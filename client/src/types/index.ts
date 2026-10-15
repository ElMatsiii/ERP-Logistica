export type EstadoOT = 'PENDIENTE' | 'EN_PROCESO' | 'PARCIAL' | 'CERRADO';

export type EstadoGuia =
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
  id_pedido: string;
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
