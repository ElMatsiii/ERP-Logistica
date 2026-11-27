import type { Request, Response } from 'express';
import { AuthError, type SesionService } from '../services/sesion.service.js';

export const MENSAJE_DATOS_LOGIN = 'Debes indicar email y contraseña';

/** POST /api/auth/login y GET /api/auth/me. Nunca registra la contraseña ni el cuerpo de la petición. */
export class SesionController {
  constructor(private readonly sesion: SesionService) {}

  login = async (req: Request, res: Response) => {
    const { email, password } = (req.body ?? {}) as { email?: unknown; password?: unknown };
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return res.status(400).json({ error: MENSAJE_DATOS_LOGIN });
    }

    try {
      const { accessToken, usuario } = await this.sesion.iniciarSesion(email, password);
      res.json({ accessToken, usuario });
    } catch (err) {
      if (err instanceof AuthError) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error('[Auth] Error inesperado en el login:', (err as Error)?.message);
      res.status(500).json({ error: 'Error interno al iniciar sesión' });
    }
  };

  /** Requiere el middleware autenticar antes. */
  me = (req: Request, res: Response) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado: se requiere identificación de usuario.' });
    }
    res.json({ autenticado: true, usuario: req.usuario });
  };
}
