import { Request, Response } from 'express';
import { authService } from '../services/auth.service.js';
import { RolLogistica } from '../types/auth.types.js';

export class AuthController {
  /**
   * Retorna los roles disponibles con sus permisos y descripciones.
   */
  getRoles = (_req: Request, res: Response) => {
    try {
      const roles = authService.getRoles();
      res.json(roles);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error al obtener roles' });
    }
  };

  /**
   * Retorna los usuarios disponibles en el sistema con sus perfiles asignados.
   */
  getUsuarios = (_req: Request, res: Response) => {
    try {
      const usuarios = authService.getUsuarios();
      res.json(usuarios);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error al obtener usuarios' });
    }
  };

  /**
   * Retorna el usuario autenticado actual a partir del token / cabeceras.
   */
  getUsuarioActual = (req: Request, res: Response) => {
    try {
      // Sin usuario por defecto: si no hay identificación, 401
      const usuario = req.usuario;
      if (!usuario) {
        return res.status(401).json({ error: 'No autenticado: se requiere identificación de usuario.' });
      }
      res.json({
        autenticado: true,
        usuario,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error al obtener usuario actual' });
    }
  };

  /**
   * Permite cambiar o seleccionar usuario rápidamente (simulador de roles / login).
   */
  login = (req: Request, res: Response) => {
    try {
      const { username, id_empleado, rol } = req.body;

      let usuario = undefined;
      if (id_empleado) {
        usuario = authService.getUsuarioById(Number(id_empleado));
      } else if (username) {
        usuario = authService.getUsuarioByUsername(String(username));
      } else if (rol) {
        usuario = authService.getUsuarioPorRol(rol as RolLogistica);
      }

      if (!usuario) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      res.json({
        mensaje: `Sesión iniciada correctamente como ${usuario.nombre} (${usuario.rol_nombre})`,
        usuario,
        token: `mock-jwt-${usuario.username}-${usuario.id_empleado}`,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error en autenticación' });
    }
  };
}
