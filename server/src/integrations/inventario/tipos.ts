// Contrato con la API REST de Inventario (repo PA1IN/Proyecto-SI-2, prefijo /api/v1).
// Los nombres de campos son los de Inventario; no se traducen para que el cruce sea directo.

export type ModoClienteInventario = 'real' | 'simulado';

export type EstadoMovimientoInventario = 'PENDIENTE' | 'COMPLETADO' | 'ANULADO';

/** GET /productos/:id (público). Peso y medidas son de la caja del set. */
export interface ProductoInventario {
  id_producto: number;
  id_tema: number;
  sku: string;
  nombre_set: string;
  cant_piezas: number;
  activo: boolean;
  url_imagen: string | null;
  peso_unitario_kg: number | null;
  largo_cm: number | null;
  alto_cm: number | null;
  ancho_cm: number | null;
  tema?: { id_tema: number; nombre_tema: string };
  cantidad_disponible?: number;
}

/** GET /bodegas (público) */
export interface BodegaInventario {
  id_bodega: number;
  nombre_bodega: string;
  ubicacion_fisica: string;
}

/** GET /stock/:idProducto (público): una fila por bodega */
export interface StockBodegaInventario {
  id_producto: number;
  id_bodega: number;
  bodega?: BodegaInventario;
  cantidad_disponible: number;
  cantidad_reservada: number;
  cantidad_minima: number;
}

/** GET /reservas?id_pedido= (API key). Lo que e-Commerce reservó para el pedido. */
export interface ReservaPedidoInventario {
  id_pedido: number;
  id_movimiento: number;
  // PENDIENTE = por despachar; COMPLETADO = ya despachada; ANULADO = liberada.
  estado: EstadoMovimientoInventario;
  fecha_registro: string;
  lineas: {
    id_producto: number;
    sku: string;
    nombre_set: string;
    id_bodega: number;
    nombre_bodega: string;
    ubicacion_fisica: string;
    cantidad: number;
  }[];
}

/** Movimiento de stock tal como lo devuelve Inventario */
export interface MovimientoInventario {
  id_movimiento: number;
  id_empleado: number | null;
  id_pedido: number | null;
  fecha_registro: string;
  tipo_operacion: string;
  estado: EstadoMovimientoInventario;
  detalles?: { id_producto: number; id_bodega: number; cantidad: number }[];
}

export interface LineaDespachoInventario {
  id_producto: number;
  /** Lo recolectado; 0 si no se encontró. Se envían todas las líneas de la reserva. */
  cantidad: number;
}

/** POST /movimientos/despacho (API key) */
export interface DespachoInventarioInput {
  /** ID de nuestra guía (GD-52341) */
  id_despacho: string;
  /** Se acepta pero Inventario no lo guarda */
  num_seguimiento?: string;
  id_pedido: number;
  /** Operador de la OT (rrhh.empleado) */
  id_empleado: number;
  observaciones_picking?: string;
  lineas: LineaDespachoInventario[];
}

export interface ResultadoDespachoInventario {
  id_despacho: string;
  /** Lo que salió de cada bodega */
  egreso: MovimientoInventario;
  /** Lo no recolectado que volvió a disponible; null si el despacho fue completo */
  liberacion: MovimientoInventario | null;
}

export interface LineaRecepcionInventario {
  id_producto: number;
  id_bodega: number;
  /** Neta (recibida menos dañada). Debe ser mayor que 0: las líneas en 0 no se envían. */
  cantidad: number;
}

/** POST /movimientos/recepcion (API key). Idempotente por id_oc + nro_guia_proveedor. */
export interface RecepcionInventarioInput {
  id_oc: number;
  id_proveedor: number;
  nro_guia_proveedor: string;
  /** Receptor de Logística (rrhh.empleado) */
  id_empleado: number;
  /** Se acepta pero Inventario no lo guarda */
  id_recepcion_logistica?: number;
  /** Se acepta pero Inventario no lo guarda */
  fecha_recepcion?: string;
  lineas: LineaRecepcionInventario[];
}

export interface ResultadoRecepcionInventario {
  id_oc: number;
  id_proveedor: number;
  nro_guia_proveedor: string;
  ingreso: MovimientoInventario;
}

/** Formato de error de Inventario (su AllExceptionsFilter) */
export interface ErrorRespuestaInventario {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

export interface EstadoConexionInventario {
  modo: ModoClienteInventario;
  ok: boolean;
  /** Solo el origen (sin la API key) */
  url: string | null;
  latencia_ms?: number;
  error?: string;
}

/** Lo que Logística usa de Inventario. El cliente real y el simulado cumplen el mismo contrato. */
export interface ClienteInventario {
  readonly modo: ModoClienteInventario;
  verificarConexion(): Promise<EstadoConexionInventario>;
  obtenerProducto(idProducto: number): Promise<ProductoInventario>;
  obtenerBodegas(): Promise<BodegaInventario[]>;
  obtenerStock(idProducto: number): Promise<StockBodegaInventario[]>;
  obtenerReserva(idPedido: number): Promise<ReservaPedidoInventario>;
  registrarDespacho(input: DespachoInventarioInput): Promise<ResultadoDespachoInventario>;
  registrarRecepcion(input: RecepcionInventarioInput): Promise<ResultadoRecepcionInventario>;
}
