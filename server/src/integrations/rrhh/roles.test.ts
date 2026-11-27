import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MAPA_ROLES_RRHH, rolLogisticaDesde, rolesRrhhPara, traducirRolRrhh } from './roles.js';
import { ROLES_CONFIG } from '../../services/auth.service.js';

describe('RRHH · Traducción de roles a Logística', () => {
  it('traduce cada rol propuesto de Logística a su rol interno', () => {
    assert.equal(rolLogisticaDesde(['LOG_COORDINADOR']), 'COORDINADOR_LOGISTICA');
    assert.equal(rolLogisticaDesde(['LOG_DESPACHO']), 'OPERADOR_DESPACHO');
    assert.equal(rolLogisticaDesde(['LOG_RECEPCION']), 'OPERADOR_RECEPCION');
  });

  it('el rol global Administrador da acceso de Coordinador', () => {
    assert.equal(rolLogisticaDesde(['Administrador']), 'COORDINADOR_LOGISTICA');
  });

  it('con varios roles gana el de mayor privilegio, sin importar el orden', () => {
    assert.equal(rolLogisticaDesde(['LOG_RECEPCION', 'LOG_DESPACHO']), 'OPERADOR_DESPACHO');
    assert.equal(rolLogisticaDesde(['LOG_DESPACHO', 'LOG_RECEPCION']), 'OPERADOR_DESPACHO');
    assert.equal(rolLogisticaDesde(['LOG_RECEPCION', 'LOG_COORDINADOR']), 'COORDINADOR_LOGISTICA');
    assert.equal(rolLogisticaDesde(['LOG_DESPACHO', 'Administrador']), 'COORDINADOR_LOGISTICA');
  });

  it('ignora roles de otros módulos junto a uno de Logística', () => {
    assert.equal(rolLogisticaDesde(['CRM_ADMIN', 'Jefe RRHH', 'LOG_RECEPCION']), 'OPERADOR_RECEPCION');
  });

  it('devuelve null si no hay ningún rol de Logística (el login responderá 403)', () => {
    assert.equal(rolLogisticaDesde([]), null);
    assert.equal(rolLogisticaDesde(null), null);
    assert.equal(rolLogisticaDesde(undefined), null);
    assert.equal(rolLogisticaDesde(['CRM_ADMIN', 'CRM_EJECUTIVO', 'Jefe RRHH', 'Coordinador', 'Analista']), null);
  });

  it('no distingue mayúsculas ni espacios al inicio o al final', () => {
    assert.equal(traducirRolRrhh('  log_despacho '), 'OPERADOR_DESPACHO');
    assert.equal(traducirRolRrhh('ADMINISTRADOR'), 'COORDINADOR_LOGISTICA');
  });

  it('no acepta coincidencias parciales', () => {
    assert.equal(traducirRolRrhh('LOG_DESPACHO_2'), null);
    assert.equal(traducirRolRrhh('LOG'), null);
    assert.equal(traducirRolRrhh(''), null);
  });

  it('todos los roles traducidos existen en ROLES_CONFIG', () => {
    for (const rol of Object.values(MAPA_ROLES_RRHH)) {
      assert.ok(ROLES_CONFIG[rol], `rol interno desconocido: ${rol}`);
    }
  });

  it('rolesRrhhPara lista los nombres de RRHH de un rol interno', () => {
    assert.deepEqual(rolesRrhhPara('COORDINADOR_LOGISTICA').sort(), ['Administrador', 'LOG_COORDINADOR']);
    assert.deepEqual(rolesRrhhPara('OPERADOR_RECEPCION'), ['LOG_RECEPCION']);
  });
});
