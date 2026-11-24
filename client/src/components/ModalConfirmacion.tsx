import React from 'react';
import { AlertTriangle, CheckCircle2, Copy, ExternalLink, X, PackageCheck } from 'lucide-react';
import { ConfirmacionStock, GuiaDespacho } from '../types';

interface ModalConfirmacionProps {
  guia: GuiaDespacho | null;
  /** Respuesta de Inventario al egreso; si no confirmó, la guía quedó en 'Error de stock' */
  inventario?: ConfirmacionStock | null;
  isOpen: boolean;
  onClose: () => void;
  onGoToTracking: (numSeguimiento?: string) => void;
}

export const ModalConfirmacion: React.FC<ModalConfirmacionProps> = ({
  guia,
  inventario,
  isOpen,
  onClose,
  onGoToTracking,
}) => {
  const [copiado, setCopiado] = React.useState(false);

  if (!isOpen || !guia) return null;

  const stockConfirmado = inventario ? inventario.ok : guia.estado_actual !== 'Error de stock';

  const copiarAlPortapapeles = () => {
    navigator.clipboard.writeText(guia.num_seguimiento);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all animate-in fade-in zoom-in-95">
        
        {/* Header con colores oficiales */}
        <div
          className={`${
            stockConfirmado ? 'bg-emerald-600' : 'bg-[#e52521]'
          } px-6 py-5 text-white flex items-center justify-between`}
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
              {stockConfirmado ? (
                <PackageCheck className="w-6 h-6 text-white" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-lg">
                {stockConfirmado ? '¡Guía de Despacho Emitida!' : 'Guía creada, falta confirmar stock'}
              </h3>
              <p className="text-xs text-white/80">
                {stockConfirmado
                  ? 'Inventario confirmó el egreso de stock'
                  : 'Inventario no confirmó el egreso de stock'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-6 space-y-5">
          {/* N° Seguimiento destacado */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Número de Seguimiento Oficial
            </span>
            <div className="flex items-center justify-center space-x-2">
              <span className="text-2xl font-black text-slate-900 tracking-wider font-mono">
                {guia.num_seguimiento}
              </span>
              <button
                onClick={copiarAlPortapapeles}
                title="Copiar número"
                className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            {copiado && (
              <span className="text-xs text-emerald-600 font-medium inline-block mt-1">
                ¡Copiado al portapapeles!
              </span>
            )}
          </div>

          {/* Resumen de la orden y despacho */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="text-xs text-slate-400 block">Orden de Trabajo (OT)</span>
              <span className="font-semibold text-slate-800">{guia.ot_id}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="text-xs text-slate-400 block">Identificador de Guía</span>
              <span className="font-semibold text-slate-800">{guia.id}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="text-xs text-slate-400 block">Transportista</span>
              <span className="font-semibold text-slate-800">
                {guia.transportista?.nombre || 'Transportista'}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="text-xs text-slate-400 block">Costo de Envío</span>
              <span className="font-bold text-emerald-700">
                ${Number(guia.costo_envio).toLocaleString('es-CL')} CLP
              </span>
            </div>
          </div>

          {stockConfirmado ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Egreso confirmado por Inventario</p>
                <p className="text-emerald-700">
                  La guía quedó en estado <span className="font-bold">"Preparado"</span>
                  {inventario?.id_movimiento_egreso && <> (movimiento de Inventario #{inventario.id_movimiento_egreso})</>}.
                  {inventario?.id_movimiento_liberacion && <> Lo no recolectado volvió a stock disponible.</>}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">La guía quedó en "Error de stock"</p>
                {inventario?.error && <p className="text-amber-800 mt-0.5">{inventario.error}</p>}
                <p className="text-amber-800 mt-1">
                  Reintente la confirmación desde la Consola de Tracking. Mientras tanto no se pueden registrar eventos de transporte.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer con acciones */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-semibold transition-colors"
          >
            Cerrar y Emitir Otra
          </button>
          <button
            onClick={() => onGoToTracking(guia.num_seguimiento)}
            className="px-4 py-2.5 rounded-xl bg-[#e52521] hover:bg-[#b91c1c] text-white text-sm font-semibold shadow-md flex items-center justify-center space-x-2 transition-all hover:shadow-lg"
          >
            <span>Ver en Consola de Tracking</span>
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
