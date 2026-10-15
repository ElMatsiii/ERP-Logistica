import React from 'react';
import { Package, Truck, UserCircle, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  activeTab: 'emision' | 'tracking';
  setActiveTab: (tab: 'emision' | 'tracking') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  return (
    <header className="relative bg-[#e52521] text-white shadow-md z-30 select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo & Marca LesGo */}
          <div className="flex items-center space-x-4">
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

            {/* Pestañas de navegación central */}
            <nav className="hidden md:flex ml-8 space-x-2">
              <button
                onClick={() => setActiveTab('emision')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === 'emision'
                    ? 'bg-white text-[#e52521] shadow-lg shadow-black/10 scale-105'
                    : 'text-white hover:bg-white/15'
                }`}
              >
                <Package className="w-4 h-4" />
                <span>Emisión de Guía</span>
              </button>

              <button
                onClick={() => setActiveTab('tracking')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === 'tracking'
                    ? 'bg-white text-[#e52521] shadow-lg shadow-black/10 scale-105'
                    : 'text-white hover:bg-white/15'
                }`}
              >
                <Truck className="w-4 h-4" />
                <span>Consola de Tracking</span>
              </button>
            </nav>
          </div>

          {/* Perfil de usuario en la esquina superior derecha */}
          <div className="flex items-center space-x-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-white tracking-wide">
                M. Pizarro
              </p>
              <div className="flex items-center justify-end space-x-1 text-xs text-red-100">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                <span>Coordinador de Despacho</span>
              </div>
            </div>

            <div className="relative">
              <div className="w-11 h-11 rounded-full bg-white text-[#e52521] flex items-center justify-center font-bold text-base shadow-md border-2 border-red-200">
                MP
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full"></span>
            </div>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden pb-3 space-x-2">
          <button
            onClick={() => setActiveTab('emision')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-bold ${
              activeTab === 'emision' ? 'bg-white text-[#e52521]' : 'bg-red-800/40 text-white'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Emisión de Guía</span>
          </button>
          <button
            onClick={() => setActiveTab('tracking')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-bold ${
              activeTab === 'tracking' ? 'bg-white text-[#e52521]' : 'bg-red-800/40 text-white'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Consola de Tracking</span>
          </button>
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
