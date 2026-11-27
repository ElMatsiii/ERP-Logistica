import React, { createContext, useContext, useState } from 'react';
import { UsuarioLogistica, RolConfig, RolLogistica, PermisoLogistica } from '../types';
import { guardarSesion, leerSesion } from '../api/sesion';

export const ROLES_LOGISTICA: Record<RolLogistica, RolConfig> = {
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
    permisos: ROLES_LOGISTICA.COORDINADOR_LOGISTICA.permisos,
    descripcion: 'Supervisión de todo el módulo: emisión, tracking y recepción en muelle.',
    pestañas_permitidas: ROLES_LOGISTICA.COORDINADOR_LOGISTICA.pestañas_permitidas,
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
    permisos: ROLES_LOGISTICA.OPERADOR_DESPACHO.permisos,
    descripcion: 'Flujo de salida: OTs de picking de Ventas, cubicación, guías y seguimiento.',
    pestañas_permitidas: ROLES_LOGISTICA.OPERADOR_DESPACHO.pestañas_permitidas,
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
    permisos: ROLES_LOGISTICA.OPERADOR_RECEPCION.permisos,
    descripcion: 'Flujo de entrada: descarga de OCs de compras, inspección de bultos y actas de muelle.',
    pestañas_permitidas: ROLES_LOGISTICA.OPERADOR_RECEPCION.pestañas_permitidas,
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // La sesión (sesion.ts) es lo que usa la API para identificar al usuario (x-user-id del usuario elegido).
  // Se guarda de forma sincrónica, antes de que los componentes hijos pidan datos en sus useEffect.
  const [user, setUser] = useState<UsuarioLogistica>(() => {
    const sesion = leerSesion();
    const guardado =
      sesion?.tipo === 'simulado' ? USUARIOS_LOGISTICA.find((u) => u.id_empleado === sesion.idEmpleado) : undefined;
    const inicial = guardado ?? USUARIOS_LOGISTICA[0]; // Maximiliano Pizarro por defecto (se elimina con la pantalla de login)
    guardarSesion({ tipo: 'simulado', idEmpleado: inicial.id_empleado });
    return inicial;
  });

  const cambiarA = (target: UsuarioLogistica | undefined) => {
    if (!target) return;
    guardarSesion({ tipo: 'simulado', idEmpleado: target.id_empleado });
    setUser(target);
  };

  const switchUser = (idEmpleado: number) => {
    cambiarA(USUARIOS_LOGISTICA.find((u) => u.id_empleado === idEmpleado));
  };

  const switchRol = (rol: RolLogistica) => {
    cambiarA(USUARIOS_LOGISTICA.find((u) => u.rol === rol));
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
