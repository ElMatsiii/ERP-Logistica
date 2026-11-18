export type RolLogistica = 'COORDINADOR_LOGISTICA' | 'OPERADOR_BODEGA' | 'TRANSPORTISTA';

export type PermisoLogistica =
  | 'EMITIR_GUIA'
  | 'ANULAR_GUIA'
  | 'GESTIONAR_TARIFAS'
  | 'RECEPCION_MUELLE'
  | 'ACTUALIZAR_TRACKING_RUTA'
  | 'ACTUALIZAR_TRACKING_ADMIN'
  | 'REINTENTAR_STOCK'
  | 'VER_COSTOS';

export interface UsuarioLogistica {
  id_usuario: number;
  id_empleado: number;
  username: string;
  nombre: string;
  rut: string;
  cargo: string;
  rol: RolLogistica;
  rol_nombre: string;
  avatar_iniciales: string;
  avatar_color: string;
  permisos: PermisoLogistica[];
  descripcion: string;
  pestañas_permitidas: ('emision' | 'tracking' | 'recepcion')[];
}

export interface RolConfig {
  rol: RolLogistica;
  nombre: string;
  descripcion: string;
  permisos: PermisoLogistica[];
  pestañas_permitidas: ('emision' | 'tracking' | 'recepcion')[];
}
