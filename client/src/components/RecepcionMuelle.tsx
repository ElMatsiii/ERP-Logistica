import React, { useState, useEffect } from 'react';
import {
  Inbox,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Package,
  Layers,
  Building2,
  Calendar,
  UserCheck,
  ClipboardList,
  Sparkles,
  RefreshCw,
  Clock,
  ArrowDownLeft,
} from 'lucide-react';
import {
  OrdenCompra,
  RecepcionRegistro,
  LineaRecepcionInput,
} from '../types';
import {
  fetchComprasPendientes,
  fetchCompraById,
  registrarRecepcionMuelle,
  fetchHistorialRecepciones,
} from '../api/logisticaApi';

export const RecepcionMuelle: React.FC = () => {
  // Estados para datos
  const [compras, setCompras] = useState<OrdenCompra[]>([]);
  const [historial, setHistorial] = useState<RecepcionRegistro[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // OC seleccionada
  const [ocSeleccionadaId, setOcSeleccionadaId] = useState<number | null>(null);
  const [ocActual, setOcActual] = useState<OrdenCompra | null>(null);

  // Formulario de recepción por línea
  const [conteoLineas, setConteoLineas] = useState<Record<number, { recibida: number; danada: number; motivo: string }>>({});
  const [muelleAsignado, setMuelleAsignado] = useState<string>('Andén 1 (Muelle Central)');
  const [operadorNombre, setOperadorNombre] = useState<string>('P. Pérez (Operador Bodega)');
  const [guiaProveedor, setGuiaProveedor] = useState<string>('GD-LEGO-2026-991');
  const [observacionGeneral, setObservacionGeneral] = useState<string>('');

  // Estados de confirmación y vista
  const [registrando, setRegistrando] = useState<boolean>(false);
  const [errorRecepcion, setErrorRecepcion] = useState<string | null>(null);
  const [exitoRecepcion, setExitoRecepcion] = useState<any | null>(null);
  const [vistaActiva, setVistaActiva] = useState<'formulario' | 'historial'>('formulario');

  // Cargar órdenes de compra y el historial
  const cargarDatos = async () => {
    try {
      setCargando(true);
      setErrorCarga(null);
      const [listaCompras, listaHistorial] = await Promise.all([
        fetchComprasPendientes(),
        fetchHistorialRecepciones(),
      ]);
      setCompras(listaCompras);
      setHistorial(listaHistorial);

      // Preseleccionar la primera OC si no hay ninguna
      if (listaCompras.length > 0 && ocSeleccionadaId === null) {
        const primeraOc = listaCompras.find((c) => c.estado !== 'RECIBIDA') || listaCompras[0];
        setOcSeleccionadaId(primeraOc.id_oc);
      }
    } catch (err: any) {
      console.error('Error al cargar datos de muelle:', err);
      setErrorCarga(err.message || 'Error al conectar con el servidor.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Al cambiar la OC seleccionada, inicializar el conteo sugerido
  useEffect(() => {
    if (!ocSeleccionadaId) return;

    const oc = compras.find((c) => c.id_oc === ocSeleccionadaId);
    if (oc) {
      setOcActual(oc);
      // Inicializar el conteo de cada línea
      const inicial: Record<number, { recibida: number; danada: number; motivo: string }> = {};
      oc.detalles.forEach((d) => {
        inicial[d.id_producto] = {
          recibida: d.cantidad_esperada, // Por defecto propone recibir todo conforme
          danada: 0,
          motivo: '',
        };
      });
      setConteoLineas(inicial);
      setErrorRecepcion(null);
      setExitoRecepcion(null);
    }
  }, [ocSeleccionadaId, compras]);

  // Actualizar conteo de una línea
  const handleCambioConteo = (id_producto: number, campo: 'recibida' | 'danada' | 'motivo', valor: any) => {
    setConteoLineas((prev) => {
      const actual = prev[id_producto] || { recibida: 0, danada: 0, motivo: '' };
      return {
        ...prev,
        [id_producto]: {
          ...actual,
          [campo]: valor,
        },
      };
    });
    setErrorRecepcion(null);
  };

  // Botón rápido para marcar línea 100% recibida sin daños
  const handleRecibirTodo = (id_producto: number, cantidadEsperada: number) => {
    setConteoLineas((prev) => ({
      ...prev,
      [id_producto]: {
        recibida: cantidadEsperada,
        danada: 0,
        motivo: '',
      },
    }));
  };

  // Totales calculados en tiempo real
  let totalEsperado = 0;
  let totalRecibido = 0;
  let totalDanado = 0;
  let tieneErroresValidacion = false;
  let mensajeErrorValidacion = '';

  if (ocActual && ocActual.detalles) {
    ocActual.detalles.forEach((d) => {
      const c = conteoLineas[d.id_producto] || { recibida: 0, danada: 0, motivo: '' };
      totalEsperado += d.cantidad_esperada;
      totalRecibido += Number(c.recibida) || 0;
      totalDanado += Number(c.danada) || 0;

      if (Number(c.recibida) < 0 || Number(c.danada) < 0) {
        tieneErroresValidacion = true;
        mensajeErrorValidacion = 'Las cantidades no pueden ser valores negativos.';
      } else if (Number(c.danada) > Number(c.recibida)) {
        tieneErroresValidacion = true;
        mensajeErrorValidacion = `En el set #${d.id_producto}, las unidades dañadas (${c.danada}) no pueden superar a las recibidas (${c.recibida}).`;
      } else if (Number(c.recibida) > d.cantidad_esperada) {
        tieneErroresValidacion = true;
        mensajeErrorValidacion = `En el set #${d.id_producto}, la cantidad recibida (${c.recibida}) supera lo esperado en la OC (${d.cantidad_esperada}).`;
      }
    });
  }

  const totalAptoInventario = Math.max(0, totalRecibido - totalDanado);
  const esConforme100 = totalRecibido === totalEsperado && totalDanado === 0;
  const esParcial = totalRecibido < totalEsperado;

  // Ejecutar confirmación de recepción en muelle
  const handleConfirmarRecepcion = async () => {
    if (!ocActual) return;

    if (totalRecibido <= 0) {
      setErrorRecepcion('Debe registrar al menos una unidad recibida para confirmar la recepción.');
      return;
    }

    if (tieneErroresValidacion) {
      setErrorRecepcion(mensajeErrorValidacion);
      return;
    }

    try {
      setRegistrando(true);
      setErrorRecepcion(null);

      const lineasPayload: LineaRecepcionInput[] = ocActual.detalles.map((d) => {
        const c = conteoLineas[d.id_producto] || { recibida: 0, danada: 0, motivo: '' };
        return {
          id_producto: d.id_producto,
          cantidad_esperada: d.cantidad_esperada,
          cantidad_recibida: Number(c.recibida) || 0,
          cantidad_danada: Number(c.danada) || 0,
          motivo_dano: c.motivo || null,
        };
      });

      const respuesta = await registrarRecepcionMuelle({
        id_oc: ocActual.id_oc,
        id_empleado_receptor: 12,
        observacion: observacionGeneral.trim() || `Recepción en ${muelleAsignado} con guía ${guiaProveedor}`,
        lineas: lineasPayload,
      });

      setExitoRecepcion(respuesta);
      // Recargar datos para actualizar historial y estados de OCs
      await cargarDatos();
    } catch (err: any) {
      console.error('Error al registrar recepción:', err);
      setErrorRecepcion(err.message || 'Error transaccional al registrar la recepción en muelle.');
    } finally {
      setRegistrando(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
      {/* Banner Principal LEGO */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
        <div className="bg-gradient-to-r from-[#e52521] via-red-600 to-amber-500 p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center">
                <Inbox className="w-3.5 h-3.5 mr-1" />
                Flujo de Entrada (HU-06)
              </span>
              <span className="bg-amber-400 text-slate-900 text-xs font-bold px-2 py-0.5 rounded">
                Compras → Logística → Inventario
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center">
              Recepción de Mercadería en Muelle de Descarga
            </h1>
            <p className="text-red-100 text-sm mt-1 max-w-2xl">
              Contrasta físicamente los sets LEGO arribados contra la Orden de Compra (OC). Clasifica cajas dañadas e ingresa automáticamente las unidades aptas como <strong className="text-white">ENTRADA</strong> en el stock de Inventario.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setVistaActiva('formulario')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-1.5 ${
                vistaActiva === 'formulario'
                  ? 'bg-white text-[#e52521] shadow-md'
                  : 'bg-red-700/60 text-white hover:bg-red-700'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>Registrar Descarga</span>
            </button>
            <button
              onClick={() => setVistaActiva('historial')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-1.5 ${
                vistaActiva === 'historial'
                  ? 'bg-white text-[#e52521] shadow-md'
                  : 'bg-red-700/60 text-white hover:bg-red-700'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Historial ({historial.length})</span>
            </button>
            <button
              onClick={cargarDatos}
              disabled={cargando}
              title="Refrescar datos"
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Barra de métricas rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-4 bg-slate-50 border-t border-slate-200 divide-x divide-slate-200 text-center py-3">
          <div className="px-4">
            <p className="text-xs text-slate-500 font-medium">Órdenes Disponibles</p>
            <p className="text-lg font-bold text-slate-800">{compras.length} OCs</p>
          </div>
          <div className="px-4">
            <p className="text-xs text-slate-500 font-medium">Receptor en Muelle</p>
            <p className="text-lg font-bold text-slate-800 truncate">{operadorNombre.split(' ')[0]} P.</p>
          </div>
          <div className="px-4">
            <p className="text-xs text-slate-500 font-medium">Muelle Asignado</p>
            <p className="text-lg font-bold text-emerald-600">Andén 1</p>
          </div>
          <div className="px-4">
            <p className="text-xs text-slate-500 font-medium">Actas Registradas</p>
            <p className="text-lg font-bold text-[#e52521]">{historial.length} Recepciones</p>
          </div>
        </div>
      </div>

      {/* Alerta de Error de Carga si existe */}
      {errorCarga && (
        <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <span>{errorCarga} Mostrando datos respaldados en fallbackData local.</span>
        </div>
      )}

      {/* Modal / Alerta de Éxito al Confirmar Recepción */}
      {exitoRecepcion && (
        <div className="mb-8 p-6 rounded-xl bg-emerald-50 border-2 border-emerald-300 shadow-md">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-emerald-600 text-white rounded-lg shadow-sm">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-900">
                  ¡Recepción en Muelle Confirmada con Éxito!
                </h3>
                <p className="text-sm text-emerald-700 mt-0.5">
                  Acta registrada bajo el folio <strong>REC-00{exitoRecepcion.recepcion?.id || '1'}</strong>. Las existencias físicamente aptas han sido ingresadas a Inventario con movimiento tipo <strong className="text-emerald-900">ENTRADA</strong>.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-1 rounded">
                    Estado: {exitoRecepcion.resumen?.estado_recepcion || 'CONFORME'}
                  </span>
                  <span className="bg-white text-slate-700 border border-emerald-200 font-semibold px-2.5 py-1 rounded">
                    Total recibido: {exitoRecepcion.resumen?.total_recibido} unidades
                  </span>
                  <span className="bg-emerald-600 text-white font-bold px-2.5 py-1 rounded">
                    Ingresadas a Inventario: {exitoRecepcion.resumen?.total_apto_inventario} unidades
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setExitoRecepcion(null)}
              className="text-emerald-700 hover:text-emerald-900 text-sm font-semibold p-1"
            >
              ✕ Cerrar
            </button>
          </div>
        </div>
      )}

      {vistaActiva === 'formulario' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* COLUMNA IZQUIERDA: Selector de OC y Detalle de Líneas (2 columnas) */}
          <div className="lg:col-span-2 space-x-0 space-y-6">
            {/* Panel 1: Selector de Orden de Compra */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-[#e52521] text-white flex items-center justify-center text-xs font-bold">
                    1
                  </span>
                  <h2 className="text-base font-bold text-slate-900">
                    Seleccionar Orden de Compra Arribada
                  </h2>
                </div>
                <span className="text-xs text-slate-500">Módulo Compras</span>
              </div>

              {/* Selector en desplegable */}
              <div className="mb-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Orden de Compra (OC) y Proveedor
                </label>
                <select
                  value={ocSeleccionadaId || ''}
                  onChange={(e) => setOcSeleccionadaId(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-medium focus:ring-2 focus:ring-[#e52521] focus:border-[#e52521] transition-all"
                >
                  {compras.map((c) => (
                    <option key={c.id_oc} value={c.id_oc}>
                      OC-{c.id_oc} · {c.proveedor} ({c.detalles?.length || 0} sets LEGO) — [{c.estado}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Ficha informativa de la OC seleccionada */}
              {ocActual && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Proveedor:</span>
                    <span className="font-bold text-slate-800 flex items-center mt-0.5">
                      <Building2 className="w-3.5 h-3.5 mr-1 text-[#e52521]" />
                      {ocActual.proveedor}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Fecha Esperada:</span>
                    <span className="font-bold text-slate-800 flex items-center mt-0.5">
                      <Calendar className="w-3.5 h-3.5 mr-1 text-slate-500" />
                      {ocActual.fecha_entrega_esperada ? new Date(ocActual.fecha_entrega_esperada).toLocaleDateString() : 'Inmediata'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Estado en Compras:</span>
                    <span className={`inline-block mt-0.5 px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                      ocActual.estado === 'RECIBIDA'
                        ? 'bg-emerald-100 text-emerald-800'
                        : ocActual.estado === 'PARCIAL'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {ocActual.estado}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Panel 2: Conteo Físico por Línea de Producto */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-[#e52521] text-white flex items-center justify-center text-xs font-bold">
                    2
                  </span>
                  <h2 className="text-base font-bold text-slate-900">
                    Contraste Físico de Sets LEGO (Descarga en Muelle)
                  </h2>
                </div>
                <span className="text-xs text-slate-500">
                  {ocActual?.detalles?.length || 0} líneas en la orden
                </span>
              </div>

              <p className="text-xs text-slate-500 mb-4">
                Ingresa la cantidad física efectivamente descargada y consigna si existen cajas golpeadas, aplastadas o con sellos rotos. Solo las unidades <strong>Aptas</strong> ingresarán como stock disponible.
              </p>

              {/* Lista de productos */}
              <div className="space-y-4">
                {ocActual?.detalles?.map((det, index) => {
                  const conteo = conteoLineas[det.id_producto] || { recibida: det.cantidad_esperada, danada: 0, motivo: '' };
                  const aptas = Math.max(0, (Number(conteo.recibida) || 0) - (Number(conteo.danada) || 0));
                  const hayDano = Number(conteo.danada) > 0;
                  const hayFaltante = Number(conteo.recibida) < det.cantidad_esperada;

                  return (
                    <div
                      key={det.id_producto}
                      className={`p-4 rounded-xl border transition-all ${
                        hayDano
                          ? 'border-red-200 bg-red-50/30'
                          : hayFaltante
                          ? 'border-amber-200 bg-amber-50/20'
                          : 'border-slate-200 bg-slate-50/40 hover:bg-slate-50'
                      }`}
                    >
                      {/* Cabecera del set LEGO */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-200/60">
                        <div className="flex items-center space-x-3">
                          {/* Ícono bloque LEGO */}
                          <div className="w-9 h-9 rounded-lg bg-[#e52521] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                            <Package className="w-5 h-5 text-amber-300" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              {det.nombre_producto || `Set LEGO #${det.id_producto}`}
                            </p>
                            <p className="text-xs text-slate-500 font-mono">
                              SKU: {det.sku || `LEGO-${det.id_producto}`} · Peso unit: {det.peso_unitario_kg || 2.0} kg
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="text-xs bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded">
                            Esperadas: {det.cantidad_esperada} un.
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRecibirTodo(det.id_producto, det.cantidad_esperada)}
                            className="text-xs font-semibold text-[#e52521] hover:underline"
                          >
                            Recibir todo conforme
                          </button>
                        </div>
                      </div>

                      {/* Inputs de conteo */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        {/* Cantidad recibida */}
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">
                            Cant. Recibida (Física):
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={det.cantidad_esperada}
                            value={conteo.recibida}
                            onChange={(e) =>
                              handleCambioConteo(det.id_producto, 'recibida', Math.max(0, parseInt(e.target.value) || 0))
                            }
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 text-sm focus:ring-1 focus:ring-[#e52521]"
                          />
                        </div>

                        {/* Cantidad dañada */}
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">
                            Cant. Dañada / Aplastada:
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={conteo.recibida}
                            value={conteo.danada}
                            onChange={(e) =>
                              handleCambioConteo(det.id_producto, 'danada', Math.max(0, parseInt(e.target.value) || 0))
                            }
                            className={`w-full px-3 py-1.5 rounded-lg border font-bold text-sm focus:ring-1 ${
                              hayDano
                                ? 'border-red-400 bg-red-50 text-red-700'
                                : 'border-slate-300 bg-white text-slate-800'
                            }`}
                          />
                        </div>

                        {/* Unidades aptas calculadas */}
                        <div className="flex flex-col justify-end">
                          <span className="text-slate-500 font-medium mb-1">Aptas para Inventario:</span>
                          <div className="h-9 px-3 rounded-lg bg-emerald-100 border border-emerald-300 flex items-center justify-between text-emerald-900 font-bold text-sm">
                            <span className="flex items-center">
                              <CheckCircle className="w-4 h-4 mr-1 text-emerald-600" />
                              {aptas} un.
                            </span>
                            <span className="text-[10px] text-emerald-700 uppercase font-semibold">ENTRADA</span>
                          </div>
                        </div>
                      </div>

                      {/* Motivo de daño si hay unidades dañadas */}
                      {hayDano && (
                        <div className="mt-3 pt-2 border-t border-red-200/60">
                          <label className="block text-[11px] font-bold text-red-800 mb-1">
                            Motivo del daño o no conformidad:
                          </label>
                          <select
                            value={conteo.motivo || ''}
                            onChange={(e) => handleCambioConteo(det.id_producto, 'motivo', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded border border-red-300 bg-white text-xs text-red-900 focus:ring-1 focus:ring-red-500"
                          >
                            <option value="">Seleccionar motivo de inspección...</option>
                            <option value="Caja aplastada por estiba pesada">Caja aplastada por estiba pesada</option>
                            <option value="Golpe severo en esquinas de caja">Golpe severo en esquinas de caja</option>
                            <option value="Sellos de fábrica LEGO rotos o abiertos">Sellos de fábrica LEGO rotos o abiertos</option>
                            <option value="Humedad / filtración durante traslado">Humedad / filtración durante traslado</option>
                            <option value="Empaque rasgado / código de barra ilegible">Empaque rasgado / código de barra ilegible</option>
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: Datos del Muelle, Resumen Transaccional y Confirmación (1 columna) */}
          <div className="space-y-6">
            {/* Panel 3: Datos del Muelle y Operador */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center space-x-2 mb-4">
                <span className="w-6 h-6 rounded-full bg-[#e52521] text-white flex items-center justify-center text-xs font-bold">
                  3
                </span>
                <h2 className="text-base font-bold text-slate-900">
                  Andén y Operador Receptor
                </h2>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Muelle de Descarga:</label>
                  <select
                    value={muelleAsignado}
                    onChange={(e) => setMuelleAsignado(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 font-medium"
                  >
                    <option value="Andén 1 (Muelle Central)">Andén 1 (Muelle Central)</option>
                    <option value="Andén 2 (Descarga Contenedores)">Andén 2 (Descarga Contenedores)</option>
                    <option value="Andén 3 (Muelle Express)">Andén 3 (Muelle Express)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Operador Receptor (RRHH):</label>
                  <div className="flex items-center space-x-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-slate-800">{operadorNombre}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">N° Guía de Fábrica / Proveedor:</label>
                  <input
                    type="text"
                    value={guiaProveedor}
                    onChange={(e) => setGuiaProveedor(e.target.value)}
                    placeholder="Ej: GD-LEGO-99214"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-800 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Observaciones del Acta:</label>
                  <textarea
                    rows={2}
                    value={observacionGeneral}
                    onChange={(e) => setObservacionGeneral(e.target.value)}
                    placeholder="Detalles sobre el transporte, transportista del proveedor o embalaje..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Panel 4: Resumen de Inventario y Botón de Confirmación */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl shadow-md p-6 text-white">
              <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center">
                <Sparkles className="w-4 h-4 mr-1.5" />
                Resumen Transaccional de Entrada
              </h3>

              <div className="space-y-2.5 py-3 border-y border-slate-700 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Sets solicitados en OC:</span>
                  <span className="font-bold text-white">{totalEsperado} un.</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Sets efectivamente descargados:</span>
                  <span className="font-bold text-white">{totalRecibido} un.</span>
                </div>
                <div className="flex justify-between text-red-400">
                  <span>Cajas dañadas (merma/rechazo):</span>
                  <span className="font-bold">-{totalDanado} un.</span>
                </div>
                <div className="pt-2 border-t border-slate-700 flex justify-between items-baseline">
                  <span className="font-bold text-emerald-400 text-sm">Alta a Inventario (ENTRADA):</span>
                  <span className="font-black text-2xl text-emerald-300">{totalAptoInventario} un.</span>
                </div>
              </div>

              {/* Mensaje de estado preliminar */}
              <div className="mt-4 p-2.5 rounded-lg text-xs font-semibold flex items-center space-x-2 bg-slate-800/80 border border-slate-700">
                {tieneErroresValidacion ? (
                  <>
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span className="text-red-300">{mensajeErrorValidacion}</span>
                  </>
                ) : esConforme100 ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span className="text-emerald-300">Recepción 100% Conforme (Sin Daños)</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span className="text-amber-300">
                      {totalDanado > 0 ? `Recepción con ${totalDanado} cajas dañadas` : 'Recepción Parcial con faltante'}
                    </span>
                  </>
                )}
              </div>

              {/* Mensaje de error de backend si hubo */}
              {errorRecepcion && (
                <div className="mt-3 p-3 rounded-lg bg-red-900/80 border border-red-500 text-xs text-red-200">
                  {errorRecepcion}
                </div>
              )}

              {/* Botón de Confirmación */}
              <button
                type="button"
                onClick={handleConfirmarRecepcion}
                disabled={registrando || tieneErroresValidacion || totalRecibido <= 0}
                className="mt-6 w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm tracking-wide text-white shadow-lg shadow-emerald-900/50 flex items-center justify-center space-x-2 transition-all transform active:scale-[0.98]"
              >
                {registrando ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Registrando transacción...</span>
                  </>
                ) : (
                  <>
                    <ArrowDownLeft className="w-5 h-5 text-emerald-200" />
                    <span>Confirmar Recepción e Ingresar a Inventario</span>
                  </>
                )}
              </button>

              <p className="text-[10px] text-slate-400 text-center mt-2">
                Dispara atómicamente el movimiento <code className="text-emerald-300">ENTRADA</code> en inv_mov y actualiza el estado de la OC.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* VISTA DE HISTORIAL DE RECEPCIONES EN MUELLE */
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-[#e52521]" />
                Bitácora Histórica de Recepciones en Muelle
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Registro inmutable de descargas físicas y actas de recepción con inventario alimentado.
              </p>
            </div>
            <button
              onClick={() => setVistaActiva('formulario')}
              className="text-xs font-bold text-[#e52521] bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              ← Volver al formulario de descarga
            </button>
          </div>

          {historial.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Inbox className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium">Aún no se han registrado actas de recepción en este muelle.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3 px-4">Folio Acta</th>
                    <th className="py-3 px-4">Orden Compra</th>
                    <th className="py-3 px-4">Proveedor</th>
                    <th className="py-3 px-4">Fecha y Hora</th>
                    <th className="py-3 px-4">Receptor</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Líneas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historial.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#e52521]">
                        REC-00{rec.id}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        OC-{rec.id_oc}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {rec.proveedor || 'LEGO Group Dinamarca'}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(rec.fecha_recepcion).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {rec.nombre_empleado || 'P. Pérez (Operador Bodega)'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                          rec.estado === 'CONFORME'
                            ? 'bg-emerald-100 text-emerald-800'
                            : rec.estado === 'PARCIAL'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {rec.estado}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-600">
                        {rec.detalles?.length || 1} sets
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
