import { Router } from 'express';
import { VentasIntegrationController } from '../controllers/ventasIntegration.controller.js';

export function createVentasIntegrationRouter(controller?: VentasIntegrationController): Router {
  const router = Router();
  const ctrl = controller || new VentasIntegrationController();

  // 1. Obtener pedidos pagados desde ecommerce_ventas listos para procesar
  router.get('/pedidos-pendientes', ctrl.getPedidosPendientes);

  // 2. Cotizar precio y tipo de envío según destino (Lógica de envíos en checkout)
  router.post('/cotizar-envio', ctrl.cotizarEnvio);

  // 3. Solicitar despacho de un pedido (Ventas entrega datos -> Logística entrega tracking y precio)
  router.post('/solicitar-despacho', ctrl.solicitarDespacho);

  // 4. Consultar estado y código de seguimiento (por id_pedido o num_seguimiento)
  router.get('/tracking/:criterio', ctrl.consultarTracking);

  return router;
}
