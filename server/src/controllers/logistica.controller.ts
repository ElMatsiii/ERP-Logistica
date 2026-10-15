import { Request, Response } from 'express';
import { LogisticaService, ValidationError } from '../services/logistica.service.js';

export class LogisticaController {
  private service: LogisticaService;

  constructor(service?: LogisticaService) {
    this.service = service || new LogisticaService();
  }

  getPedidosPendientes = async (req: Request, res: Response) => {
    try {
      const pedidos = await this.service.getPedidosPendientes();
      res.json(pedidos);
    } catch (error: any) {
      console.error('Error al obtener pedidos pendientes:', error);
      res.status(500).json({ error: 'Error interno al consultar pedidos pendientes', detalle: error.message });
    }
  };

  getOtById = async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const ot = await this.service.getOtById(id);
      res.json(ot);
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error(`Error al obtener OT ${req.params.id}:`, error);
      res.status(500).json({ error: 'Error interno al consultar orden de trabajo', detalle: error.message });
    }
  };

  getTransportistas = async (req: Request, res: Response) => {
    try {
      const transportistas = await this.service.getTransportistas();
      res.json(transportistas);
    } catch (error: any) {
      console.error('Error al obtener transportistas:', error);
      res.status(500).json({ error: 'Error interno al consultar transportistas', detalle: error.message });
    }
  };

  cotizar = async (req: Request, res: Response) => {
    try {
      const resultado = await this.service.cotizarEnvio(req.body);
      res.json(resultado);
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error('Error al cotizar envío:', error);
      res.status(500).json({ error: 'Error al calcular cotización', detalle: error.message });
    }
  };

  emitirGuia = async (req: Request, res: Response) => {
    try {
      const resultado = await this.service.emitirGuia(req.body);
      res.status(201).json(resultado);
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error('Error al emitir guía de despacho:', error);
      res.status(500).json({ error: 'Error transaccional al emitir guía', detalle: error.message });
    }
  };

  getTracking = async (req: Request, res: Response) => {
    try {
      const { estado, transportista, fecha, busqueda } = req.query;
      const guias = await this.service.getTracking({
        estado: estado as string | undefined,
        transportista: transportista as string | undefined,
        fecha: fecha as string | undefined,
        busqueda: busqueda as string | undefined,
      });
      res.json(guias);
    } catch (error: any) {
      console.error('Error al consultar tracking:', error);
      res.status(500).json({ error: 'Error interno al consultar bitácora de tracking', detalle: error.message });
    }
  };

  registrarEventoTracking = async (req: Request, res: Response) => {
    try {
      const id_guia = String(req.params.id_guia);
      const { estado, usuario_responsable, observacion } = req.body;
      const resultado = await this.service.registrarEventoTracking(
        id_guia,
        estado,
        usuario_responsable,
        observacion
      );
      res.status(201).json({
        mensaje: 'Evento registrado exitosamente en bitácora',
        ...resultado,
      });
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error(`Error al registrar evento para guía ${req.params.id_guia}:`, error);
      res.status(500).json({ error: 'Error al registrar evento de tracking', detalle: error.message });
    }
  };
}
