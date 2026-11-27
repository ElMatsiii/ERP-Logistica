export type RolLogistica = 'COORDINADOR_LOGISTICA' | 'OPERADOR_DESPACHO' | 'OPERADOR_RECEPCION';

export type PermisoLogistica =
  | 'EMITIR_GUIA'
  | 'ANULAR_GUIA'
  | 'GESTIONAR_TARIFAS'
  | 'RECEPCION_MUELLE'
  | 'ACTUALIZAR_TRACKING'
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

/** GET /api/auth/config (público) */
export interface ConfigAuthPublica {
  modo: 'jwt' | 'simulado';
  /** false = el servidor no tiene JWT_SECRET: no puede validar tokens del portal */
  login_con_contrasena: boolean;
}

export interface RolConfig {
  rol: RolLogistica;
  nombre: string;
  descripcion: string;
  permisos: PermisoLogistica[];
  pestañas_permitidas: ('emision' | 'tracking' | 'recepcion')[];
}
