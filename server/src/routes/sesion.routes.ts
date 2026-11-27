import { Router, type RequestHandler } from 'express';
import { SesionController } from '../controllers/sesion.controller.js';
import type { ConfigAuth } from '../config/auth.config.js';
import type { SesionService } from '../services/sesion.service.js';

/**
 * /api/auth
 * - GET  /config (público): modo de autenticación del servidor, sin datos sensibles
 * - POST /login  (público): email + contraseña de RRHH → { accessToken, usuario }
 * - GET  /me     (autenticado): usuario de la sesión actual
 */
export function createSesionRouter(opciones: {
  sesion: SesionService;
  autenticar: RequestHandler;
  configAuth: Pick<ConfigAuth, 'modo' | 'jwtSecret'>;
}): Router {
  const router = Router();
  const ctrl = new SesionController(opciones.sesion, opciones.configAuth);

  router.get('/config', ctrl.config);
  router.post('/login', ctrl.login);
  router.get('/me', opciones.autenticar, ctrl.me);

  return router;
}
