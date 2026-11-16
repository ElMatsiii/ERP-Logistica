import { Router } from 'express';
import { LogisticaController } from '../controllers/logistica.controller.js';

export function createLogisticaRouter(controller?: LogisticaController): Router {
  const router = Router();
  const ctrl = controller || new LogisticaController();

  // 1. Pedidos disponibles y estado de picking
  router.get('/pedidos-pendientes', ctrl.getPedidosPendientes);

  // 2. Detalle completo de la OT y empaque sugerido
  router.get('/ots/:id', ctrl.getOtById);

  // Auxiliar: Transportistas y servicios activos
  router.get('/transportistas', ctrl.getTransportistas);

  // Auxiliar: Cálculo y validación previa de cotización
  router.post('/cotizar', ctrl.cotizar);

  // 3. Emisión de Guía de Despacho (con validaciones transaccionales)
  router.post('/guias', ctrl.emitirGuia);

  // 3b. Reintento de la confirmación de stock con Inventario (guías en 'Pendiente de stock' o 'Error de stock')
  router.post('/guias/:id/reintentar-stock', ctrl.reintentarStockGuia);

  // 4. Listado y búsqueda de tracking de guías emitidas
  router.get('/tracking', ctrl.getTracking);

  // 5. Inserción de nuevo evento cronológico (append-only) y actualización de estado
  router.post('/tracking/:id_guia/evento', ctrl.registrarEventoTracking);

  // 6. Órdenes de compra pendientes para recepción en muelle (HU-06)
  router.get('/compras-pendientes', ctrl.getComprasPendientes);
  router.get('/compras/:id', ctrl.getCompraById);

  // 7. Registro de recepción física en muelle e ingreso a inventario (HU-06)
  router.post('/recepciones', ctrl.registrarRecepcion);
  router.get('/recepciones', ctrl.getHistorialRecepciones);

  // 8. Estado de la integración con Inventario (modo real o simulado, y si responde)
  router.get('/integraciones/inventario', ctrl.getEstadoInventario);

  return router;
}
