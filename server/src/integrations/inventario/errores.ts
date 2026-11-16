import type { ErrorRespuestaInventario } from './tipos.js';

export type TipoErrorInventario =
  | 'VALIDACION' // 400: datos mal armados de nuestro lado
  | 'NO_AUTORIZADO' // 401/403: API key ausente o incorrecta
  | 'NO_ENCONTRADO' // 404: pedido sin reserva, producto o bodega inexistente
  | 'CONFLICTO' // 409: reserva no PENDIENTE, guía ya usada, stock no coincide
  | 'ERROR_INVENTARIO' // 5xx u otro código inesperado
  | 'TIMEOUT' // Inventario no respondió a tiempo
  | 'SIN_CONEXION' // No se pudo llegar a Inventario (caído, URL mala, sin red)
  | 'RESPUESTA_INVALIDA'; // Respondió algo que no es el JSON esperado

/**
 * Error al hablar con Inventario. `reintentable` indica si tiene sentido volver a intentar
 * la misma llamada más tarde (la guía queda en ERROR_STOCK y se reintenta).
 */
export class InventarioError extends Error {
  readonly tipo: TipoErrorInventario;
  readonly status: number | null;
  /** Mensajes de Inventario (class-validator devuelve una lista en los 400) */
  readonly detalles: string[];
  readonly reintentable: boolean;
  readonly ruta: string;

  constructor(opciones: {
    tipo: TipoErrorInventario;
    mensaje: string;
    ruta: string;
    status?: number | null;
    detalles?: string[];
  }) {
    super(opciones.mensaje);
    this.name = 'InventarioError';
    this.tipo = opciones.tipo;
    this.status = opciones.status ?? null;
    this.detalles = opciones.detalles ?? [];
    this.ruta = opciones.ruta;
    this.reintentable = ['TIMEOUT', 'SIN_CONEXION', 'ERROR_INVENTARIO'].includes(opciones.tipo);
  }
}

export function tipoPorStatus(status: number): TipoErrorInventario {
  if (status === 400) return 'VALIDACION';
  if (status === 401 || status === 403) return 'NO_AUTORIZADO';
  if (status === 404) return 'NO_ENCONTRADO';
  if (status === 409) return 'CONFLICTO';
  return 'ERROR_INVENTARIO';
}

/** Arma el error a partir de una respuesta no exitosa, con o sin cuerpo en el formato de Inventario. */
export function errorDesdeRespuesta(status: number, ruta: string, cuerpo: unknown): InventarioError {
  const tipo = tipoPorStatus(status);
  const formato = cuerpo as Partial<ErrorRespuestaInventario> | null;
  const mensajes =
    formato && formato.message !== undefined
      ? Array.isArray(formato.message)
        ? formato.message.map(String)
        : [String(formato.message)]
      : [];

  const base = mensajes.length > 0 ? mensajes.join('; ') : `Inventario respondió HTTP ${status}`;
  const mensaje = tipo === 'NO_AUTORIZADO' ? `API key de Inventario rechazada: ${base}` : base;

  return new InventarioError({ tipo, mensaje, ruta, status, detalles: mensajes });
}
