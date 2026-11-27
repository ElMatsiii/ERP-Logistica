import { RolConfig, RolLogistica, UsuarioLogistica, PermisoLogistica } from '../types/auth.types.js';

export const ROLES_CONFIG: Record<RolLogistica, RolConfig> = {
  COORDINADOR_LOGISTICA: {
    rol: 'COORDINADOR_LOGISTICA',
    nombre: 'Coordinador General de Logística',
    descripcion: 'Supervisión integral de la cadena logística: autorizaciones, flujo de pedidos, auditoría de stock y recepción de compras.',
    permisos: [
      'EMITIR_GUIA',
      'ANULAR_GUIA',
      'GESTIONAR_TARIFAS',
      'RECEPCION_MUELLE',
      'ACTUALIZAR_TRACKING',
      'REINTENTAR_STOCK',
      'VER_COSTOS',
    ],
    pestañas_permitidas: ['emision', 'tracking', 'recepcion'],
  },
  OPERADOR_DESPACHO: {
    rol: 'OPERADOR_DESPACHO',
    nombre: 'Encargado de Despacho y Ventas (Outbound)',
    descripcion: 'Especialista en pedidos e-Commerce: preparación de OTs de picking, cubicación, emisión de guías de despacho y monitoreo de tracking.',
    permisos: [
      'EMITIR_GUIA',
      'ACTUALIZAR_TRACKING',
      'REINTENTAR_STOCK',
    ],
    pestañas_permitidas: ['emision', 'tracking'],
  },
  OPERADOR_RECEPCION: {
    rol: 'OPERADOR_RECEPCION',
    nombre: 'Encargado de Recepción en Muelle (Inbound)',
    descripcion: 'Especialista en compras y proveedores: descarga física en muelle, control de calidad (unidades aptas vs dañadas) e ingreso a Inventario.',
    permisos: [
      'RECEPCION_MUELLE',
    ],
    pestañas_permitidas: ['recepcion'],
  },
};

export const USUARIOS_LOGISTICA: UsuarioLogistica[] = [
  {
    id_usuario: 1,
    id_empleado: 305,
    username: 'mpizarro',
    nombre: 'Maximiliano Pizarro',
    rut: '17.892.341-5',
    cargo: 'Coordinador General de Logística',
    rol: 'COORDINADOR_LOGISTICA',
    rol_nombre: 'Coordinador General',
    avatar_iniciales: 'MP',
    avatar_color: 'bg-emerald-600',
    permisos: ROLES_CONFIG.COORDINADOR_LOGISTICA.permisos,
    descripcion: 'Supervisión de todo el módulo: emisión, tracking y recepción en muelle.',
    pestañas_permitidas: ROLES_CONFIG.COORDINADOR_LOGISTICA.pestañas_permitidas,
  },
  {
    id_usuario: 3,
    id_empleado: 301,
    username: 'cgomez',
    nombre: 'Carlos Gómez',
    rut: '15.432.908-2',
    cargo: 'Encargado de Despacho e-Commerce',
    rol: 'OPERADOR_DESPACHO',
    rol_nombre: 'Encargado de Despacho (Ventas)',
    avatar_iniciales: 'CG',
    avatar_color: 'bg-blue-600',
    permisos: ROLES_CONFIG.OPERADOR_DESPACHO.permisos,
    descripcion: 'Flujo de salida: OTs de picking de Ventas, cubicación, guías y seguimiento.',
    pestañas_permitidas: ROLES_CONFIG.OPERADOR_DESPACHO.pestañas_permitidas,
  },
  {
    id_usuario: 6,
    id_empleado: 304,
    username: 'eparedes',
    nombre: 'Esteban Paredes',
    rut: '14.981.452-3',
    cargo: 'Encargado de Recepción en Muelle',
    rol: 'OPERADOR_RECEPCION',
    rol_nombre: 'Encargado de Recepción (Compras)',
    avatar_iniciales: 'EP',
    avatar_color: 'bg-purple-600',
    permisos: ROLES_CONFIG.OPERADOR_RECEPCION.permisos,
    descripcion: 'Flujo de entrada: descarga de OCs de compras, inspección de bultos y actas de muelle.',
    pestañas_permitidas: ROLES_CONFIG.OPERADOR_RECEPCION.pestañas_permitidas,
  },
];

export class AuthService {
  getRoles(): RolConfig[] {
    return Object.values(ROLES_CONFIG);
  }

  getUsuarios(): UsuarioLogistica[] {
    return USUARIOS_LOGISTICA;
  }

  getUsuarioById(idEmpleadoOrUsuario: number): UsuarioLogistica | undefined {
    return USUARIOS_LOGISTICA.find(
      (u) => u.id_usuario === idEmpleadoOrUsuario || u.id_empleado === idEmpleadoOrUsuario
    );
  }

  getUsuarioByUsername(username: string): UsuarioLogistica | undefined {
    return USUARIOS_LOGISTICA.find(
      (u) => u.username.toLowerCase() === username.toLowerCase()
    );
  }

  /** Usuario simulado con ese rol. Un rol desconocido devuelve undefined (nunca un usuario por defecto). */
  getUsuarioPorRol(rol: RolLogistica): UsuarioLogistica | undefined {
    return USUARIOS_LOGISTICA.find((u) => u.rol === rol);
  }

  validarPermiso(usuario: UsuarioLogistica, permiso: PermisoLogistica): boolean {
    return usuario.permisos.includes(permiso);
  }
}

export const authService = new AuthService();
