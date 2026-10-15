import { prisma } from '../lib/prisma.js';
import { EstadoOT, Prisma } from '@prisma/client';
import {
  mockOts,
  mockTransportistas,
  mockServicios,
  mockCoberturas,
  mockTarifas,
  mockGuias,
  mockInvMov,
  mockDirecciones,
} from './fallbackData.js';

export interface FiltrosTracking {
  estado?: string;
  transportista?: string;
  fecha?: string;
  busqueda?: string;
}

export interface EmisionGuiaData {
  guia_id: string;
  ot_id: string;
  transportista_id: number;
  servicio_id: number;
  direccion_id: number;
  num_seguimiento: string;
  factor_volumetrico_aplicado: number;
  peso_real_total_kg: number;
  peso_volumetrico_total_kg: number;
  costo_envio: number;
  estado_inicial: string;
  usuario_responsable: string;
  bultos: Array<{
    largo_cm: number;
    alto_cm: number;
    ancho_cm: number;
    peso_real_kg: number;
    peso_volumetrico_kg: number;
  }>;
  items_inventario: Array<{
    id_producto: number;
    cantidad: number;
    referencia_origen: string;
  }>;
}

export class LogisticaRepository {
  private fallbackOts = [...mockOts];
  private fallbackGuias = [...mockGuias];
  private fallbackInvMov = [...mockInvMov];

  /**
   * Obtiene la lista de órdenes de trabajo disponibles (picking) con datos de cliente y dirección.
   */
  async getPedidosPendientes() {
    try {
      return await prisma.log_ot_picking.findMany({
        include: {
          direccion: {
            include: {
              comuna: {
                include: {
                  region: true,
                },
              },
            },
          },
          detalles: true,
          guias: {
            select: {
              id: true,
              num_seguimiento: true,
              estado_actual: true,
              fecha_emision: true,
            },
          },
        },
        orderBy: {
          fecha_creacion: 'desc',
        },
      });
    } catch (err) {
      // Fallback si la BD no está corriendo en el host local
      return this.fallbackOts;
    }
  }

  /**
   * Busca una OT por su identificador único (ej: "OT-4091").
   */
  async getOtById(id: string) {
    try {
      return await prisma.log_ot_picking.findUnique({
        where: { id },
        include: {
          detalles: true,
          direccion: {
            include: {
              comuna: {
                include: {
                  region: true,
                },
              },
            },
          },
          guias: {
            include: {
              transportista: true,
              servicio: true,
              eventos: {
                orderBy: { fecha_hora: 'asc' },
              },
              bultos: true,
            },
          },
        },
      });
    } catch (err) {
      return this.fallbackOts.find((o) => o.id === id) || null;
    }
  }

  /**
   * Verifica si existe cobertura vigente para un servicio y comuna.
   */
  async getCoberturaActiva(servicio_id: number, comuna_id: number) {
    try {
      const ahora = new Date();
      return await prisma.log_cobertura.findFirst({
        where: {
          servicio_id,
          comuna_id,
          vigente: true,
          vigencia_desde: { lte: ahora },
          vigencia_hasta: { gte: ahora },
        },
      });
    } catch (err) {
      const match = mockCoberturas.find(
        (c) => c.servicio_id === servicio_id && c.comuna_id === comuna_id
      );
      if (match && match.vigente) {
        return {
          id: match.id,
          servicio_id: match.servicio_id,
          comuna_id: match.comuna_id,
          vigente: true,
          vigencia_desde: new Date(),
          vigencia_hasta: new Date(Date.now() + 86400000 * 365),
        };
      }
      return null;
    }
  }

  /**
   * Obtiene la tarifa configurada para un servicio, comuna y rango de peso.
   */
  async getTarifa(servicio_id: number, comuna_id: number, peso_kg: number) {
    try {
      const ahora = new Date();
      return await prisma.log_tarifa.findFirst({
        where: {
          servicio_id,
          comuna_id,
          vigencia_desde: { lte: ahora },
          vigencia_hasta: { gte: ahora },
          peso_desde_kg: { lte: peso_kg },
        },
        orderBy: {
          peso_hasta_kg: 'desc',
        },
      });
    } catch (err) {
      const t = mockTarifas.find(
        (x) => x.servicio_id === servicio_id && x.comuna_id === comuna_id
      );
      return t || null;
    }
  }

  /**
   * Obtiene datos del transportista por ID.
   */
  async getTransportistaById(id: number) {
    try {
      return await prisma.log_transportista.findUnique({
        where: { id },
        include: {
          servicios: {
            where: { activo: true },
          },
        },
      });
    } catch (err) {
      return mockTransportistas.find((t) => t.id === id) || null;
    }
  }

  /**
   * Obtiene datos del servicio por ID.
   */
  async getServicioById(id: number) {
    try {
      return await prisma.log_servicio.findUnique({
        where: { id },
        include: {
          transportista: true,
        },
      });
    } catch (err) {
      return mockServicios.find((s) => s.id === id) || null;
    }
  }

  /**
   * Obtiene todos los transportistas activos con sus servicios.
   */
  async getTransportistasActivos() {
    try {
      return await prisma.log_transportista.findMany({
        where: { activo: true },
        include: {
          servicios: {
            where: { activo: true },
          },
        },
        orderBy: { nombre: 'asc' },
      });
    } catch (err) {
      return mockTransportistas.filter((t) => t.activo);
    }
  }

  /**
   * Emite una nueva Guía de Despacho en una sola transacción Prisma atómica:
   * 1. Inserta `log_guia_despacho`
   * 2. Inserta `log_bulto`
   * 3. Registra el evento inicial en `log_evento_tracking`
   * 4. Registra los movimientos de salida en `inv_mov`
   */
  async emitirGuiaTransaccional(data: EmisionGuiaData) {
    try {
      return await prisma.$transaction(async (tx: any) => {
        // 1. Crear la Guía de Despacho
        const guiaCreada = await tx.log_guia_despacho.create({
          data: {
            id: data.guia_id,
            ot_id: data.ot_id,
            transportista_id: data.transportista_id,
            servicio_id: data.servicio_id,
            direccion_id: data.direccion_id,
            num_seguimiento: data.num_seguimiento,
            factor_volumetrico_aplicado: data.factor_volumetrico_aplicado,
            peso_real_total_kg: data.peso_real_total_kg,
            peso_volumetrico_total_kg: data.peso_volumetrico_total_kg,
            costo_envio: data.costo_envio,
            estado_actual: data.estado_inicial,
          },
        });

        // 2. Crear los bultos asociados
        for (const b of data.bultos) {
          await tx.log_bulto.create({
            data: {
              guia_id: data.guia_id,
              largo_cm: b.largo_cm,
              alto_cm: b.alto_cm,
              ancho_cm: b.ancho_cm,
              peso_real_kg: b.peso_real_kg,
              peso_volumetrico_kg: b.peso_volumetrico_kg,
            },
          });
        }

        // 3. Registrar el evento inicial en la bitácora de seguimiento
        await tx.log_evento_tracking.create({
          data: {
            guia_id: data.guia_id,
            estado: data.estado_inicial,
            usuario_responsable: data.usuario_responsable,
            observacion: `Guía emitida exitosamente para OT ${data.ot_id} con tracking ${data.num_seguimiento}`,
          },
        });

        // 4. Registrar movimientos de inventario de tipo 'SALIDA'
        for (const item of data.items_inventario) {
          await tx.inv_mov.create({
            data: {
              id_producto: item.id_producto,
              tipo: 'SALIDA',
              cantidad: item.cantidad,
              referencia_origen: item.referencia_origen,
            },
          });
        }

        // Retornar la guía con todas sus relaciones
        return tx.log_guia_despacho.findUnique({
          where: { id: data.guia_id },
          include: {
            ot: {
              include: {
                detalles: true,
              },
            },
            transportista: true,
            servicio: true,
            direccion: {
              include: {
                comuna: {
                  include: {
                    region: true,
                  },
                },
              },
            },
            bultos: true,
            eventos: {
              orderBy: { fecha_hora: 'asc' },
            },
          },
        });
      });
    } catch (err) {
      // Fallback transaccional en memoria
      const transportista = mockTransportistas.find((t) => t.id === data.transportista_id);
      const servicio = mockServicios.find((s) => s.id === data.servicio_id);
      const ot = this.fallbackOts.find((o) => o.id === data.ot_id);
      const direccion = mockDirecciones.find((d) => d.id === data.direccion_id);

      const nuevaGuia: any = {
        id: data.guia_id,
        ot_id: data.ot_id,
        transportista_id: data.transportista_id,
        servicio_id: data.servicio_id,
        direccion_id: data.direccion_id,
        num_seguimiento: data.num_seguimiento,
        factor_volumetrico_aplicado: data.factor_volumetrico_aplicado,
        peso_real_total_kg: data.peso_real_total_kg,
        peso_volumetrico_total_kg: data.peso_volumetrico_total_kg,
        costo_envio: data.costo_envio,
        estado_actual: data.estado_inicial,
        fecha_emision: new Date().toISOString(),
        ot,
        transportista,
        servicio,
        direccion,
        bultos: data.bultos.map((b, idx) => ({ ...b, id: 100 + idx, guia_id: data.guia_id })),
        eventos: [
          {
            id: Date.now(),
            guia_id: data.guia_id,
            estado: data.estado_inicial,
            fecha_hora: new Date().toISOString(),
            usuario_responsable: data.usuario_responsable,
            observacion: `Guía emitida exitosamente para OT ${data.ot_id} con tracking ${data.num_seguimiento}`,
          },
        ],
      };

      this.fallbackGuias.unshift(nuevaGuia);

      for (const item of data.items_inventario) {
        this.fallbackInvMov.push({
          id: Date.now(),
          id_producto: item.id_producto,
          tipo: 'SALIDA',
          cantidad: item.cantidad,
          referencia_origen: item.referencia_origen,
          fecha: new Date().toISOString(),
        });
      }

      return nuevaGuia;
    }
  }

  /**
   * Consulta guías de tracking con soporte de filtros.
   */
  async getTrackingGuias(filtros: FiltrosTracking) {
    try {
      const where: any = {};

      if (filtros.estado && filtros.estado.trim() !== '') {
        where.estado_actual = {
          equals: filtros.estado,
          mode: 'insensitive',
        };
      }

      if (filtros.transportista && filtros.transportista.trim() !== '') {
        where.transportista = {
          nombre: {
            contains: filtros.transportista,
            mode: 'insensitive',
          },
        };
      }

      if (filtros.fecha && filtros.fecha.trim() !== '') {
        const fechaInicio = new Date(filtros.fecha);
        fechaInicio.setHours(0, 0, 0, 0);
        const fechaFin = new Date(filtros.fecha);
        fechaFin.setHours(23, 59, 59, 999);

        where.fecha_emision = {
          gte: fechaInicio,
          lte: fechaFin,
        };
      }

      if (filtros.busqueda && filtros.busqueda.trim() !== '') {
        const q = filtros.busqueda.trim();
        where.OR = [
          { id: { contains: q, mode: 'insensitive' } },
          { num_seguimiento: { contains: q, mode: 'insensitive' } },
          { ot_id: { contains: q, mode: 'insensitive' } },
          {
            ot: {
              cliente_nombre: { contains: q, mode: 'insensitive' },
            },
          },
          {
            direccion: {
              cliente_nombre: { contains: q, mode: 'insensitive' },
            },
          },
        ];
      }

      return await prisma.log_guia_despacho.findMany({
        where,
        include: {
          ot: {
            include: {
              detalles: true,
            },
          },
          transportista: true,
          servicio: true,
          direccion: {
            include: {
              comuna: {
                include: {
                  region: true,
                },
              },
            },
          },
          bultos: true,
          eventos: {
            orderBy: { fecha_hora: 'asc' },
          },
        },
        orderBy: {
          fecha_emision: 'desc',
        },
      });
    } catch (err) {
      // Filtrado en memoria
      return this.fallbackGuias.filter((g) => {
        if (filtros.estado && g.estado_actual.toLowerCase() !== filtros.estado.toLowerCase()) {
          return false;
        }
        if (
          filtros.transportista &&
          !g.transportista?.nombre.toLowerCase().includes(filtros.transportista.toLowerCase())
        ) {
          return false;
        }
        if (filtros.fecha) {
          const gFecha = new Date(g.fecha_emision).toISOString().split('T')[0];
          if (gFecha !== filtros.fecha) return false;
        }
        if (filtros.busqueda) {
          const q = filtros.busqueda.toLowerCase();
          const matchId = g.id.toLowerCase().includes(q);
          const matchTracking = g.num_seguimiento.toLowerCase().includes(q);
          const matchOt = g.ot_id.toLowerCase().includes(q);
          const matchCli = (g.ot?.cliente_nombre || g.direccion?.cliente_nombre || '')
            .toLowerCase()
            .includes(q);
          if (!matchId && !matchTracking && !matchOt && !matchCli) return false;
        }
        return true;
      });
    }
  }

  /**
   * Agrega un nuevo evento a la bitácora de seguimiento (append-only)
   * y actualiza el campo denormalizado `estado_actual` en la guía.
   */
  async registrarEventoTracking(
    guia_id: string,
    estado: string,
    usuario_responsable: string,
    observacion: string
  ) {
    try {
      return await prisma.$transaction(async (tx: any) => {
        // 1. Insertar nuevo evento
        const nuevoEvento = await tx.log_evento_tracking.create({
          data: {
            guia_id,
            estado,
            usuario_responsable,
            observacion,
          },
        });

        // 2. Actualizar campo denormalizado en la guía
        const guiaActualizada = await tx.log_guia_despacho.update({
          where: { id: guia_id },
          data: {
            estado_actual: estado,
          },
          include: {
            ot: true,
            transportista: true,
            servicio: true,
            direccion: {
              include: {
                comuna: true,
              },
            },
            bultos: true,
            eventos: {
              orderBy: { fecha_hora: 'asc' },
            },
          },
        });

        return { nuevoEvento, guia: guiaActualizada };
      });
    } catch (err) {
      // Fallback append-only en memoria
      const guia = this.fallbackGuias.find((g) => g.id === guia_id);
      if (!guia) {
        throw new Error(`La guía ${guia_id} no fue encontrada.`);
      }

      const nuevoEvento = {
        id: Date.now(),
        guia_id,
        estado,
        fecha_hora: new Date().toISOString(),
        usuario_responsable: usuario_responsable || 'M. Pizarro',
        observacion,
      };

      if (!guia.eventos) guia.eventos = [];
      guia.eventos.push(nuevoEvento);
      guia.estado_actual = estado;

      return { nuevoEvento, guia };
    }
  }
}
