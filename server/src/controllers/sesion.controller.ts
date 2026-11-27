import type { Request, Response } from 'express';
import type { ConfigAuth, ModoAuth } from '../config/auth.config.js';
import { AuthError, type SesionService } from '../services/sesion.service.js';

export const MENSAJE_DATOS_LOGIN = 'Debes indicar email y contraseña';

/** Respuesta pública de GET /api/auth/config: solo cómo se puede iniciar sesión, nada sensible. */
export interface ConfigAuthPublica {
  modo: ModoAuth;
  /** true si JWT_SECRET está configurado (POST /api/auth/login disponible) */
  login_con_contrasena: boolean;
}

/** GET /api/auth/config, POST /api/auth/login y GET /api/auth/me. Nunca registra la contraseña ni el cuerpo de la petición. */
export class SesionController {
  constructor(
    private readonly sesion: SesionService,
    private readonly configAuth: Pick<ConfigAuth, 'modo' | 'jwtSecret'>
  ) {}

  /** Público: el cliente lo usa para decidir qué pantalla de inicio mostrar. */
  config = (_req: Request, res: Response) => {
    const respuesta: ConfigAuthPublica = {
      modo: this.configAuth.modo,
      login_con_contrasena: this.configAuth.jwtSecret !== null,
    };
    res.json(respuesta);
  };

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
