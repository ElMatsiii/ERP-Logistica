import { LogisticaRepository, EmisionGuiaData } from '../repositories/logistica.repository.js';
import { cubicarBultos, calcularCostoEnvio, BultoInput } from '../domain/cubicacion.js';
import { prisma } from '../lib/prisma.js';

export interface CotizarEnvioInput {
  comuna_destino: string;
  peso_kg?: number;
  productos?: Array<{
    id_producto: number;
    cantidad: number;
    peso_unitario_kg?: number;
    largo_cm?: number;
    alto_cm?: number;
    ancho_cm?: number;
  }>;
}

export interface SolicitarDespachoInput {
  id_pedido: number | string;
  cliente_nombre?: string;
  cliente_rut?: string;
  direccion_entrega: string;
  comuna_entrega: string;
  ciudad_entrega?: string;
  telefono_contacto?: string;
  transportista_preferido?: string;
  productos: Array<{
    id_producto: number;
    sku?: string;
    nombre?: string;
    cantidad: number;
    peso_unitario_kg?: number;
    largo_cm?: number;
    alto_cm?: number;
    ancho_cm?: number;
  }>;
}

export class VentasIntegrationService {
  private repository: LogisticaRepository;

  constructor(repository?: LogisticaRepository) {
    this.repository = repository || new LogisticaRepository();
  }

  /**
   * Obtiene la lista de pedidos pagados en el módulo de ecommerce_ventas
   * con sus datos de entrega y productos reales.
   */
  async getPedidosPendientes() {
    try {
      // 1. Consultar pedidos reales en estado 'pagada' / 'Pagada'
      const pedidosReales: any[] = await prisma.$queryRawUnsafe(`
        SELECT p.id_pedido, p.id_cliente, p.fecha_pedido, p.monto_total, p.estado,
               p.direccion_entrega, p.comuna_entrega, p.ciudad_entrega, p.telefono_contacto,
               p.metodo_pago, p.observaciones
        FROM ecommerce_ventas.ecom_pedido p
        WHERE LOWER(p.estado) = 'pagada'
        ORDER BY p.id_pedido DESC;
      `);

      if (pedidosReales && pedidosReales.length > 0) {
        // Cargar detalles de cada pedido
        const pedidosConDetalles = await Promise.all(
          pedidosReales.map(async (ped) => {
            let detalles: any[] = [];
            try {
              detalles = await prisma.$queryRawUnsafe(`
                SELECT d.id_detalle_ped, d.id_pedido, d.id_producto, d.cantidad, d.precio_unitario,
                       prod.sku, prod.nombre_set AS nombre_producto, prod.cant_piezas
                FROM ecommerce_ventas.ecom_detalle_pedido d
                LEFT JOIN inventario.inv_producto prod ON d.id_producto = prod.id_producto
                WHERE d.id_pedido = $1;
              `, ped.id_pedido);
            } catch (err) {
              detalles = [];
            }

            return {
              id_pedido: ped.id_pedido,
              numero_pedido: `PED-${String(ped.id_pedido).padStart(5, '0')}`,
              id_cliente: ped.id_cliente,
              cliente_nombre: ped.cliente_nombre || `Cliente #${ped.id_cliente}`,
              fecha_pedido: ped.fecha_pedido,
              monto_total: Number(ped.monto_total),
              estado: ped.estado,
              direccion_entrega: ped.direccion_entrega || 'Dirección no especificada',
              comuna_entrega: ped.comuna_entrega || 'La Serena',
              ciudad_entrega: ped.ciudad_entrega || ped.comuna_entrega || 'La Serena',
              telefono_contacto: ped.telefono_contacto || '+56900000000',
              metodo_pago: ped.metodo_pago || 'Webpay',
              productos: detalles.map((d) => ({
                id_producto: d.id_producto,
                sku: d.sku || `LEGO-${d.id_producto}`,
                nombre: d.nombre_producto || `Set LEGO #${d.id_producto}`,
                cantidad: d.cantidad,
                precio_unitario: Number(d.precio_unitario || 0),
                peso_unitario_kg: Math.max(0.4, Number((d.cant_piezas ? d.cant_piezas * 0.0018 : 2.0).toFixed(2))),
              })),
            };
          })
        );
        return pedidosConDetalles;
      }
    } catch (err) {
      console.warn('[VentasIntegration] Error al consultar ecommerce_ventas.ecom_pedido, usando fallback:', (err as Error).message);
    }

    // Fallback: Si no hay conexión o no hay filas, retornamos pedidos mock sincronizados
    return [
      {
        id_pedido: 15,
        numero_pedido: 'PED-00015',
        id_cliente: 1,
        cliente_nombre: 'Martín Almeyda',
        fecha_pedido: '2026-11-15T00:00:00.000Z',
        monto_total: 120000,
        estado: 'Pagada',
        direccion_entrega: 'Balmaceda 1234',
        comuna_entrega: 'La Serena',
        ciudad_entrega: 'La Serena',
        telefono_contacto: '912345678',
        metodo_pago: 'tarjeta',
        productos: [
          {
            id_producto: 4,
            sku: '60271-1',
            nombre: 'Main Square (Sets LEGO City)',
            cantidad: 1,
            precio_unitario: 120000,
            peso_unitario_kg: 2.5,
          },
        ],
      },
      {
        id_pedido: 16,
        numero_pedido: 'PED-00016',
        id_cliente: 1,
        cliente_nombre: 'Martín Almeyda',
        fecha_pedido: '2026-11-15T00:00:00.000Z',
        monto_total: 80000,
        estado: 'Pagada',
        direccion_entrega: 'Balmaceda 1234',
        comuna_entrega: 'La Serena',
        ciudad_entrega: 'La Serena',
        telefono_contacto: '912345678',
        metodo_pago: 'tarjeta',
        productos: [
          {
            id_producto: 2,
            sku: '60473-1',
            nombre: 'The City Tower',
            cantidad: 1,
            precio_unitario: 80000,
            peso_unitario_kg: 1.8,
          },
        ],
      },
    ];
  }

  /**
   * Endpoint de cotización previa para el ecommerce (Preguntar: precio y tipo de envío).
   */
  async cotizarOpcionesEnvio(input: CotizarEnvioInput) {
    const comunaBuscada = (input.comuna_destino || 'La Serena').trim();
    const comunas = await this.repository.getComunas();
    const comuna =
      comunas.find((c: any) => c.nombre.toLowerCase().includes(comunaBuscada.toLowerCase())) ||
      comunas.find((c: any) => c.id === 101) || // La Serena por defecto
      comunas[0];

    const comunaId = comuna ? comuna.id : 101;
    const comunaNombre = comuna ? comuna.nombre : comunaBuscada;

    // Determinar peso y dimensiones de bultos
    let bultos: BultoInput[] = [];
    if (input.productos && input.productos.length > 0) {
      bultos = input.productos.map((p) => ({
        largo_cm: p.largo_cm || 40,
        alto_cm: p.alto_cm || 30,
        ancho_cm: p.ancho_cm || 20,
        peso_real_kg: Math.max(0.5, (p.peso_unitario_kg || 2.0) * p.cantidad),
      }));
    } else {
      const pesoEstimado = Math.max(0.5, Number(input.peso_kg || 2.5));
      bultos = [
        {
          largo_cm: 40,
          alto_cm: 30,
          ancho_cm: 20,
          peso_real_kg: pesoEstimado,
        },
      ];
    }

    const transportistas = await this.repository.getTransportistasActivos();
    const opciones: any[] = [];

    for (const t of transportistas) {
      const factorVol = t.factor_volumetrico_default || 5000;
      const cub = cubicarBultos(bultos, factorVol);

      for (const s of t.servicios || []) {
        const cobertura = await this.repository.getCoberturaActiva(s.id, comunaId);
        if (cobertura && cobertura.vigente) {
          const tarifa = await this.repository.getTarifa(s.id, comunaId, cub.peso_cobrado_total_kg);
          const costo = tarifa
            ? calcularCostoEnvio(cub.peso_cobrado_total_kg, {
                peso_desde_kg: Number(tarifa.peso_desde_kg),
                peso_hasta_kg: Number(tarifa.peso_hasta_kg),
                precio_base: Number(tarifa.precio_base),
                precio_kg_adicional: Number(tarifa.precio_kg_adicional),
              })
            : calcularCostoEnvio(cub.peso_cobrado_total_kg, null);

          opciones.push({
            transportista_id: t.id,
            transportista: t.nombre,
            servicio_id: s.id,
            tipo_envio: s.nombre,
            dias_entrega_estimados: s.dias_transito_comprometidos,
            peso_facturable_kg: cub.peso_cobrado_total_kg,
            precio_envio: costo,
            cobertura: true,
          });
        }
      }
    }

    // Ordenar opciones por precio ascendente
    opciones.sort((a, b) => a.precio_envio - b.precio_envio);

    return {
      comuna_destino: comunaNombre,
      total_bultos: bultos.length,
      peso_cobrado_kg: opciones[0]?.peso_facturable_kg || 2.5,
      opciones_envio: opciones,
    };
  }

  /**
   * Recibe el pedido de ventas, genera la Guía de Despacho, el código de seguimiento
   * y responde con el recibo de tracking y precio.
   */
  async solicitarDespacho(input: SolicitarDespachoInput) {
    if (!input.id_pedido) {
      throw new Error('El campo id_pedido es requerido para solicitar despacho.');
    }
    if (!input.direccion_entrega || !input.comuna_entrega) {
      throw new Error('Se requiere dirección y comuna de entrega.');
    }

    // 1. Resolver comuna
    const comunas = await this.repository.getComunas();
    const comuna =
      comunas.find((c: any) => c.nombre.toLowerCase().includes(input.comuna_entrega.toLowerCase())) ||
      comunas.find((c: any) => c.id === 101) ||
      comunas[0];
    const comunaId = comuna ? comuna.id : 101;

    // 2. Resolver productos y bultos
    const productos = input.productos && input.productos.length > 0 ? input.productos : [{ id_producto: 1, cantidad: 1 }];
    const bultos: BultoInput[] = productos.map((p) => ({
      largo_cm: p.largo_cm || 40,
      alto_cm: p.alto_cm || 30,
      ancho_cm: p.ancho_cm || 20,
      peso_real_kg: Math.max(0.5, (p.peso_unitario_kg || 2.0) * p.cantidad),
    }));

    // 3. Resolver transportista y servicio
    const transportistas = await this.repository.getTransportistasActivos();
    let transportistaSeleccionado = transportistas[0];
    if (input.transportista_preferido) {
      const match = transportistas.find((t) =>
        t.nombre.toLowerCase().includes(input.transportista_preferido!.toLowerCase())
      );
      if (match) transportistaSeleccionado = match;
    }

    const servicioSeleccionado =
      transportistaSeleccionado.servicios?.[0] || {
        id: 1,
        nombre: `${transportistaSeleccionado.nombre} Estándar`,
        dias_transito_comprometidos: 2,
      };

    const factorVol = transportistaSeleccionado.factor_volumetrico_default || 5000;
    const cubicacion = cubicarBultos(bultos, factorVol);

    const tarifa = await this.repository.getTarifa(
      servicioSeleccionado.id,
      comunaId,
      cubicacion.peso_cobrado_total_kg
    );
    const costoEnvio = tarifa
      ? calcularCostoEnvio(cubicacion.peso_cobrado_total_kg, {
          peso_desde_kg: Number(tarifa.peso_desde_kg),
          peso_hasta_kg: Number(tarifa.peso_hasta_kg),
          precio_base: Number(tarifa.precio_base),
          precio_kg_adicional: Number(tarifa.precio_kg_adicional),
        })
      : calcularCostoEnvio(cubicacion.peso_cobrado_total_kg, null);

    // 4. Generar identificadores únicos de Guía y Seguimiento
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const prefix = transportistaSeleccionado.nombre.toUpperCase().includes('STARKEN')
      ? 'STK'
      : transportistaSeleccionado.nombre.toUpperCase().includes('BLUE')
      ? 'BLU'
      : 'CHI';
    const numSeguimiento = `${prefix}-${randomSuffix}-CL`;
    const guiaId = `GD-${Math.floor(52000 + Math.random() * 9000)}`;
    const otId = `OT-ECOM-${input.id_pedido}`;

    const fechaEstimadaEntrega = new Date();
    fechaEstimadaEntrega.setDate(
      fechaEstimadaEntrega.getDate() + (servicioSeleccionado.dias_transito_comprometidos || 2)
    );

    // 5. Asegurar OT en log_ot_picking si se usa base de datos
    try {
      await prisma.log_ot_picking.upsert({
        where: { id: otId },
        update: {},
        create: {
          id: otId,
          id_pedido: String(input.id_pedido),
          id_operador: 301,
          nombre_operador: 'Sistema Picking Automático E-commerce',
          estado: 'CERRADO',
          cliente_nombre: input.cliente_nombre || 'Cliente Web',
          cliente_rut: input.cliente_rut || '11.111.111-1',
          direccion_id: 1,
        },
      });
    } catch (err) {
      // Ignorar si falla por constraints
    }

    // 6. Registrar Guía en el repositorio
    const guiaData: EmisionGuiaData = {
      guia_id: guiaId,
      ot_id: otId,
      transportista_id: transportistaSeleccionado.id,
      servicio_id: servicioSeleccionado.id,
      direccion_id: 1,
      num_seguimiento: numSeguimiento,
      factor_volumetrico_aplicado: factorVol,
      peso_real_total_kg: cubicacion.peso_real_total_kg,
      peso_volumetrico_total_kg: cubicacion.peso_volumetrico_total_kg,
      costo_envio: costoEnvio,
      estado_inicial: 'PREPARADO',
      usuario_responsable: 'Integración E-commerce Ventas',
      bultos: cubicacion.bultos.map((b) => ({
        largo_cm: b.largo_cm,
        alto_cm: b.alto_cm,
        ancho_cm: b.ancho_cm,
        peso_real_kg: b.peso_real_kg,
        peso_volumetrico_kg: b.peso_volumetrico_kg,
      })),
      items_inventario: productos.map((p) => ({
        id_producto: p.id_producto,
        cantidad: p.cantidad,
        referencia_origen: `PEDIDO-${input.id_pedido}`,
      })),
    };

    await this.repository.emitirGuiaTransaccional(guiaData);

    // 7. Actualización cruzada en ecommerce_ventas.ecom_pedido -> 'enviada'
    try {
      const pedidoNum = Number(input.id_pedido);
      if (!isNaN(pedidoNum)) {
        await prisma.$queryRawUnsafe(`
          UPDATE ecommerce_ventas.ecom_pedido
          SET estado = 'enviada'
          WHERE id_pedido = $1;
        `, pedidoNum);
        console.log(`[VentasIntegration] Estado del pedido #${pedidoNum} actualizado a 'enviada' en Neon.`);
      }
    } catch (err) {
      console.warn('[VentasIntegration] No se pudo actualizar estado en ecommerce_ventas.ecom_pedido:', (err as Error).message);
    }

    // 8. Retornar el recibo estructurado que Ventas especificó
    return {
      status: 'ok',
      mensaje: 'Despacho recepcionado y programado exitosamente',
      id_pedido: input.id_pedido,
      codigo_seguimiento: numSeguimiento,
      num_seguimiento: numSeguimiento,
      guia_despacho_id: guiaId,
      transportista: transportistaSeleccionado.nombre,
      tipo_envio: servicioSeleccionado.nombre,
      precio_envio: costoEnvio,
      estado_envio: 'PREPARADO',
      dias_transito_estimados: servicioSeleccionado.dias_transito_comprometidos,
      fecha_estimada_entrega: fechaEstimadaEntrega.toISOString(),
      tracking_url: `http://localhost:3001/api/logistica/ventas/tracking/${input.id_pedido}`,
    };
  }

  /**
   * Consulta el tracking de un envío por ID de Pedido o Número de Seguimiento.
   */
  async consultarTracking(criterio: string | number) {
    const q = String(criterio).trim();

    // 1. Buscar en BD
    let guia: any = null;
    try {
      const guias = await this.repository.getTrackingGuias({ busqueda: q });
      guia = guias.find(
        (g: any) =>
          g.num_seguimiento.toLowerCase() === q.toLowerCase() ||
          g.id.toLowerCase() === q.toLowerCase() ||
          g.ot_id.toLowerCase().includes(q.toLowerCase()) ||
          (g.ot && String(g.ot.id_pedido) === q)
      );

      if (!guia) {
        const todas = await this.repository.getTrackingGuias({});
        guia = todas.find(
          (g: any) =>
            g.num_seguimiento.toLowerCase().includes(q.toLowerCase()) ||
            g.ot_id.toLowerCase().includes(q.toLowerCase()) ||
            (g.ot && String(g.ot.id_pedido).includes(q))
        );
      }
    } catch (err) {
      // Si falla BD, guia es null
    }

    // 2. Si no se encontró en BD, buscar en memoria fallback
    if (!guia) {
      const fallbackGuias = this.repository.getFallbackGuias();
      guia = fallbackGuias.find(
        (g: any) =>
          g.num_seguimiento.toLowerCase().includes(q.toLowerCase()) ||
          g.id.toLowerCase().includes(q.toLowerCase()) ||
          g.ot_id.toLowerCase().includes(q.toLowerCase()) ||
          (g.ot && String(g.ot.id_pedido).includes(q))
      );
    }

    if (!guia) {
      return {
        encontrado: false,
        criterio: q,
        mensaje: `No se encontró guía de despacho activa para el criterio: ${q}`,
        estado_actual: 'SIN_DESPACHO',
      };
    }

    return {
      encontrado: true,
      id_pedido: guia.ot?.id_pedido || q,
      codigo_seguimiento: guia.num_seguimiento,
      guia_despacho_id: guia.id,
      transportista: guia.transportista?.nombre || 'Chilexpress',
      tipo_envio: guia.servicio?.nombre || 'Estándar',
      precio_envio: Number(guia.costo_envio),
      estado_actual: guia.estado_actual,
      fecha_emision: guia.fecha_emision,
      direccion_destino: guia.direccion
        ? `${guia.direccion.calle} ${guia.direccion.numero}, ${guia.direccion.comuna?.nombre}`
        : 'La Serena, IV Región',
      historial_eventos: (guia.eventos || []).map((e: any) => ({
        fecha: e.fecha_hora,
        estado: e.estado,
        observacion: e.observacion,
        responsable: e.usuario_responsable,
      })),
    };
  }
}
