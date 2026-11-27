import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { AuthError, MENSAJES_AUTH, SesionService, usuarioDesdeCuenta, validarCuenta } from './sesion.service.js';
import { ROLES_CONFIG } from './auth.service.js';
import { CONTRASENA_DEMO, ClienteRrhhSimulado, EMPLEADOS_SIMULADOS as E, type EmpleadoSimulado } from '../integrations/rrhh/cliente-simulado.js';
import { RrhhError, type ClienteRrhh, type CuentaRrhh } from '../integrations/rrhh/index.js';

const SECRETO = 'secreto-de-prueba-compartido-con-rrhh-0123456789';
type ConfigSesion = ConstructorParameters<typeof SesionService>[1];
const CONFIG: ConfigSesion = { jwtSecret: SECRETO, jwtExpiresInSeg: 8 * 3600 };

const servicio = (cliente: ClienteRrhh = new ClienteRrhhSimulado(), config: ConfigSesion = CONFIG) => new SesionService(cliente, config);

/** Espera un AuthError con el status y mensaje indicados */
async function rechazaCon(promesa: Promise<unknown>, status: number, mensaje: string) {
  await assert.rejects(promesa, (err: unknown) => {
    assert.ok(err instanceof AuthError, `se esperaba AuthError y llegó ${err}`);
    assert.equal(err.status, status);
    assert.equal(err.message, mensaje);
    return true;
  });
}

function lanzaCon(fn: () => unknown, status: number, mensaje: string) {
  assert.throws(fn, (err: unknown) => err instanceof AuthError && err.status === status && err.message === mensaje);
}

/** Token firmado "por RRHH" (o por un tercero) con el payload que se indique */
const tokenExterno = (payload: object, secreto = SECRETO, opciones: jwt.SignOptions = { algorithm: 'HS256', expiresIn: '8h' }) =>
  jwt.sign(payload, secreto, opciones);

describe('Sesión · Login contra RRHH (POST /api/auth/login)', () => {
  it('login correcto: devuelve accessToken y el usuario de Logística sin datos sensibles', async () => {
    const { accessToken, usuario } = await servicio().iniciarSesion('mpizarro@lesgo.test', CONTRASENA_DEMO);
    assert.equal(typeof accessToken, 'string');
    assert.deepEqual(usuario, {
      id_usuario: E.COORDINADOR,
      id_empleado: E.COORDINADOR,
      username: 'mpizarro@lesgo.test',
      nombre: 'Maximiliano Pizarro',
      rut: '17.892.341-5',
      cargo: 'Coordinador General de Logística',
      rol: 'COORDINADOR_LOGISTICA',
      rol_nombre: ROLES_CONFIG.COORDINADOR_LOGISTICA.nombre,
      avatar_iniciales: 'MP',
      avatar_color: 'bg-emerald-600',
      permisos: ROLES_CONFIG.COORDINADOR_LOGISTICA.permisos,
      descripcion: ROLES_CONFIG.COORDINADOR_LOGISTICA.descripcion,
      pestañas_permitidas: ['emision', 'tracking', 'recepcion'],
    });
    const json = JSON.stringify({ accessToken, usuario });
    assert.doesNotMatch(json, /password|\$2[aby]\$/);
  });

  it('el email no distingue mayúsculas ni espacios', async () => {
    const { usuario } = await servicio().iniciarSesion('  EParedes@LesGo.test ', CONTRASENA_DEMO);
    assert.equal(usuario.rol, 'OPERADOR_RECEPCION');
    assert.deepEqual(usuario.permisos, ['RECEPCION_MUELLE']);
  });

  it('cada rol de RRHH se traduce a su rol de Logística (incluido Administrador)', async () => {
    const casos: [string, string][] = [
      ['cgomez@lesgo.test', 'OPERADOR_DESPACHO'],
      ['eparedes@lesgo.test', 'OPERADOR_RECEPCION'],
      ['asoto@lesgo.test', 'COORDINADOR_LOGISTICA'],
      ['jmunoz@lesgo.test', 'OPERADOR_DESPACHO'], // varios roles: gana el de mayor privilegio
    ];
    for (const [email, rol] of casos) {
      assert.equal((await servicio().iniciarSesion(email, CONTRASENA_DEMO)).usuario.rol, rol, email);
    }
  });

  it('contraseña incorrecta → 401 "Usuario o contraseña incorrectos"', async () => {
    await rechazaCon(servicio().iniciarSesion('mpizarro@lesgo.test', 'otra-clave'), 401, MENSAJES_AUTH.CREDENCIALES_INVALIDAS);
  });

  it('email inexistente → 401 con el mismo mensaje', async () => {
    await rechazaCon(servicio().iniciarSesion('nadie@lesgo.test', CONTRASENA_DEMO), 401, MENSAJES_AUTH.CREDENCIALES_INVALIDAS);
  });

  it('datos vacíos o de otro tipo → 401 con el mismo mensaje', async () => {
    const s = servicio();
    for (const [email, password] of [['', CONTRASENA_DEMO], ['mpizarro@lesgo.test', ''], [undefined, undefined], [123, {}], [['a'], null]]) {
      await rechazaCon(s.iniciarSesion(email, password), 401, MENSAJES_AUTH.CREDENCIALES_INVALIDAS);
    }
  });

  it('usuario bloqueado → 401 "La cuenta no está activa"', async () => {
    await rechazaCon(servicio().iniciarSesion('dfuentes@lesgo.test', CONTRASENA_DEMO), 401, MENSAJES_AUTH.CUENTA_NO_ACTIVA);
  });

  it('empleado inactivo → 401 "La cuenta no está activa"', async () => {
    await rechazaCon(servicio().iniciarSesion('pvera@lesgo.test', CONTRASENA_DEMO), 401, MENSAJES_AUTH.CUENTA_NO_ACTIVA);
  });

  it('cuenta bloqueada con contraseña incorrecta → no revela el estado (credenciales inválidas)', async () => {
    await rechazaCon(servicio().iniciarSesion('dfuentes@lesgo.test', 'otra'), 401, MENSAJES_AUTH.CREDENCIALES_INVALIDAS);
  });

  it('sin rol de Logística → 403 "No tienes acceso al módulo de Logística"', async () => {
    await rechazaCon(servicio().iniciarSesion('cherrera@lesgo.test', CONTRASENA_DEMO), 403, MENSAJES_AUTH.SIN_ACCESO_LOGISTICA);
  });

  it('cuenta sin password_hash en RRHH → credenciales inválidas', async () => {
    const empleados: EmpleadoSimulado[] = [{
      id_empleado: 1, rut: '1-9', nombre: 'Sin', apellido: 'Clave', email: 'sinclave@lesgo.test', estado: 'activo',
      cargo: null, roles: ['LOG_DESPACHO'], usuario: { estado: 'activo', password_hash: '' },
    }];
    const s = servicio(new ClienteRrhhSimulado({ empleados, ausencias: [] }));
    await rechazaCon(s.iniciarSesion('sinclave@lesgo.test', ''), 401, MENSAJES_AUTH.CREDENCIALES_INVALIDAS);
    await rechazaCon(s.iniciarSesion('sinclave@lesgo.test', 'x'), 401, MENSAJES_AUTH.CREDENCIALES_INVALIDAS);
  });

  it('sin JWT_SECRET → 503, sin consultar RRHH', async () => {
    let consultas = 0;
    const cliente = Object.assign(new ClienteRrhhSimulado(), {
      buscarCuentaPorEmail: async () => { consultas++; return null; },
    });
    await rechazaCon(servicio(cliente, { jwtSecret: null, jwtExpiresInSeg: 60 }).iniciarSesion('mpizarro@lesgo.test', CONTRASENA_DEMO), 503, MENSAJES_AUTH.JWT_NO_CONFIGURADO);
    assert.equal(consultas, 0);
  });

  it('RRHH caído → 503 (no 401: las credenciales pueden estar bien)', async () => {
    const cliente = Object.assign(new ClienteRrhhSimulado(), {
      buscarCuentaPorEmail: async () => {
        throw new RrhhError({ tipo: 'SIN_CONEXION', mensaje: 'No se pudo conectar con la BD para leer RRHH', operacion: 'buscarCuentaPorEmail' });
      },
    });
    await rechazaCon(servicio(cliente).iniciarSesion('mpizarro@lesgo.test', CONTRASENA_DEMO), 503, MENSAJES_AUTH.RRHH_NO_DISPONIBLE);
  });
});

describe('Sesión · Token compatible con RRHH', () => {
  it('HS256 con el payload exacto de RRHH { sub, username, role, employeeId, source } y 8 h de vigencia', async () => {
    const { accessToken } = await servicio().iniciarSesion('jmunoz@lesgo.test', CONTRASENA_DEMO);
    const decodificado = jwt.decode(accessToken, { complete: true })!;
    assert.deepEqual(decodificado.header, { alg: 'HS256', typ: 'JWT' });

    const { iat, exp, ...payload } = decodificado.payload as jwt.JwtPayload;
    assert.deepEqual(payload, {
      sub: E.VARIOS_ROLES,
      username: 'jmunoz@lesgo.test',
      role: 'Asistente', // primer rol por id_rol, como RRHH (informativo)
      employeeId: E.VARIOS_ROLES,
      source: 'db',
    });
    assert.equal(exp! - iat!, 8 * 3600);
  });

  it('la firma usa JWT_SECRET (verificable por RRHH con el mismo secreto)', async () => {
    const { accessToken } = await servicio().iniciarSesion('cgomez@lesgo.test', CONTRASENA_DEMO);
    assert.doesNotThrow(() => jwt.verify(accessToken, SECRETO, { algorithms: ['HS256'] }));
    assert.throws(() => jwt.verify(accessToken, 'otro-secreto'), jwt.JsonWebTokenError);
  });

  it('respeta JWT_EXPIRES_IN', async () => {
    const { accessToken } = await servicio(undefined, { jwtSecret: SECRETO, jwtExpiresInSeg: 1800 }).iniciarSesion('cgomez@lesgo.test', CONTRASENA_DEMO);
    const { iat, exp } = jwt.decode(accessToken) as jwt.JwtPayload;
    assert.equal(exp! - iat!, 1800);
  });

  it('sin roles, role va null', () => {
    const cuenta = { id_empleado: 9, email: 'x@lesgo.test', roles: [] } as unknown as CuentaRrhh;
    assert.equal((jwt.decode(servicio().firmarToken(cuenta)) as jwt.JwtPayload).role, null);
  });
});

describe('Sesión · Verificación de token y relectura de la cuenta', () => {
  it('acepta el token emitido por el login', async () => {
    const s = servicio();
    const { accessToken } = await s.iniciarSesion('cgomez@lesgo.test', CONTRASENA_DEMO);
    assert.equal(s.verificarToken(accessToken), E.DESPACHO);
    const usuario = await s.usuarioDesdeToken(accessToken);
    assert.equal(usuario.id_empleado, E.DESPACHO);
    assert.equal(usuario.rol, 'OPERADOR_DESPACHO');
  });

  it('acepta un token emitido por RRHH (sub como número o como texto)', async () => {
    const s = servicio();
    for (const sub of [E.RECEPCION, String(E.RECEPCION)]) {
      const token = tokenExterno({ sub, username: 'eparedes@lesgo.test', role: 'LOG_RECEPCION', employeeId: E.RECEPCION, source: 'db' });
      assert.equal((await s.usuarioDesdeToken(token)).rol, 'OPERADOR_RECEPCION');
    }
  });

  it('el rol del token es solo informativo: manda el rol que está en RRHH', async () => {
    // El token dice LOG_COORDINADOR, pero en RRHH el empleado 304 solo es LOG_RECEPCION
    const token = tokenExterno({ sub: E.RECEPCION, username: 'eparedes@lesgo.test', role: 'LOG_COORDINADOR', employeeId: E.RECEPCION, source: 'db' });
    assert.equal((await servicio().usuarioDesdeToken(token)).rol, 'OPERADOR_RECEPCION');
  });

  it('token mal firmado → 401 "Sesión inválida o expirada"', () => {
    const token = tokenExterno({ sub: E.COORDINADOR, employeeId: E.COORDINADOR, source: 'db' }, 'secreto-de-otro');
    lanzaCon(() => servicio().verificarToken(token), 401, MENSAJES_AUTH.SESION_INVALIDA);
  });

  it('token expirado → 401 "Sesión inválida o expirada"', () => {
    const exp = Math.floor(Date.now() / 1000) - 10;
    const token = tokenExterno({ sub: E.COORDINADOR, employeeId: E.COORDINADOR, source: 'db', exp }, SECRETO, { algorithm: 'HS256' });
    lanzaCon(() => servicio().verificarToken(token), 401, MENSAJES_AUTH.SESION_INVALIDA);
  });

  it('token alterado o basura → 401', () => {
    const s = servicio();
    const valido = tokenExterno({ sub: E.DESPACHO, employeeId: E.DESPACHO, source: 'db' });
    const [h, , f] = valido.split('.');
    const otroPayload = Buffer.from(JSON.stringify({ sub: E.COORDINADOR, employeeId: E.COORDINADOR, source: 'db' })).toString('base64url');
    for (const token of [`${h}.${otroPayload}.${f}`, 'no-es-un-token', '', 'a.b.c']) {
      lanzaCon(() => s.verificarToken(token), 401, MENSAJES_AUTH.SESION_INVALIDA);
    }
  });

  it('rechaza alg "none" y otros algoritmos distintos de HS256', () => {
    const s = servicio();
    const sinFirma = tokenExterno({ sub: E.COORDINADOR, employeeId: E.COORDINADOR, source: 'db' }, '', { algorithm: 'none' });
    const hs512 = tokenExterno({ sub: E.COORDINADOR, employeeId: E.COORDINADOR, source: 'db' }, SECRETO, { algorithm: 'HS512' });
    lanzaCon(() => s.verificarToken(sinFirma), 401, MENSAJES_AUTH.SESION_INVALIDA);
    lanzaCon(() => s.verificarToken(hs512), 401, MENSAJES_AUTH.SESION_INVALIDA);
  });

  it('source "demo" (admin en memoria de RRHH) → 401', () => {
    const token = tokenExterno({ sub: 0, username: 'admin', role: 'Administrador', employeeId: null, source: 'demo' });
    lanzaCon(() => servicio().verificarToken(token), 401, MENSAJES_AUTH.TOKEN_DEMO);
  });

  it('payload incompleto o incoherente → 401', () => {
    const s = servicio();
    const payloads = [
      { sub: E.DESPACHO, employeeId: E.DESPACHO }, // sin source
      { sub: E.DESPACHO, employeeId: E.DESPACHO, source: 'otro' },
      { employeeId: E.DESPACHO, source: 'db' }, // sin sub
      { sub: 'abc', source: 'db' },
      { sub: -3, source: 'db' },
      { sub: E.DESPACHO, employeeId: E.COORDINADOR, source: 'db' }, // sub y employeeId distintos
    ];
    for (const p of payloads) lanzaCon(() => s.verificarToken(tokenExterno(p)), 401, MENSAJES_AUTH.SESION_INVALIDA);
  });

  it('sin JWT_SECRET → 503', () => {
    lanzaCon(() => servicio(undefined, { jwtSecret: null, jwtExpiresInSeg: 60 }).verificarToken('x'), 503, MENSAJES_AUTH.JWT_NO_CONFIGURADO);
  });

  it('un bloqueo en RRHH aplica de inmediato aunque el token siga vigente', async () => {
    const empleados: EmpleadoSimulado[] = [{
      id_empleado: 50, rut: '5-5', nombre: 'Ana', apellido: 'Paz', email: 'apaz@lesgo.test', estado: 'activo',
      cargo: null, roles: ['LOG_DESPACHO'], usuario: { estado: 'activo', password_hash: '' },
    }];
    const cliente = new ClienteRrhhSimulado({ empleados, ausencias: [] });
    const s = servicio(cliente);
    const token = s.firmarToken((await cliente.buscarCuentaPorId(50))!);
    assert.equal((await s.usuarioDesdeToken(token)).rol, 'OPERADOR_DESPACHO');

    // RRHH bloquea la cuenta
    Object.assign(cliente, { buscarCuentaPorId: async () => ({ ...(await new ClienteRrhhSimulado({ empleados, ausencias: [] }).buscarCuentaPorId(50))!, estado_usuario: 'bloqueado' }) });
    await rechazaCon(s.usuarioDesdeToken(token), 401, MENSAJES_AUTH.CUENTA_NO_ACTIVA);
  });

  it('un cambio de rol en RRHH aplica de inmediato', async () => {
    const empleados: EmpleadoSimulado[] = [{
      id_empleado: 51, rut: '5-1', nombre: 'Luis', apellido: 'Mora', email: 'lmora@lesgo.test', estado: 'activo',
      cargo: null, roles: ['LOG_DESPACHO'], usuario: { estado: 'activo', password_hash: '' },
    }];
    const antes = new ClienteRrhhSimulado({ empleados, ausencias: [] });
    const token = servicio(antes).firmarToken((await antes.buscarCuentaPorId(51))!);

    const comoRecepcion = new ClienteRrhhSimulado({ empleados: [{ ...empleados[0], roles: ['LOG_RECEPCION'] }], ausencias: [] });
    assert.equal((await servicio(comoRecepcion).usuarioDesdeToken(token)).rol, 'OPERADOR_RECEPCION');

    const sinRol = new ClienteRrhhSimulado({ empleados: [{ ...empleados[0], roles: ['CRM_ANALISTA'] }], ausencias: [] });
    await rechazaCon(servicio(sinRol).usuarioDesdeToken(token), 403, MENSAJES_AUTH.SIN_ACCESO_LOGISTICA);
  });

  it('empleado que ya no existe en RRHH → 401', async () => {
    const token = tokenExterno({ sub: 987654, employeeId: 987654, source: 'db' });
    await rechazaCon(servicio().usuarioDesdeToken(token), 401, MENSAJES_AUTH.SESION_INVALIDA);
  });

  it('RRHH caído al releer la cuenta → 503', async () => {
    const cliente = Object.assign(new ClienteRrhhSimulado(), {
      buscarCuentaPorId: async () => {
        throw new RrhhError({ tipo: 'SIN_CONEXION', mensaje: 'x', operacion: 'buscarCuentaPorId' });
      },
    });
    const token = tokenExterno({ sub: E.DESPACHO, employeeId: E.DESPACHO, source: 'db' });
    await rechazaCon(servicio(cliente).usuarioDesdeToken(token), 503, MENSAJES_AUTH.RRHH_NO_DISPONIBLE);
  });
});

describe('Sesión · validarCuenta y usuarioDesdeCuenta', () => {
  const base: CuentaRrhh = {
    id_empleado: 7, rut: '7-7', nombre: 'Rocío', apellido: 'Díaz', email: 'rdiaz@lesgo.test',
    estado_empleado: 'activo', estado_usuario: 'activo', password_hash: '$2b$10$x', roles: ['LOG_RECEPCION'], cargo: null,
  };

  it('usuario inactivo (no bloqueado) también es "cuenta no activa"', () => {
    lanzaCon(() => validarCuenta({ ...base, estado_usuario: 'inactivo' }), 401, MENSAJES_AUTH.CUENTA_NO_ACTIVA);
  });

  it('el estado se valida antes que el rol (inactivo y sin rol → 401)', () => {
    lanzaCon(() => validarCuenta({ ...base, estado_empleado: 'inactivo', roles: [] }), 401, MENSAJES_AUTH.CUENTA_NO_ACTIVA);
  });

  it('sin cargo en RRHH usa el nombre del rol; nunca incluye password_hash', () => {
    const usuario = usuarioDesdeCuenta(base, 'OPERADOR_RECEPCION');
    assert.equal(usuario.cargo, ROLES_CONFIG.OPERADOR_RECEPCION.nombre);
    assert.equal(usuario.avatar_iniciales, 'RD');
    assert.equal(usuario.avatar_color, 'bg-purple-600');
    assert.ok(!JSON.stringify(usuario).includes('password'));
  });

  it('los permisos son copias: modificarlos no altera ROLES_CONFIG', () => {
    const usuario = usuarioDesdeCuenta(base, 'OPERADOR_RECEPCION');
    usuario.permisos.push('ANULAR_GUIA');
    usuario.pestañas_permitidas.push('emision');
    assert.deepEqual(ROLES_CONFIG.OPERADOR_RECEPCION.permisos, ['RECEPCION_MUELLE']);
    assert.deepEqual(ROLES_CONFIG.OPERADOR_RECEPCION.pestañas_permitidas, ['recepcion']);
  });
});
