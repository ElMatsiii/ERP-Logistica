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

const API_BASE = '/api/logistica';

export interface IncidenciaPostventa {
  id: number;
  guia_id: string;
  tipo: string;
  descripcion: string;
  evento_tracking_id: number | null;
  id_caso_postventa: number | null;
}

export async function prepararDerivacionPostventa(guiaId: string): Promise<IncidenciaPostventa> {
  const res = await fetch(`${API_BASE}/tracking/${encodeURIComponent(guiaId)}/derivar-postventa`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'No se pudo preparar la derivación');
  return data.incidencia;
}

export async function fetchPedidosPendientes(): Promise<OTPicking[]> {
  const res = await fetch(`${API_BASE}/pedidos-pendientes`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al obtener órdenes de trabajo pendientes');
  }
  return res.json();
}

export async function fetchOtById(id: string): Promise<OTPicking> {
  const res = await fetch(`${API_BASE}/ots/${id}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Error al obtener detalle de OT ${id}`);
  }
  return res.json();
}

export async function fetchTransportistas(): Promise<Transportista[]> {
  const res = await fetch(`${API_BASE}/transportistas`);
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
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
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

  const res = await fetch(url);
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Error al registrar evento en bitácora');
  }

  return data;
}

export async function fetchComprasPendientes(): Promise<OrdenCompra[]> {
  const res = await fetch(`${API_BASE}/compras-pendientes`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al obtener órdenes de compra pendientes');
  }
  return res.json();
}

export async function fetchCompraById(id: number): Promise<OrdenCompra> {
  const res = await fetch(`${API_BASE}/compras/${id}`);
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
    headers: { 'Content-Type': 'application/json' },
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
  const res = await fetch(`${API_BASE}/empleados`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al obtener empleados');
  }
  return res.json();
}

/** Bodegas de Inventario donde ingresa la mercadería recibida */
export async function fetchBodegas(): Promise<Bodega[]> {
  const res = await fetch(`${API_BASE}/bodegas`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al obtener bodegas de Inventario');
  }
  return res.json();
}

export async function fetchHistorialRecepciones(): Promise<RecepcionRegistro[]> {
  const res = await fetch(`${API_BASE}/recepciones`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al consultar historial de recepciones');
  }
  return res.json();
}

