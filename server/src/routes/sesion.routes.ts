import { Router, type RequestHandler } from 'express';
import { SesionController } from '../controllers/sesion.controller.js';
import type { ConfigAuth } from '../config/auth.config.js';
import type { SesionService } from '../services/sesion.service.js';

/**
 * /api/auth
 * - GET  /config (público): modo de autenticación del servidor, sin datos sensibles
 * - POST /login  (público, SOLO AUTH_MODO=simulado): email + contraseña → { accessToken, usuario }.
 *                En jwt responde 404: el login lo hace el portal de RRHH.
 * - GET  /me     (autenticado): usuario de la sesión actual (token del portal o usuario simulado)
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
