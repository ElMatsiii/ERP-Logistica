import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { EmisionGuia } from './components/EmisionGuia';
import { ConsolaTracking } from './components/ConsolaTracking';
import { GuiaDespacho } from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<'emision' | 'tracking'>('emision');
  const [trackingSearch, setTrackingSearch] = useState<string>('');

  const handleGuiaEmitida = (guia: GuiaDespacho) => {
    // Permite que la consola de tracking conozca la nueva guía
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
      {/* Navbar corporativo LesGo */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Contenido principal según pestaña activa */}
      <main className="flex-1 pb-16">
        {activeTab === 'emision' ? (
          <EmisionGuia
            onGuiaEmitida={handleGuiaEmitida}
            onGoToTracking={handleGoToTracking}
          />
        ) : (
          <ConsolaTracking initialSearch={trackingSearch} />
        )}
      </main>

      {/* Footer corporativo */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-center space-x-2">
          <span className="font-bold text-[#e52521]">LesGo ERP</span>
          <span>-</span>
          <span>Sistemas de Información II</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
