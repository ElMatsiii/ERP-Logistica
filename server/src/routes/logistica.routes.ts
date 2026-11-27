import { Router, type RequestHandler } from 'express';
import { LogisticaController } from '../controllers/logistica.controller.js';
import { requerirPermiso } from '../middleware/auth.middleware.js';
import { createAuthRouter } from './auth.routes.js';
import type { ModoAuth } from '../config/auth.config.js';

export interface OpcionesLogisticaRouter {
  /** Middleware de autenticación (crearAutenticar). Obligatorio: no hay rutas sin identificación. */
  autenticar: RequestHandler;
  /** AUTH_MODO: el selector de usuarios simulados solo existe en 'simulado' */
  modoAuth: ModoAuth;
  controller?: LogisticaController;
}

export function createLogisticaRouter(opciones: OpcionesLogisticaRouter): Router {
  const router = Router();
  const ctrl = opciones.controller || new LogisticaController();

  // Todas las rutas de logística exigen un usuario autenticado (sin usuario por defecto)
  router.use(opciones.autenticar);

  // Sub-router de autenticación y gestión de roles
  router.use('/auth', createAuthRouter({ modo: opciones.modoAuth }));

  // 1. Pedidos disponibles y estado de picking
  router.get('/pedidos-pendientes', ctrl.getPedidosPendientes);

  // 2. Detalle completo de la OT y empaque sugerido
  router.get('/ots/:id', ctrl.getOtById);

  // Auxiliar: Transportistas y servicios activos
  router.get('/transportistas', ctrl.getTransportistas);

  // Auxiliar: Cálculo y validación previa de cotización
  router.post('/cotizar', ctrl.cotizar);

  // 3. Emisión de Guía de Despacho (con validaciones transaccionales y RBAC)
  router.post('/guias', requerirPermiso('EMITIR_GUIA'), ctrl.emitirGuia);

  // 3b. Reintento de la confirmación de stock con Inventario
  router.post('/guias/:id/reintentar-stock', requerirPermiso('REINTENTAR_STOCK'), ctrl.reintentarStockGuia);

  // 4. Listado y búsqueda de tracking de guías emitidas
  router.get('/tracking', ctrl.getTracking);

  // 5. Inserción de nuevo evento cronológico (append-only) y actualización de estado
  router.post('/tracking/:id_guia/evento', requerirPermiso('ACTUALIZAR_TRACKING'), ctrl.registrarEventoTracking);
  router.post('/tracking/:id_guia/derivar-postventa', requerirPermiso('ACTUALIZAR_TRACKING'), ctrl.derivarEntregaFallida);
  router.post('/incidencias/:id/caso-postventa', requerirPermiso('ACTUALIZAR_TRACKING'), ctrl.vincularCasoPostventa);

  // 6. Órdenes de compra pendientes para recepción en muelle (HU-06)
  router.get('/compras-pendientes', ctrl.getComprasPendientes);
  router.get('/compras/:id', ctrl.getCompraById);

  // 7. Registro de recepción física en muelle e ingreso a inventario (HU-06)
  router.post('/recepciones', requerirPermiso('RECEPCION_MUELLE'), ctrl.registrarRecepcion);
  router.get('/recepciones', ctrl.getHistorialRecepciones);

  // Auxiliares de recepción: receptores (RRHH) y bodegas de ingreso (Inventario)
  router.get('/empleados', ctrl.getEmpleados);
  router.get('/bodegas', ctrl.getBodegas);

  // 8. Estado de la integración con Inventario (modo real o simulado, y si responde)
  router.get('/integraciones/inventario', ctrl.getEstadoInventario);

  return router;
}
