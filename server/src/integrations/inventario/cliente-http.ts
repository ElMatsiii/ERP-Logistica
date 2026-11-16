import { InventarioError, errorDesdeRespuesta } from './errores.js';
import type {
  BodegaInventario,
  ClienteInventario,
  DespachoInventarioInput,
  EstadoConexionInventario,
  ProductoInventario,
  RecepcionInventarioInput,
  ReservaPedidoInventario,
  ResultadoDespachoInventario,
  ResultadoRecepcionInventario,
  StockBodegaInventario,
} from './tipos.js';

export interface OpcionesClienteHttp {
  /** URL base con el prefijo de la API, p. ej. http://localhost:3000/api/v1 */
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
  /** Inyectable para tests */
  fetchFn?: typeof fetch;
}

/**
 * Cliente real de la API de Inventario. No reintenta por su cuenta: quien llama decide
 * (p. ej. la guía queda en ERROR_STOCK). Despacho y recepción son idempotentes en Inventario,
 * así que repetir la misma llamada es seguro.
 */
export class ClienteInventarioHttp implements ClienteInventario {
  readonly modo = 'real' as const;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(opciones: OpcionesClienteHttp) {
    this.baseUrl = opciones.baseUrl.trim().replace(/\/+$/, '');
    this.apiKey = opciones.apiKey.trim();
    this.timeoutMs = opciones.timeoutMs ?? 8000;
    this.fetchFn = opciones.fetchFn ?? fetch;
  }

  async verificarConexion(): Promise<EstadoConexionInventario> {
    const inicio = Date.now();
    const url = this.origen();
    try {
      await this.solicitar<unknown>('GET', '/health');
      return { modo: this.modo, ok: true, url, latencia_ms: Date.now() - inicio };
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : String(err);
      return { modo: this.modo, ok: false, url, latencia_ms: Date.now() - inicio, error: mensaje };
    }
  }

  obtenerProducto(idProducto: number) {
    return this.solicitar<ProductoInventario>('GET', `/productos/${encodeURIComponent(idProducto)}`);
  }

  obtenerBodegas() {
    return this.solicitar<BodegaInventario[]>('GET', '/bodegas');
  }

  obtenerStock(idProducto: number) {
    return this.solicitar<StockBodegaInventario[]>('GET', `/stock/${encodeURIComponent(idProducto)}`);
  }

  obtenerReserva(idPedido: number) {
    return this.solicitar<ReservaPedidoInventario>(
      'GET',
      `/reservas?id_pedido=${encodeURIComponent(idPedido)}`
    );
  }

  registrarDespacho(input: DespachoInventarioInput) {
    return this.solicitar<ResultadoDespachoInventario>('POST', '/movimientos/despacho', input);
  }

  registrarRecepcion(input: RecepcionInventarioInput) {
    return this.solicitar<ResultadoRecepcionInventario>('POST', '/movimientos/recepcion', input);
  }

  private async solicitar<T>(metodo: 'GET' | 'POST', ruta: string, cuerpo?: unknown): Promise<T> {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), this.timeoutMs);

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';

    let respuesta: Response;
    try {
      respuesta = await this.fetchFn(`${this.baseUrl}${ruta}`, {
        method: metodo,
        headers,
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
        signal: controlador.signal,
      });
    } catch (err: any) {
      if (controlador.signal.aborted) {
        throw new InventarioError({
          tipo: 'TIMEOUT',
          mensaje: `Inventario no respondió en ${this.timeoutMs} ms (${metodo} ${ruta})`,
          ruta,
        });
      }
      const causa = err?.cause?.code || err?.code || err?.message || 'error de red';
      throw new InventarioError({
        tipo: 'SIN_CONEXION',
        mensaje: `No se pudo conectar con Inventario en ${this.origen()} (${causa})`,
        ruta,
      });
    } finally {
      clearTimeout(temporizador);
    }

    const texto = await respuesta.text();
    let json: unknown = null;
    if (texto) {
      try {
        json = JSON.parse(texto);
      } catch {
        if (respuesta.ok) {
          throw new InventarioError({
            tipo: 'RESPUESTA_INVALIDA',
            mensaje: `Inventario respondió algo que no es JSON (${metodo} ${ruta})`,
            ruta,
            status: respuesta.status,
          });
        }
      }
    }

    if (!respuesta.ok) throw errorDesdeRespuesta(respuesta.status, ruta, json);
    return json as T;
  }

  /** Origen sin ruta ni credenciales, para mostrar en logs y en el estado de la conexión */
  private origen(): string {
    try {
      return new URL(this.baseUrl).origin;
    } catch {
      return this.baseUrl;
    }
  }
}
