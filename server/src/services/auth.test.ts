import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { authService, ROLES_CONFIG, USUARIOS_LOGISTICA } from './auth.service.js';
import { identificarUsuario, requerirPermiso, requerirRol } from '../middleware/auth.middleware.js';

describe('ELT-35 · Gestión de Usuarios y Roles (RBAC Logística y Transporte)', () => {
  describe('1. Catálogo de Roles y Permisos', () => {
    it('define los 3 roles operativos requeridos para el módulo', () => {
      const roles = authService.getRoles();
      assert.equal(roles.length, 3);

      const rolesNombres = roles.map((r) => r.rol);
      assert.ok(rolesNombres.includes('COORDINADOR_LOGISTICA'));
      assert.ok(rolesNombres.includes('OPERADOR_BODEGA'));
      assert.ok(rolesNombres.includes('TRANSPORTISTA'));
    });

    it('el rol COORDINADOR_LOGISTICA tiene acceso total (3 pestañas y permisos administrativos)', () => {
      const coord = ROLES_CONFIG.COORDINADOR_LOGISTICA;
      assert.equal(coord.pestañas_permitidas.length, 3);
      assert.ok(coord.pestañas_permitidas.includes('emision'));
      assert.ok(coord.pestañas_permitidas.includes('tracking'));
      assert.ok(coord.pestañas_permitidas.includes('recepcion'));
      assert.ok(coord.permisos.includes('EMITIR_GUIA'));
      assert.ok(coord.permisos.includes('RECEPCION_MUELLE'));
      assert.ok(coord.permisos.includes('ACTUALIZAR_TRACKING_RUTA'));
      assert.ok(coord.permisos.includes('ANULAR_GUIA'));
    });

    it('el rol OPERADOR_BODEGA tiene acceso a emisión y recepción, pero no a anulación ni tracking admin', () => {
      const bodega = ROLES_CONFIG.OPERADOR_BODEGA;
      assert.ok(bodega.pestañas_permitidas.includes('emision'));
      assert.ok(bodega.pestañas_permitidas.includes('recepcion'));
      assert.ok(!bodega.pestañas_permitidas.includes('tracking'));
      assert.ok(bodega.permisos.includes('EMITIR_GUIA'));
      assert.ok(bodega.permisos.includes('RECEPCION_MUELLE'));
      assert.ok(!bodega.permisos.includes('ANULAR_GUIA'));
      assert.ok(!bodega.permisos.includes('GESTIONAR_TARIFAS'));
    });

    it('el rol TRANSPORTISTA tiene acceso exclusivo a tracking para actualizar eventos en ruta', () => {
      const chofer = ROLES_CONFIG.TRANSPORTISTA;
      assert.deepEqual(chofer.pestañas_permitidas, ['tracking']);
      assert.ok(chofer.permisos.includes('ACTUALIZAR_TRACKING_RUTA'));
      assert.ok(!chofer.permisos.includes('EMITIR_GUIA'));
      assert.ok(!chofer.permisos.includes('RECEPCION_MUELLE'));
    });
  });

  describe('2. Usuarios y Mapeo de Identidad', () => {
    it('contiene los perfiles de demostración (M. Pizarro, C. Gómez, J. Tapia)', () => {
      const usuarios = authService.getUsuarios();
      assert.equal(usuarios.length, 3);

      const pizarro = authService.getUsuarioByUsername('mpizarro');
      assert.ok(pizarro);
      assert.equal(pizarro?.rol, 'COORDINADOR_LOGISTICA');
      assert.equal(pizarro?.id_empleado, 305);

      const gomez = authService.getUsuarioByUsername('cgomez');
      assert.ok(gomez);
      assert.equal(gomez?.rol, 'OPERADOR_BODEGA');
      assert.equal(gomez?.id_empleado, 301);

      const tapia = authService.getUsuarioByUsername('jtapia');
      assert.ok(tapia);
      assert.equal(tapia?.rol, 'TRANSPORTISTA');
      assert.equal(tapia?.id_empleado, 302);
    });

    it('busca correctamente por id_empleado o id_usuario', () => {
      const porEmpleado = authService.getUsuarioById(305);
      assert.equal(porEmpleado?.username, 'mpizarro');

      const porUsuario = authService.getUsuarioById(3);
      assert.equal(porUsuario?.username, 'cgomez');
    });
  });

  describe('3. Middleware de Autenticación y Autorización (RBAC)', () => {
    it('identifica al usuario según x-user-role', () => {
      const req: any = { headers: { 'x-user-role': 'TRANSPORTISTA' } };
      const res: any = {};
      let called = false;
      const next = () => { called = true; };

      identificarUsuario(req, res, next);
      assert.ok(called);
      assert.equal(req.usuario?.rol, 'TRANSPORTISTA');
      assert.equal(req.usuario?.nombre, 'Juan Tapia');
    });

    it('identifica al usuario según x-user-id', () => {
      const req: any = { headers: { 'x-user-id': '301' } };
      const res: any = {};
      let called = false;
      const next = () => { called = true; };

      identificarUsuario(req, res, next);
      assert.ok(called);
      assert.equal(req.usuario?.rol, 'OPERADOR_BODEGA');
      assert.equal(req.usuario?.username, 'cgomez');
    });

    it('aplica Coordinador por defecto si no se especifican cabeceras (compatibilidad hacia atrás)', () => {
      const req: any = { headers: {} };
      const res: any = {};
      let called = false;
      const next = () => { called = true; };

      identificarUsuario(req, res, next);
      assert.ok(called);
      assert.equal(req.usuario?.rol, 'COORDINADOR_LOGISTICA');
      assert.equal(req.usuario?.nombre, 'Maximiliano Pizarro');
    });

    it('bloquea con 403 Forbidden a TRANSPORTISTA cuando intenta emitir guía', () => {
      const req: any = { usuario: authService.getUsuarioPorRol('TRANSPORTISTA') };
      let statusSent = 0;
      let bodySent: any = null;
      const res: any = {
        status(code: number) {
          statusSent = code;
          return this;
        },
        json(data: any) {
          bodySent = data;
        },
      };
      let called = false;
      const next = () => { called = true; };

      const middleware = requerirPermiso('EMITIR_GUIA');
      middleware(req, res, next);

      assert.equal(called, false);
      assert.equal(statusSent, 403);
      assert.ok(bodySent.error.includes('Acceso restringido'));
      assert.equal(bodySent.rol_usuario, 'TRANSPORTISTA');
    });

    it('permite a OPERADOR_BODEGA emitir guía', () => {
      const req: any = { usuario: authService.getUsuarioPorRol('OPERADOR_BODEGA') };
      const res: any = {};
      let called = false;
      const next = () => { called = true; };

      const middleware = requerirPermiso('EMITIR_GUIA');
      middleware(req, res, next);

      assert.ok(called);
    });

    it('permite a TRANSPORTISTA actualizar tracking en ruta', () => {
      const req: any = { usuario: authService.getUsuarioPorRol('TRANSPORTISTA') };
      const res: any = {};
      let called = false;
      const next = () => { called = true; };

      const middleware = requerirPermiso('ACTUALIZAR_TRACKING_RUTA');
      middleware(req, res, next);

      assert.ok(called);
    });

    it('requerirRol valida correctamente listas de roles', () => {
      const req: any = { usuario: authService.getUsuarioPorRol('TRANSPORTISTA') };
      let statusSent = 0;
      let bodySent: any = null;
      const res: any = {
        status(code: number) {
          statusSent = code;
          return this;
        },
        json(data: any) {
          bodySent = data;
        },
      };
      let called = false;
      const next = () => { called = true; };

      const middleware = requerirRol('COORDINADOR_LOGISTICA', 'OPERADOR_BODEGA');
      middleware(req, res, next);

      assert.equal(called, false);
      assert.equal(statusSent, 403);
    });
  });
});
