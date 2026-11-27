import { Router, type RequestHandler } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import type { ModoAuth } from '../config/auth.config.js';

/** Las rutas del selector de usuarios simulado solo existen en AUTH_MODO=simulado. */
const soloModoSimulado =
  (modo: ModoAuth): RequestHandler =>
  (req, res, next) => {
    if (modo === 'simulado') return next();
    res.status(404).json({
      error: `Ruta no disponible con AUTH_MODO=jwt: ${req.method} ${req.originalUrl}. El inicio de sesión se hace desde el portal del ERP (RRHH).`,
    });
  };

/**
 * /api/logistica/auth. Se monta dentro de /api/logistica, que ya aplica el middleware autenticar.
 * La sesión real se inicia en el portal de RRHH; /api/auth (sesion.routes.ts) valida el token.
 */
export function createAuthRouter(opciones: { modo: ModoAuth }): Router {
  const router = Router();
  const ctrl = new AuthController();
  const simulado = soloModoSimulado(opciones.modo);

  // Listado de roles del sistema (ambos modos)
  router.get('/roles', ctrl.getRoles);

  // Usuario autenticado actual (ambos modos)
  router.get('/me', ctrl.getUsuarioActual);

  // Selector de usuarios simulados (USUARIOS_LOGISTICA): solo desarrollo y demo de roles
  router.get('/usuarios', simulado, ctrl.getUsuarios);
  router.post('/login', simulado, ctrl.login);

  return router;
}
