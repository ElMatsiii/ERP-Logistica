import React, { useState, useRef, useEffect } from 'react';
import {
  Package,
  Truck,
  ShieldCheck,
  Inbox,
  ChevronDown,
  Lock,
  CheckCircle2,
  Users,
  Warehouse,
  Radio,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { RolLogistica } from '../types';

interface NavTabsProps {
  activeTab: 'emision' | 'tracking' | 'recepcion';
  setActiveTab: (tab: 'emision' | 'tracking' | 'recepcion') => void;
}

export const Navbar: React.FC = () => {
  const { user, usuarios, switchUser } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleBadgeStyle = (rol: RolLogistica) => {
    switch (rol) {
      case 'COORDINADOR_LOGISTICA':
        return {
          bg: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40',
          dot: 'bg-emerald-400',
          icon: ShieldCheck,
        };
      case 'OPERADOR_BODEGA':
        return {
          bg: 'bg-blue-500/20 text-blue-200 border-blue-400/40',
          dot: 'bg-blue-400',
          icon: Warehouse,
        };
      case 'TRANSPORTISTA':
        return {
          bg: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
          dot: 'bg-amber-400',
          icon: Truck,
        };
      default:
        return {
          bg: 'bg-slate-500/20 text-slate-200 border-slate-400/40',
          dot: 'bg-slate-400',
          icon: ShieldCheck,
        };
    }
  };

  const currentRoleStyle = getRoleBadgeStyle(user.rol);
  const CurrentRoleIcon = currentRoleStyle.icon;

  return (
    <header className="relative bg-[#e52521] text-white shadow-md z-30 select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo & Marca LesGo */}
          <div className="flex items-center space-x-2">
            {/* Bloque LEGO Icon */}
            <div className="w-12 h-12 bg-white rounded-lg p-1.5 shadow-md flex items-center justify-center transform hover:rotate-6 transition-transform">
              <div className="grid grid-cols-2 gap-1 w-full h-full p-1 bg-[#e52521] rounded">
                <div className="w-full h-full bg-[#ffcf00] rounded-full shadow-inner"></div>
                <div className="w-full h-full bg-[#ffcf00] rounded-full shadow-inner"></div>
                <div className="w-full h-full bg-[#ffcf00] rounded-full shadow-inner"></div>
                <div className="w-full h-full bg-[#ffcf00] rounded-full shadow-inner"></div>
              </div>
            </div>
            
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-lego text-3xl font-bold tracking-tight text-[#ffcf00] drop-shadow-sm">
                  LesGo
                </span>
                <span className="bg-white/20 text-white text-xs font-semibold px-2 py-0.5 rounded tracking-wider uppercase">
                  ERP
                </span>
              </div>
              <p className="text-xs text-red-100 font-medium tracking-wide">
                Módulo de Logística y Transporte
              </p>
            </div>
          </div>

          {/* Selector de Perfil y Rol (Simulador RBAC Sprint 3) */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center space-x-3 bg-red-700/60 hover:bg-red-700 px-3 py-1.5 rounded-xl border border-red-400/40 transition-all focus:outline-none focus:ring-2 focus:ring-[#ffcf00]"
              title="Haz clic para cambiar de rol y probar permisos (RBAC)"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-white tracking-wide flex items-center justify-end space-x-1">
                  <span>{user.nombre}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-red-200 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </p>
                <div className="flex items-center justify-end space-x-1 text-xs">
                  <CurrentRoleIcon className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="text-red-100 font-medium">{user.rol_nombre}</span>
                </div>
              </div>

              <div className="relative">
                <div className={`w-11 h-11 rounded-full text-white flex items-center justify-center font-bold text-base shadow-md border-2 border-white/80 ${user.avatar_color}`}>
                  {user.avatar_iniciales}
                </div>
                <span className={`absolute bottom-0 right-0 w-3 h-3 ${currentRoleStyle.dot} border-2 border-white rounded-full`}></span>
              </div>
            </button>

            {/* Dropdown Menu de Cambio de Rol */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 text-slate-800 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Users className="w-5 h-5 text-[#e52521]" />
                      <span className="font-bold text-sm text-slate-800">
                        Gestión de Usuarios y Roles (RBAC)
                      </span>
                    </div>
                    <span className="text-[10px] font-bold bg-[#ffcf00] text-slate-900 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Sprint 3
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Selecciona un perfil operativo para simular sus vistas, permisos de acción y restricciones:
                  </p>
                </div>

                <div className="p-2 space-y-2 max-h-96 overflow-y-auto">
                  {usuarios.map((u) => {
                    const isSelected = u.id_empleado === user.id_empleado;
                    const rStyle = getRoleBadgeStyle(u.rol);
                    const RoleIcon = rStyle.icon;

                    return (
                      <button
                        key={u.id_empleado}
                        onClick={() => {
                          switchUser(u.id_empleado);
                          setDropdownOpen(false);
                        }}
                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-start space-x-3 ${
                          isSelected
                            ? 'bg-red-50/70 border-[#e52521] shadow-sm'
                            : 'bg-white hover:bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm text-white ${u.avatar_color}`}>
                          {u.avatar_iniciales}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-slate-900 truncate">
                              {u.nombre}
                            </span>
                            {isSelected && (
                              <span className="flex items-center text-xs font-semibold text-[#e52521]">
                                <CheckCircle2 className="w-4 h-4 mr-1 text-[#e52521]" />
                                Activo
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-1.5 mt-0.5">
                            <RoleIcon className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-xs font-medium text-slate-600">
                              {u.rol_nombre}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                            {u.descripcion}
                          </p>

                          <div className="flex flex-wrap gap-1 mt-2">
                            {u.pestañas_permitidas.map((tab) => (
                              <span
                                key={tab}
                                className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200"
                              >
                                {tab === 'emision' && 'Emisión'}
                                {tab === 'tracking' && 'Tracking'}
                                {tab === 'recepcion' && 'Muelle'}
                              </span>
                            ))}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="p-3 bg-slate-100 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>RUT autenticado: <strong>{user.rut}</strong></span>
                  <span className="text-slate-400">ID Empleado: {user.id_empleado}</span>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Remate inferior almenado característico de ladrillos LEGO en color blanco */}
      <div className="w-full overflow-hidden leading-none h-3 bg-transparent">
        <svg
          className="w-full h-3 text-white"
          viewBox="0 0 1200 12"
          preserveAspectRatio="none"
          fill="currentColor"
        >
          {/* Almenas estilo dientes / espigas de bloques LEGO */}
          <pattern
            id="lego-studs"
            x="0"
            y="0"
            width="40"
            height="12"
            patternUnits="userSpaceOnUse"
          >
            {/* Espacio hueco y almena de 20px blanco */}
            <rect x="0" y="0" width="20" height="8" fill="#e52521" />
            <rect x="20" y="0" width="20" height="12" fill="#f8fafc" />
            <circle cx="30" cy="4" r="2.5" fill="#e2e8f0" />
          </pattern>
          <rect width="100%" height="12" fill="url(#lego-studs)" />
        </svg>
      </div>
    </header>
  );
};

// Pestañas de navegación ubicadas sobre el título de cada página
export const NavTabs: React.FC<NavTabsProps> = ({ activeTab, setActiveTab }) => {
  const { canAccessTab, user } = useAuth();

  const emisionPermitida = canAccessTab('emision');
  const trackingPermitido = canAccessTab('tracking');
  const recepcionPermitida = canAccessTab('recepcion');

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        
        {/* Pestañas funcionales con RBAC */}
        <nav className="flex space-x-2">
          {/* Pestaña: Emisión de Guía */}
          {emisionPermitida ? (
            <button
              onClick={() => setActiveTab('emision')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'emision'
                  ? 'bg-[#e52521] text-white shadow-md'
                  : 'bg-white text-slate-600 border border-slate-200 hover:text-[#e52521] hover:border-red-200'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Emisión de Guía</span>
            </button>
          ) : (
            <div
              className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-75"
              title={`Acceso bloqueado: El rol ${user.rol_nombre} no tiene permisos para emitir guías.`}
            >
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span className="line-through">Emisión de Guía</span>
              <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-500 font-bold">Bloqueado</span>
            </div>
          )}

          {/* Pestaña: Consola de Tracking */}
          {trackingPermitido ? (
            <button
              onClick={() => setActiveTab('tracking')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'tracking'
                  ? 'bg-[#e52521] text-white shadow-md'
                  : 'bg-white text-slate-600 border border-slate-200 hover:text-[#e52521] hover:border-red-200'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>Consola de Tracking</span>
            </button>
          ) : (
            <div
              className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-75"
              title={`Acceso bloqueado: El rol ${user.rol_nombre} no tiene permisos para la consola de tracking.`}
            >
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span className="line-through">Consola de Tracking</span>
              <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-500 font-bold">Bloqueado</span>
            </div>
          )}

          {/* Pestaña: Recepción en Muelle */}
          {recepcionPermitida ? (
            <button
              onClick={() => setActiveTab('recepcion')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'recepcion'
                  ? 'bg-[#e52521] text-white shadow-md'
                  : 'bg-white text-slate-600 border border-slate-200 hover:text-[#e52521] hover:border-red-200'
              }`}
            >
              <Inbox className="w-4 h-4" />
              <span>Recepción en Muelle</span>
            </button>
          ) : (
            <div
              className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-75"
              title={`Acceso bloqueado: El rol ${user.rol_nombre} no tiene permisos para recepción en muelle.`}
            >
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span className="line-through">Recepción en Muelle</span>
              <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-500 font-bold">Bloqueado</span>
            </div>
          )}
        </nav>

        {/* Indicador de rol activo y alcance */}
        <div className="flex items-center space-x-2 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 self-start sm:self-auto">
          <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
          <span>Vista activa:</span>
          <strong className="text-slate-800">{user.nombre}</strong>
          <span className="text-slate-300">|</span>
          <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-medium text-[11px]">
            {user.rol_nombre}
          </span>
        </div>

      </div>
    </div>
  );
};
