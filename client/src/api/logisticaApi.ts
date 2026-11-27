import {
  OTPicking,
  Transportista,
  GuiaDespacho,
  BultoInput,
  CotizacionResponse,
  OrdenCompra,
  RegistrarRecepcionPayload,
  RecepcionRegistro,
  ConfirmacionStock,
  IngresoInventario,
  Empleado,
  Bodega,
} from '../types';
import { cabecerasDeSesion, notificarNoAutorizado, suscribirCambioSesion } from './sesion';

const API_BASE = '/api/logistica';

/* =========================================================================
 * PETICIONES: identificación, errores y 401 en un solo lugar
 * ========================================================================= */

/** Error de la API con el código HTTP y el cuerpo devuelto por el servidor. */
export class ErrorApi extends Error {
  readonly status: number;
  readonly data: any;

  constructor(status: number, mensaje: string, data: any = null) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.status = status;
    this.data = data;
  }
}

interface OpcionesSolicitud {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Mensaje si el servidor no envía uno propio */
  mensajeError: string;
  /** false = un 401 no cierra la sesión (p. ej. el propio login con credenciales malas) */
  cerrarSesionEn401?: boolean;
  /** true = rutas públicas (config, login): no se envía ninguna identificación */
  sinIdentificacion?: boolean;
}

/**
 * Hace la petición con la identificación de la sesión actual:
 * - con token: Authorization: Bearer <token> (sin cabeceras x-user-*)
 * - con usuario simulado: x-user-id (solo AUTH_MODO=simulado)
 * Ante un 401 avisa al AuthContext para cerrar la sesión. Los 403 y demás errores
 * se lanzan como ErrorApi con el mensaje del servidor, que los componentes muestran.
 */
export async function solicitar<T>(url: string, opciones: OpcionesSolicitud): Promise<T> {
  const headers: Record<string, string> = opciones.sinIdentificacion ? {} : { ...cabecerasDeSesion() };
  if (opciones.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(url, {
      method: opciones.method ?? 'GET',
      headers,
      body: opciones.body !== undefined ? JSON.stringify(opciones.body) : undefined,
    });
  } catch {
    throw new ErrorApi(0, 'No se pudo conectar con el servidor. Revisa tu conexión e intenta nuevamente.');
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && opciones.cerrarSesionEn401 !== false) notificarNoAutorizado();
    throw new ErrorApi(res.status, data?.error || opciones.mensajeError, data);
  }
  return data as T;
}

/* =========================================================================
 * CACHÉ EN MEMORIA Y DEDUPLICACIÓN DE PETICIONES CONCURRENTES
 * ========================================================================= */
interface CacheEntry<T> {
  data: T;
  expira: number;
}

const memoriaCache = new Map<string, CacheEntry<any>>();
const peticionesEnVuelo = new Map<string, Promise<any>>();

/**
 * Invalida entradas de la caché por prefijo o completamente si no se especifica.
 */
export function invalidarCache(prefijo?: string): void {
  if (!prefijo) {
    memoriaCache.clear();
    return;
  }
  for (const key of Array.from(memoriaCache.keys())) {
    if (key.startsWith(prefijo)) {
      memoriaCache.delete(key);
    }
  }
}

// La caché no distingue usuarios: al iniciar, cerrar o cambiar de sesión se vacía completa
suscribirCambioSesion(() => {
  memoriaCache.clear();
  peticionesEnVuelo.clear();
});

async function conCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number,
  forceRefresh = false
): Promise<T> {
  if (!forceRefresh) {
    const entry = memoriaCache.get(key);
    if (entry && entry.expira > Date.now()) {
      return entry.data as T;
    }
  }

  // Deduplica llamadas concurrentes que coincidan con la misma clave
  if (peticionesEnVuelo.has(key)) {
    return peticionesEnVuelo.get(key) as Promise<T>;
  }

  const promesa = fetcher()
    .then((data) => {
      memoriaCache.set(key, { data, expira: Date.now() + ttlMs });
      return data;
    })
    .finally(() => {
      peticionesEnVuelo.delete(key);
    });

  peticionesEnVuelo.set(key, promesa);
  return promesa;
}

/* =========================================================================
 * POSTVENTA
 * ========================================================================= */

export interface IncidenciaPostventa {
  id: number;
  guia_id: string;
  tipo: string;
  descripcion: string;
  evento_tracking_id: number | null;
  id_caso_postventa: number | null;
}

export interface PayloadPostventa {
  id_incidencia: number;
  id_evento_tracking: number;
  id_guia: string;
  numero_seguimiento: string;
  tipo: string;
  motivo: string;
  fecha_evento: string;
  fecha_incidencia: string;
  id_pedido: number;
  lineas_despachadas: Array<{
    id_linea_ot: number;
    id_producto: number;
    sku: string;
    cantidad_despachada: number;
  }>;
}

export async function prepararDerivacionPostventa(guiaId: string): Promise<{ incidencia: IncidenciaPostventa; payload: PayloadPostventa }> {
  return solicitar(`${API_BASE}/tracking/${encodeURIComponent(guiaId)}/derivar-postventa`, {
    method: 'POST',
    mensajeError: 'No se pudo preparar la derivación',
  });
}

/* =========================================================================
 * ENDPOINTS DE LOGÍSTICA Y TRANSPORTE
 * ========================================================================= */

export async function fetchPedidosPendientes(forceRefresh = false): Promise<OTPicking[]> {
  return conCache(
    'pedidos_pendientes',
    () => solicitar<OTPicking[]>(`${API_BASE}/pedidos-pendientes`, { mensajeError: 'Error al obtener órdenes de trabajo pendientes' }),
    20 * 1000, // 20 segundos de caché para navegación fluida entre pestañas
    forceRefresh
  );
}

export async function fetchOtById(id: string, forceRefresh = false): Promise<OTPicking> {
  return conCache(
    `ot_${id}`,
    () => solicitar<OTPicking>(`${API_BASE}/ots/${id}`, { mensajeError: `Error al obtener detalle de OT ${id}` }),
    60 * 1000, // 1 minuto de caché para detalle de OT
    forceRefresh
  );
}

export async function fetchTransportistas(forceRefresh = false): Promise<Transportista[]> {
  return conCache(
    'transportistas',
    () => solicitar<Transportista[]>(`${API_BASE}/transportistas`, { mensajeError: 'Error al obtener transportistas' }),
    5 * 60 * 1000, // 5 minutos para datos maestros de transportistas y tarifas
    forceRefresh
  );
}

export async function cotizarEnvio(payload: {
  ot_id: string;
  transportista_id: number;
  servicio_id: number;
  bultos: BultoInput[];
}): Promise<CotizacionResponse> {
  const bultosKey = payload.bultos
    .map((b) => `${b.largo_cm}x${b.alto_cm}x${b.ancho_cm}@${b.peso_real_kg}`)
    .join(';');
  const key = `cotizar_${payload.ot_id}_${payload.transportista_id}_${payload.servicio_id}_${bultosKey}`;

  return conCache(
    key,
    () => solicitar<CotizacionResponse>(`${API_BASE}/cotizar`, { method: 'POST', body: payload, mensajeError: 'Error al cotizar envío' }),
    2 * 60 * 1000 // 2 minutos de caché por combinación de dimensiones
  );
}

export async function emitirGuiaDespacho(payload: {
  ot_id: string;
  transportista_id: number;
  servicio_id: number;
  bultos: BultoInput[];
  usuario_responsable?: string;
}): Promise<{ mensaje: string; guia: GuiaDespacho; inventario: ConfirmacionStock }> {
  const data = await solicitar<{ mensaje: string; guia: GuiaDespacho; inventario: ConfirmacionStock }>(`${API_BASE}/guias`, {
    method: 'POST',
    body: payload,
    mensajeError: 'Error al emitir guía de despacho',
  });

  // Invalidar caches afectadas por la nueva guía
  invalidarCache('pedidos_pendientes');
  invalidarCache(`ot_${payload.ot_id}`);
  invalidarCache('cotizar_');
  invalidarCache('tracking');

  return data;
}

/** Vuelve a pedir a Inventario que confirme el egreso de una guía en 'Pendiente/Error de stock' */
export async function reintentarStockGuia(
  guiaId: string,
  usuario_responsable?: string
): Promise<{ mensaje: string; guia: GuiaDespacho; inventario: ConfirmacionStock }> {
  const data = await solicitar<{ mensaje: string; guia: GuiaDespacho; inventario: ConfirmacionStock }>(
    `${API_BASE}/guias/${encodeURIComponent(guiaId)}/reintentar-stock`,
    { method: 'POST', body: { usuario_responsable }, mensajeError: 'Error al reintentar la confirmación de stock' }
  );

  invalidarCache('tracking');
  return data;
}

export async function fetchTracking(
  filtros: {
    estado?: string;
    transportista?: string;
    fecha?: string;
    busqueda?: string;
  },
  forceRefresh = false
): Promise<GuiaDespacho[]> {
  const params = new URLSearchParams();
  if (filtros.estado) params.append('estado', filtros.estado);
  if (filtros.transportista) params.append('transportista', filtros.transportista);
  if (filtros.fecha) params.append('fecha', filtros.fecha);
  if (filtros.busqueda) params.append('busqueda', filtros.busqueda);

  const query = params.toString();
  const url = query ? `${API_BASE}/tracking?${query}` : `${API_BASE}/tracking`;
  const key = `tracking_${query}`;

  return conCache(
    key,
    () => solicitar<GuiaDespacho[]>(url, { mensajeError: 'Error al consultar tracking' }),
    15 * 1000, // 15 segundos de caché para tracking
    forceRefresh
  );
}

export async function registrarEventoTracking(
  guiaId: string,
  payload: {
    estado: string;
    observacion: string;
    usuario_responsable?: string;
  }
): Promise<{ mensaje: string; nuevoEvento: any; guia: GuiaDespacho }> {
  const data = await solicitar<{ mensaje: string; nuevoEvento: any; guia: GuiaDespacho }>(`${API_BASE}/tracking/${guiaId}/evento`, {
    method: 'POST',
    body: payload,
    mensajeError: 'Error al registrar evento en bitácora',
  });

  // Invalidar caché de tracking tras nuevo evento
  invalidarCache('tracking');

  return data;
}

export async function fetchComprasPendientes(forceRefresh = false): Promise<OrdenCompra[]> {
  return conCache(
    'compras_pendientes',
    () => solicitar<OrdenCompra[]>(`${API_BASE}/compras-pendientes`, { mensajeError: 'Error al obtener órdenes de compra pendientes' }),
    20 * 1000,
    forceRefresh
  );
}

export async function fetchCompraById(id: number, forceRefresh = false): Promise<OrdenCompra> {
  return conCache(
    `compra_${id}`,
    () => solicitar<OrdenCompra>(`${API_BASE}/compras/${id}`, { mensajeError: `Error al obtener orden de compra #${id}` }),
    60 * 1000,
    forceRefresh
  );
}

export async function registrarRecepcionMuelle(
  payload: RegistrarRecepcionPayload
): Promise<{ mensaje: string; recepcion: RecepcionRegistro; resumen: any; inventario: IngresoInventario }> {
  const data = await solicitar<{ mensaje: string; recepcion: RecepcionRegistro; resumen: any; inventario: IngresoInventario }>(
    `${API_BASE}/recepciones`,
    { method: 'POST', body: payload, mensajeError: 'Error al registrar recepción en muelle' }
  );

  // Invalidar compras e historial tras recepción exitosa
  invalidarCache('compras_');
  invalidarCache('compra_');
  invalidarCache('historial_recepciones');

  return data;
}

/** Empleados para elegir al receptor en muelle */
export async function fetchEmpleados(forceRefresh = false): Promise<Empleado[]> {
  return conCache(
    'empleados',
    () => solicitar<Empleado[]>(`${API_BASE}/empleados`, { mensajeError: 'Error al obtener empleados' }),
    5 * 60 * 1000,
    forceRefresh
  );
}

/** Bodegas de Inventario donde ingresa la mercadería recibida */
export async function fetchBodegas(forceRefresh = false): Promise<Bodega[]> {
  return conCache(
    'bodegas',
    () => solicitar<Bodega[]>(`${API_BASE}/bodegas`, { mensajeError: 'Error al obtener bodegas de Inventario' }),
    5 * 60 * 1000,
    forceRefresh
  );
}

export async function fetchHistorialRecepciones(forceRefresh = false): Promise<RecepcionRegistro[]> {
  return conCache(
    'historial_recepciones',
    () => solicitar<RecepcionRegistro[]>(`${API_BASE}/recepciones`, { mensajeError: 'Error al consultar historial de recepciones' }),
    20 * 1000,
    forceRefresh
  );
}
