import React from 'react';
import { Check, AlertTriangle, Truck, Package, Tag } from 'lucide-react';
import { EstadoOT } from '../types';

interface StatusBadgeProps {
  status: EstadoOT | string;
  type?: 'ot' | 'guia';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'ot' }) => {
  const normalized = (status || '').toUpperCase().trim();

  if (type === 'ot') {
    switch (normalized) {
      case 'CERRADO':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span className="w-2 h-2 mr-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            CERRADO (Listo para Despacho)
          </span>
        );
      case 'PENDIENTE':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <span className="w-2 h-2 mr-1.5 rounded-full bg-amber-500"></span>
            PENDIENTE (Sin recolección)
          </span>
        );
      case 'PARCIAL':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <span className="w-2 h-2 mr-1.5 rounded-full bg-rose-500"></span>
            PARCIAL (Incompleto)
          </span>
        );
      case 'EN_PROCESO':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            <span className="w-2 h-2 mr-1.5 rounded-full bg-blue-500"></span>
            EN PROCESO
          </span>
        );
    }
  }

  // Guías de Despacho
  switch (status) {
    case 'Entregado conforme':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <Check className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
          <span>{status}</span>
        </span>
      );
    case 'Entrega Fallida':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
          <AlertTriangle className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
          <span>{status}</span>
        </span>
      );
    case 'En tránsito':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-300">
          <Truck className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
          <span>{status}</span>
        </span>
      );
    case 'Despachado':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-300">
          <Package className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
          <span>{status}</span>
        </span>
      );
    case 'Preparado':
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
          <Tag className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
          <span>{status}</span>
        </span>
      );
  }
};
