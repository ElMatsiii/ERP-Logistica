import { Router, type RequestHandler } from 'express';
import { SesionController } from '../controllers/sesion.controller.js';
import type { SesionService } from '../services/sesion.service.js';

/**
 * /api/auth
 * - POST /login  (público): email + contraseña de RRHH → { accessToken, usuario }
 * - GET  /me     (autenticado): usuario de la sesión actual
 */
export function createSesionRouter(opciones: { sesion: SesionService; autenticar: RequestHandler }): Router {
  const router = Router();
  const ctrl = new SesionController(opciones.sesion);

  router.post('/login', ctrl.login);
  router.get('/me', opciones.autenticar, ctrl.me);

  return router;
}
