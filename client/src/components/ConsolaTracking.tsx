import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Truck,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  RefreshCw,
  X,
  FileText,
  MapPin,
  Package,
  Layers,
  ChevronRight,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { GuiaDespacho, Transportista } from '../types';
import {
  fetchTracking,
  fetchTransportistas,
  registrarEventoTracking,
} from '../api/logisticaApi';
import { StatusBadge } from './StatusBadge';

interface ConsolaTrackingProps {
  initialSearch?: string;
}

export const ConsolaTracking: React.FC<ConsolaTrackingProps> = ({ initialSearch = '' }) => {
  // Filtros
  const [busqueda, setBusqueda] = useState<string>(initialSearch);
  const [filtroTransportista, setFiltroTransportista] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<string>('');
  const [filtroFecha, setFiltroFecha] = useState<string>('');

  // Datos
  const [guias, setGuias] = useState<GuiaDespacho[]>([]);
  const [transportistas, setTransportistas] = useState<Transportista[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Guía seleccionada para el Panel Lateral (Split View)
  const [guiaSeleccionada, setGuiaSeleccionada] = useState<GuiaDespacho | null>(null);

  // Formulario de nuevo evento
  const [nuevoEstado, setNuevoEstado] = useState<string>('En tránsito');
  const [nuevaObservacion, setNuevaObservacion] = useState<string>('');
  const [usuarioResponsable, setUsuarioResponsable] = useState<string>('M. Pizarro');
  const [guardandoEvento, setGuardandoEvento] = useState<boolean>(false);
  const [mensajeExitoEvento, setMensajeExitoEvento] = useState<string | null>(null);

  // Cargar datos de tracking
  const cargarTracking = async () => {
    try {
      setCargando(true);
      setError(null);
      const data = await fetchTracking({
        busqueda,
        transportista: filtroTransportista,
        estado: filtroEstado,
        fecha: filtroFecha,
      });
      setGuias(data);

      // Si había una guía seleccionada, actualizarla con los datos frescos
      if (guiaSeleccionada) {
        const actualizada = data.find((g) => g.id === guiaSeleccionada.id);
        if (actualizada) {
          setGuiaSeleccionada(actualizada);
        }
      } else if (data.length > 0) {
        // Seleccionar la primera guía por defecto en pantallas grandes
        setGuiaSeleccionada(data[0]);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al obtener bitácora de tracking.');
    } finally {
      setCargando(false);
    }
  };

  // Cargar lista de transportistas para el dropdown
  useEffect(() => {
    fetchTransportistas()
      .then((data) => setTransportistas(data))
      .catch((err) => console.error('Error cargando transportistas:', err));
  }, []);

  // Cargar tracking al cambiar filtros (con debounce para la búsqueda)
  useEffect(() => {
    const timer = setTimeout(() => {
      cargarTracking();
    }, 250);
    return () => clearTimeout(timer);
  }, [busqueda, filtroTransportista, filtroEstado, filtroFecha]);

  // Si llega un search inicial desde el prop, actualizarlo
  useEffect(() => {
    if (initialSearch) {
      setBusqueda(initialSearch);
    }
  }, [initialSearch]);

  // Manejador para registrar nuevo evento append-only
  const handleRegistrarEvento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guiaSeleccionada) return;

    try {
      setGuardandoEvento(true);
      setMensajeExitoEvento(null);

      const res = await registrarEventoTracking(guiaSeleccionada.id, {
        estado: nuevoEstado,
        observacion: nuevaObservacion || `Cambio de estado a "${nuevoEstado}" registrado en bitácora`,
        usuario_responsable: usuarioResponsable,
      });

      setMensajeExitoEvento('Evento registrado exitosamente en la bitácora.');
      setNuevaObservacion('');

      // Actualizar la guía activa en el panel lateral y en la lista principal
      setGuiaSeleccionada(res.guia);
      setGuias((prev) =>
        prev.map((item) => (item.id === res.guia.id ? res.guia : item))
      );

      setTimeout(() => setMensajeExitoEvento(null), 3000);
    } catch (err: any) {
      console.error('Error al registrar evento:', err);
      alert(err.message || 'Error al guardar evento en bitácora.');
    } finally {
      setGuardandoEvento(false);
    }
  };

  const estadosOpciones = [
    'Preparado',
    'Despachado',
    'En tránsito',
    'Entregado conforme',
    'Entrega Fallida',
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
      
      {/* Encabezado */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 bg-blue-600 rounded-full inline-block"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
              Sprint 2 - Monitoreo y Trazabilidad
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Consola de Tracking y Seguimiento
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Visualice el estado de los despachos emitidos y gestione la bitácora cronológica de eventos.
          </p>
        </div>

        <button
          onClick={cargarTracking}
          disabled={cargando}
          className="inline-flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 shadow-sm transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
          <span>Refrescar Lista</span>
        </button>
      </div>

      {/* ========================================================
          BARRA SUPERIOR CON INPUTS DE FILTRO
         ======================================================== */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Búsqueda por texto libre */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Búsqueda por texto
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="N° Guía, Tracking, Cliente..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-[#e52521] focus:outline-none transition-all"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

          {/* Filtro por Transportista */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Transportista
            </label>
            <select
              value={filtroTransportista}
              onChange={(e) => setFiltroTransportista(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#e52521] focus:outline-none transition-all"
            >
              <option value="">Todos los transportistas</option>
              {transportistas.map((t) => (
                <option key={t.id} value={t.nombre}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Estado */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Estado del Envío
            </label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#e52521] focus:outline-none transition-all"
            >
              <option value="">Todos los estados</option>
              {estadosOpciones.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Fecha */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Fecha de Emisión
            </label>
            <div className="relative">
              <input
                type="date"
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#e52521] focus:outline-none transition-all"
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

        </div>

        {/* Resumen de resultados filtrados */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            Mostrando <strong>{guias.length}</strong> guías de despacho registradas
          </span>
          {(busqueda || filtroTransportista || filtroEstado || filtroFecha) && (
            <button
              onClick={() => {
                setBusqueda('');
                setFiltroTransportista('');
                setFiltroEstado('');
                setFiltroFecha('');
              }}
              className="text-[#e52521] font-semibold hover:underline"
            >
              Limpiar todos los filtros
            </button>
          )}
        </div>
      </div>

      {/* ========================================================
          SPLIT VIEW: TABLA PRINCIPAL + PANEL LATERAL DE DETALLE
         ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* TABLA PRINCIPAL DE GUÍAS (7 o 12 cols según selección) */}
        <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ${
          guiaSeleccionada ? 'lg:col-span-7' : 'lg:col-span-12'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">N° Guía / Tracking</th>
                  <th className="py-3 px-4">Pedido / OT</th>
                  <th className="py-3 px-4">Cliente / Comuna</th>
                  <th className="py-3 px-4">Transportista</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {guias.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold">No se encontraron guías con los filtros aplicados</p>
                      <p className="text-[11px] mt-1">Pruebe modificando los términos de búsqueda.</p>
                    </td>
                  </tr>
                ) : (
                  guias.map((g) => {
                    const isSelected = guiaSeleccionada?.id === g.id;
                    const clienteNombre =
                      g.ot?.cliente_nombre || g.direccion?.cliente_nombre || 'Cliente';
                    const comunaNombre =
                      g.direccion?.comuna?.nombre || 'Comuna Destino';

                    return (
                      <tr
                        key={g.id}
                        onClick={() => setGuiaSeleccionada(g)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-red-50/80 font-medium border-l-4 border-l-[#e52521]'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3.5 px-4 font-mono">
                          <span className="font-bold text-slate-900 block">{g.id}</span>
                          <span className="text-[11px] text-slate-500">{g.num_seguimiento}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-800 block">
                            {g.ot?.id_pedido || 'Pedido'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{g.ot_id}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-800 block truncate max-w-[140px]">
                            {clienteNombre}
                          </span>
                          <span className="text-[11px] text-slate-500 flex items-center space-x-1">
                            <MapPin className="w-3 h-3 text-red-400 inline" />
                            <span>{comunaNombre}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          {g.transportista?.nombre || 'Transportista'}
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={g.estado_actual} type="guia" />
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                          {new Date(g.fecha_emision).toLocaleDateString('es-CL')}
                        </td>
                        <td className="py-3.5 px-2 text-right">
                          <ChevronRight className={`w-4 h-4 text-slate-400 ${isSelected ? 'text-[#e52521]' : ''}`} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ========================================================
            PANEL LATERAL DE DETALLE (SPLIT VIEW)
           ======================================================== */}
        {guiaSeleccionada && (
          <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden sticky top-6 animate-in fade-in slide-in-from-right-4">
            
            {/* Header del Panel Lateral */}
            <div className="bg-slate-900 text-white p-5 flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400 block mb-0.5">
                  Detalle del Envío
                </span>
                <h3 className="text-xl font-black tracking-tight font-mono text-[#ffcf00]">
                  {guiaSeleccionada.num_seguimiento}
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Guía: <strong>{guiaSeleccionada.id}</strong> | OT: <strong>{guiaSeleccionada.ot_id}</strong>
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <StatusBadge status={guiaSeleccionada.estado_actual} type="guia" />
                <button
                  onClick={() => setGuiaSeleccionada(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-6 max-h-[calc(100vh-140px)] overflow-y-auto">
              
              {/* Información General del Envío */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block font-medium">Destinatario</span>
                  <p className="font-bold text-slate-800 mt-0.5">
                    {guiaSeleccionada.ot?.cliente_nombre || guiaSeleccionada.direccion?.cliente_nombre || 'Cliente'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {guiaSeleccionada.direccion?.calle} #{guiaSeleccionada.direccion?.numero}
                  </p>
                  <p className="text-[11px] text-slate-600 font-semibold">
                    {guiaSeleccionada.direccion?.comuna?.nombre}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block font-medium">Servicio y Costo</span>
                  <p className="font-bold text-slate-800 mt-0.5">
                    {guiaSeleccionada.transportista?.nombre}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {guiaSeleccionada.servicio?.nombre}
                  </p>
                  <p className="text-[11px] font-bold text-emerald-700 mt-1">
                    ${Number(guiaSeleccionada.costo_envio).toLocaleString('es-CL')} CLP
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block font-medium">Peso Real Total</span>
                  <p className="text-sm font-extrabold text-slate-900 mt-0.5 font-mono">
                    {Number(guiaSeleccionada.peso_real_total_kg)} kg
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block font-medium">Peso Volumétrico</span>
                  <p className="text-sm font-extrabold text-slate-900 mt-0.5 font-mono">
                    {Number(guiaSeleccionada.peso_volumetrico_total_kg)} kg
                  </p>
                </div>
              </div>

              {/* LÍNEA DE TIEMPO VERTICAL (log_evento_tracking) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#e52521]" />
                    <span>Línea de Tiempo y Bitácora</span>
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    {guiaSeleccionada.eventos?.length || 0} eventos registrados
                  </span>
                </div>

                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {guiaSeleccionada.eventos && guiaSeleccionada.eventos.length > 0 ? (
                    guiaSeleccionada.eventos.map((ev, index) => {
                      const isLatest = index === (guiaSeleccionada.eventos?.length || 0) - 1;
                      const fechaFormat = new Date(ev.fecha_hora).toLocaleString('es-CL', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <div key={ev.id || index} className="relative group">
                          {/* Punto en la línea */}
                          <span
                            className={`absolute -left-6 top-1 w-3 h-3 rounded-full border-2 border-white ${
                              isLatest
                                ? 'bg-[#e52521] ring-4 ring-red-100'
                                : 'bg-slate-400'
                            }`}
                          ></span>

                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-slate-800">
                                {ev.estado}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {fechaFormat}
                              </span>
                            </div>
                            <p className="text-slate-600 text-[11px] leading-relaxed">
                              {ev.observacion}
                            </p>
                            <div className="mt-1.5 pt-1 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400">
                              <span>Responsable: <strong className="text-slate-600">{ev.usuario_responsable}</strong></span>
                              <span className="font-mono text-[9px] text-slate-400">#EV-{ev.id}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-400">No hay eventos registrados en bitácora.</p>
                  )}
                </div>
              </div>

              {/* ========================================================
                  FORMULARIO DE ACTUALIZACIÓN DE EVENTOS (APPEND-ONLY)
                 ======================================================== */}
              <div className="pt-4 border-t border-slate-200">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
                  <PlusCircle className="w-3.5 h-3.5 text-blue-600" />
                  <span>Registrar nuevo evento en bitácora</span>
                </h4>

                {mensajeExitoEvento && (
                  <div className="mb-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>{mensajeExitoEvento}</span>
                  </div>
                )}

                <form onSubmit={handleRegistrarEvento} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Nuevo Estado del Envío
                    </label>
                    <select
                      value={nuevoEstado}
                      onChange={(e) => setNuevoEstado(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#e52521] focus:outline-none"
                    >
                      {estadosOpciones.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Observaciones / Bitácora
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ingrese detalles del suceso (ej: Arribo a HUB regional, entregado a conserjería, reintento programado)..."
                      value={nuevaObservacion}
                      onChange={(e) => setNuevaObservacion(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#e52521] focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-400">
                      Operador: <strong className="text-slate-600">{usuarioResponsable}</strong>
                    </span>

                    <button
                      type="submit"
                      disabled={guardandoEvento}
                      className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm"
                    >
                      {guardandoEvento ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Guardando...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5 text-[#ffcf00]" />
                          <span>Registrar evento</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
