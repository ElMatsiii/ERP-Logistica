import { Request, Response } from 'express';
import { VentasIntegrationService } from '../services/ventasIntegration.service.js';

export class VentasIntegrationController {
  private service: VentasIntegrationService;

  constructor(service?: VentasIntegrationService) {
    this.service = service || new VentasIntegrationService();
  }

  /**
   * GET /api/logistica/ventas/pedidos-pendientes
   * Lista los pedidos pagados en ecommerce_ventas listos para despacho.
   */
  getPedidosPendientes = async (_req: Request, res: Response) => {
    try {
      const pedidos = await this.service.getPedidosPendientes();
      res.json({
        total: pedidos.length,
        pedidos,
      });
    } catch (error) {
      console.error('[VentasIntegrationController] getPedidosPendientes:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  };

  /**
   * POST /api/logistica/ventas/cotizar-envio
   * Calcula opciones de couriers, precios y plazos de entrega para el checkout de Ventas.
   */
  cotizarEnvio = async (req: Request, res: Response) => {
    try {
      const { comuna_destino, peso_kg, productos } = req.body;
      const resultado = await this.service.cotizarOpcionesEnvio({
        comuna_destino,
        peso_kg,
        productos,
      });
      res.json(resultado);
    } catch (error) {
      console.error('[VentasIntegrationController] cotizarEnvio:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  };

  /**
   * POST /api/logistica/ventas/solicitar-despacho
   * Recibe datos de entrega e información del pedido, genera la guía y retorna tracking + precio.
   */
  solicitarDespacho = async (req: Request, res: Response) => {
    try {
      const {
        id_pedido,
        cliente_nombre,
        cliente_rut,
        direccion_entrega,
        comuna_entrega,
        ciudad_entrega,
        telefono_contacto,
        transportista_preferido,
        productos,
      } = req.body;

      if (!id_pedido) {
        return res.status(400).json({ error: 'El id_pedido es obligatorio.' });
      }

      const recibo = await this.service.solicitarDespacho({
        id_pedido,
        cliente_nombre,
        cliente_rut,
        direccion_entrega,
        comuna_entrega,
        ciudad_entrega,
        telefono_contacto,
        transportista_preferido,
        productos: productos || [],
      });

      return res.status(201).json(recibo);
    } catch (error) {
      console.error('[VentasIntegrationController] solicitarDespacho:', error);
      return res.status(400).json({ error: (error as Error).message });
    }
  };

  /**
   * GET /api/logistica/ventas/tracking/:criterio
   * Consulta el tracking actual de un pedido por id_pedido o num_seguimiento.
   */
  consultarTracking = async (req: Request, res: Response) => {
    try {
      const criterioParam = req.params.criterio;
      if (!criterioParam) {
        return res.status(400).json({ error: 'Debe especificar un criterio de búsqueda (id_pedido o num_seguimiento).' });
      }

      const criterio = Array.isArray(criterioParam) ? criterioParam[0] : criterioParam;
      const tracking = await this.service.consultarTracking(criterio);
      if (!tracking.encontrado) {
        return res.status(404).json(tracking);
      }

      return res.json(tracking);
    } catch (error) {
      console.error('[VentasIntegrationController] consultarTracking:', error);
      return res.status(500).json({ error: (error as Error).message });
    }
  };
}
