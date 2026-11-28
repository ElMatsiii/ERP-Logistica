import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { UsuarioLogistica, PermisoLogistica, ConfigAuthPublica, UsuarioSimulado } from '../types';
import {
  borrarSesion,
  guardarSesion,
  leerSesion,
  marcarTokenDelPortalUsado,
  registrarManejadorNoAutorizado,
  resultadoTokenDelPortal,
} from '../api/sesion';
import { ErrorApi } from '../api/logisticaApi';
import { obtenerConfigAuth, obtenerUsuarioActual } from '../api/authApi';
import { PantallaAcceso } from '../components/PantallaAcceso';
import { urlPortalRrhh } from '../config';

/* =========================================================================
 * SESIÓN (siempre disponible): estado y logout. La usa la pantalla de acceso.
 * Logística no tiene login propio: se entra con el token del portal de RRHH
 * o, solo en AUTH_MODO=simulado, como usuario de prueba.
 * ========================================================================= */

export type EstadoSesion = 'cargando' | 'sin_sesion' | 'autenticado' | 'sin_conexion';

export interface Aviso {
  tipo: 'info' | 'error';
  texto: string;
}

interface SesionContextType {
  estado: EstadoSesion;
  config: ConfigAuthPublica | null;
  usuario: UsuarioLogistica | null;
  tipoSesion: 'token' | 'simulado' | null;
  /** Mensaje para la pantalla de acceso (sesión expirada, sin conexión, etc.) */
  aviso: Aviso | null;
  /** Solo AUTH_MODO=simulado: entra como usuario de prueba (x-user-id). */
  loginSimulado: (idEmpleado: number) => Promise<void>;
  logout: (aviso?: Aviso) => void;
  reintentar: () => void;
}

const SesionContext = createContext<SesionContextType | undefined>(undefined);

const AVISO_SESION_EXPIRADA: Aviso = { tipo: 'info', texto: 'Tu sesión expiró o ya no es válida. Inicia sesión nuevamente.' };
const AVISO_PORTAL_INVALIDO: Aviso = {
  tipo: 'info',
  texto: 'La sesión del portal no es válida o expiró. Vuelve a ingresar desde el portal del ERP.',
};
/** Mensaje del servidor para un token inválido o expirado (MENSAJES_AUTH.SESION_INVALIDA) */
const MENSAJE_SERVIDOR_SESION_INVALIDA = 'Sesión inválida o expirada';

/** Errores que indican que el servidor no está disponible (no son culpa de la sesión) */
const esErrorDeConexion = (err: unknown) => err instanceof ErrorApi && (err.status === 0 || err.status >= 500);

/* =========================================================================
 * USUARIO AUTENTICADO: solo existe dentro de la app (user nunca es null)
 * ========================================================================= */

interface AuthContextType {
  user: UsuarioLogistica;
  tipoSesion: 'token' | 'simulado';
  modo: 'jwt' | 'simulado';
  /** Usuarios de prueba (solo con sesión simulada en AUTH_MODO=simulado; vacío en cualquier otro caso) */
  usuarios: UsuarioSimulado[];
  switchUser: (idEmpleado: number) => void;
  logout: () => void;
  hasPermission: (permiso: PermisoLogistica) => boolean;
  canAccessTab: (tab: 'emision' | 'tracking' | 'recepcion') => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Valida la sesión al cargar (GET /api/auth/config + GET /api/auth/me) y muestra la pantalla de acceso
 * mientras no haya un usuario autenticado. Los hijos solo se montan con sesión válida.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [estado, setEstado] = useState<EstadoSesion>('cargando');
  const [config, setConfig] = useState<ConfigAuthPublica | null>(null);
  const [usuario, setUsuario] = useState<UsuarioLogistica | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [intento, setIntento] = useState(0);

  const logout = useCallback((nuevoAviso?: Aviso) => {
    borrarSesion();
    setUsuario(null);
    setAviso(nuevoAviso ?? null);
    setEstado('sin_sesion');
  }, []);

  // Ante cualquier 401 de la API: cerrar sesión y volver al login
  useEffect(() => {
    registrarManejadorNoAutorizado(() => logout(AVISO_SESION_EXPIRADA));
    return () => registrarManejadorNoAutorizado(null);
  }, [logout]);

  // Al cargar (y al reintentar): configuración del servidor y validación de la sesión guardada
  useEffect(() => {
    let cancelado = false;

    (async () => {
      setEstado('cargando');
      let cfg: ConfigAuthPublica;
      try {
        cfg = await obtenerConfigAuth();
      } catch (err) {
        if (cancelado) return;
        setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo conectar con el servidor' });
        setEstado('sin_conexion');
        return;
      }
      if (cancelado) return;
      setConfig(cfg);

      // ¿Se llegó desde el portal de RRHH con #token? (main.tsx ya lo leyó, lo guardó y lo quitó de la URL)
      const portal = resultadoTokenDelPortal();
      if (portal === 'invalido') {
        marcarTokenDelPortalUsado();
        logout(AVISO_PORTAL_INVALIDO);
        return;
      }

      const sesion = leerSesion();
      if (portal === 'aplicado' && !cfg.acepta_tokens) {
        marcarTokenDelPortalUsado();
        logout({ tipo: 'error', texto: 'El servidor de Logística no puede validar la sesión del portal (falta configurar JWT_SECRET).' });
        return;
      }

      const sesionUtilizable =
        sesion !== null &&
        // Una sesión simulada no sirve si el servidor está en modo jwt; un token no sirve si el servidor no puede verificarlo
        !(sesion.tipo === 'simulado' && cfg.modo !== 'simulado') &&
        !(sesion.tipo === 'token' && !cfg.acepta_tokens);

      if (!sesionUtilizable) {
        if (sesion) borrarSesion();
        setEstado('sin_sesion');
        return;
      }

      try {
        const actual = await obtenerUsuarioActual();
        if (cancelado) return;
        marcarTokenDelPortalUsado();
        setUsuario(actual);
        setAviso(null);
        setEstado('autenticado');
      } catch (err) {
        if (cancelado) return;
        if (esErrorDeConexion(err)) {
          // El servidor o RRHH no responde: se conserva la sesión para reintentar
          setAviso({ tipo: 'error', texto: (err as Error).message });
          setEstado('sin_conexion');
        } else {
          // 401 / 403: la sesión ya no sirve. Se muestra el motivo que da el servidor
          // ("La cuenta no está activa", "No tienes acceso al módulo de Logística"); si el token
          // simplemente no es válido y venía del portal, se dice así.
          marcarTokenDelPortalUsado();
          const status = err instanceof ErrorApi ? err.status : 0;
          const mensaje = err instanceof ErrorApi ? err.message : '';
          const generico = !mensaje || mensaje === MENSAJE_SERVIDOR_SESION_INVALIDA;
          const texto = generico
            ? portal === 'aplicado'
              ? AVISO_PORTAL_INVALIDO.texto
              : mensaje || AVISO_SESION_EXPIRADA.texto
            : mensaje;
          logout({ tipo: status === 403 ? 'error' : 'info', texto });
        }
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [intento, logout]);

  const loginSimulado = useCallback(async (idEmpleado: number) => {
    guardarSesion({ tipo: 'simulado', idEmpleado });
    try {
      const actual = await obtenerUsuarioActual();
      setUsuario(actual);
      setAviso(null);
      setEstado('autenticado');
    } catch (err) {
      borrarSesion();
      throw err;
    }
  }, []);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  const tipoSesion = estado === 'autenticado' ? leerSesion()?.tipo ?? null : null;

  const sesion: SesionContextType = { estado, config, usuario, tipoSesion, aviso, loginSimulado, logout, reintentar };

  const auth = useMemo<AuthContextType | null>(() => {
    if (estado !== 'autenticado' || !usuario || !config || !tipoSesion) return null;
    const puedeCambiarUsuario = tipoSesion === 'simulado' && config.modo === 'simulado';
    // Usuarios de prueba: los entrega el servidor solo en modo simulado (GET /api/auth/config)
    const usuariosSimulados = puedeCambiarUsuario ? config.usuarios_simulados ?? [] : [];
    return {
      user: usuario,
      tipoSesion,
      modo: config.modo,
      usuarios: usuariosSimulados,
      // El selector de usuarios simulados solo funciona con una sesión simulada (nunca reemplaza un token)
      switchUser: (id) => {
        if (!puedeCambiarUsuario || !usuariosSimulados.some((u) => u.id_empleado === id)) return;
        loginSimulado(id).catch(() => logout(AVISO_SESION_EXPIRADA));
      },
      // Cerrar sesión: borra la sesión local (y la caché). En jwt vuelve al portal de RRHH, donde se inicia sesión;
      // en simulado (o si falta VITE_RRHH_PORTAL_URL) queda en la pantalla de acceso.
      logout: () => {
        const portal = urlPortalRrhh();
        if (config.modo === 'jwt' && portal) {
          logout();
          window.location.assign(portal);
          return;
        }
        logout({ tipo: 'info', texto: 'Cerraste sesión.' });
      },
      hasPermission: (permiso) => usuario.permisos.includes(permiso),
      canAccessTab: (tab) => usuario.pestañas_permitidas.includes(tab),
    };
  }, [estado, usuario, config, tipoSesion, loginSimulado, logout]);

  return (
    <SesionContext.Provider value={sesion}>
      {auth ? (
        // key: al cambiar de usuario se vuelve a montar la app (sin datos ni estado del usuario anterior)
        <AuthContext.Provider value={auth} key={auth.user.id_empleado}>
          {children}
        </AuthContext.Provider>
      ) : (
        <PantallaAcceso />
      )}
    </SesionContext.Provider>
  );
};

export function useSesion(): SesionContextType {
  const context = useContext(SesionContext);
  if (!context) {
    throw new Error('useSesion debe ser utilizado dentro de un AuthProvider');
  }
  return context;
}

/** Usuario autenticado. Solo se puede usar dentro de la app (después del login). */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider con sesión iniciada');
  }
  return context;
}
