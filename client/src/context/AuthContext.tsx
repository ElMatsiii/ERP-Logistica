import React, { createContext, useContext, useState, useEffect } from 'react';
import { UsuarioLogistica, RolConfig, RolLogistica, PermisoLogistica } from '../types';

export const ROLES_LOGISTICA: Record<RolLogistica, RolConfig> = {
  COORDINADOR_LOGISTICA: {
    rol: 'COORDINADOR_LOGISTICA',
    nombre: 'Coordinador de Logística y Despacho',
    descripcion: 'Control total de despacho, cotizaciones, emisión de guías, resolución de contingencias y auditoría de tracking.',
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
    descripcion: 'Preparación física, cubicación de bultos y recepción de órdenes de compra en muelle con ingreso a Inventario.',
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
    descripcion: 'Operador en terreno enfocado en la consola de tracking para actualizar estados de entrega y visitas fallidas.',
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
    permisos: ROLES_LOGISTICA.COORDINADOR_LOGISTICA.permisos,
    descripcion: 'Supervisión integral de despacho, muelle y flota de transporte.',
    pestañas_permitidas: ROLES_LOGISTICA.COORDINADOR_LOGISTICA.pestañas_permitidas,
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
    permisos: ROLES_LOGISTICA.OPERADOR_BODEGA.permisos,
    descripcion: 'Operaciones de almacén: picking, embalaje, cubicación y recepción en muelle.',
    pestañas_permitidas: ROLES_LOGISTICA.OPERADOR_BODEGA.pestañas_permitidas,
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
    permisos: ROLES_LOGISTICA.TRANSPORTISTA.permisos,
    descripcion: 'Gestión en terreno: bitácora de entrega, visitas fallidas y seguimiento satelital.',
    pestañas_permitidas: ROLES_LOGISTICA.TRANSPORTISTA.pestañas_permitidas,
  },
];

interface AuthContextType {
  user: UsuarioLogistica;
  roles: RolConfig[];
  usuarios: UsuarioLogistica[];
  switchUser: (idEmpleado: number) => void;
  switchRol: (rol: RolLogistica) => void;
  hasPermission: (permiso: PermisoLogistica) => boolean;
  canAccessTab: (tab: 'emision' | 'tracking' | 'recepcion') => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'lesgo_logistica_usuario_activo';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UsuarioLogistica>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const match = USUARIOS_LOGISTICA.find((u) => u.id_empleado === parsed.id_empleado);
        if (match) return match;
      }
    } catch {
      // Fallback si localStorage falla
    }
    return USUARIOS_LOGISTICA[0]; // Maximiliano Pizarro por defecto
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } catch {
      // Ignore write errors
    }
  }, [user]);

  const switchUser = (idEmpleado: number) => {
    const target = USUARIOS_LOGISTICA.find((u) => u.id_empleado === idEmpleado);
    if (target) {
      setUser(target);
    }
  };

  const switchRol = (rol: RolLogistica) => {
    const target = USUARIOS_LOGISTICA.find((u) => u.rol === rol);
    if (target) {
      setUser(target);
    }
  };

  const hasPermission = (permiso: PermisoLogistica): boolean => {
    return user.permisos.includes(permiso);
  };

  const canAccessTab = (tab: 'emision' | 'tracking' | 'recepcion'): boolean => {
    return user.pestañas_permitidas.includes(tab);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        roles: Object.values(ROLES_LOGISTICA),
        usuarios: USUARIOS_LOGISTICA,
        switchUser,
        switchRol,
        hasPermission,
        canAccessTab,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
}
