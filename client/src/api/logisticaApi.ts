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
 * ENDPOINTS DE AUTENTICACIÓN Y ROLES (RBAC)
 * ========================================================================= */

export async function fetchRoles(): Promise<RolConfig[]> {
  const res = await fetch(`${API_BASE}/auth/roles`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error('Error al obtener catálogo de roles');
  }
  return res.json();
}

export async function fetchUsuarios(): Promise<UsuarioLogistica[]> {
  const res = await fetch(`${API_BASE}/auth/usuarios`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error('Error al obtener lista de usuarios');
  }
  return res.json();
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
  return res.json();
}

/* =========================================================================
 * ENDPOINTS DE LOGÍSTICA Y TRANSPORTE
 * ========================================================================= */

export async function fetchPedidosPendientes(): Promise<OTPicking[]> {
  const res = await fetch(`${API_BASE}/pedidos-pendientes`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al obtener órdenes de trabajo pendientes');
  }
  return res.json();
}

export async function fetchOtById(id: string): Promise<OTPicking> {
  const res = await fetch(`${API_BASE}/ots/${id}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Error al obtener detalle de OT ${id}`);
  }
  return res.json();
}

export async function fetchTransportistas(): Promise<Transportista[]> {
  const res = await fetch(`${API_BASE}/transportistas`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al obtener transportistas');
  }
  return res.json();
}

export async function cotizarEnvio(payload: {
  ot_id: string;
  transportista_id: number;
  servicio_id: number;
  bultos: BultoInput[];
}): Promise<CotizacionResponse> {
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
  return data;
}

export async function fetchTracking(filtros: {
  estado?: string;
  transportista?: string;
  fecha?: string;
  busqueda?: string;
}): Promise<GuiaDespacho[]> {
  const params = new URLSearchParams();
  if (filtros.estado) params.append('estado', filtros.estado);
  if (filtros.transportista) params.append('transportista', filtros.transportista);
  if (filtros.fecha) params.append('fecha', filtros.fecha);
  if (filtros.busqueda) params.append('busqueda', filtros.busqueda);

  const query = params.toString();
  const url = query ? `${API_BASE}/tracking?${query}` : `${API_BASE}/tracking`;

  const res = await fetch(url, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al consultar tracking');
  }
  return res.json();
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

  return data;
}

export async function fetchComprasPendientes(): Promise<OrdenCompra[]> {
  const res = await fetch(`${API_BASE}/compras-pendientes`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al obtener órdenes de compra pendientes');
  }
  return res.json();
}

export async function fetchCompraById(id: number): Promise<OrdenCompra> {
  const res = await fetch(`${API_BASE}/compras/${id}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Error al obtener orden de compra #${id}`);
  }
  return res.json();
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

  return data;
}

/** Empleados para elegir al receptor en muelle */
export async function fetchEmpleados(): Promise<Empleado[]> {
  const res = await fetch(`${API_BASE}/empleados`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al obtener empleados');
  }
  return res.json();
}

/** Bodegas de Inventario donde ingresa la mercadería recibida */
export async function fetchBodegas(): Promise<Bodega[]> {
  const res = await fetch(`${API_BASE}/bodegas`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al obtener bodegas de Inventario');
  }
  return res.json();
}

export async function fetchHistorialRecepciones(): Promise<RecepcionRegistro[]> {
  const res = await fetch(`${API_BASE}/recepciones`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al consultar historial de recepciones');
  }
  return res.json();
}
