import { prisma } from '../lib/prisma.js';
import { EstadoOT, Prisma } from '@prisma/client';
import {
  mockOts,
  mockTransportistas,
  mockServicios,
  mockCoberturas,
  mockTarifas,
  mockGuias,
  mockDirecciones,
  mockComprasOc,
  mockRecepciones,
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
}

/**
 * true si Prisma no pudo llegar a la base (servidor caído, URL mala). Solo en ese caso
 * se usan los datos en memoria; cualquier otro error (FK, UNIQUE, datos) se propaga.
 */
function esErrorDeConexion(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  const code = (err as { code?: string } | null)?.code;
  return typeof code === 'string' && ['P1000', 'P1001', 'P1002', 'P1003', 'P1017'].includes(code);
}

const INCLUDE_GUIA_COMPLETA = {
  ot: { include: { detalles: true } },
  transportista: true,
  servicio: true,
  direccion: { include: { comuna: { include: { region: true } } } },
  bultos: true,
  eventos: { orderBy: { fecha_hora: 'asc' as const } },
};

export interface RecepcionItemData {
  id_producto: number;
  /** Bodega de Inventario donde entran las unidades aptas de la línea */
  id_bodega: number | null;
  cantidad_esperada: number;
  cantidad_recibida: number;
  cantidad_danada: number;
  motivo_dano?: string | null;
}

export interface RecepcionData {
  id_oc: number;
  id_proveedor: number;
  nro_guia_proveedor: string;
  id_empleado_receptor: number;
  estado: string;
  observacion?: string;
  detalles: RecepcionItemData[];
}

/** Empleados de prueba de RRHH, para trabajar sin base de datos */
const EMPLEADOS_FALLBACK = [
  { id_empleado: 301, nombre: 'Carlos Gómez', cargo: 'Operador de Bodega Central' },
  { id_empleado: 302, nombre: 'Juan Tapia', cargo: 'Operador de Picking Zona Norte' },
  { id_empleado: 303, nombre: 'Loreto Silva', cargo: 'Operadora de Bodega Packing' },
  { id_empleado: 304, nombre: 'Esteban Paredes', cargo: 'Operador de Recepción y Despacho' },
];

export class LogisticaRepository {
  private fallbackOts = [...mockOts];
  private fallbackGuias = [...mockGuias];
  private fallbackCompras = [...mockComprasOc];
  private fallbackRecepciones = [...mockRecepciones];

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
   * Guía con su OT (y detalle), transportista, servicio, dirección, bultos y eventos.
   */
  async getGuiaById(id: string) {
    try {
      return await prisma.log_guia_despacho.findUnique({ where: { id }, include: INCLUDE_GUIA_COMPLETA });
    } catch (err) {
      if (!esErrorDeConexion(err)) throw err;
      return this.fallbackGuias.find((g) => g.id === id) || null;
    }
  }

  /**
   * Guías ya emitidas para una OT (para impedir una segunda guía del mismo pedido).
   */
  async getGuiasPorOt(otId: string): Promise<Array<{ id: string; estado_actual: string }>> {
    try {
      return await prisma.log_guia_despacho.findMany({
        where: { ot_id: otId },
        select: { id: true, estado_actual: true },
        orderBy: { fecha_emision: 'asc' },
      });
    } catch (err) {
      if (!esErrorDeConexion(err)) throw err;
      return this.fallbackGuias
        .filter((g) => g.ot_id === otId)
        .map((g) => ({ id: g.id, estado_actual: g.estado_actual }));
    }
  }

  /**
   * Emite una nueva Guía de Despacho en una sola transacción Prisma atómica:
   * 1. Inserta `log_guia_despacho` (queda en 'Pendiente de stock')
   * 2. Inserta `log_bulto`
   * 3. Registra el evento inicial en `log_evento_tracking`
   * El egreso de stock lo confirma Inventario por API después de esta transacción.
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
            observacion: `Guía creada para OT ${data.ot_id} con tracking ${data.num_seguimiento}. Esperando que Inventario confirme el egreso de stock.`,
          },
        });

        // Retornar la guía con todas sus relaciones
        return tx.log_guia_despacho.findUnique({
          where: { id: data.guia_id },
          include: INCLUDE_GUIA_COMPLETA,
        });
      });
    } catch (err) {
      // Solo sin base de datos se trabaja en memoria; un error de datos no debe ocultarse.
      if (!esErrorDeConexion(err)) throw err;

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
            observacion: `Guía creada para OT ${data.ot_id} con tracking ${data.num_seguimiento}. Esperando que Inventario confirme el egreso de stock.`,
          },
        ],
      };

      this.fallbackGuias.unshift(nuevaGuia);
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

  /**
   * Obtiene la lista de órdenes de compra pendientes o en proceso de recepción en muelle.
   */
  async getComprasPendientes() {
    try {
      const ocs = await prisma.comprasOc.findMany({
        include: {
          detalles: true,
        },
        orderBy: { id_oc: 'desc' },
      });

      // SKU, nombre y peso de cada línea los completa el servicio desde Inventario
      return ocs;
    } catch (err) {
      if (!esErrorDeConexion(err)) throw err;
      return this.fallbackCompras;
    }
  }

  /**
   * Obtiene una orden de compra específica por su ID (null si no existe).
   */
  async getCompraById(id_oc: number) {
    try {
      return await prisma.comprasOc.findUnique({
        where: { id_oc },
        include: { detalles: true },
      });
    } catch (err) {
      if (!esErrorDeConexion(err)) throw err;
      return this.fallbackCompras.find((c) => c.id_oc === id_oc) || null;
    }
  }

  /**
   * Empleados (por ahora la tabla de prueba de RRHH) para elegir al receptor en muelle.
   */
  async getEmpleados() {
    try {
      return await prisma.rrhhEmpleado.findMany({ orderBy: { id_empleado: 'asc' } });
    } catch (err) {
      if (!esErrorDeConexion(err)) throw err;
      return EMPLEADOS_FALLBACK;
    }
  }

  async existeEmpleado(idEmpleado: number): Promise<boolean> {
    try {
      return (await prisma.rrhhEmpleado.count({ where: { id_empleado: idEmpleado } })) > 0;
    } catch (err) {
      if (!esErrorDeConexion(err)) throw err;
      return EMPLEADOS_FALLBACK.some((e) => e.id_empleado === idEmpleado);
    }
  }

  /** true si la guía del proveedor ya se registró para esa OC */
  async existeRecepcion(idOc: number, nroGuiaProveedor: string): Promise<boolean> {
    try {
      const previa = await prisma.log_recepcion.findFirst({
        where: { id_oc: idOc, nro_guia_proveedor: nroGuiaProveedor },
        select: { id: true },
      });
      return previa !== null;
    } catch (err) {
      if (!esErrorDeConexion(err)) throw err;
      return this.fallbackRecepciones.some(
        (r: any) => r.id_oc === idOc && r.nro_guia_proveedor === nroGuiaProveedor
      );
    }
  }

  /**
   * Registra el acta de recepción en muelle en una transacción atómica:
   * 1. Inserta `log_recepcion` (con proveedor y guía del proveedor)
   * 2. Inserta `log_recepcion_detalle` con conteo de unidades recibidas vs dañadas y bodega
   * 3. Actualiza el estado de la Orden de Compra
   * El ingreso de stock lo registra Inventario por API antes de esta transacción.
   */
  async registrarRecepcionTransaccional(data: RecepcionData) {
    try {
      return await prisma.$transaction(async (tx: any) => {
        // 1. Crear acta de recepción
        const recepcionCreada = await tx.log_recepcion.create({
          data: {
            id_oc: data.id_oc,
            id_proveedor: data.id_proveedor,
            nro_guia_proveedor: data.nro_guia_proveedor,
            id_empleado_receptor: data.id_empleado_receptor,
            estado: data.estado,
            observacion: data.observacion || 'Recepción en muelle conforme',
          },
        });

        // 2. Crear líneas de recepción
        for (const det of data.detalles) {
          await tx.log_recepcion_detalle.create({
            data: {
              recepcion_id: recepcionCreada.id,
              id_producto: det.id_producto,
              id_bodega: det.id_bodega,
              cantidad_esperada: det.cantidad_esperada,
              cantidad_recibida: det.cantidad_recibida,
              cantidad_danada: det.cantidad_danada,
              motivo_dano: det.motivo_dano || null,
            },
          });
        }

        // 3. Actualizar estado de la Orden de Compra
        await tx.comprasOc.update({
          where: { id_oc: data.id_oc },
          data: {
            estado: data.estado === 'CONFORME' ? 'RECIBIDA' : 'PARCIAL',
          },
        });

        // Retornar la recepción con sus líneas
        return tx.log_recepcion.findUnique({
          where: { id: recepcionCreada.id },
          include: { detalles: true },
        });
      });
    } catch (err) {
      // Solo sin base de datos se trabaja en memoria; un error de datos (FK, UNIQUE) se propaga.
      if (!esErrorDeConexion(err)) throw err;

      // Fallback en memoria si la BD no está disponible
      const nuevaRecepcion = {
        id: this.fallbackRecepciones.length + 1,
        id_oc: data.id_oc,
        id_proveedor: data.id_proveedor,
        nro_guia_proveedor: data.nro_guia_proveedor,
        id_empleado_receptor: data.id_empleado_receptor,
        nombre_empleado: 'P. Pérez (Operador Bodega)',
        fecha_recepcion: new Date().toISOString(),
        estado: data.estado,
        observacion: data.observacion || 'Recepción en muelle registrada en fallback',
        detalles: data.detalles.map((d, idx) => ({
          id: Date.now() + idx,
          recepcion_id: this.fallbackRecepciones.length + 1,
          ...d,
        })),
      };

      this.fallbackRecepciones.unshift(nuevaRecepcion);

      // Actualizar estado en fallback compras
      const oc = this.fallbackCompras.find((c) => c.id_oc === data.id_oc);
      if (oc) {
        oc.estado = data.estado === 'CONFORME' ? 'RECIBIDA' : 'PARCIAL';
      }

      return nuevaRecepcion;
    }
  }

  /**
   * Consulta el historial de recepciones realizadas en muelle.
   */
  async getHistorialRecepciones() {
    try {
      return await prisma.log_recepcion.findMany({
        include: {
          detalles: true,
        },
        orderBy: { fecha_recepcion: 'desc' },
      });
    } catch (err) {
      return this.fallbackRecepciones;
    }
  }
}
