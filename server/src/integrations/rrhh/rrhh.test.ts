import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ClienteRrhhSimulado, EMPLEADOS_SIMULADOS as E } from './cliente-simulado.js';
import { fechaCalendario, sumarDias } from './fechas.js';
import { rolLogisticaDesde } from './roles.js';

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
