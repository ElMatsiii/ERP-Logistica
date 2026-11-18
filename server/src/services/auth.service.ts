import { RolConfig, RolLogistica, UsuarioLogistica, PermisoLogistica } from '../types/auth.types.js';

export const ROLES_CONFIG: Record<RolLogistica, RolConfig> = {
  COORDINADOR_LOGISTICA: {
    rol: 'COORDINADOR_LOGISTICA',
    nombre: 'Coordinador de Logística y Despacho',
    descripcion: 'Control y supervisión global del flujo logístico, emisión de guías, resolución de contingencias y auditoría de stock.',
    permisos: [
      'EMITIR_GUIA',
      'ANULAR_GUIA',
      'GESTIONAR_TARIFAS',
      'RECEPCION_MUELLE',
      'ACTUALIZAR_TRACKING_RUTA',
      'ACTUALIZAR_TRACKING_ADMIN',
      'REINTENTAR_STOCK',
      'VER_COSTOS',
    ],
    pestañas_permitidas: ['emision', 'tracking', 'recepcion'],
  },
  OPERADOR_BODEGA: {
    rol: 'OPERADOR_BODEGA',
    nombre: 'Operador de Bodega Central (Picking & Packing)',
    descripcion: 'Preparación física, cubicación de bultos para guías de despacho e inspección de compras en muelle de recepción.',
    permisos: [
      'EMITIR_GUIA',
      'RECEPCION_MUELLE',
      'REINTENTAR_STOCK',
    ],
    pestañas_permitidas: ['emision', 'recepcion'],
  },
  TRANSPORTISTA: {
    rol: 'TRANSPORTISTA',
    nombre: 'Conductor / Transportista de Reparto',
    descripcion: 'Operador de última milla enfocado exclusivamente en la consola de tracking para actualizar eventos en ruta y constatar entregas.',
    permisos: [
      'ACTUALIZAR_TRACKING_RUTA',
    ],
    pestañas_permitidas: ['tracking'],
  },
};

export const USUARIOS_LOGISTICA: UsuarioLogistica[] = [
  {
    id_usuario: 1,
    id_empleado: 305,
    username: 'mpizarro',
    nombre: 'Maximiliano Pizarro',
    rut: '17.892.341-5',
    cargo: 'Coordinador de Despacho',
    rol: 'COORDINADOR_LOGISTICA',
    rol_nombre: 'Coordinador de Logística',
    avatar_iniciales: 'MP',
    avatar_color: 'bg-emerald-600',
    permisos: ROLES_CONFIG.COORDINADOR_LOGISTICA.permisos,
    descripcion: 'Supervisión integral de despacho, muelle y flota de transporte.',
    pestañas_permitidas: ROLES_CONFIG.COORDINADOR_LOGISTICA.pestañas_permitidas,
  },
  {
    id_usuario: 3,
    id_empleado: 301,
    username: 'cgomez',
    nombre: 'Carlos Gómez',
    rut: '15.432.908-2',
    cargo: 'Operador de Bodega Central',
    rol: 'OPERADOR_BODEGA',
    rol_nombre: 'Operador de Bodega',
    avatar_iniciales: 'CG',
    avatar_color: 'bg-blue-600',
    permisos: ROLES_CONFIG.OPERADOR_BODEGA.permisos,
    descripcion: 'Operaciones de almacén: picking, embalaje, cubicación y recepción en muelle.',
    pestañas_permitidas: ROLES_CONFIG.OPERADOR_BODEGA.pestañas_permitidas,
  },
  {
    id_usuario: 4,
    id_empleado: 302,
    username: 'jtapia',
    nombre: 'Juan Tapia',
    rut: '16.781.204-K',
    cargo: 'Chofer de Reparto / Transportista',
    rol: 'TRANSPORTISTA',
    rol_nombre: 'Conductor / Transportista',
    avatar_iniciales: 'JT',
    avatar_color: 'bg-amber-600',
    permisos: ROLES_CONFIG.TRANSPORTISTA.permisos,
    descripcion: 'Gestión en terreno: bitácora de entrega, visitas fallidas y seguimiento satelital.',
    pestañas_permitidas: ROLES_CONFIG.TRANSPORTISTA.pestañas_permitidas,
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

  getUsuarioPorRol(rol: RolLogistica): UsuarioLogistica {
    const user = USUARIOS_LOGISTICA.find((u) => u.rol === rol);
    return user || USUARIOS_LOGISTICA[0];
  }

  validarPermiso(usuario: UsuarioLogistica, permiso: PermisoLogistica): boolean {
    return usuario.permisos.includes(permiso);
  }
}

export const authService = new AuthService();
