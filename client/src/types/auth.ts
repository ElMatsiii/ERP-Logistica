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

/** Usuario de prueba de AUTH_MODO=simulado (datos ficticios, solo para desarrollo) */
export interface UsuarioSimulado {
  id_empleado: number;
  nombre: string;
  rol: RolLogistica;
  rol_nombre: string;
  descripcion: string;
  avatar_iniciales: string;
  avatar_color: string;
  pestañas_permitidas: ('emision' | 'tracking' | 'recepcion')[];
}

/** GET /api/auth/config (público) */
export interface ConfigAuthPublica {
  modo: 'jwt' | 'simulado';
  /** false = el servidor no tiene JWT_SECRET: no puede validar tokens del portal */
  acepta_tokens: boolean;
  /** Solo en modo simulado */
  usuarios_simulados?: UsuarioSimulado[];
}

export interface RolConfig {
  rol: RolLogistica;
  nombre: string;
  descripcion: string;
  permisos: PermisoLogistica[];
  pestañas_permitidas: ('emision' | 'tracking' | 'recepcion')[];
}
