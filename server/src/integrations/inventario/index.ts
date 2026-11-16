import { ClienteInventarioHttp } from './cliente-http.js';
import { ClienteInventarioSimulado } from './cliente-simulado.js';
import type { ClienteInventario } from './tipos.js';

export * from './tipos.js';
export { InventarioError } from './errores.js';
export type { TipoErrorInventario } from './errores.js';
export { ClienteInventarioHttp } from './cliente-http.js';
export { ClienteInventarioSimulado } from './cliente-simulado.js';

const TIMEOUT_POR_DEFECTO_MS = 8000;

/**
 * Elige el cliente según el entorno:
 * - INVENTARIO_API_URL vacía -> cliente simulado (sin red).
 * - INVENTARIO_API_URL con valor -> API real, con INVENTARIO_API_KEY como Bearer.
 */
export function crearClienteInventario(env: NodeJS.ProcessEnv = process.env): ClienteInventario {
  const url = env.INVENTARIO_API_URL?.trim();
  if (!url) {
    console.warn('[Inventario] INVENTARIO_API_URL vacía: se usa el cliente SIMULADO (no se llama a Inventario).');
    return new ClienteInventarioSimulado();
  }

  const apiKey = env.INVENTARIO_API_KEY?.trim() ?? '';
  if (!apiKey) {
    console.warn('[Inventario] Falta INVENTARIO_API_KEY: reservas, despacho y recepción responderán 401.');
  }

  const timeoutMs = Number(env.INVENTARIO_TIMEOUT_MS) > 0 ? Number(env.INVENTARIO_TIMEOUT_MS) : TIMEOUT_POR_DEFECTO_MS;
  console.log(`[Inventario] Cliente REAL hacia ${url} (timeout ${timeoutMs} ms).`);
  return new ClienteInventarioHttp({ baseUrl: url, apiKey, timeoutMs });
}

let instancia: ClienteInventario | null = null;

/**
 * Cliente compartido por el servidor. Se crea en el primer uso (no al importar el módulo),
 * para que ya estén cargadas las variables del .env.
 */
export function obtenerClienteInventario(): ClienteInventario {
  if (!instancia) instancia = crearClienteInventario();
  return instancia;
}

/** Solo para tests: permite inyectar un cliente o volver a leer el entorno. */
export function fijarClienteInventario(cliente: ClienteInventario | null): void {
  instancia = cliente;
}
