import { Request, Response } from 'express';
import { LogisticaService, ValidationError } from '../services/logistica.service.js';
import { obtenerClienteInventario } from '../integrations/inventario/index.js';

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
      const payload = {
        ...req.body,
        usuario_responsable: req.body?.usuario_responsable || req.usuario?.nombre,
      };
      const resultado = await this.service.emitirGuia(payload);
      res.status(201).json(resultado);
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error('Error al emitir guía de despacho:', error);
      res.status(500).json({ error: 'Error transaccional al emitir guía', detalle: error.message });
    }
  };

  /** Reintenta que Inventario confirme el egreso de una guía en 'Pendiente de stock' o 'Error de stock' */
  reintentarStockGuia = async (req: Request, res: Response) => {
    try {
      const usuarioResp = req.body?.usuario_responsable || req.usuario?.nombre;
      const resultado = await this.service.reintentarConfirmacionStock(
        String(req.params.id),
        usuarioResp
      );
      res.json(resultado);
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error(`Error al reintentar stock de la guía ${req.params.id}:`, error);
      res.status(500).json({ error: 'Error al reintentar la confirmación de stock', detalle: error.message });
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
      const usuarioFinal = usuario_responsable || req.usuario?.nombre || 'M. Pizarro';
      const resultado = await this.service.registrarEventoTracking(
        id_guia,
        estado,
        usuarioFinal,
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

  getComprasPendientes = async (req: Request, res: Response) => {
    try {
      const compras = await this.service.getComprasPendientes();
      res.json(compras);
    } catch (error: any) {
      console.error('Error al obtener compras pendientes:', error);
      res.status(500).json({ error: 'Error al consultar órdenes de compra', detalle: error.message });
    }
  };

  getCompraById = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const compra = await this.service.getCompraById(id);
      res.json(compra);
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error(`Error al obtener orden de compra ${req.params.id}:`, error);
      res.status(500).json({ error: 'Error al consultar orden de compra', detalle: error.message });
    }
  };

  registrarRecepcion = async (req: Request, res: Response) => {
    try {
      const payload = {
        ...req.body,
        id_empleado_receptor: req.body?.id_empleado_receptor || req.usuario?.id_empleado,
      };
      const resultado = await this.service.registrarRecepcion(payload);
      res.status(201).json(resultado);
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error('Error al registrar recepción en muelle:', error);
      res.status(500).json({ error: 'Error transaccional al registrar recepción', detalle: error.message });
    }
  };

  getHistorialRecepciones = async (req: Request, res: Response) => {
    try {
      const recepciones = await this.service.getHistorialRecepciones();
      res.json(recepciones);
    } catch (error: any) {
      console.error('Error al obtener historial de recepciones:', error);
      res.status(500).json({ error: 'Error al consultar historial de recepciones', detalle: error.message });
    }
  };

  getEmpleados = async (_req: Request, res: Response) => {
    try {
      res.json(await this.service.getEmpleados());
    } catch (error: any) {
      console.error('Error al obtener empleados:', error);
      res.status(500).json({ error: 'Error al consultar empleados', detalle: error.message });
    }
  };

  /** Bodegas de Inventario (503 si Inventario no responde) */
  getBodegas = async (_req: Request, res: Response) => {
    try {
      res.json(await this.service.getBodegas());
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error('Error al obtener bodegas:', error);
      res.status(500).json({ error: 'Error al consultar bodegas', detalle: error.message });
    }
  };

  /** Modo del cliente de Inventario (real o simulado) y si responde. 503 si no responde. */
  getEstadoInventario = async (_req: Request, res: Response) => {
    const estado = await obtenerClienteInventario().verificarConexion();
    res.status(estado.ok ? 200 : 503).json(estado);
  };
}
