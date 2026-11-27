import express, { type Express } from 'express';
import cors from 'cors';
import type { ConfigAuth } from './config/auth.config.js';
import type { LogisticaController } from './controllers/logistica.controller.js';
import { obtenerClienteRrhh, verificarRrhhConLimite, type ClienteRrhh } from './integrations/rrhh/index.js';
import { checkDatabaseConnection } from './lib/prisma.js';
import { crearAutenticar } from './middleware/auth.middleware.js';
import { createLogisticaRouter } from './routes/logistica.routes.js';
import { SesionService } from './services/sesion.service.js';

export interface OpcionesApp {
  configAuth: ConfigAuth;
  /** Por defecto, el cliente según RRHH_MODO */
  clienteRrhh?: ClienteRrhh;
  /** Por defecto, checkDatabaseConnection (inyectable para tests sin BD) */
  verificarBd?: () => Promise<boolean>;
  /** Solo para tests */
  controller?: LogisticaController;
  clientUrl?: string;
  registrarPeticiones?: boolean;
}

/** Arma la app de Express sin abrir el puerto (index.ts la levanta; los tests usan un puerto efímero). */
export function crearApp(opciones: OpcionesApp): Express {
  const clienteRrhh = opciones.clienteRrhh ?? obtenerClienteRrhh();
  const verificarBd = opciones.verificarBd ?? checkDatabaseConnection;
  const clientUrl = opciones.clientUrl ?? 'http://localhost:5173';

  const sesion = new SesionService(clienteRrhh, opciones.configAuth);
  const autenticar = crearAutenticar({ modo: opciones.configAuth.modo, sesion });

  const app = express();

  app.use(
    cors({
      origin: [clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true,
    })
  );

  app.use(express.json());

  // Logger de peticiones en consola
  if (opciones.registrarPeticiones !== false) {
    app.use((req, _res, next) => {
      const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
      console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
      next();
    });
  }

  // Ruta de comprobación de salud: PÚBLICA (sin autenticación), se monta antes de cualquier middleware de auth
  app.get('/api/health', async (_req, res) => {
    // RRHH nunca hace fallar ni colgar el health: verificarRrhhConLimite no lanza y corta a los 3 s
    const [dbOk, rrhh] = await Promise.all([verificarBd(), verificarRrhhConLimite(clienteRrhh)]);
    res.json({
      status: 'ok',
      module: 'LesGo ERP - Módulo Logística y Transporte',
      schema: 'logistica',
      timestamp: new Date().toISOString(),
      database: dbOk ? 'conectado (Neon PostgreSQL - esquema logistica)' : 'sin_conexion_pg',
      rrhh,
    });
  });

  // Rutas de logística: todas exigen identificación (autenticar)
  app.use('/api/logistica', createLogisticaRouter({ autenticar, controller: opciones.controller }));

  // Manejador 404
  app.use((req, res) => {
    res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
  });

  return app;
}
