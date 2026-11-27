import { ConfigAuthPublica, UsuarioLogistica } from '../types';
import { solicitar } from './logisticaApi';

/*
 * Endpoints de sesión (/api/auth). Logística no tiene login propio: la sesión se inicia en el portal
 * de RRHH (token) o, solo en AUTH_MODO=simulado, como usuario de prueba.
 * Ninguno cierra la sesión por su cuenta ante un 401: el AuthContext decide qué mostrar.
 */

/** Público: modo de autenticación del servidor (jwt | simulado). */
export function obtenerConfigAuth(): Promise<ConfigAuthPublica> {
  return solicitar<ConfigAuthPublica>('/api/auth/config', {
    mensajeError: 'No se pudo obtener la configuración del servidor',
    cerrarSesionEn401: false,
    sinIdentificacion: true,
  });
}

/** Usuario de la sesión actual (token o usuario simulado), validado por el servidor. */
export async function obtenerUsuarioActual(): Promise<UsuarioLogistica> {
  const { usuario } = await solicitar<{ autenticado: boolean; usuario: UsuarioLogistica }>('/api/auth/me', {
    mensajeError: 'No se pudo validar la sesión',
    cerrarSesionEn401: false,
  });
  return usuario;
}
