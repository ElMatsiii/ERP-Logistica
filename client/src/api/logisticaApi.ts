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
  UsuarioLogistica,
  RolConfig,
} from '../types';

const API_BASE = '/api/logistica';

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
  const res = await fetch(`${API_BASE}/tracking/${encodeURIComponent(guiaId)}/derivar-postventa`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'No se pudo preparar la derivación');
  return data;
}

/**
 * Retorna las cabeceras de autenticación y rol activo desde localStorage.
 */
function getAuthHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('lesgo_logistica_usuario_activo');
    if (raw) {
      const user = JSON.parse(raw);
      return {
        'x-user-id': String(user.id_empleado),
        'x-user-role': String(user.rol),
        'x-user-name': String(user.nombre),
      };
    }
  } catch {
    // Si falla la lectura, usar valor por defecto
  }
  return {
    'x-user-id': '305',
    'x-user-role': 'COORDINADOR_LOGISTICA',
    'x-user-name': 'Maximiliano Pizarro',
  };
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
 * ENDPOINTS DE AUTENTICACIÓN Y ROLES (RBAC)
 * ========================================================================= */

export async function fetchRoles(forceRefresh = false): Promise<RolConfig[]> {
  return conCache(
    'roles',
    async () => {
      const res = await fetch(`${API_BASE}/auth/roles`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        throw new Error('Error al obtener catálogo de roles');
      }
      return res.json();
    },
    5 * 60 * 1000,
    forceRefresh
  );
}

export async function fetchUsuarios(forceRefresh = false): Promise<UsuarioLogistica[]> {
  return conCache(
    'usuarios',
    async () => {
      const res = await fetch(`${API_BASE}/auth/usuarios`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        throw new Error('Error al obtener lista de usuarios');
      }
      return res.json();
    },
    5 * 60 * 1000,
    forceRefresh
  );
}

export async function loginUsuario(idEmpleado: number): Promise<{ usuario: UsuarioLogistica }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ id_empleado: idEmpleado }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Error al iniciar sesión');
  }
  invalidarCache(); // Limpiar caches al cambiar de sesión/rol
  return res.json();
}

/* =========================================================================
 * ENDPOINTS DE LOGÍSTICA Y TRANSPORTE
 * ========================================================================= */

export async function fetchPedidosPendientes(forceRefresh = false): Promise<OTPicking[]> {
  return conCache(
    'pedidos_pendientes',
    async () => {
      const res = await fetch(`${API_BASE}/pedidos-pendientes`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al obtener órdenes de trabajo pendientes');
      }
      return res.json();
    },
    20 * 1000, // 20 segundos de caché para navegación fluida entre pestañas
    forceRefresh
  );
}

export async function fetchOtById(id: string, forceRefresh = false): Promise<OTPicking> {
  return conCache(
    `ot_${id}`,
    async () => {
      const res = await fetch(`${API_BASE}/ots/${id}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Error al obtener detalle de OT ${id}`);
      }
      return res.json();
    },
    60 * 1000, // 1 minuto de caché para detalle de OT
    forceRefresh
  );
}

export async function fetchTransportistas(forceRefresh = false): Promise<Transportista[]> {
  return conCache(
    'transportistas',
    async () => {
      const res = await fetch(`${API_BASE}/transportistas`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al obtener transportistas');
      }
      return res.json();
    },
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
    async () => {
      const res = await fetch(`${API_BASE}/cotizar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al cotizar envío');
      }
      return res.json();
    },
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
  const res = await fetch(`${API_BASE}/guias`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMessage = data.error || 'Error al emitir guía de despacho';
    const err = new Error(errorMessage);
    (err as any).status = res.status;
    (err as any).data = data;
    throw err;
  }

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
  const res = await fetch(`${API_BASE}/guias/${encodeURIComponent(guiaId)}/reintentar-stock`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ usuario_responsable }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Error al reintentar la confirmación de stock');
  }

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
    async () => {
      const res = await fetch(url, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al consultar tracking');
      }
      return res.json();
    },
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
  const res = await fetch(`${API_BASE}/tracking/${guiaId}/evento`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Error al registrar evento en bitácora');
  }

  // Invalidar caché de tracking tras nuevo evento
  invalidarCache('tracking');

  return data;
}

export async function fetchComprasPendientes(forceRefresh = false): Promise<OrdenCompra[]> {
  return conCache(
    'compras_pendientes',
    async () => {
      const res = await fetch(`${API_BASE}/compras-pendientes`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al obtener órdenes de compra pendientes');
      }
      return res.json();
    },
    20 * 1000,
    forceRefresh
  );
}

export async function fetchCompraById(id: number, forceRefresh = false): Promise<OrdenCompra> {
  return conCache(
    `compra_${id}`,
    async () => {
      const res = await fetch(`${API_BASE}/compras/${id}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Error al obtener orden de compra #${id}`);
      }
      return res.json();
    },
    60 * 1000,
    forceRefresh
  );
}

export async function registrarRecepcionMuelle(
  payload: RegistrarRecepcionPayload
): Promise<{ mensaje: string; recepcion: RecepcionRegistro; resumen: any; inventario: IngresoInventario }> {
  const res = await fetch(`${API_BASE}/recepciones`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.error || 'Error al registrar recepción en muelle');
    (error as any).status = res.status;
    throw error;
  }

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
    async () => {
      const res = await fetch(`${API_BASE}/empleados`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al obtener empleados');
      }
      return res.json();
    },
    5 * 60 * 1000,
    forceRefresh
  );
}

/** Bodegas de Inventario donde ingresa la mercadería recibida */
export async function fetchBodegas(forceRefresh = false): Promise<Bodega[]> {
  return conCache(
    'bodegas',
    async () => {
      const res = await fetch(`${API_BASE}/bodegas`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al obtener bodegas de Inventario');
      }
      return res.json();
    },
    5 * 60 * 1000,
    forceRefresh
  );
}

export async function fetchHistorialRecepciones(forceRefresh = false): Promise<RecepcionRegistro[]> {
  return conCache(
    'historial_recepciones',
    async () => {
      const res = await fetch(`${API_BASE}/recepciones`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al consultar historial de recepciones');
      }
      return res.json();
    },
    20 * 1000,
    forceRefresh
  );
}
