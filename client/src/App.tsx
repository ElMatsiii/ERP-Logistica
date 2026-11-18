import React, { useState, useEffect } from 'react';
import { Navbar, NavTabs } from './components/Navbar';
import { EmisionGuia } from './components/EmisionGuia';
import { ConsolaTracking } from './components/ConsolaTracking';
import { RecepcionMuelle } from './components/RecepcionMuelle';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GuiaDespacho } from './types';
import { ShieldAlert, ArrowRight, Lock } from 'lucide-react';

function AppContent() {
  const { user, canAccessTab } = useAuth();
  const [activeTab, setActiveTab] = useState<'emision' | 'tracking' | 'recepcion'>('emision');
  const [trackingSearch, setTrackingSearch] = useState<string>('');

  // Sincronización automática de pestaña al cambiar de rol:
  // Si el nuevo rol no tiene acceso a la pestaña actual, redirige a su primera pestaña permitida
  useEffect(() => {
    if (!canAccessTab(activeTab)) {
      if (user.pestañas_permitidas.length > 0) {
        setActiveTab(user.pestañas_permitidas[0]);
      }
    }
  }, [user, activeTab, canAccessTab]);

  const handleGuiaEmitida = (guia: GuiaDespacho) => {
    setTrackingSearch(guia.num_seguimiento);
  };

  const handleGoToTracking = (numSeguimiento?: string) => {
    if (numSeguimiento) {
      setTrackingSearch(numSeguimiento);
    }
    setActiveTab('tracking');
  };

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col font-sans">
      {/* Navbar corporativo LesGo con Selector de Roles RBAC */}
      <Navbar />

      {/* Pestañas de navegación con validación de permisos */}
      <NavTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Contenido principal según pestaña activa y control de acceso */}
      <main className="flex-1 pb-16">
        {!canAccessTab(activeTab) ? (
          <div className="max-w-3xl mx-auto mt-12 p-8 bg-white rounded-2xl border border-red-200 shadow-lg text-center">
            <div className="w-16 h-16 bg-red-100 text-[#e52521] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">
              Acceso Restringido por Control de Roles (RBAC)
            </h2>
            <p className="text-sm text-slate-600 mt-2 max-w-lg mx-auto">
              El usuario actual <strong>{user.nombre}</strong> con rol <strong>{user.rol_nombre}</strong> no posee los permisos necesarios para acceder al módulo de{' '}
              <span className="font-semibold text-slate-900">
                {activeTab === 'emision' && 'Emisión de Guías'}
                {activeTab === 'tracking' && 'Consola de Tracking'}
                {activeTab === 'recepcion' && 'Recepción en Muelle'}
              </span>.
            </p>

            <div className="mt-6 flex items-center justify-center space-x-3">
              <button
                onClick={() => setActiveTab(user.pestañas_permitidas[0])}
                className="inline-flex items-center space-x-2 px-5 py-2.5 bg-[#e52521] hover:bg-red-700 text-white text-sm font-semibold rounded-xl shadow-md transition-colors"
              >
                <span>Ir a mi vista permitida</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : activeTab === 'emision' ? (
          <EmisionGuia
            onGuiaEmitida={handleGuiaEmitida}
            onGoToTracking={handleGoToTracking}
          />
        ) : activeTab === 'tracking' ? (
          <ConsolaTracking initialSearch={trackingSearch} />
        ) : (
          <RecepcionMuelle />
        )}
      </main>

      {/* Footer corporativo */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-[#e52521]">LesGo ERP</span>
            <span>-</span>
            <span>Módulo de Logística y Transporte (Grupo 6)</span>
          </div>
          <div className="text-slate-400">
            Control de Acceso Basado en Roles (RBAC) · Sprint 3
          </div>
        </div>
      </footer>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
