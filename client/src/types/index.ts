export type EstadoOT = 'PENDIENTE' | 'EN_PROCESO' | 'PARCIAL' | 'CERRADO';

export type EstadoGuia =
  | 'Pendiente de stock'
  | 'Error de stock'
  | 'Preparado'
  | 'Despachado'
  | 'En tránsito'
  | 'Entregado conforme'
  | 'Entrega Fallida'
  | string;

export interface Region {
  id: number;
  nombre: string;
}

export interface Comuna {
  id: number;
  region_id: number;
  nombre: string;
  region?: Region;
}

export interface Direccion {
  id: number;
  cliente_id: number;
  cliente_nombre?: string;
  cliente_rut?: string;
  comuna_id: number;
  calle: string;
  numero: string;
  depto?: string | null;
  referencia?: string | null;
  activa: boolean;
  comuna?: Comuna;
}

export interface DetalleOT {
  id: number;
  ot_id: string;
  id_producto: number;
  sku: string;
  nombre_producto: string;
  cant_solicitada: number;
  cant_recolectada: number;
  peso_unitario_kg?: number | null;
  largo_cm?: number | null;
  alto_cm?: number | null;
  ancho_cm?: number | null;
}

export interface OTPicking {
  id: string;
  id_pedido: number;
  id_operador: number;
  nombre_operador: string;
  estado: EstadoOT;
  fecha_creacion: string;
  cliente_id?: number | null;
  cliente_nombre?: string | null;
  cliente_rut?: string | null;
  direccion_id?: number | null;
  direccion?: Direccion;
  detalles?: DetalleOT[];
  guias?: Array<{
    id: string;
    num_seguimiento: string;
    estado_actual: string;
    fecha_emision: string;
  }>;
  empaque_sugerido?: {
    largo_cm: number;
    alto_cm: number;
    ancho_cm: number;
    peso_real_kg: number;
  };
}

export interface Servicio {
  id: number;
  transportista_id: number;
  nombre: string;
  dias_transito_comprometidos: number;
  activo: boolean;
}

export interface Transportista {
  id: number;
  rut: string;
  nombre: string;
  contacto_email: string;
  contacto_telefono: string;
  factor_volumetrico_default: number;
  activo: boolean;
  servicios: Servicio[];
}

export interface BultoInput {
  largo_cm: number;
  alto_cm: number;
  ancho_cm: number;
  peso_real_kg: number;
}

export interface Bulto extends BultoInput {
  id?: number;
  guia_id?: string;
  peso_volumetrico_kg: number;
}

export interface EventoTracking {
  id: number;
  guia_id: string;
  estado: string;
  fecha_hora: string;
  usuario_responsable: string;
  observacion: string;
}

export interface GuiaDespacho {
  id: string;
  ot_id: string;
  transportista_id: number;
  servicio_id: number;
  direccion_id: number;
  num_seguimiento: string;
  factor_volumetrico_aplicado: number;
  peso_real_total_kg: number | string;
  peso_volumetrico_total_kg: number | string;
  costo_envio: number | string;
  estado_actual: string;
  fecha_emision: string;
  ot?: OTPicking;
  transportista?: Transportista;
  servicio?: Servicio;
  direccion?: Direccion;
  bultos?: Bulto[];
  eventos?: EventoTracking[];
}

/** Respuesta de Inventario al egreso de stock de una guía */
export interface ConfirmacionStock {
  ok: boolean;
  id_movimiento_egreso?: number;
  id_movimiento_liberacion?: number | null;
  error?: string;
  tipo_error?: string;
  reintentable?: boolean;
}

/** Guías que esperan que Inventario confirme el egreso (las asigna el sistema) */
export const ESTADOS_STOCK = ['Pendiente de stock', 'Error de stock'];

export interface CotizacionResponse {
  cubicacion: {
    bultos: Array<BultoInput & { peso_volumetrico_kg: number; peso_a_cobrar_kg: number }>;
    peso_real_total_kg: number;
    peso_volumetrico_total_kg: number;
    peso_cobrado_total_kg: number;
    factor_volumetrico_aplicado: number;
  };
  tiene_cobertura: boolean;
  costo_estimado: number;
  comuna_destino?: string;
  transportista_nombre?: string;
}

export interface DetalleOrdenCompra {
  id: number;
  id_oc: number;
  id_producto: number;
  sku?: string;
  nombre_producto?: string;
  cantidad_esperada: number;
  peso_unitario_kg?: number;
}

export interface OrdenCompra {
  id_oc: number;
  id_proveedor?: number;
  proveedor: string;
  estado: string;
  fecha_emision?: string;
  fecha_entrega_esperada?: string;
  detalles: DetalleOrdenCompra[];
}

export interface LineaRecepcionInput {
  id_producto: number;
  cantidad_esperada: number;
  cantidad_recibida: number;
  cantidad_danada: number;
  motivo_dano?: string | null;
}

export interface LineaRecepcionPayload extends LineaRecepcionInput {
  /** Bodega de Inventario donde entran las unidades aptas */
  id_bodega: number | null;
}

export interface RegistrarRecepcionPayload {
  id_oc: number;
  id_empleado_receptor: number;
  nro_guia_proveedor: string;
  observacion?: string;
  lineas: LineaRecepcionPayload[];
}

/** Resultado del ingreso de stock en Inventario para una recepción */
export interface IngresoInventario {
  registrado: boolean;
  id_movimiento_ingreso?: number;
  motivo?: string;
}

export interface Empleado {
  id_empleado: number;
  nombre: string;
  cargo: string;
}

/** Bodega de Inventario */
export interface Bodega {
  id_bodega: number;
  nombre_bodega: string;
  ubicacion_fisica: string;
}

export interface DetalleRecepcion {
  id: number;
  recepcion_id: number;
  id_producto: number;
  id_bodega?: number | null;
  cantidad_esperada: number;
  cantidad_recibida: number;
  cantidad_danada: number;
  motivo_dano?: string | null;
  sku?: string;
  nombre_producto?: string;
}

export interface RecepcionRegistro {
  id: number;
  id_oc: number;
  id_proveedor?: number | null;
  nro_guia_proveedor?: string | null;
  id_empleado_receptor: number;
  nombre_empleado?: string;
  fecha_recepcion: string;
  estado: string;
  observacion?: string;
  proveedor?: string;
  detalles: DetalleRecepcion[];
}

