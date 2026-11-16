import { InventarioError } from './errores.js';
import type {
  BodegaInventario,
  ClienteInventario,
  DespachoInventarioInput,
  EstadoConexionInventario,
  MovimientoInventario,
  ProductoInventario,
  RecepcionInventarioInput,
  ReservaPedidoInventario,
  ResultadoDespachoInventario,
  ResultadoRecepcionInventario,
  StockBodegaInventario,
} from './tipos.js';

/**
 * Cliente simulado: se usa cuando INVENTARIO_API_URL está vacía, para trabajar y hacer la demo
 * sin el backend de Inventario. Imita sus reglas y respuestas (400, 404, 409 e idempotencia),
 * guarda todo en memoria y se reinicia con el servidor.
 *
 * Límites conocidos:
 * - El catálogo son los productos de prueba de nuestro seed (IDs = número de set LEGO).
 * - No conoce las líneas reales de los pedidos: una reserva simulada nace PENDIENTE y sin líneas.
 * - Despacho y recepción no validan que el producto exista ni descuentan stock.
 */

const PRODUCTOS_SIMULADOS: Array<[number, string, string, number, number, number, number]> = [
  // id, sku, nombre, peso kg, largo, alto, ancho
  [75192, '75192-1', 'Millennium Falcon UCS', 13.2, 53, 46, 38],
  [75252, '75252-1', 'Imperial Star Destroyer UCS', 12.5, 53, 46, 38],
  [75288, '75288-1', 'AT-AT Walker', 2.1, 48, 37.8, 9.4],
  [76240, '76240-1', 'Batmobile Tumbler', 2.8, 45, 30, 15],
  [71741, '71741-1', 'NINJAGO City Gardens', 5.6, 58.2, 48, 17],
  [10294, '10294-1', 'Titanic', 14.5, 60, 50, 40],
  [71043, '71043-1', 'Hogwarts Castle', 7.5, 60, 51, 20],
  [10283, '10283-1', 'NASA Space Shuttle Discovery', 3.2, 58, 37, 11],
  [10295, '10295-1', 'Porsche 911', 1.8, 48, 28.2, 11.8],
  [10278, '10278-1', 'Police Station', 2.9, 58, 37, 11],
  [10284, '10284-1', 'Camp Nou - FC Barcelona', 5.3, 58, 48, 17],
  [10307, '10307-1', 'Eiffel Tower', 12, 62, 52, 39],
  [21323, '21323-1', 'Grand Piano', 5.8, 58, 37, 16],
];

const BODEGAS_SIMULADAS: BodegaInventario[] = [
  { id_bodega: 1, nombre_bodega: 'Bodega Central Santiago', ubicacion_fisica: 'Av. Américo Vespucio 1500, Pudahuel, Santiago' },
  { id_bodega: 2, nombre_bodega: 'Bodega Coquimbo', ubicacion_fisica: 'Av. Costanera 2300, Coquimbo' },
  { id_bodega: 3, nombre_bodega: 'Bodega La Serena', ubicacion_fisica: 'Av. Balmaceda 310, La Serena' },
];

export interface OpcionesClienteSimulado {
  /** Reservas iniciales (por defecto, cualquier pedido tiene una reserva PENDIENTE sin líneas) */
  reservas?: ReservaPedidoInventario[];
  /** Pedidos que responden 404 "no tiene una reserva" */
  pedidosSinReserva?: number[];
}

export class ClienteInventarioSimulado implements ClienteInventario {
  readonly modo = 'simulado' as const;
  private readonly productos = new Map<number, ProductoInventario>();
  private readonly reservas = new Map<number, ReservaPedidoInventario>();
  private readonly pedidosSinReserva: Set<number>;
  private readonly despachos = new Map<string, { id_pedido: number; resultado: ResultadoDespachoInventario }>();
  private readonly recepciones = new Map<string, { firma: string; resultado: ResultadoRecepcionInventario }>();
  private secuencia = 9000;

  constructor(opciones: OpcionesClienteSimulado = {}) {
    for (const [id, sku, nombre, peso, largo, alto, ancho] of PRODUCTOS_SIMULADOS) {
      this.productos.set(id, {
        id_producto: id,
        id_tema: 1,
        sku,
        nombre_set: nombre,
        cant_piezas: 0,
        activo: true,
        url_imagen: null,
        peso_unitario_kg: peso,
        largo_cm: largo,
        alto_cm: alto,
        ancho_cm: ancho,
        cantidad_disponible: 50,
      });
    }
    for (const r of opciones.reservas ?? []) this.reservas.set(r.id_pedido, structuredClone(r));
    this.pedidosSinReserva = new Set(opciones.pedidosSinReserva ?? []);
  }

  async verificarConexion(): Promise<EstadoConexionInventario> {
    return { modo: this.modo, ok: true, url: null, latencia_ms: 0 };
  }

  async obtenerProducto(idProducto: number): Promise<ProductoInventario> {
    const producto = this.productos.get(idProducto);
    if (!producto) {
      throw error('NO_ENCONTRADO', 404, `/productos/${idProducto}`, `El producto con ID ${idProducto} no existe`);
    }
    return structuredClone(producto);
  }

  async obtenerBodegas(): Promise<BodegaInventario[]> {
    return structuredClone(BODEGAS_SIMULADAS);
  }

  async obtenerStock(idProducto: number): Promise<StockBodegaInventario[]> {
    await this.obtenerProducto(idProducto);
    return BODEGAS_SIMULADAS.map((b) => ({
      id_producto: idProducto,
      id_bodega: b.id_bodega,
      bodega: { ...b },
      cantidad_disponible: 20,
      cantidad_reservada: 0,
      cantidad_minima: 5,
    }));
  }

  async obtenerReserva(idPedido: number): Promise<ReservaPedidoInventario> {
    const ruta = `/reservas?id_pedido=${idPedido}`;
    if (!Number.isInteger(idPedido) || idPedido <= 0) {
      throw error('VALIDACION', 400, ruta, 'id_pedido must be a positive number');
    }
    return structuredClone(this.reservaDe(idPedido, ruta));
  }

  async registrarDespacho(input: DespachoInventarioInput): Promise<ResultadoDespachoInventario> {
    const ruta = '/movimientos/despacho';
    const problemas: string[] = [];
    if (!input.id_despacho || typeof input.id_despacho !== 'string') problemas.push('id_despacho should not be empty');
    if (!esPositivo(input.id_pedido)) problemas.push('id_pedido must be a positive number');
    if (!esPositivo(input.id_empleado)) problemas.push('id_empleado must be a positive number');
    if (!Array.isArray(input.lineas) || input.lineas.length === 0) {
      problemas.push('lineas must contain at least 1 elements');
    } else {
      if (new Set(input.lineas.map((l) => l.id_producto)).size !== input.lineas.length) {
        problemas.push('lineas no puede repetir un id_producto');
      }
      input.lineas.forEach((l, i) => {
        if (!esPositivo(l.id_producto)) problemas.push(`lineas.${i}.id_producto must be a positive number`);
        if (!Number.isInteger(l.cantidad) || l.cantidad < 0) problemas.push(`lineas.${i}.cantidad must not be less than 0`);
      });
    }
    if (problemas.length) throw error('VALIDACION', 400, ruta, problemas);

    // Idempotencia: la misma guía para el mismo pedido devuelve el despacho ya registrado.
    const previo = this.despachos.get(input.id_despacho);
    if (previo) {
      if (previo.id_pedido === input.id_pedido) return structuredClone(previo.resultado);
      throw error('CONFLICTO', 409, ruta, `La guía ${input.id_despacho} ya se usó en el pedido ${previo.id_pedido}`);
    }

    const reserva = this.reservaDe(input.id_pedido, ruta);
    if (reserva.estado !== 'PENDIENTE') {
      throw error('CONFLICTO', 409, ruta, `La reserva del pedido ${input.id_pedido} está ${reserva.estado}`);
    }

    const bodegaDe = (idProducto: number) =>
      reserva.lineas.find((l) => l.id_producto === idProducto)?.id_bodega ?? 1;
    const recolectadas = input.lineas.filter((l) => l.cantidad > 0);
    const faltantes = input.lineas.filter((l) => l.cantidad === 0);

    const resultado: ResultadoDespachoInventario = {
      id_despacho: input.id_despacho,
      egreso: this.movimiento('EGRESO', input.id_pedido, input.id_empleado,
        recolectadas.map((l) => ({ id_producto: l.id_producto, id_bodega: bodegaDe(l.id_producto), cantidad: l.cantidad }))),
      liberacion: faltantes.length
        ? this.movimiento('LIBERACION', input.id_pedido, null,
            faltantes.map((l) => ({ id_producto: l.id_producto, id_bodega: bodegaDe(l.id_producto), cantidad: 0 })))
        : null,
    };

    reserva.estado = 'COMPLETADO';
    this.despachos.set(input.id_despacho, { id_pedido: input.id_pedido, resultado });
    return structuredClone(resultado);
  }

  async registrarRecepcion(input: RecepcionInventarioInput): Promise<ResultadoRecepcionInventario> {
    const ruta = '/movimientos/recepcion';
    const problemas: string[] = [];
    if (!esPositivo(input.id_oc)) problemas.push('id_oc must be a positive number');
    if (!esPositivo(input.id_proveedor)) problemas.push('id_proveedor must be a positive number');
    if (!input.nro_guia_proveedor || typeof input.nro_guia_proveedor !== 'string') {
      problemas.push('nro_guia_proveedor should not be empty');
    }
    if (!esPositivo(input.id_empleado)) problemas.push('id_empleado must be a positive number');
    if (!Array.isArray(input.lineas) || input.lineas.length === 0) {
      problemas.push('lineas must contain at least 1 elements');
    } else {
      const claves = input.lineas.map((l) => `${l.id_producto}-${l.id_bodega}`);
      if (new Set(claves).size !== claves.length) {
        problemas.push('lineas no puede repetir el mismo producto en la misma bodega');
      }
      input.lineas.forEach((l, i) => {
        if (!esPositivo(l.id_producto)) problemas.push(`lineas.${i}.id_producto must be a positive number`);
        if (!esPositivo(l.id_bodega)) problemas.push(`lineas.${i}.id_bodega must be a positive number`);
        if (!esPositivo(l.cantidad)) problemas.push(`lineas.${i}.cantidad must be a positive number`);
      });
    }
    if (problemas.length) throw error('VALIDACION', 400, ruta, problemas);

    const faltante = input.lineas.find((l) => !BODEGAS_SIMULADAS.some((b) => b.id_bodega === l.id_bodega));
    if (faltante) throw error('NO_ENCONTRADO', 404, ruta, `La bodega con ID ${faltante.id_bodega} no existe`);

    // Idempotencia por OC + guía del proveedor: mismos datos devuelven lo ya registrado; otros datos, 409.
    const clave = `${input.id_oc}|${input.nro_guia_proveedor}`;
    const firma = JSON.stringify({
      id_proveedor: input.id_proveedor,
      id_empleado: input.id_empleado,
      lineas: [...input.lineas]
        .map((l) => [l.id_producto, l.id_bodega, l.cantidad])
        .sort((a, b) => a[0] - b[0] || a[1] - b[1]),
    });
    const previa = this.recepciones.get(clave);
    if (previa) {
      if (previa.firma === firma) return structuredClone(previa.resultado);
      throw error('CONFLICTO', 409, ruta,
        `La guía ${input.nro_guia_proveedor} de la OC ${input.id_oc} ya se registró con otros datos`);
    }

    const resultado: ResultadoRecepcionInventario = {
      id_oc: input.id_oc,
      id_proveedor: input.id_proveedor,
      nro_guia_proveedor: input.nro_guia_proveedor,
      ingreso: this.movimiento('INGRESO', null, input.id_empleado, input.lineas.map((l) => ({ ...l }))),
    };
    this.recepciones.set(clave, { firma, resultado });
    return structuredClone(resultado);
  }

  private reservaDe(idPedido: number, ruta: string): ReservaPedidoInventario {
    if (this.pedidosSinReserva.has(idPedido)) {
      throw error('NO_ENCONTRADO', 404, ruta, `El pedido ${idPedido} no tiene una reserva`);
    }
    let reserva = this.reservas.get(idPedido);
    if (!reserva) {
      reserva = {
        id_pedido: idPedido,
        id_movimiento: this.secuencia++,
        estado: 'PENDIENTE',
        fecha_registro: new Date().toISOString(),
        lineas: [],
      };
      this.reservas.set(idPedido, reserva);
    }
    return reserva;
  }

  private movimiento(
    tipo: string,
    idPedido: number | null,
    idEmpleado: number | null,
    detalles: { id_producto: number; id_bodega: number; cantidad: number }[]
  ): MovimientoInventario {
    return {
      id_movimiento: this.secuencia++,
      id_empleado: idEmpleado,
      id_pedido: idPedido,
      fecha_registro: new Date().toISOString(),
      tipo_operacion: tipo,
      estado: 'COMPLETADO',
      detalles,
    };
  }
}

function esPositivo(valor: unknown): boolean {
  return typeof valor === 'number' && Number.isInteger(valor) && valor > 0;
}

function error(
  tipo: 'VALIDACION' | 'NO_ENCONTRADO' | 'CONFLICTO',
  status: number,
  ruta: string,
  mensajes: string | string[]
): InventarioError {
  const detalles = Array.isArray(mensajes) ? mensajes : [mensajes];
  return new InventarioError({ tipo, status, ruta, detalles, mensaje: detalles.join('; ') });
}
