import React, { useState, useEffect } from 'react';
import {
  Package,
  Truck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Star,
  HelpCircle,
  Calculator,
  MapPin,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import {
  OTPicking,
  Transportista,
  BultoInput,
  GuiaDespacho,
} from '../types';
import {
  fetchPedidosPendientes,
  fetchOtById,
  fetchTransportistas,
  cotizarEnvio,
  emitirGuiaDespacho,
} from '../api/logisticaApi';
import { StatusBadge } from './StatusBadge';
import { ModalConfirmacion } from './ModalConfirmacion';

interface EmisionGuiaProps {
  onGuiaEmitida: (guia: GuiaDespacho) => void;
  onGoToTracking: (numSeguimiento?: string) => void;
}

export const EmisionGuia: React.FC<EmisionGuiaProps> = ({
  onGuiaEmitida,
  onGoToTracking,
}) => {
  // Estados para datos maestros
  const [ots, setOts] = useState<OTPicking[]>([]);
  const [transportistas, setTransportistas] = useState<Transportista[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // Estados del formulario
  const [otSeleccionadaId, setOtSeleccionadaId] = useState<string>('');
  const [otActual, setOtActual] = useState<OTPicking | null>(null);
  const [transportistaId, setTransportistaId] = useState<number>(1);
  const [servicioId, setServicioId] = useState<number>(1);

  // Dimensiones del bulto para cubicación interactiva
  const [dimensiones, setDimensiones] = useState<BultoInput>({
    largo_cm: 50,
    alto_cm: 40,
    ancho_cm: 30,
    peso_real_kg: 5.0,
  });

  // Estados de cálculo en tiempo real
  const [pesoVolumetrico, setPesoVolumetrico] = useState<number>(0);
  const [pesoCobrado, setPesoCobrado] = useState<number>(0);
  const [factorVolumetrico, setFactorVolumetrico] = useState<number>(5000);
  const [tarifaEstimada, setTarifaEstimada] = useState<number>(0);
  const [tieneCobertura, setTieneCobertura] = useState<boolean>(true);
  const [comunaDestino, setComunaDestino] = useState<string>('');

  // Estados de emisión
  const [emitirCargando, setEmitirCargando] = useState<boolean>(false);
  const [errorEmision, setErrorEmision] = useState<string | null>(null);
  const [guiaEmitidaReciente, setGuiaEmitidaReciente] = useState<GuiaDespacho | null>(null);
  const [modalAbierto, setModalAbierto] = useState<boolean>(false);

  // Cargar lista inicial de OTs y Transportistas
  const cargarDatos = async () => {
    try {
      setCargando(true);
      setErrorCarga(null);
      const [listaOts, listaTransp] = await Promise.all([
        fetchPedidosPendientes(),
        fetchTransportistas(),
      ]);
      setOts(listaOts);
      setTransportistas(listaTransp);

      // Preseleccionar la primera OT disponible si no hay seleccionada
      if (listaOts.length > 0 && !otSeleccionadaId) {
        // Preferir una OT con estado CERRADO para buena UX inicial
        const otCerrada = listaOts.find((o) => o.estado === 'CERRADO') || listaOts[0];
        setOtSeleccionadaId(otCerrada.id);
      }

      // Preseleccionar transportista
      if (listaTransp.length > 0) {
        setTransportistaId(listaTransp[0].id);
        if (listaTransp[0].servicios && listaTransp[0].servicios.length > 0) {
          setServicioId(listaTransp[0].servicios[0].id);
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorCarga(err.message || 'Error de conexión con el backend.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Al cambiar la OT seleccionada, obtener su detalle completo y empaque sugerido
  useEffect(() => {
    if (!otSeleccionadaId) return;

    let cancelado = false;
    const fetchDetalle = async () => {
      try {
        const otDetalle = await fetchOtById(otSeleccionadaId);
        if (cancelado) return;
        setOtActual(otDetalle);
        setComunaDestino(otDetalle.direccion?.comuna?.nombre || '');

        // Si la OT tiene empaque sugerido, actualizar dimensiones
        if (otDetalle.empaque_sugerido) {
          setDimensiones({
            largo_cm: otDetalle.empaque_sugerido.largo_cm,
            alto_cm: otDetalle.empaque_sugerido.alto_cm,
            ancho_cm: otDetalle.empaque_sugerido.ancho_cm,
            peso_real_kg: otDetalle.empaque_sugerido.peso_real_kg,
          });
        }
      } catch (err: any) {
        if (!cancelado) {
          console.error('Error al cargar detalle de OT:', err);
        }
      }
    };

    fetchDetalle();
    return () => {
      cancelado = true;
    };
  }, [otSeleccionadaId]);

  // Actualizar factor volumétrico según el transportista seleccionado
  useEffect(() => {
    const t = transportistas.find((x) => x.id === transportistaId);
    if (t) {
      const factor = t.factor_volumetrico_default || 5000;
      setFactorVolumetrico(factor);

      // Si el servicio actual no pertenece al transportista seleccionado, cambiar al primero
      if (!t.servicios.some((s) => s.id === servicioId) && t.servicios.length > 0) {
        setServicioId(t.servicios[0].id);
      }
    }
  }, [transportistaId, transportistas]);

  // Cálculo en tiempo real de Cubicacion (Largo * Alto * Ancho / Factor) y Cotización
  useEffect(() => {
    const largo = Number(dimensiones.largo_cm) || 0;
    const alto = Number(dimensiones.alto_cm) || 0;
    const ancho = Number(dimensiones.ancho_cm) || 0;
    const real = Number(dimensiones.peso_real_kg) || 0;

    const factor = factorVolumetrico > 0 ? factorVolumetrico : 5000;
    const vol = Number(((largo * alto * ancho) / factor).toFixed(2));
    const cobrado = Number(Math.max(real, vol).toFixed(2));

    setPesoVolumetrico(vol);
    setPesoCobrado(cobrado);

    // Cotización remota si la OT está disponible
    if (otSeleccionadaId && transportistaId && servicioId && largo > 0 && alto > 0 && ancho > 0 && real > 0) {
      cotizarEnvio({
        ot_id: otSeleccionadaId,
        transportista_id: transportistaId,
        servicio_id: servicioId,
        bultos: [dimensiones],
      })
        .then((res) => {
          setTieneCobertura(res.tiene_cobertura);
          setTarifaEstimada(res.costo_estimado);
        })
        .catch(() => {
          // Si falla cotización remota, estimar localmente
          setTarifaEstimada(4500 + Math.max(0, Math.ceil(cobrado - 2) * 1100));
        });
    }
  }, [dimensiones, factorVolumetrico, otSeleccionadaId, transportistaId, servicioId]);

  // Manejo de emisión de guía
  const handleEmitirGuia = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorEmision(null);

    // Validación en Frontend antes de enviar
    if (!otActual) {
      setErrorEmision('Seleccione una orden de trabajo.');
      return;
    }

    if (otActual.estado !== 'CERRADO') {
      setErrorEmision('No se puede emitir guía: la OT no se encuentra en estado CERRADO.');
      return;
    }

    if (
      dimensiones.largo_cm <= 0 ||
      dimensiones.alto_cm <= 0 ||
      dimensiones.ancho_cm <= 0 ||
      dimensiones.peso_real_kg <= 0
    ) {
      setErrorEmision('El peso real y las dimensiones deben ser estrictamente mayores a 0.');
      return;
    }

    if (!tieneCobertura) {
      setErrorEmision(
        'El servicio seleccionado no cuenta con cobertura vigente en la comuna de destino.'
      );
      return;
    }

    try {
      setEmitirCargando(true);
      const res = await emitirGuiaDespacho({
        ot_id: otActual.id,
        transportista_id: transportistaId,
        servicio_id: servicioId,
        bultos: [dimensiones],
        usuario_responsable: 'M. Pizarro (Coordinador de Despacho)',
      });

      setGuiaEmitidaReciente(res.guia);
      setModalAbierto(true);
      onGuiaEmitida(res.guia);

      // Recargar lista de OTs para reflejar cualquier cambio
      cargarDatos();
    } catch (err: any) {
      console.error('Error al emitir guía:', err);
      setErrorEmision(err.message || 'Error transaccional al emitir guía.');
    } finally {
      setEmitirCargando(false);
    }
  };

  const transportistaSeleccionado = transportistas.find((t) => t.id === transportistaId);
  const serviciosDisponibles = transportistaSeleccionado ? transportistaSeleccionado.servicios : [];
  const servicioSeleccionado = serviciosDisponibles.find((s) => s.id === servicioId);

  const otEsCerrada = otActual?.estado === 'CERRADO';
  const pesoMayorEsVolumetrico = pesoVolumetrico > dimensiones.peso_real_kg;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
      
      {/* Encabezado del Formulario */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 bg-[#e52521] rounded-full inline-block"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#e52521]">
              Sprint 2 - Módulo Operativo
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Emisión de Guía de Despacho
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Valida empaque con cubicación en tiempo real, asigna transportista y rebaja existencias de inventario.
          </p>
        </div>

        <button
          onClick={cargarDatos}
          disabled={cargando}
          className="self-start md:self-auto inline-flex items-center space-x-2 px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
          <span>Actualizar Datos</span>
        </button>
      </div>

      {errorCarga && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Aviso del servidor</p>
            <p>{errorCarga}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleEmitirGuia} className="space-y-8">
        
        {/* ========================================================
            SECCIÓN 1: SELECCIÓN DE PEDIDO Y CLIENTE
           ======================================================== */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-red-50 text-[#e52521] flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Orden de Trabajo de Picking y Cliente
                </h2>
                <p className="text-xs text-slate-500">
                  Seleccione la orden recolectada para validar el despacho.
                </p>
              </div>
            </div>

            {otActual && <StatusBadge status={otActual.estado} type="ot" />}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Selector de OT */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Seleccionar Orden de Trabajo (OT)
              </label>
              <select
                value={otSeleccionadaId}
                onChange={(e) => setOtSeleccionadaId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e52521] focus:border-transparent transition-all shadow-sm"
              >
                {ots.map((ot) => (
                  <option key={ot.id} value={ot.id}>
                    {ot.id} — Pedido {ot.id_pedido} ({ot.estado}) - {ot.cliente_nombre || 'Cliente'}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Total de órdenes disponibles en almacén: {ots.length}
              </span>
            </div>

            {/* Datos del Cliente y Pedido */}
            <div className="lg:col-span-2 bg-slate-50/70 rounded-xl p-4 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <span className="text-xs text-slate-400 block font-medium">Cliente Titular</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">
                  {otActual?.cliente_nombre || otActual?.direccion?.cliente_nombre || 'No especificado'}
                </p>
                <span className="text-xs text-slate-500 font-mono">
                  RUT: {otActual?.cliente_rut || otActual?.direccion?.cliente_rut || '17.291.844-3'}
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block font-medium">Dirección de Destino</span>
                <p className="text-sm font-semibold text-slate-800 mt-0.5 flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-red-500 inline flex-shrink-0" />
                  <span>
                    {otActual?.direccion?.calle} #{otActual?.direccion?.numero}
                  </span>
                </p>
                <span className="text-xs text-slate-600">
                  {otActual?.direccion?.depto ? `${otActual.direccion.depto}, ` : ''}
                  {otActual?.direccion?.comuna?.nombre} ({otActual?.direccion?.comuna?.region?.nombre})
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block font-medium">Operador de Picking</span>
                <p className="text-sm font-semibold text-slate-800 mt-0.5">
                  {otActual?.nombre_operador || 'Operador Asignado'}
                </p>
                <span className="text-xs text-slate-400">
                  Creada: {otActual?.fecha_creacion ? new Date(otActual.fecha_creacion).toLocaleDateString('es-CL') : 'Hoy'}
                </span>
              </div>
            </div>
          </div>

          {/* ALERTA DE BLOQUEO SI LA OT NO ESTÁ CERRADA (Regla de negocio estricta) */}
          {otActual && !otEsCerrada && (
            <div className="mt-5 p-4 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-900 flex items-start space-x-3.5 animate-in slide-in-from-top-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold">
                  Bloqueo de Regla de Negocio: La OT {otActual.id} se encuentra en estado "{otActual.estado}"
                </p>
                <p className="text-xs text-amber-800 mt-1">
                  Por norma operacional de LesGo ERP, solo las órdenes en estado <span className="font-bold underline">CERRADO</span> (recolección al 100%) pueden emitir guía de despacho y egresar existencias de inventario.
                  El botón de emisión permanecerá deshabilitado.
                </p>
              </div>
            </div>
          )}

          {/* Lista de sets LEGO incluidos en la OT */}
          {otActual?.detalles && otActual.detalles.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                Sets LEGO en la orden:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {otActual.detalles.map((prod) => (
                  <div
                    key={prod.id}
                    className="flex items-center space-x-2.5 p-2 rounded-lg bg-white border border-slate-200 text-xs shadow-2xs"
                  >
                    <div className="w-7 h-7 rounded bg-[#ffcf00]/30 border border-[#ffcf00] flex items-center justify-center font-bold text-amber-800 flex-shrink-0">
                      <svg
                        className="w-4 h-4 text-amber-800"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="8" width="18" height="12" rx="2" />
                        <path d="M7 8V6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2" />
                        <path d="M13 8V6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2" />
                      </svg>
                    </div>
                    <div className="truncate flex-1">
                      <p className="font-bold text-slate-800 truncate">{prod.nombre_producto}</p>
                      <span className="text-[10px] text-slate-400 font-mono">
                        SKU: {prod.sku} | Cant: {prod.cant_solicitada}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================
            SECCIÓN 2: DETALLE DEL BULTO Y CUBICACIÓN INTERACTIVA
           ======================================================== */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-100 mb-6">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#006cb7] flex items-center justify-center font-bold">
              2
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Detalle del Bulto y Cubicación en Tiempo Real
              </h2>
              <p className="text-xs text-slate-500">
                Modifique las medidas del embalaje para calcular el peso volumétrico y el peso facturable.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Inputs interactivos */}
            <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Largo (cm)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    value={dimensiones.largo_cm}
                    onChange={(e) =>
                      setDimensiones({ ...dimensiones, largo_cm: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#006cb7] focus:outline-none transition-all"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">cm</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Alto (cm)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    value={dimensiones.alto_cm}
                    onChange={(e) =>
                      setDimensiones({ ...dimensiones, alto_cm: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#006cb7] focus:outline-none transition-all"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">cm</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Ancho (cm)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    value={dimensiones.ancho_cm}
                    onChange={(e) =>
                      setDimensiones({ ...dimensiones, ancho_cm: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#006cb7] focus:outline-none transition-all"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">cm</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Peso Real (kg)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    value={dimensiones.peso_real_kg}
                    onChange={(e) =>
                      setDimensiones({ ...dimensiones, peso_real_kg: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#006cb7] focus:outline-none transition-all"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">kg</span>
                </div>
              </div>

              <div className="col-span-2 sm:col-span-4 text-xs text-slate-400 flex items-center justify-between">
                <span>
                  Factor volumétrico aplicado: <strong className="text-slate-700">{factorVolumetrico}</strong> (según transportista)
                </span>
                <span>
                  Fórmula: (L × A × An) ÷ {factorVolumetrico}
                </span>
              </div>
            </div>

            {/* Consola de Resultados de Cubicación en Vivo */}
            <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-lg border border-slate-700 relative overflow-hidden">
              <div className="absolute top-0 right-0 translate-x-4 -translate-y-4 w-28 h-28 bg-[#ffcf00]/10 rounded-full blur-xl pointer-events-none"></div>

              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                  <Calculator className="w-3.5 h-3.5 text-[#ffcf00]" />
                  <span>Cálculo de Tarifación</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-slate-300">
                  DINÁMICO
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className={`p-3 rounded-xl border transition-all ${
                  !pesoMayorEsVolumetrico ? 'bg-white/10 border-emerald-400/50 shadow-inner' : 'bg-white/5 border-white/5'
                }`}>
                  <span className="text-[11px] text-slate-400 block font-medium">Peso Real</span>
                  <p className="text-xl font-bold font-mono text-white">
                    {dimensiones.peso_real_kg} <span className="text-xs text-slate-400">kg</span>
                  </p>
                  {!pesoMayorEsVolumetrico && (
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center mt-0.5">
                      <Star className="w-3 h-3 mr-1 fill-current" />
                      <span>Mayor (Cobrado)</span>
                    </span>
                  )}
                </div>

                <div className={`p-3 rounded-xl border transition-all ${
                  pesoMayorEsVolumetrico ? 'bg-white/10 border-amber-400/50 shadow-inner' : 'bg-white/5 border-white/5'
                }`}>
                  <span className="text-[11px] text-slate-400 block font-medium">Peso Volumétrico</span>
                  <p className="text-xl font-bold font-mono text-white">
                    {pesoVolumetrico} <span className="text-xs text-slate-400">kg</span>
                  </p>
                  {pesoMayorEsVolumetrico && (
                    <span className="text-[10px] text-amber-400 font-bold flex items-center mt-0.5">
                      <Star className="w-3 h-3 mr-1 fill-current" />
                      <span>Mayor (Cobrado)</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Peso final a facturar */}
              <div className="pt-3 border-t border-slate-700/80 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-300 block font-medium">
                    Peso a Cobrar (Facturable)
                  </span>
                  <span className="text-xs text-slate-400">
                    Max(Peso Real, Peso Volumétrico)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black font-mono text-[#ffcf00]">
                    {pesoCobrado} kg
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ========================================================
            SECCIÓN 3: TRANSPORTE Y COTIZACIÓN ESTIMADA
           ======================================================== */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-100 mb-6">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              3
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Selección de Transportista y Verificación de Cobertura
              </h2>
              <p className="text-xs text-slate-500">
                Elija la empresa logística para la comuna de destino y compruebe tarifas.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Selector de Transportista */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Transportista
              </label>
              <select
                value={transportistaId}
                onChange={(e) => setTransportistaId(parseInt(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all shadow-sm"
              >
                {transportistas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre} (Factor: {t.factor_volumetrico_default})
                  </option>
                ))}
              </select>
            </div>

            {/* Selector de Servicio */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Tipo de Servicio
              </label>
              <select
                value={servicioId}
                onChange={(e) => setServicioId(parseInt(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all shadow-sm"
              >
                {serviciosDisponibles.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} ({s.dias_transito_comprometidos}d de tránsito)
                  </option>
                ))}
              </select>
            </div>

            {/* Preview de Tarifa y Cobertura */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="text-xs text-slate-400 block font-medium">Estado de Cobertura</span>
                <div className="flex items-center space-x-2 mt-1">
                  {tieneCobertura ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                      <CheckCircle className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
                      <span>Cobertura Vigente en {comunaDestino || 'Comuna'}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800">
                      <XCircle className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
                      <span>Sin Cobertura en {comunaDestino || 'Comuna'}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-200/80 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Tarifa estimada:</span>
                <span className="text-lg font-extrabold text-slate-900 font-mono">
                  ${tarifaEstimada.toLocaleString('es-CL')} CLP
                </span>
              </div>
            </div>
          </div>

          {/* Preview del N° de Guía generado dinámicamente */}
          <div className="mt-5 p-3.5 bg-slate-100/70 border border-dashed border-slate-300 rounded-xl flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium flex items-center space-x-2">
              <Truck className="w-4 h-4 text-slate-500" />
              <span>
                Prefijo sugerido para seguimiento: <strong className="text-slate-900 font-mono">{transportistaSeleccionado?.nombre.toUpperCase().includes('CHILE') ? 'CHX-2026-XXXXXX' : 'STK-2026-XXXXXX'}</strong>
              </span>
            </span>
            <span className="text-slate-400 font-mono">Formato único ERP LesGo</span>
          </div>
        </div>

        {/* ERROR DE VALIDACIÓN O EMISIÓN */}
        {errorEmision && (
          <div className="p-4 rounded-xl bg-red-50 border-2 border-red-300 text-red-900 text-sm flex items-start space-x-3 animate-in shake">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">No fue posible emitir la guía de despacho</p>
              <p className="text-xs text-red-800 mt-0.5">{errorEmision}</p>
            </div>
          </div>
        )}

        {/* BOTÓN PRINCIPAL DE EMISIÓN */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-4 gap-4">
          <div className="text-xs text-slate-500">
            * Al emitir la guía se insertarán en una sola transacción: <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-mono">log_guia_despacho</code>, <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-mono">log_bulto</code>, <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-mono">log_evento_tracking</code> y <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-mono">inv_mov</code>.
          </div>

          <button
            type="submit"
            disabled={!otEsCerrada || !tieneCobertura || emitirCargando}
            className={`w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center space-x-2 ${
              !otEsCerrada || !tieneCobertura || emitirCargando
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-[#e52521] hover:bg-[#b91c1c] text-white hover:shadow-lg active:scale-95'
            }`}
          >
            {emitirCargando ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Procesando Transacción...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Emitir guía y rebajar inventario</span>
              </>
            )}
          </button>
        </div>

      </form>

      {/* Modal de confirmación al emitir exitosamente */}
      <ModalConfirmacion
        isOpen={modalAbierto}
        guia={guiaEmitidaReciente}
        onClose={() => setModalAbierto(false)}
        onGoToTracking={onGoToTracking}
      />
    </div>
  );
};
