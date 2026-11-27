import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { ClienteRrhhSimulado, EMPLEADOS_SIMULADOS as E } from './cliente-simulado.js';
import { ClienteRrhhBd, type EjecutorSql } from './cliente-bd.js';
import { RrhhError } from './errores.js';
import { fechaCalendario, sumarDias } from './fechas.js';
import { crearClienteRrhh, fijarClienteRrhh, obtenerClienteRrhh } from './index.js';
import { rolLogisticaDesde } from './roles.js';
import { verificarRrhhConLimite } from './salud.js';
import type { ClienteRrhh } from './tipos.js';

// Fecha fija para que los tests no dependan del día en que se ejecutan
const HOY = new Date(2026, 10, 27, 10, 30); // 27-11-2026 10:30 hora local

describe('RRHH · Cliente simulado', () => {
  const cliente = new ClienteRrhhSimulado({ hoy: HOY });

  it('se identifica como modo simulado y siempre está conectado', async () => {
    assert.equal(cliente.modo, 'simulado');
    assert.deepEqual(await cliente.verificarConexion(), { modo: 'simulado', ok: true });
  });

  describe('casos de prueba requeridos', () => {
    it('tiene un empleado activo por cada rol de Logística, más el Administrador del ERP', async () => {
      const casos: [number, string][] = [
        [E.COORDINADOR, 'COORDINADOR_LOGISTICA'],
        [E.DESPACHO, 'OPERADOR_DESPACHO'],
        [E.RECEPCION, 'OPERADOR_RECEPCION'],
        [E.ADMINISTRADOR_ERP, 'COORDINADOR_LOGISTICA'],
      ];
      for (const [id, rolEsperado] of casos) {
        const cuenta = await cliente.buscarCuentaPorId(id);
        assert.ok(cuenta, `falta la cuenta ${id}`);
        assert.equal(cuenta.estado_empleado, 'activo');
        assert.equal(cuenta.estado_usuario, 'activo');
        assert.equal(rolLogisticaDesde(cuenta.roles), rolEsperado);
      }
    });

    it('tiene una cuenta bloqueada con rol de Logística', async () => {
      const cuenta = await cliente.buscarCuentaPorId(E.BLOQUEADO);
      assert.equal(cuenta?.estado_usuario, 'bloqueado');
      assert.equal(cuenta?.estado_empleado, 'activo');
      assert.ok(rolLogisticaDesde(cuenta?.roles));
    });

    it('tiene un empleado inactivo con usuario activo', async () => {
      const cuenta = await cliente.buscarCuentaPorId(E.INACTIVO);
      assert.equal(cuenta?.estado_empleado, 'inactivo');
      assert.equal(cuenta?.estado_usuario, 'activo');
    });

    it('tiene un empleado activo sin rol de Logística', async () => {
      const cuenta = await cliente.buscarCuentaPorId(E.SIN_ROL_LOGISTICA);
      assert.equal(cuenta?.estado_usuario, 'activo');
      assert.ok(cuenta && cuenta.roles.length > 0);
      assert.equal(rolLogisticaDesde(cuenta?.roles), null);
    });

    it('tiene un empleado con varios roles de Logística (gana Despacho)', async () => {
      const cuenta = await cliente.buscarCuentaPorId(E.VARIOS_ROLES);
      assert.equal(rolLogisticaDesde(cuenta?.roles), 'OPERADOR_DESPACHO');
    });

    it('tiene un operador de despacho con una ausencia vigente hoy', async () => {
      assert.equal(await cliente.estaAusente(E.DESPACHO_AUSENTE, HOY), true);
    });

    it('la ausencia vigente se calcula respecto de hoy si no se fija la fecha', async () => {
      const real = new ClienteRrhhSimulado();
      assert.equal(await real.estaAusente(E.DESPACHO_AUSENTE, new Date()), true);
    });
  });

  describe('buscarCuentaPorEmail', () => {
    it('encuentra la cuenta sin distinguir mayúsculas ni espacios', async () => {
      const cuenta = await cliente.buscarCuentaPorEmail('  CGomez@LesGo.TEST ');
      assert.equal(cuenta?.id_empleado, E.DESPACHO);
      assert.equal(cuenta?.nombre, 'Carlos');
      assert.deepEqual(cuenta?.roles, ['LOG_DESPACHO']);
      assert.equal(typeof cuenta?.password_hash, 'string');
    });

    it('devuelve null si el email no existe o viene vacío', async () => {
      assert.equal(await cliente.buscarCuentaPorEmail('nadie@lesgo.test'), null);
      assert.equal(await cliente.buscarCuentaPorEmail(''), null);
      assert.equal(await cliente.buscarCuentaPorEmail('   '), null);
    });

    it('un empleado sin usuario en RRHH no tiene cuenta', async () => {
      assert.equal(await cliente.buscarCuentaPorId(E.SIN_USUARIO), null);
    });
  });

  describe('buscarCuentaPorId', () => {
    it('devuelve null si el empleado no existe', async () => {
      assert.equal(await cliente.buscarCuentaPorId(999999), null);
    });

    it('devuelve copias: modificar el resultado no altera los datos', async () => {
      const cuenta = await cliente.buscarCuentaPorId(E.COORDINADOR);
      cuenta!.roles.push('CRM_ADMIN');
      cuenta!.estado_usuario = 'bloqueado';
      const otraVez = await cliente.buscarCuentaPorId(E.COORDINADOR);
      assert.deepEqual(otraVez?.roles, ['LOG_COORDINADOR']);
      assert.equal(otraVez?.estado_usuario, 'activo');
    });
  });

  describe('obtenerEmpleado', () => {
    it('devuelve los datos públicos con cargo y roles, sin password_hash', async () => {
      const emp = await cliente.obtenerEmpleado(E.COORDINADOR);
      assert.deepEqual(emp, {
        id_empleado: E.COORDINADOR,
        rut: '17.892.341-5',
        nombre: 'Maximiliano',
        apellido: 'Pizarro',
        email: 'mpizarro@lesgo.test',
        estado: 'activo',
        roles: ['LOG_COORDINADOR'],
        cargo: 'Coordinador General de Logística',
      });
      assert.ok(!('password_hash' in emp!));
    });

    it('incluye empleados sin usuario y devuelve null si no existe', async () => {
      assert.equal((await cliente.obtenerEmpleado(E.SIN_USUARIO))?.email, null);
      assert.equal(await cliente.obtenerEmpleado(999999), null);
    });
  });

  describe('listarEmpleados', () => {
    it('sin filtro lista a todos, ordenados por id y sin password_hash', async () => {
      const lista = await cliente.listarEmpleados();
      assert.equal(lista.length, Object.keys(E).length);
      const ids = lista.map((e) => e.id_empleado);
      assert.deepEqual(ids, [...ids].sort((a, b) => a - b));
      assert.ok(lista.every((e) => !('password_hash' in e)));
      assert.ok(!JSON.stringify(lista).includes('password'));
    });

    it('soloActivos excluye a los empleados inactivos', async () => {
      const lista = await cliente.listarEmpleados({ soloActivos: true });
      assert.ok(lista.every((e) => e.estado === 'activo'));
      assert.ok(!lista.some((e) => e.id_empleado === E.INACTIVO));
    });

    it('filtra por nombre de rol de RRHH sin distinguir mayúsculas', async () => {
      const ids = (await cliente.listarEmpleados({ rol: 'log_despacho' })).map((e) => e.id_empleado);
      assert.deepEqual(ids, [E.DESPACHO, E.DESPACHO_AUSENTE, E.VARIOS_ROLES, E.BLOQUEADO, E.SIN_USUARIO].sort((a, b) => a - b));
    });

    it('combina rol y soloActivos', async () => {
      const ids = (await cliente.listarEmpleados({ rol: 'LOG_RECEPCION', soloActivos: true })).map((e) => e.id_empleado);
      assert.deepEqual(ids, [E.VARIOS_ROLES, E.RECEPCION]);
    });

    it('un rol que nadie tiene devuelve una lista vacía', async () => {
      assert.deepEqual(await cliente.listarEmpleados({ rol: 'ROL_INEXISTENTE' }), []);
    });
  });

  describe('estaAusente', () => {
    it('cuenta los días de inicio y fin (inclusive) e ignora la hora', async () => {
      const inicio = sumarDias(HOY, -1);
      inicio.setHours(0, 0, 0);
      const fin = sumarDias(HOY, 3);
      fin.setHours(23, 59, 59);
      assert.equal(await cliente.estaAusente(E.DESPACHO_AUSENTE, inicio), true);
      assert.equal(await cliente.estaAusente(E.DESPACHO_AUSENTE, fin), true);
      assert.equal(await cliente.estaAusente(E.DESPACHO_AUSENTE, sumarDias(HOY, -2)), false);
      assert.equal(await cliente.estaAusente(E.DESPACHO_AUSENTE, sumarDias(HOY, 4)), false);
    });

    it('una ausencia que ya terminó no cuenta', async () => {
      assert.equal(await cliente.estaAusente(E.DESPACHO, HOY), false);
      assert.equal(await cliente.estaAusente(E.DESPACHO, sumarDias(HOY, -15)), true);
    });

    it('solo cuentan las ausencias aprobadas o en curso (no pendientes ni rechazadas)', async () => {
      assert.equal(await cliente.estaAusente(E.RECEPCION, HOY), false);
      assert.equal(await cliente.estaAusente(E.VARIOS_ROLES, HOY), false);
    });

    it('acepta ausencias en_curso', async () => {
      const c = new ClienteRrhhSimulado({
        ausencias: [{ id_empleado: E.DESPACHO, estado: 'en_curso', fecha_inicio: '2026-11-27', fecha_fin: '2026-11-27' }],
      });
      assert.equal(await c.estaAusente(E.DESPACHO, HOY), true);
    });

    it('un empleado sin ausencias o inexistente no está ausente', async () => {
      assert.equal(await cliente.estaAusente(E.COORDINADOR, HOY), false);
      assert.equal(await cliente.estaAusente(999999, HOY), false);
    });

    it('rechaza una fecha inválida', async () => {
      await assert.rejects(cliente.estaAusente(E.DESPACHO, new Date('no-es-fecha')), TypeError);
    });
  });

  it('acepta datos propios por constructor (para otros tests)', async () => {
    const c = new ClienteRrhhSimulado({
      empleados: [{ id_empleado: 1, rut: '1-9', nombre: 'A', apellido: 'B', email: 'a@b.test', estado: 'activo', cargo: null, roles: ['LOG_RECEPCION'] }],
      ausencias: [],
    });
    assert.equal((await c.listarEmpleados()).length, 1);
    assert.equal(await c.buscarCuentaPorEmail('a@b.test'), null); // sin usuario
  });
});

describe('RRHH · fechaCalendario', () => {
  it('formatea en fecha local YYYY-MM-DD', () => {
    assert.equal(fechaCalendario(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
    assert.equal(fechaCalendario(sumarDias(new Date(2026, 11, 31), 1)), '2027-01-01');
  });
});

// ---------------------------------------------------------------------------
// Cliente de BD: ejecutor SQL falso que registra cada consulta (no toca Neon)
// ---------------------------------------------------------------------------
type Respuesta = unknown[] | Error | Record<string, unknown>;

function ejecutorFalso(respuestas: Respuesta[] = []) {
  const consultas: Prisma.Sql[] = [];
  const ejecutor: EjecutorSql = {
    async $queryRaw<T>(query: Prisma.Sql): Promise<T> {
      consultas.push(query);
      const r = respuestas.shift() ?? [];
      if (!Array.isArray(r)) throw r;
      return r as T;
    },
  };
  return { ejecutor, consultas };
}

const sqlDe = (q: Prisma.Sql) => q.sql.replace(/\s+/g, ' ').trim();

const FILA_CUENTA = {
  id_empleado: 301n,
  rut: '15.432.908-2',
  nombre: 'Carlos',
  apellido: 'Gómez',
  email: 'cgomez@lesgo.test',
  estado_empleado: 'ACTIVO',
  estado_usuario: 'Activo',
  password_hash: '$2a$10$hashdeprueba',
  roles: ['Asistente', 'LOG_DESPACHO'],
};

const FILA_EMPLEADO = {
  id_empleado: 301,
  rut: '15.432.908-2',
  nombre: 'Carlos',
  apellido: 'Gómez',
  email: 'cgomez@lesgo.test',
  estado: 'Activo',
  roles: null,
  cargo: 'Operador de Picking',
};

describe('RRHH · Cliente de BD (solo lectura)', () => {
  it('se identifica como modo bd', () => {
    assert.equal(new ClienteRrhhBd(ejecutorFalso().ejecutor).modo, 'bd');
  });

  describe('verificarConexion', () => {
    it('consulta rrhh.rol y nunca rrhh.usuario', async () => {
      const { ejecutor, consultas } = ejecutorFalso([[{ ok: 1 }]]);
      const estado = await new ClienteRrhhBd(ejecutor).verificarConexion();
      assert.deepEqual(estado, { modo: 'bd', ok: true });
      assert.equal(consultas.length, 1);
      assert.match(sqlDe(consultas[0]), /^SELECT 1 AS ok FROM rrhh\.rol LIMIT 1$/);
      assert.doesNotMatch(sqlDe(consultas[0]), /usuario|password/i);
    });

    it('está ok aunque rrhh.rol no tenga filas', async () => {
      const { ejecutor } = ejecutorFalso([[]]);
      assert.equal((await new ClienteRrhhBd(ejecutor).verificarConexion()).ok, true);
    });

    it('no lanza si la BD falla: responde ok=false con el mensaje', async () => {
      const caida = Object.assign(new Error('No se alcanza el servidor'), { name: 'PrismaClientInitializationError' });
      const { ejecutor } = ejecutorFalso([caida]);
      const estado = await new ClienteRrhhBd(ejecutor).verificarConexion();
      assert.equal(estado.ok, false);
      assert.equal(estado.modo, 'bd');
      assert.equal(estado.error, 'No se pudo conectar con la BD para leer RRHH');
    });
  });

  describe('buscarCuentaPorEmail', () => {
    it('envía el email como parámetro, nunca dentro del texto SQL', async () => {
      const malicioso = "x'; DROP TABLE rrhh.usuario; --@lesgo.test";
      const { ejecutor, consultas } = ejecutorFalso([[FILA_CUENTA]]);
      await new ClienteRrhhBd(ejecutor).buscarCuentaPorEmail(`  ${malicioso} `);
      const q = consultas[0];
      assert.deepEqual(q.values, [malicioso]);
      assert.doesNotMatch(q.sql, /DROP/);
      assert.match(sqlDe(q), /lower\(e\.email\) = lower\(\?\)/);
      assert.match(sqlDe(q), /FROM rrhh\.usuario u JOIN rrhh\.empleado e/);
    });

    it('normaliza la fila: id numérico, estados en minúsculas y roles por id_rol', async () => {
      const { ejecutor } = ejecutorFalso([[FILA_CUENTA]]);
      const cuenta = await new ClienteRrhhBd(ejecutor).buscarCuentaPorEmail('cgomez@lesgo.test');
      assert.deepEqual(cuenta, {
        id_empleado: 301,
        rut: '15.432.908-2',
        nombre: 'Carlos',
        apellido: 'Gómez',
        email: 'cgomez@lesgo.test',
        estado_empleado: 'activo',
        estado_usuario: 'activo',
        password_hash: '$2a$10$hashdeprueba',
        roles: ['Asistente', 'LOG_DESPACHO'],
      });
    });

    it('estados desconocidos o nulos se tratan como no activos', async () => {
      const { ejecutor } = ejecutorFalso([
        [{ ...FILA_CUENTA, estado_empleado: 'suspendido', estado_usuario: null, roles: null, password_hash: null }],
        [{ ...FILA_CUENTA, estado_usuario: 'BLOQUEADO' }],
      ]);
      const cliente = new ClienteRrhhBd(ejecutor);
      const cuenta = await cliente.buscarCuentaPorEmail('cgomez@lesgo.test');
      assert.equal(cuenta?.estado_empleado, 'inactivo');
      assert.equal(cuenta?.estado_usuario, 'inactivo');
      assert.deepEqual(cuenta?.roles, []);
      assert.equal(cuenta?.password_hash, '');
      assert.equal((await cliente.buscarCuentaPorEmail('cgomez@lesgo.test'))?.estado_usuario, 'bloqueado');
    });

    it('devuelve null sin filas, y no consulta si el email viene vacío', async () => {
      const { ejecutor, consultas } = ejecutorFalso([[]]);
      const cliente = new ClienteRrhhBd(ejecutor);
      assert.equal(await cliente.buscarCuentaPorEmail('nadie@lesgo.test'), null);
      assert.equal(await cliente.buscarCuentaPorEmail('   '), null);
      assert.equal(consultas.length, 1);
    });
  });

  describe('buscarCuentaPorId', () => {
    it('filtra por id_empleado como parámetro', async () => {
      const { ejecutor, consultas } = ejecutorFalso([[FILA_CUENTA]]);
      const cuenta = await new ClienteRrhhBd(ejecutor).buscarCuentaPorId(301);
      assert.equal(cuenta?.id_empleado, 301);
      assert.deepEqual(consultas[0].values, [301]);
      assert.match(sqlDe(consultas[0]), /WHERE e\.id_empleado = \?/);
    });

    it('un id inválido devuelve null sin consultar', async () => {
      const { ejecutor, consultas } = ejecutorFalso();
      const cliente = new ClienteRrhhBd(ejecutor);
      for (const id of [0, -1, 1.5, Number.NaN]) assert.equal(await cliente.buscarCuentaPorId(id), null);
      assert.equal(consultas.length, 0);
    });
  });

  describe('obtenerEmpleado y listarEmpleados', () => {
    it('obtenerEmpleado no lee rrhh.usuario ni password_hash', async () => {
      const { ejecutor, consultas } = ejecutorFalso([[FILA_EMPLEADO]]);
      const emp = await new ClienteRrhhBd(ejecutor).obtenerEmpleado(301);
      assert.deepEqual(emp, { ...FILA_EMPLEADO, estado: 'activo', roles: [] });
      assert.doesNotMatch(sqlDe(consultas[0]), /rrhh\.usuario|password/i);
      assert.match(sqlDe(consultas[0]), /rrhh\.contrato_cargo/);
      assert.deepEqual(consultas[0].values, [301]);
    });

    it('obtenerEmpleado devuelve null si no existe', async () => {
      const { ejecutor } = ejecutorFalso([[]]);
      assert.equal(await new ClienteRrhhBd(ejecutor).obtenerEmpleado(999), null);
    });

    it('listarEmpleados pasa los filtros como parámetros', async () => {
      const { ejecutor, consultas } = ejecutorFalso([[FILA_EMPLEADO], []]);
      const cliente = new ClienteRrhhBd(ejecutor);
      const lista = await cliente.listarEmpleados({ rol: ' LOG_DESPACHO ', soloActivos: true });
      assert.equal(lista.length, 1);
      assert.deepEqual(consultas[0].values, [true, 'LOG_DESPACHO', 'LOG_DESPACHO']);
      assert.doesNotMatch(sqlDe(consultas[0]), /rrhh\.usuario|password/i);

      await cliente.listarEmpleados();
      assert.deepEqual(consultas[1].values, [false, null, null]);
    });
  });

  describe('estaAusente', () => {
    it('envía la fecha calendario local como parámetro y solo cuenta aprobada / en_curso', async () => {
      const { ejecutor, consultas } = ejecutorFalso([[{ ausente: true }], [{ ausente: false }]]);
      const cliente = new ClienteRrhhBd(ejecutor);
      assert.equal(await cliente.estaAusente(302, HOY), true);
      assert.equal(await cliente.estaAusente(302, HOY), false);
      assert.deepEqual(consultas[0].values, [302, '2026-11-27']);
      assert.match(sqlDe(consultas[0]), /IN \('aprobada', 'en_curso'\)/);
      assert.match(sqlDe(consultas[0]), /FROM rrhh\.solicitud_ausencia/);
    });

    it('un id inválido no está ausente y no consulta; una fecha inválida lanza', async () => {
      const { ejecutor, consultas } = ejecutorFalso();
      const cliente = new ClienteRrhhBd(ejecutor);
      assert.equal(await cliente.estaAusente(-5, HOY), false);
      assert.equal(consultas.length, 0);
      await assert.rejects(cliente.estaAusente(302, new Date('x')), TypeError);
    });
  });

  it('todas las consultas son SELECT de solo lectura', async () => {
    const { ejecutor, consultas } = ejecutorFalso();
    const cliente = new ClienteRrhhBd(ejecutor);
    await cliente.verificarConexion();
    await cliente.buscarCuentaPorEmail('a@b.test');
    await cliente.buscarCuentaPorId(1);
    await cliente.obtenerEmpleado(1);
    await cliente.listarEmpleados({ rol: 'LOG_DESPACHO', soloActivos: true });
    await cliente.estaAusente(1, HOY);
    assert.equal(consultas.length, 6);
    for (const q of consultas) {
      const sql = sqlDe(q);
      assert.match(sql, /^SELECT /, sql);
      assert.doesNotMatch(sql, /\b(insert|update|delete|drop|alter|truncate|create|grant|merge)\b/i, sql);
    }
  });

  describe('errores tipados', () => {
    const casos: [string, Record<string, unknown>, string][] = [
      ['sin conexión', { name: 'PrismaClientInitializationError', message: 'sin red' }, 'SIN_CONEXION'],
      ['P1001', { name: 'PrismaClientKnownRequestError', code: 'P1001' }, 'SIN_CONEXION'],
      ['sin GRANT', { code: 'P2010', meta: { code: '42501', message: 'permission denied for schema rrhh' } }, 'SIN_PERMISO'],
      ['tabla inexistente', { code: 'P2010', meta: { code: '42P01' } }, 'ESQUEMA_INVALIDO'],
      ['columna inexistente', { code: 'P2010', meta: { code: '42703' } }, 'ESQUEMA_INVALIDO'],
      ['otro error', { message: 'algo raro' }, 'ERROR_BD'],
    ];

    for (const [nombre, error, tipo] of casos) {
      it(`${nombre} → ${tipo}`, async () => {
        const { ejecutor } = ejecutorFalso([error]);
        await assert.rejects(new ClienteRrhhBd(ejecutor).buscarCuentaPorEmail('secreto@lesgo.test'), (err: unknown) => {
          assert.ok(err instanceof RrhhError);
          assert.equal(err.tipo, tipo);
          assert.equal(err.operacion, 'buscarCuentaPorEmail');
          assert.doesNotMatch(err.message, /secreto/); // el mensaje nunca incluye valores de la consulta
          assert.equal(err.cause, error);
          return true;
        });
      });
    }
  });
});

describe('RRHH · Selección de cliente (RRHH_MODO)', () => {
  it('RRHH_MODO=bd usa el cliente de BD con el ejecutor indicado', async () => {
    const { ejecutor, consultas } = ejecutorFalso([[]]);
    const cliente = crearClienteRrhh({ RRHH_MODO: ' BD ' }, ejecutor);
    assert.ok(cliente instanceof ClienteRrhhBd);
    assert.equal(cliente.modo, 'bd');
    await cliente.verificarConexion();
    assert.equal(consultas.length, 1);
  });

  it('RRHH_MODO=simulado usa el cliente simulado', () => {
    assert.ok(crearClienteRrhh({ RRHH_MODO: 'simulado' }) instanceof ClienteRrhhSimulado);
  });

  it('vacío o inválido cae en simulado (nunca lee rrhh por accidente)', () => {
    for (const RRHH_MODO of [undefined, '', '  ', 'real', 'produccion']) {
      const { ejecutor, consultas } = ejecutorFalso();
      const cliente = crearClienteRrhh({ RRHH_MODO }, ejecutor);
      assert.equal(cliente.modo, 'simulado', `RRHH_MODO=${RRHH_MODO}`);
      assert.equal(consultas.length, 0);
    }
  });

  it('obtenerClienteRrhh reutiliza la instancia y fijarClienteRrhh permite reemplazarla', () => {
    const propio = new ClienteRrhhSimulado({ empleados: [], ausencias: [] });
    fijarClienteRrhh(propio);
    assert.equal(obtenerClienteRrhh(), propio);
    assert.equal(obtenerClienteRrhh(), propio);
    fijarClienteRrhh(null);
    assert.notEqual(obtenerClienteRrhh(), propio);
    fijarClienteRrhh(null);
  });
});

describe('RRHH · Estado para /api/health (verificarRrhhConLimite)', () => {
  /** Cliente cuyo verificarConexion se define en cada test */
  const clienteCon = (verificar: ClienteRrhh['verificarConexion'], modo: ClienteRrhh['modo'] = 'bd'): ClienteRrhh =>
    Object.assign(new ClienteRrhhSimulado({ empleados: [], ausencias: [] }), { modo, verificarConexion: verificar }) as ClienteRrhh;

  it('modo simulado: ok', async () => {
    assert.deepEqual(await verificarRrhhConLimite(new ClienteRrhhSimulado()), { modo: 'simulado', ok: true });
  });

  it('modo bd conectado: ok', async () => {
    const { ejecutor } = ejecutorFalso([[{ ok: 1 }]]);
    assert.deepEqual(await verificarRrhhConLimite(new ClienteRrhhBd(ejecutor)), { modo: 'bd', ok: true });
  });

  it('modo bd sin conexión: ok=false con el mensaje del cliente', async () => {
    const { ejecutor } = ejecutorFalso([{ name: 'PrismaClientInitializationError' }]);
    assert.deepEqual(await verificarRrhhConLimite(new ClienteRrhhBd(ejecutor)), {
      modo: 'bd',
      ok: false,
      error: 'No se pudo conectar con la BD para leer RRHH',
    });
  });

  it('si verificarConexion se queda colgado, responde ok=false al cumplirse el límite', async () => {
    const colgado = clienteCon(() => new Promise(() => {}));
    const inicio = Date.now();
    const estado = await verificarRrhhConLimite(colgado, 50);
    const demora = Date.now() - inicio;
    assert.deepEqual(estado, { modo: 'bd', ok: false, error: 'RRHH no respondió en 50 ms' });
    assert.ok(demora >= 40 && demora < 1000, `demoró ${demora} ms`);
  });

  it('si verificarConexion lanza (sincrónico o rechazo), no propaga el error', async () => {
    const sincronico = clienteCon(() => {
      throw new Error('detalle interno con secreto');
    });
    const rechazo = clienteCon(() => Promise.reject(new RrhhError({ tipo: 'SIN_PERMISO', mensaje: 'Sin permiso de lectura sobre el esquema rrhh', operacion: 'verificarConexion' })));
    assert.deepEqual(await verificarRrhhConLimite(sincronico), { modo: 'bd', ok: false, error: 'Error inesperado al verificar RRHH' });
    assert.deepEqual(await verificarRrhhConLimite(rechazo), { modo: 'bd', ok: false, error: 'Sin permiso de lectura sobre el esquema rrhh' });
  });

  it('una respuesta ok=false sin mensaje recibe uno genérico', async () => {
    const caido = clienteCon(async () => ({ modo: 'bd', ok: false }));
    assert.deepEqual(await verificarRrhhConLimite(caido), { modo: 'bd', ok: false, error: 'RRHH no está disponible' });
  });
});
