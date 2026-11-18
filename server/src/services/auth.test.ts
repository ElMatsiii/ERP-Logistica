import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { authService, ROLES_CONFIG, USUARIOS_LOGISTICA } from './auth.service.js';
import { identificarUsuario, requerirPermiso, requerirRol } from '../middleware/auth.middleware.js';

describe('ELT-35 · Gestión de Usuarios y Roles (RBAC Logística y Transporte)', () => {
  describe('1. Catálogo de Roles Especializados', () => {
    it('define los 3 roles operativos internos del módulo', () => {
      const roles = authService.getRoles();
      assert.equal(roles.length, 3);

      const rolesNombres = roles.map((r) => r.rol);
      assert.ok(rolesNombres.includes('COORDINADOR_LOGISTICA'));
      assert.ok(rolesNombres.includes('OPERADOR_DESPACHO'));
      assert.ok(rolesNombres.includes('OPERADOR_RECEPCION'));
    });

    it('COORDINADOR_LOGISTICA tiene acceso total (3 pestañas y permisos completos)', () => {
      const coord = ROLES_CONFIG.COORDINADOR_LOGISTICA;
      assert.equal(coord.pestañas_permitidas.length, 3);
      assert.ok(coord.pestañas_permitidas.includes('emision'));
      assert.ok(coord.pestañas_permitidas.includes('tracking'));
      assert.ok(coord.pestañas_permitidas.includes('recepcion'));
      assert.ok(coord.permisos.includes('EMITIR_GUIA'));
      assert.ok(coord.permisos.includes('RECEPCION_MUELLE'));
      assert.ok(coord.permisos.includes('ACTUALIZAR_TRACKING'));
      assert.ok(coord.permisos.includes('ANULAR_GUIA'));
    });

    it('OPERADOR_DESPACHO gestiona ventas e-Commerce: emision y tracking (sin muelle)', () => {
      const despacho = ROLES_CONFIG.OPERADOR_DESPACHO;
      assert.equal(despacho.pestañas_permitidas.length, 2);
      assert.ok(despacho.pestañas_permitidas.includes('emision'));
      assert.ok(despacho.pestañas_permitidas.includes('tracking'));
      assert.ok(!despacho.pestañas_permitidas.includes('recepcion'));
      assert.ok(despacho.permisos.includes('EMITIR_GUIA'));
      assert.ok(despacho.permisos.includes('ACTUALIZAR_TRACKING'));
      assert.ok(!despacho.permisos.includes('RECEPCION_MUELLE'));
    });

    it('OPERADOR_RECEPCION gestiona compras de proveedores: solo recepcion en muelle', () => {
      const recepcion = ROLES_CONFIG.OPERADOR_RECEPCION;
      assert.deepEqual(recepcion.pestañas_permitidas, ['recepcion']);
      assert.ok(recepcion.permisos.includes('RECEPCION_MUELLE'));
      assert.ok(!recepcion.permisos.includes('EMITIR_GUIA'));
      assert.ok(!recepcion.permisos.includes('ACTUALIZAR_TRACKING'));
    });
  });

  describe('2. Usuarios y Mapeo de Identidad', () => {
    it('contiene los perfiles de demostración (M. Pizarro, C. Gómez, E. Paredes)', () => {
      const usuarios = authService.getUsuarios();
      assert.equal(usuarios.length, 3);

      const pizarro = authService.getUsuarioByUsername('mpizarro');
      assert.ok(pizarro);
      assert.equal(pizarro?.rol, 'COORDINADOR_LOGISTICA');
      assert.equal(pizarro?.id_empleado, 305);

      const gomez = authService.getUsuarioByUsername('cgomez');
      assert.ok(gomez);
      assert.equal(gomez?.rol, 'OPERADOR_DESPACHO');
      assert.equal(gomez?.id_empleado, 301);

      const paredes = authService.getUsuarioByUsername('eparedes');
      assert.ok(paredes);
      assert.equal(paredes?.rol, 'OPERADOR_RECEPCION');
      assert.equal(paredes?.id_empleado, 304);
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
      const req: any = { headers: { 'x-user-role': 'OPERADOR_RECEPCION' } };
      const res: any = {};
      let called = false;
      const next = () => { called = true; };

      identificarUsuario(req, res, next);
      assert.ok(called);
      assert.equal(req.usuario?.rol, 'OPERADOR_RECEPCION');
      assert.equal(req.usuario?.nombre, 'Esteban Paredes');
    });

    it('identifica al usuario según x-user-id', () => {
      const req: any = { headers: { 'x-user-id': '301' } };
      const res: any = {};
      let called = false;
      const next = () => { called = true; };

      identificarUsuario(req, res, next);
      assert.ok(called);
      assert.equal(req.usuario?.rol, 'OPERADOR_DESPACHO');
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

    it('bloquea con 403 Forbidden a OPERADOR_RECEPCION cuando intenta emitir guía', () => {
      const req: any = { usuario: authService.getUsuarioPorRol('OPERADOR_RECEPCION') };
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
      assert.equal(bodySent.rol_usuario, 'OPERADOR_RECEPCION');
    });

    it('bloquea con 403 Forbidden a OPERADOR_DESPACHO cuando intenta registrar recepcion en muelle', () => {
      const req: any = { usuario: authService.getUsuarioPorRol('OPERADOR_DESPACHO') };
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

      const middleware = requerirPermiso('RECEPCION_MUELLE');
      middleware(req, res, next);

      assert.equal(called, false);
      assert.equal(statusSent, 403);
      assert.ok(bodySent.error.includes('Acceso restringido'));
      assert.equal(bodySent.rol_usuario, 'OPERADOR_DESPACHO');
    });

    it('permite a OPERADOR_DESPACHO emitir guía y actualizar tracking', () => {
      const req: any = { usuario: authService.getUsuarioPorRol('OPERADOR_DESPACHO') };
      const res: any = {};
      let calledEmision = false;
      let calledTracking = false;

      requerirPermiso('EMITIR_GUIA')(req, res, () => { calledEmision = true; });
      requerirPermiso('ACTUALIZAR_TRACKING')(req, res, () => { calledTracking = true; });

      assert.ok(calledEmision);
      assert.ok(calledTracking);
    });

    it('permite a OPERADOR_RECEPCION registrar recepciones en muelle', () => {
      const req: any = { usuario: authService.getUsuarioPorRol('OPERADOR_RECEPCION') };
      const res: any = {};
      let called = false;

      requerirPermiso('RECEPCION_MUELLE')(req, res, () => { called = true; });

      assert.ok(called);
    });

    it('requerirRol valida correctamente listas de roles', () => {
      const req: any = { usuario: authService.getUsuarioPorRol('OPERADOR_RECEPCION') };
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

      const middleware = requerirRol('COORDINADOR_LOGISTICA', 'OPERADOR_DESPACHO');
      middleware(req, res, next);

      assert.equal(called, false);
      assert.equal(statusSent, 403);
    });
  });
});
