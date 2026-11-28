import React, { useState } from 'react';
import { AlertCircle, ExternalLink, FlaskConical, Info, Loader2, LogIn, RefreshCw, WifiOff } from 'lucide-react';
import { useSesion } from '../context/AuthContext';
import { colorAvatar, urlPortalRrhh } from '../config';

/** Ladrillo LEGO de la marca (mismo que el Navbar) */
const LogoLesGo: React.FC = () => (
  <div className="flex items-center space-x-2">
    <div className="w-12 h-12 bg-white rounded-lg p-1.5 shadow-md flex items-center justify-center">
      <div className="grid grid-cols-2 gap-1 w-full h-full p-1 bg-[#e52521] rounded">
        <div className="w-full h-full bg-[#ffcf00] rounded-full shadow-inner"></div>
        <div className="w-full h-full bg-[#ffcf00] rounded-full shadow-inner"></div>
        <div className="w-full h-full bg-[#ffcf00] rounded-full shadow-inner"></div>
        <div className="w-full h-full bg-[#ffcf00] rounded-full shadow-inner"></div>
      </div>
    </div>
    <div>
      <div className="flex items-center space-x-1.5">
        <span className="font-lego text-3xl font-bold tracking-tight text-[#ffcf00] drop-shadow-sm">LesGo</span>
        <span className="bg-white/20 text-white text-xs font-semibold px-2 py-0.5 rounded tracking-wider uppercase">ERP</span>
      </div>
      <p className="text-xs text-red-100 font-medium tracking-wide">Módulo de Logística y Transporte</p>
    </div>
  </div>
);

/** Fondo y tarjeta comunes a todas las pantallas de acceso */
const MarcoAcceso: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-slate-100/70 flex flex-col items-center justify-center px-4 py-10 font-sans">
    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      <div className="bg-[#e52521] px-6 py-5">
        <LogoLesGo />
      </div>
      <div className="p-6 sm:p-8">{children}</div>
    </div>
    <p className="mt-6 text-xs text-slate-500">
      <span className="font-bold text-[#e52521]">LesGo ERP</span> · Módulo de Logística y Transporte (Grupo 6)
    </p>
  </div>
);

const CajaAviso: React.FC<{ tipo: 'info' | 'error'; children: React.ReactNode }> = ({ tipo, children }) => (
  <div
    role={tipo === 'error' ? 'alert' : 'status'}
    className={`flex items-start space-x-2 rounded-xl border px-3 py-2.5 text-sm ${
      tipo === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-900'
    }`}
  >
    {tipo === 'error' ? <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />}
    <span>{children}</span>
  </div>
);

/** Botón al portal del ERP, o aviso de configuración si VITE_RRHH_PORTAL_URL falta o no es válida */
const BotonPortal: React.FC = () => {
  const portal = urlPortalRrhh();
  if (!portal) {
    return (
      <CajaAviso tipo="error">
        Falta configurar <code className="font-mono text-xs">VITE_RRHH_PORTAL_URL</code> en <code className="font-mono text-xs">client/.env</code> (ver client/.env.example).
      </CajaAviso>
    );
  }
  return (
    <a
      href={portal}
      className="w-full inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-[#e52521] hover:bg-red-700 text-white text-sm font-semibold rounded-xl shadow-md transition-colors"
    >
      <LogIn className="w-4 h-4" />
      <span>Ir al portal del ERP</span>
      <ExternalLink className="w-3.5 h-3.5 opacity-80" />
    </a>
  );
};

/**
 * Solo AUTH_MODO=simulado (desarrollo y pruebas): entrar como uno de los usuarios de prueba que entrega
 * el servidor en GET /api/auth/config. Son datos ficticios; nunca aparece en modo jwt.
 */
const BloqueUsuariosSimulados: React.FC = () => {
  const { config, loginSimulado } = useSesion();
  const [entrando, setEntrando] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (config?.modo !== 'simulado') return null;
  const usuarios = config.usuarios_simulados ?? [];

  const entrar = async (idEmpleado: number) => {
    setEntrando(idEmpleado);
    setError(null);
    try {
      await loginSimulado(idEmpleado);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo entrar como usuario simulado');
      setEntrando(null);
    }
  };

  return (
    <div className="mt-6 pt-5 border-t border-dashed border-slate-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FlaskConical className="w-4 h-4 text-[#e52521]" />
          <span className="text-sm font-bold text-slate-800">Modo desarrollo: usuarios simulados</span>
        </div>
        <span className="text-[10px] font-bold bg-[#ffcf00] text-slate-900 px-2 py-0.5 rounded-full uppercase tracking-wider">
          Simulado
        </span>
      </div>
      <p className="text-xs text-slate-500 mt-1">
        El servidor está en AUTH_MODO=simulado. Entra como un perfil de prueba para revisar vistas y permisos.
      </p>

      {error && (
        <div className="mt-3">
          <CajaAviso tipo="error">{error}</CajaAviso>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {usuarios.map((u) => (
          <button
            key={u.id_empleado}
            onClick={() => entrar(u.id_empleado)}
            disabled={entrando !== null}
            className="w-full text-left p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-red-200 disabled:opacity-60 transition-all flex items-center space-x-3"
          >
            <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm text-white ${colorAvatar(u.rol)}`}>
              {u.avatar_iniciales}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-slate-900 truncate">{u.nombre}</p>
              <p className="text-xs text-slate-600 truncate">{u.rol_nombre}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {u.pestañas_permitidas.map((tab) => (
                  <span key={tab} className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                    {tab === 'emision' ? 'Emisión' : tab === 'tracking' ? 'Tracking' : 'Muelle'}
                  </span>
                ))}
              </div>
            </div>
            {entrando === u.id_empleado ? (
              <Loader2 className="w-4 h-4 text-[#e52521] animate-spin" />
            ) : (
              <LogIn className="w-4 h-4 text-slate-400" />
            )}
          </button>
        ))}
        {usuarios.length === 0 && <p className="text-xs text-slate-500">El servidor no entregó usuarios de prueba.</p>}
      </div>
    </div>
  );
};

/**
 * Lo que se ve sin sesión: verificando, sin conexión o el acceso por el portal del ERP.
 * Logística no tiene formulario de login: la sesión se inicia en el portal de RRHH, que redirige con el token.
 * En AUTH_MODO=simulado se agregan los usuarios de prueba.
 */
export const PantallaAcceso: React.FC = () => {
  const { estado, aviso, reintentar } = useSesion();

  if (estado === 'cargando') {
    return (
      <MarcoAcceso>
        <div className="flex flex-col items-center text-center py-6" role="status">
          <Loader2 className="w-8 h-8 text-[#e52521] animate-spin" />
          <p className="mt-3 text-sm font-medium text-slate-600">Verificando sesión…</p>
        </div>
      </MarcoAcceso>
    );
  }

  if (estado === 'sin_conexion') {
    return (
      <MarcoAcceso>
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-red-100 text-[#e52521] rounded-2xl flex items-center justify-center shadow-sm">
            <WifiOff className="w-7 h-7" />
          </div>
          <h1 className="mt-4 text-lg font-bold text-slate-900">No se pudo conectar con el servidor</h1>
          <p className="mt-1 text-sm text-slate-600">{aviso?.texto ?? 'Intenta nuevamente en unos minutos.'}</p>
          <button
            onClick={reintentar}
            className="mt-5 inline-flex items-center space-x-2 px-5 py-2.5 bg-[#e52521] hover:bg-red-700 text-white text-sm font-semibold rounded-xl shadow-md transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reintentar</span>
          </button>
        </div>
      </MarcoAcceso>
    );
  }

  return (
    <MarcoAcceso>
      <h1 className="text-xl font-bold text-slate-900">Inicia sesión desde el portal del ERP</h1>
      <p className="text-sm text-slate-500 mt-1">
        El acceso a Logística se hace con tu cuenta del ERP LesGo. Ingresa al portal y abre el módulo de Logística desde allí.
      </p>
      <div className="mt-5 space-y-4">
        {aviso && <CajaAviso tipo={aviso.tipo}>{aviso.texto}</CajaAviso>}
        <BotonPortal />
      </div>
      <BloqueUsuariosSimulados />
    </MarcoAcceso>
  );
};
