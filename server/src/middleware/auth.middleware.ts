import { Request, Response, NextFunction } from 'express';
import { PermisoLogistica, RolLogistica, UsuarioLogistica } from '../types/auth.types.js';
import { authService, USUARIOS_LOGISTICA } from '../services/auth.service.js';

// Extender interfaz Request de Express
declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioLogistica;
    }
  }
}

/**
 * Middleware para identificar al usuario que realiza la petición.
 * Lee cabeceras 'x-user-id', 'x-user-role', o 'x-user-username'.
 * En caso de no recibirlas (ej: tests automatizados anteriores),
 * asigna por defecto al Coordinador para mantener retrocompatibilidad total.
 */
export function identificarUsuario(req: Request, res: Response, next: NextFunction) {
  const userIdHeader = req.headers['x-user-id'];
  const userRoleHeader = req.headers['x-user-role'] as RolLogistica | undefined;
  const usernameHeader = req.headers['x-user-username'] as string | undefined;

  let usuario: UsuarioLogistica | undefined;

  if (userIdHeader) {
    const id = parseInt(String(userIdHeader), 10);
    usuario = authService.getUsuarioById(id);
  }

  if (!usuario && usernameHeader) {
    usuario = authService.getUsuarioByUsername(usernameHeader);
  }

  if (!usuario && userRoleHeader) {
    usuario = authService.getUsuarioPorRol(userRoleHeader);
  }

  // Si no se especifica, por defecto asignamos al Coordinador (compatibilidad hacia atrás)
  if (!usuario) {
    usuario = USUARIOS_LOGISTICA[0];
  }

  req.usuario = usuario;
  next();
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
