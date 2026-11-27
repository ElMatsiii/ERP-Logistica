import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { crearApp } from '../app.js';
import type { ConfigAuth } from '../config/auth.config.js';
import type { LogisticaController } from '../controllers/logistica.controller.js';
import { ClienteRrhhSimulado, EMPLEADOS_SIMULADOS as E } from '../integrations/rrhh/cliente-simulado.js';
import { MENSAJES_AUTH, SesionService } from '../services/sesion.service.js';
import { MENSAJES_IDENTIFICACION } from './auth.middleware.js';

const SECRETO = 'secreto-de-prueba-compartido-con-rrhh-0123456789';

/** Controlador falso: cualquier acción responde 200 e informa quién llegó. Ninguna ruta toca la BD. */
function controladorFalso(llamadas: string[]): LogisticaController {
  return new Proxy({} as LogisticaController, {
    get: (_obj, accion: string) => (req: any, res: any) => {
      llamadas.push(accion);
      res.json({ accion, id_empleado: req.usuario?.id_empleado ?? null });
    },
  });
}

interface Servidor {
  url: string;
  llamadas: string[];
  cerrar: () => Promise<void>;
}

async function levantar(configAuth: ConfigAuth): Promise<Servidor> {
  const llamadas: string[] = [];
  const app = crearApp({
    configAuth,
    clienteRrhh: new ClienteRrhhSimulado(),
    verificarBd: async () => true,
    controller: controladorFalso(llamadas),
    registrarPeticiones: false,
  });
  const server: Server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    llamadas,
    cerrar: async () => {
      server.closeAllConnections();
      server.close();
      await once(server, 'close');
    },
  };
}

const CONFIG_JWT: ConfigAuth = { modo: 'jwt', jwtSecret: SECRETO, jwtExpiresInSeg: 8 * 3600, advertencias: [] };
const CONFIG_SIMULADO: ConfigAuth = { modo: 'simulado', jwtSecret: SECRETO, jwtExpiresInSeg: 8 * 3600, advertencias: [] };

const sesion = new SesionService(new ClienteRrhhSimulado(), CONFIG_JWT);
/** Token válido (firmado con el secreto) para un empleado simulado */
async function tokenDe(idEmpleado: number): Promise<string> {
  const cuenta = await new ClienteRrhhSimulado().buscarCuentaPorId(idEmpleado);
  assert.ok(cuenta);
  return sesion.firmarToken(cuenta);
}
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function pedir(s: Servidor, metodo: string, ruta: string, headers: Record<string, string> = {}) {
  const res = await fetch(`${s.url}${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: metodo === 'GET' ? undefined : '{}',
  });
  return { status: res.status, body: (await res.json()) as any };
}

describe('HTTP · AUTH_MODO=jwt', () => {
  let s: Servidor;
  before(async () => { s = await levantar(CONFIG_JWT); });
  after(async () => { await s.cerrar(); });

  describe('GET /api/health es pública', () => {
    it('responde 200 sin ninguna identificación, con el estado de RRHH', async () => {
      const { status, body } = await pedir(s, 'GET', '/api/health');
      assert.equal(status, 200);
      assert.equal(body.status, 'ok');
      assert.deepEqual(body.rrhh, { modo: 'simulado', ok: true });
    });

    it('responde 200 aunque llegue un token inválido', async () => {
      const { status } = await pedir(s, 'GET', '/api/health', bearer('token-invalido'));
      assert.equal(status, 200);
    });
  });

  describe('token ausente o mal formado → 401', () => {
    it('sin Authorization → 401, también en rutas de solo lectura', async () => {
      for (const ruta of ['/api/logistica/auth/me', '/api/logistica/pedidos-pendientes', '/api/logistica/tracking']) {
        const { status, body } = await pedir(s, 'GET', ruta);
        assert.equal(status, 401, ruta);
        assert.equal(body.error, MENSAJES_IDENTIFICACION.SIN_TOKEN);
      }
      assert.deepEqual(s.llamadas, []);
    });

    it('las cabeceras x-user-* se ignoran en modo jwt', async () => {
      const { status } = await pedir(s, 'GET', '/api/logistica/auth/me', { 'x-user-id': String(E.COORDINADOR), 'x-user-role': 'COORDINADOR_LOGISTICA' });
      assert.equal(status, 401);
    });

    it('Authorization que no es Bearer → 401', async () => {
      for (const valor of ['Basic dXNlcjpwYXNz', 'Bearer', 'Bearer a b', 'token-suelto']) {
        const { status, body } = await pedir(s, 'GET', '/api/logistica/auth/me', { Authorization: valor });
        assert.equal(status, 401, valor);
        assert.equal(body.error, MENSAJES_IDENTIFICACION.CABECERA_INVALIDA, valor);
      }
    });
  });

  describe('token inválido → 401 "Sesión inválida o expirada"', () => {
    it('mal firmado', async () => {
      const token = jwt.sign({ sub: E.COORDINADOR, employeeId: E.COORDINADOR, source: 'db' }, 'otro-secreto', { algorithm: 'HS256' });
      const { status, body } = await pedir(s, 'GET', '/api/logistica/auth/me', bearer(token));
      assert.equal(status, 401);
      assert.equal(body.error, MENSAJES_AUTH.SESION_INVALIDA);
    });

    it('expirado', async () => {
      const exp = Math.floor(Date.now() / 1000) - 60;
      const token = jwt.sign({ sub: E.COORDINADOR, employeeId: E.COORDINADOR, source: 'db', exp }, SECRETO, { algorithm: 'HS256' });
      const { status, body } = await pedir(s, 'GET', '/api/logistica/auth/me', bearer(token));
      assert.equal(status, 401);
      assert.equal(body.error, MENSAJES_AUTH.SESION_INVALIDA);
    });

    it('source "demo" del admin en memoria de RRHH', async () => {
      const token = jwt.sign({ sub: 0, username: 'admin', role: 'Administrador', source: 'demo' }, SECRETO, { algorithm: 'HS256' });
      const { status, body } = await pedir(s, 'GET', '/api/logistica/auth/me', bearer(token));
      assert.equal(status, 401);
      assert.equal(body.error, MENSAJES_AUTH.TOKEN_DEMO);
    });
  });

  describe('token válido: se relee la cuenta en RRHH', () => {
    it('identifica al empleado real con su rol de Logística', async () => {
      const { status, body } = await pedir(s, 'GET', '/api/logistica/auth/me', bearer(await tokenDe(E.DESPACHO)));
      assert.equal(status, 200);
      assert.equal(body.usuario.id_empleado, E.DESPACHO);
      assert.equal(body.usuario.rol, 'OPERADOR_DESPACHO');
      assert.equal(body.usuario.username, 'cgomez@lesgo.test');
      assert.doesNotMatch(JSON.stringify(body), /password/);
    });

    it('cuenta bloqueada → 401 aunque el token tenga firma válida', async () => {
      const { status, body } = await pedir(s, 'GET', '/api/logistica/auth/me', bearer(await tokenDe(E.BLOQUEADO)));
      assert.equal(status, 401);
      assert.equal(body.error, MENSAJES_AUTH.CUENTA_NO_ACTIVA);
    });

    it('empleado inactivo → 401', async () => {
      const { status } = await pedir(s, 'GET', '/api/logistica/auth/me', bearer(await tokenDe(E.INACTIVO)));
      assert.equal(status, 401);
    });

    it('sin rol de Logística → 403 "No tienes acceso al módulo de Logística"', async () => {
      const { status, body } = await pedir(s, 'GET', '/api/logistica/auth/me', bearer(await tokenDe(E.SIN_ROL_LOGISTICA)));
      assert.equal(status, 403);
      assert.equal(body.error, MENSAJES_AUTH.SIN_ACCESO_LOGISTICA);
    });
  });

  describe('permisos por rol (requerirPermiso no cambia)', () => {
    it('Recepción no puede emitir guías → 403, sin llegar al controlador', async () => {
      const antes = s.llamadas.length;
      const { status, body } = await pedir(s, 'POST', '/api/logistica/guias', bearer(await tokenDe(E.RECEPCION)));
      assert.equal(status, 403);
      assert.deepEqual(body.permisos_requeridos, ['EMITIR_GUIA']);
      assert.equal(s.llamadas.length, antes);
    });

    it('Despacho sí puede emitir guías', async () => {
      const { status, body } = await pedir(s, 'POST', '/api/logistica/guias', bearer(await tokenDe(E.DESPACHO)));
      assert.equal(status, 200);
      assert.deepEqual(body, { accion: 'emitirGuia', id_empleado: E.DESPACHO });
    });

    it('Despacho no puede registrar recepciones en muelle → 403', async () => {
      const { status } = await pedir(s, 'POST', '/api/logistica/recepciones', bearer(await tokenDe(E.DESPACHO)));
      assert.equal(status, 403);
    });

    it('Recepción sí puede registrar recepciones', async () => {
      const { status, body } = await pedir(s, 'POST', '/api/logistica/recepciones', bearer(await tokenDe(E.RECEPCION)));
      assert.equal(status, 200);
      assert.equal(body.id_empleado, E.RECEPCION);
    });

    it('el Administrador del ERP actúa como Coordinador', async () => {
      const { status } = await pedir(s, 'POST', '/api/logistica/guias/GD-1/reintentar-stock', bearer(await tokenDe(E.ADMINISTRADOR_ERP)));
      assert.equal(status, 200);
    });
  });
});

describe('HTTP · AUTH_MODO=simulado', () => {
  let s: Servidor;
  before(async () => { s = await levantar(CONFIG_SIMULADO); });
  after(async () => { await s.cerrar(); });

  it('GET /api/health es pública', async () => {
    const { status, body } = await pedir(s, 'GET', '/api/health');
    assert.equal(status, 200);
    assert.equal(body.rrhh.ok, true);
  });

  it('sin identificación → 401 (ya no hay Coordinador por defecto)', async () => {
    for (const ruta of ['/api/logistica/auth/me', '/api/logistica/pedidos-pendientes']) {
      const { status, body } = await pedir(s, 'GET', ruta);
      assert.equal(status, 401, ruta);
      assert.equal(body.error, MENSAJES_IDENTIFICACION.SIN_IDENTIFICACION);
    }
    const { status } = await pedir(s, 'POST', '/api/logistica/guias');
    assert.equal(status, 401);
    assert.deepEqual(s.llamadas, []);
  });

  it('acepta x-user-id y aplica permisos', async () => {
    assert.equal((await pedir(s, 'POST', '/api/logistica/guias', { 'x-user-id': String(E.RECEPCION) })).status, 403);
    const { status, body } = await pedir(s, 'POST', '/api/logistica/guias', { 'x-user-id': String(E.DESPACHO) });
    assert.equal(status, 200);
    assert.equal(body.id_empleado, E.DESPACHO);
  });

  it('x-user-role desconocido → 401', async () => {
    const { status } = await pedir(s, 'GET', '/api/logistica/auth/me', { 'x-user-role': 'SUPERADMIN' });
    assert.equal(status, 401);
  });

  it('también acepta Bearer (para probar el login real en desarrollo)', async () => {
    const { status, body } = await pedir(s, 'GET', '/api/logistica/auth/me', bearer(await tokenDe(E.RECEPCION)));
    assert.equal(status, 200);
    assert.equal(body.usuario.username, 'eparedes@lesgo.test');
  });

  it('un Bearer inválido → 401, sin caer en las cabeceras x-user-*', async () => {
    const { status } = await pedir(s, 'GET', '/api/logistica/auth/me', { ...bearer('basura'), 'x-user-id': String(E.COORDINADOR) });
    assert.equal(status, 401);
  });

  it('sin JWT_SECRET, un Bearer → 503 y las cabeceras siguen funcionando', async () => {
    const sinSecreto = await levantar({ ...CONFIG_SIMULADO, jwtSecret: null });
    try {
      const conToken = await pedir(sinSecreto, 'GET', '/api/logistica/auth/me', bearer(await tokenDe(E.DESPACHO)));
      assert.equal(conToken.status, 503);
      assert.equal(conToken.body.error, MENSAJES_AUTH.JWT_NO_CONFIGURADO);
      const conCabecera = await pedir(sinSecreto, 'GET', '/api/logistica/auth/me', { 'x-user-id': String(E.DESPACHO) });
      assert.equal(conCabecera.status, 200);
    } finally {
      await sinSecreto.cerrar();
    }
  });
});
