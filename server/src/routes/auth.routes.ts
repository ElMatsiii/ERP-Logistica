import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { identificarUsuario } from '../middleware/auth.middleware.js';

export function createAuthRouter(): Router {
  const router = Router();
  const ctrl = new AuthController();

  router.use(identificarUsuario);

  // Listado de roles del sistema
  router.get('/roles', ctrl.getRoles);

  // Listado de usuarios del módulo
  router.get('/usuarios', ctrl.getUsuarios);

  // Usuario autenticado actual
  router.get('/me', ctrl.getUsuarioActual);

  // Login / Switch de usuario
  router.post('/login', ctrl.login);

  return router;
}
