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
import { CONTRASENA_DEMO } from '../integrations/rrhh/cliente-simulado.js';
import { MENSAJE_DATOS_LOGIN } from '../controllers/sesion.controller.js';
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

async function pedir(s: Servidor, metodo: string, ruta: string, headers: Record<string, string> = {}, cuerpo: unknown = {}) {
  const res = await fetch(`${s.url}${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: metodo === 'GET' ? undefined : typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  });
  return { status: res.status, body: (await res.json()) as any };
}

const login = (s: Servidor, email: unknown, password: unknown) =>
  pedir(s, 'POST', '/api/auth/login', {}, { email, password });

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

  describe('POST /api/auth/login (público)', () => {
    it('login correcto → { accessToken, usuario } sin datos sensibles; el token sirve en las rutas', async () => {
      const { status, body } = await login(s, 'eparedes@lesgo.test', CONTRASENA_DEMO);
      assert.equal(status, 200);
      assert.deepEqual(Object.keys(body).sort(), ['accessToken', 'usuario']);
      assert.equal(body.usuario.id_empleado, E.RECEPCION);
      assert.equal(body.usuario.rol, 'OPERADOR_RECEPCION');
      assert.doesNotMatch(JSON.stringify(body.usuario), /password|\$2[aby]\$/);

      const payload = jwt.verify(body.accessToken, SECRETO, { algorithms: ['HS256'] }) as jwt.JwtPayload;
      assert.equal(payload.sub, E.RECEPCION);
      assert.equal(payload.source, 'db');

      assert.equal((await pedir(s, 'POST', '/api/logistica/recepciones', bearer(body.accessToken))).status, 200);
      assert.equal((await pedir(s, 'POST', '/api/logistica/guias', bearer(body.accessToken))).status, 403);
    });

    it('contraseña incorrecta y email inexistente → 401 con el mismo mensaje', async () => {
      for (const [email, password] of [['eparedes@lesgo.test', 'mala'], ['nadie@lesgo.test', CONTRASENA_DEMO]]) {
        const { status, body } = await login(s, email, password);
        assert.equal(status, 401);
        assert.deepEqual(body, { error: MENSAJES_AUTH.CREDENCIALES_INVALIDAS });
      }
    });

    it('usuario bloqueado y empleado inactivo → 401 "La cuenta no está activa"', async () => {
      for (const email of ['dfuentes@lesgo.test', 'pvera@lesgo.test']) {
        const { status, body } = await login(s, email, CONTRASENA_DEMO);
        assert.equal(status, 401, email);
        assert.equal(body.error, MENSAJES_AUTH.CUENTA_NO_ACTIVA);
      }
    });

    it('sin rol de Logística → 403', async () => {
      const { status, body } = await login(s, 'cherrera@lesgo.test', CONTRASENA_DEMO);
      assert.equal(status, 403);
      assert.equal(body.error, MENSAJES_AUTH.SIN_ACCESO_LOGISTICA);
    });

    it('faltan email o contraseña, o no son texto → 400', async () => {
      const cuerpos = [{}, { email: 'eparedes@lesgo.test' }, { password: CONTRASENA_DEMO }, { email: '  ', password: 'x' }, { email: 1, password: 2 }];
      for (const cuerpo of cuerpos) {
        const { status, body } = await pedir(s, 'POST', '/api/auth/login', {}, cuerpo);
        assert.equal(status, 400, JSON.stringify(cuerpo));
        assert.equal(body.error, MENSAJE_DATOS_LOGIN);
      }
    });

    it('JSON mal formado → 400 en JSON, sin devolver lo enviado', async () => {
      const { status, body } = await pedir(s, 'POST', '/api/auth/login', {}, '{"email": "a@b.test", "password": "secreta"');
      assert.equal(status, 400);
      assert.equal(body.error, 'El cuerpo de la petición no es JSON válido');
      assert.doesNotMatch(JSON.stringify(body), /secreta/);
    });
  });

  describe('GET /api/auth/me', () => {
    it('sin token → 401', async () => {
      const { status, body } = await pedir(s, 'GET', '/api/auth/me');
      assert.equal(status, 401);
      assert.equal(body.error, MENSAJES_IDENTIFICACION.SIN_TOKEN);
    });

    it('con el token del login → { autenticado, usuario }', async () => {
      const { body: sesion } = await login(s, 'mpizarro@lesgo.test', CONTRASENA_DEMO);
      const { status, body } = await pedir(s, 'GET', '/api/auth/me', bearer(sesion.accessToken));
      assert.equal(status, 200);
      assert.equal(body.autenticado, true);
      assert.deepEqual(body.usuario, sesion.usuario);
    });

    it('acepta un token emitido por el portal de RRHH (inicio de sesión único)', async () => {
      const tokenRrhh = jwt.sign(
        { sub: E.DESPACHO, username: 'cgomez@lesgo.test', role: 'LOG_DESPACHO', employeeId: E.DESPACHO, source: 'db' },
        SECRETO,
        { algorithm: 'HS256', expiresIn: '8h' }
      );
      const { status, body } = await pedir(s, 'GET', '/api/auth/me', bearer(tokenRrhh));
      assert.equal(status, 200);
      assert.equal(body.usuario.rol, 'OPERADOR_DESPACHO');
    });
  });

  describe('selector de usuarios simulados desactivado en modo jwt', () => {
    it('/api/logistica/auth/usuarios y /login → 404, aun con un token válido', async () => {
      const token = await tokenDe(E.COORDINADOR);
      assert.equal((await pedir(s, 'GET', '/api/logistica/auth/usuarios', bearer(token))).status, 404);
      const { status, body } = await pedir(s, 'POST', '/api/logistica/auth/login', bearer(token), { id_empleado: E.COORDINADOR });
      assert.equal(status, 404);
      assert.match(body.error, /POST \/api\/auth\/login/);
    });

    it('/api/logistica/auth/roles y /me siguen disponibles con token', async () => {
      const token = await tokenDe(E.COORDINADOR);
      assert.equal((await pedir(s, 'GET', '/api/logistica/auth/roles', bearer(token))).status, 200);
      assert.equal((await pedir(s, 'GET', '/api/logistica/auth/me', bearer(token))).status, 200);
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

  it('el selector de usuarios simulados sigue funcionando (con identificación)', async () => {
    const cabecera = { 'x-user-id': String(E.COORDINADOR) };
    const usuarios = await pedir(s, 'GET', '/api/logistica/auth/usuarios', cabecera);
    assert.equal(usuarios.status, 200);
    assert.ok(Array.isArray(usuarios.body));
    const cambio = await pedir(s, 'POST', '/api/logistica/auth/login', cabecera, { id_empleado: E.RECEPCION });
    assert.equal(cambio.status, 200);
    assert.equal(cambio.body.usuario.rol, 'OPERADOR_RECEPCION');
    assert.equal((await pedir(s, 'GET', '/api/logistica/auth/usuarios')).status, 401);
  });

  it('POST /api/auth/login también funciona en modo simulado', async () => {
    const { status, body } = await login(s, 'cgomez@lesgo.test', CONTRASENA_DEMO);
    assert.equal(status, 200);
    assert.equal((await pedir(s, 'GET', '/api/auth/me', bearer(body.accessToken))).body.usuario.id_empleado, E.DESPACHO);
  });

  it('GET /api/auth/me acepta x-user-* en modo simulado', async () => {
    const { status, body } = await pedir(s, 'GET', '/api/auth/me', { 'x-user-id': String(E.RECEPCION) });
    assert.equal(status, 200);
    assert.equal(body.usuario.rol, 'OPERADOR_RECEPCION');
  });

  it('sin JWT_SECRET: login y Bearer → 503; las cabeceras siguen funcionando', async () => {
    const sinSecreto = await levantar({ ...CONFIG_SIMULADO, jwtSecret: null });
    try {
      const conToken = await pedir(sinSecreto, 'GET', '/api/logistica/auth/me', bearer(await tokenDe(E.DESPACHO)));
      assert.equal(conToken.status, 503);
      assert.equal(conToken.body.error, MENSAJES_AUTH.JWT_NO_CONFIGURADO);
      const conLogin = await login(sinSecreto, 'cgomez@lesgo.test', CONTRASENA_DEMO);
      assert.equal(conLogin.status, 503);
      assert.equal(conLogin.body.error, MENSAJES_AUTH.JWT_NO_CONFIGURADO);
      const conCabecera = await pedir(sinSecreto, 'GET', '/api/logistica/auth/me', { 'x-user-id': String(E.DESPACHO) });
      assert.equal(conCabecera.status, 200);
    } finally {
      await sinSecreto.cerrar();
    }
  });
});
