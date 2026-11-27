import { Request, Response, NextFunction, RequestHandler } from 'express';
import { PermisoLogistica, RolLogistica, UsuarioLogistica } from '../types/auth.types.js';
import { authService } from '../services/auth.service.js';
import { AuthError, type SesionService } from '../services/sesion.service.js';
import type { ModoAuth } from '../config/auth.config.js';

// Extender interfaz Request de Express
declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioLogistica;
    }
  }
}

export const MENSAJES_IDENTIFICACION = {
  SIN_IDENTIFICACION: 'No autenticado: se requiere identificación de usuario.',
  SIN_TOKEN: 'No autenticado: falta el token de sesión (Authorization: Bearer <token>).',
  CABECERA_INVALIDA: 'No autenticado: la cabecera Authorization debe ser "Bearer <token>".',
  ERROR_INTERNO: 'Error interno al verificar la sesión',
} as const;

/** Usuario simulado según las cabeceras x-user-id, x-user-username o x-user-role (solo AUTH_MODO=simulado). */
function usuarioDesdeCabeceras(req: Request): UsuarioLogistica | undefined {
  const userIdHeader = req.headers['x-user-id'];
  const userRoleHeader = req.headers['x-user-role'];
  const usernameHeader = req.headers['x-user-username'];

  let usuario: UsuarioLogistica | undefined;

  if (userIdHeader) {
    const id = parseInt(String(userIdHeader), 10);
    if (Number.isSafeInteger(id)) usuario = authService.getUsuarioById(id);
  }

  if (!usuario && usernameHeader) {
    usuario = authService.getUsuarioByUsername(String(usernameHeader));
  }

  if (!usuario && userRoleHeader) {
    usuario = authService.getUsuarioPorRol(String(userRoleHeader) as RolLogistica);
  }

  return usuario;
}

/**
 * Identificación simulada (solo desarrollo y tests): cabeceras 'x-user-id', 'x-user-username' o 'x-user-role'.
 * Ya NO hay usuario por defecto: sin identificación válida (o con id/rol desconocidos) responde 401.
 */
export function identificarUsuario(req: Request, res: Response, next: NextFunction) {
  const usuario = usuarioDesdeCabeceras(req);
  if (!usuario) {
    return res.status(401).json({ error: MENSAJES_IDENTIFICACION.SIN_IDENTIFICACION });
  }
  req.usuario = usuario;
  next();
}

/** Extrae el token de "Authorization: Bearer <token>". undefined = sin cabecera; null = cabecera mal formada. */
function tokenBearer(req: Request): string | null | undefined {
  const cabecera = req.headers.authorization;
  if (cabecera === undefined || cabecera === '') return undefined;
  const coincidencia = /^Bearer\s+(\S+)\s*$/i.exec(cabecera);
  return coincidencia ? coincidencia[1] : null;
}

/**
 * Middleware de autenticación (reemplaza a identificarUsuario en las rutas).
 * - Con "Authorization: Bearer <token>" (ambos modos): verifica el JWT (HS256, mismo secreto que RRHH),
 *   relee la cuenta en RRHH y valida estado y rol en cada petición.
 * - AUTH_MODO=jwt: el token es obligatorio; las cabeceras x-user-* se ignoran.
 * - AUTH_MODO=simulado: sin token, acepta x-user-* (solo desarrollo y tests).
 * Sin identificación → 401. Sin rol de Logística → 403.
 */
export function crearAutenticar(opciones: { modo: ModoAuth; sesion: SesionService }): RequestHandler {
  const { modo, sesion } = opciones;

  return async (req: Request, res: Response, next: NextFunction) => {
    const token = tokenBearer(req);

    if (token === null) {
      return res.status(401).json({ error: MENSAJES_IDENTIFICACION.CABECERA_INVALIDA });
    }

    if (token === undefined) {
      if (modo === 'jwt') {
        return res.status(401).json({ error: MENSAJES_IDENTIFICACION.SIN_TOKEN });
      }
      return identificarUsuario(req, res, next);
    }

    try {
      req.usuario = await sesion.usuarioDesdeToken(token);
    } catch (err) {
      if (err instanceof AuthError) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error('[Auth] Error inesperado al verificar la sesión:', (err as Error)?.message);
      return res.status(500).json({ error: MENSAJES_IDENTIFICACION.ERROR_INTERNO });
    }
    next();
  };
}

/**
 * Validador de permisos requeridos para una ruta.
 */
export function requerirPermiso(...permisosRequeridos: PermisoLogistica[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const usuario = req.usuario;

    if (!usuario) {
      return res.status(401).json({
        error: 'No autenticado: se requiere identificación de usuario para realizar esta acción.',
      });
    }

    const tienePermiso = permisosRequeridos.some((p) => usuario.permisos.includes(p));

    if (!tienePermiso) {
      return res.status(403).json({
        error: `Acceso restringido: El rol '${usuario.rol_nombre}' (${usuario.rol}) no tiene autorización para realizar esta acción. Permiso requerido: [${permisosRequeridos.join(', ')}].`,
        rol_usuario: usuario.rol,
        permisos_usuario: usuario.permisos,
        permisos_requeridos: permisosRequeridos,
      });
    }

    next();
  };
}

/**
 * Validador de roles específicos permitidos para una ruta.
 */
export function requerirRol(...rolesPermitidos: RolLogistica[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const usuario = req.usuario;

    if (!usuario) {
      return res.status(401).json({
        error: 'No autenticado: se requiere identificación de usuario.',
      });
    }

    if (!rolesPermitidos.includes(usuario.rol)) {
      return res.status(403).json({
        error: `Acceso restringido: Solo los roles [${rolesPermitidos.join(', ')}] pueden acceder a este recurso. Tu rol actual es: '${usuario.rol_nombre}' (${usuario.rol}).`,
        rol_usuario: usuario.rol,
        roles_permitidos: rolesPermitidos,
      });
    }

    next();
  };
}
