import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ClienteInventarioHttp,
  ClienteInventarioSimulado,
  InventarioError,
  crearClienteInventario,
  type DespachoInventarioInput,
  type RecepcionInventarioInput,
} from './index.js';

// ---------------------------------------------------------------------------
// Utilidades: fetch simulado que registra la llamada y responde lo indicado
// ---------------------------------------------------------------------------
type Llamada = { url: string; init: RequestInit };

function fetchQueResponde(status: number, cuerpo: unknown, llamadas: Llamada[] = []): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    llamadas.push({ url: String(url), init: init ?? {} });
    const texto = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
    return new Response(texto, { status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
}

function clienteHttp(fetchFn: typeof fetch, timeoutMs = 1000) {
  return new ClienteInventarioHttp({
    baseUrl: 'http://inventario.test/api/v1/',
    apiKey: 'clave-de-prueba-123456',
    timeoutMs,
    fetchFn,
  });
}

async function capturar(promesa: Promise<unknown>): Promise<InventarioError> {
  try {
    await promesa;
  } catch (err) {
    assert.ok(err instanceof InventarioError, `se esperaba InventarioError y llegó ${err}`);
    return err;
  }
  assert.fail('se esperaba un error');
}

const errorInventario = (statusCode: number, error: string, message: string | string[]) => ({
  statusCode,
  error,
  message,
  path: '/api/v1/x',
  timestamp: '2026-11-16T21:00:00.000Z',
});

const DESPACHO: DespachoInventarioInput = {
  id_despacho: 'GD-52341',
  id_pedido: 10294,
  id_empleado: 301,
  lineas: [
    { id_producto: 75192, cantidad: 1 },
    { id_producto: 10294, cantidad: 0 },
  ],
};

const RECEPCION: RecepcionInventarioInput = {
  id_oc: 8001,
  id_proveedor: 4,
  nro_guia_proveedor: 'GP-8001-1',
  id_empleado: 304,
  lineas: [{ id_producto: 75192, id_bodega: 1, cantidad: 9 }],
};

// ---------------------------------------------------------------------------
describe('Integración Inventario - cliente HTTP', () => {
  it('arma la URL, envía la API key como Bearer y devuelve el JSON', async () => {
    const llamadas: Llamada[] = [];
    const cliente = clienteHttp(fetchQueResponde(200, { id_producto: 112, peso_unitario_kg: 2.41 }, llamadas));

    const producto = await cliente.obtenerProducto(112);

    assert.equal(producto.peso_unitario_kg, 2.41);
    assert.equal(llamadas[0].url, 'http://inventario.test/api/v1/productos/112');
    const headers = llamadas[0].init.headers as Record<string, string>;
    assert.equal(headers.Authorization, 'Bearer clave-de-prueba-123456');
    assert.equal(llamadas[0].init.method, 'GET');
  });

  it('envía el despacho como POST con cuerpo JSON', async () => {
    const llamadas: Llamada[] = [];
    const cliente = clienteHttp(fetchQueResponde(201, { id_despacho: 'GD-52341', egreso: {}, liberacion: null }, llamadas));

    await cliente.registrarDespacho(DESPACHO);

    assert.equal(llamadas[0].url, 'http://inventario.test/api/v1/movimientos/despacho');
    assert.equal(llamadas[0].init.method, 'POST');
    assert.deepEqual(JSON.parse(String(llamadas[0].init.body)), DESPACHO);
  });

  it('consulta la reserva por id_pedido en el query string', async () => {
    const llamadas: Llamada[] = [];
    const cliente = clienteHttp(fetchQueResponde(200, { id_pedido: 10294, estado: 'PENDIENTE', lineas: [] }, llamadas));

    const reserva = await cliente.obtenerReserva(10294);

    assert.equal(reserva.estado, 'PENDIENTE');
    assert.equal(llamadas[0].url, 'http://inventario.test/api/v1/reservas?id_pedido=10294');
  });

  it('401: API key rechazada, no reintentable', async () => {
    const cliente = clienteHttp(fetchQueResponde(401, errorInventario(401, 'UNAUTHORIZED', 'Falta la API key (Authorization: Bearer)')));
    const err = await capturar(cliente.obtenerReserva(10294));
    assert.equal(err.tipo, 'NO_AUTORIZADO');
    assert.equal(err.status, 401);
    assert.equal(err.reintentable, false);
    assert.match(err.message, /API key/);
  });

  it('404: pedido sin reserva, conserva el mensaje de Inventario', async () => {
    const cliente = clienteHttp(fetchQueResponde(404, errorInventario(404, 'NOT_FOUND', 'El pedido 10294 no tiene una reserva')));
    const err = await capturar(cliente.obtenerReserva(10294));
    assert.equal(err.tipo, 'NO_ENCONTRADO');
    assert.equal(err.message, 'El pedido 10294 no tiene una reserva');
  });

  it('409: conflicto (reserva ya despachada), no reintentable', async () => {
    const cliente = clienteHttp(fetchQueResponde(409, errorInventario(409, 'CONFLICT', 'La reserva del pedido 10294 está COMPLETADO')));
    const err = await capturar(cliente.registrarDespacho(DESPACHO));
    assert.equal(err.tipo, 'CONFLICTO');
    assert.equal(err.reintentable, false);
    assert.match(err.message, /COMPLETADO/);
  });

  it('400: junta la lista de mensajes de validación', async () => {
    const cliente = clienteHttp(
      fetchQueResponde(400, errorInventario(400, 'BAD_REQUEST', ['id_pedido must be a positive number', 'id_pedido must be an integer number']))
    );
    const err = await capturar(cliente.obtenerReserva(10294));
    assert.equal(err.tipo, 'VALIDACION');
    assert.deepEqual(err.detalles, ['id_pedido must be a positive number', 'id_pedido must be an integer number']);
  });

  it('500 sin cuerpo JSON: error de Inventario reintentable', async () => {
    const cliente = clienteHttp(fetchQueResponde(500, '<html>Internal Server Error</html>'));
    const err = await capturar(cliente.obtenerBodegas());
    assert.equal(err.tipo, 'ERROR_INVENTARIO');
    assert.equal(err.reintentable, true);
  });

  it('timeout: corta la espera y es reintentable', async () => {
    const lento = ((_url: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      })) as typeof fetch;
    const err = await capturar(clienteHttp(lento, 30).obtenerBodegas());
    assert.equal(err.tipo, 'TIMEOUT');
    assert.equal(err.reintentable, true);
  });

  it('sin conexión: informa el origen y la causa, sin exponer la API key', async () => {
    const caido = (async () => {
      throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } });
    }) as typeof fetch;
    const err = await capturar(clienteHttp(caido).obtenerBodegas());
    assert.equal(err.tipo, 'SIN_CONEXION');
    assert.equal(err.reintentable, true);
    assert.match(err.message, /http:\/\/inventario\.test.*ECONNREFUSED/);
    assert.doesNotMatch(err.message, /clave-de-prueba/);
  });

  it('respuesta 200 que no es JSON: respuesta inválida', async () => {
    const err = await capturar(clienteHttp(fetchQueResponde(200, 'ok')).obtenerBodegas());
    assert.equal(err.tipo, 'RESPUESTA_INVALIDA');
  });

  it('verificarConexion informa ok/error sin lanzar', async () => {
    const ok = await clienteHttp(fetchQueResponde(200, { status: 'ok' })).verificarConexion();
    assert.equal(ok.ok, true);
    assert.equal(ok.url, 'http://inventario.test');

    const caido = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    const mal = await clienteHttp(caido).verificarConexion();
    assert.equal(mal.ok, false);
    assert.ok(mal.error);
  });
});

// ---------------------------------------------------------------------------
describe('Integración Inventario - cliente simulado', () => {
  it('entrega peso y medidas de los productos de prueba; 404 si no existe', async () => {
    const sim = new ClienteInventarioSimulado();
    const titanic = await sim.obtenerProducto(10294);
    assert.equal(titanic.peso_unitario_kg, 14.5);
    const err = await capturar(sim.obtenerProducto(1));
    assert.equal(err.tipo, 'NO_ENCONTRADO');
  });

  it('despacha una reserva PENDIENTE, libera lo no recolectado y no permite despacharla dos veces', async () => {
    const sim = new ClienteInventarioSimulado();
    const r = await sim.registrarDespacho(DESPACHO);
    assert.equal(r.egreso.detalles?.length, 1);
    assert.ok(r.liberacion, 'la línea en 0 se libera');
    assert.equal((await sim.obtenerReserva(10294)).estado, 'COMPLETADO');

    // Reintento con la misma guía: idempotente
    const repetido = await sim.registrarDespacho(DESPACHO);
    assert.equal(repetido.egreso.id_movimiento, r.egreso.id_movimiento);

    // Otra guía para el mismo pedido: la reserva ya no está PENDIENTE
    const err = await capturar(sim.registrarDespacho({ ...DESPACHO, id_despacho: 'GD-99999' }));
    assert.equal(err.tipo, 'CONFLICTO');
  });

  it('valida el despacho como Inventario (líneas, cantidades y productos repetidos)', async () => {
    const sim = new ClienteInventarioSimulado();
    const err = await capturar(
      sim.registrarDespacho({ ...DESPACHO, lineas: [{ id_producto: 1, cantidad: -1 }, { id_producto: 1, cantidad: 0 }] })
    );
    assert.equal(err.tipo, 'VALIDACION');
    assert.ok(err.detalles.some((d) => d.includes('repetir')));
  });

  it('responde 404 para pedidos configurados sin reserva', async () => {
    const sim = new ClienteInventarioSimulado({ pedidosSinReserva: [10294] });
    const err = await capturar(sim.obtenerReserva(10294));
    assert.equal(err.tipo, 'NO_ENCONTRADO');
  });

  it('recepción: idempotente con los mismos datos y 409 con datos distintos', async () => {
    const sim = new ClienteInventarioSimulado();
    const primera = await sim.registrarRecepcion(RECEPCION);
    const repetida = await sim.registrarRecepcion(RECEPCION);
    assert.equal(repetida.ingreso.id_movimiento, primera.ingreso.id_movimiento);

    const err = await capturar(
      sim.registrarRecepcion({ ...RECEPCION, lineas: [{ id_producto: 75192, id_bodega: 1, cantidad: 8 }] })
    );
    assert.equal(err.tipo, 'CONFLICTO');
  });

  it('recepción: rechaza cantidades en 0 y bodegas inexistentes', async () => {
    const sim = new ClienteInventarioSimulado();
    const cero = await capturar(
      sim.registrarRecepcion({ ...RECEPCION, lineas: [{ id_producto: 75192, id_bodega: 1, cantidad: 0 }] })
    );
    assert.equal(cero.tipo, 'VALIDACION');
    const bodega = await capturar(
      sim.registrarRecepcion({ ...RECEPCION, lineas: [{ id_producto: 75192, id_bodega: 99, cantidad: 1 }] })
    );
    assert.equal(bodega.tipo, 'NO_ENCONTRADO');
  });
});

// ---------------------------------------------------------------------------
describe('Integración Inventario - selección de cliente', () => {
  it('sin INVENTARIO_API_URL usa el simulado; con URL usa el real', () => {
    assert.equal(crearClienteInventario({}).modo, 'simulado');
    assert.equal(crearClienteInventario({ INVENTARIO_API_URL: '  ' }).modo, 'simulado');
    assert.equal(
      crearClienteInventario({ INVENTARIO_API_URL: 'http://localhost:3000/api/v1', INVENTARIO_API_KEY: 'x'.repeat(20) }).modo,
      'real'
    );
  });
});
