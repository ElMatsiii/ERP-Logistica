import type { RolLogistica } from './types';

/**
 * Color del avatar según el rol. Las clases van escritas aquí (y no se toman de avatar_color del servidor)
 * porque Tailwind solo genera las clases que encuentra en el código del cliente.
 */
const COLOR_AVATAR: Record<RolLogistica, string> = {
  COORDINADOR_LOGISTICA: 'bg-emerald-600',
  OPERADOR_DESPACHO: 'bg-blue-600',
  OPERADOR_RECEPCION: 'bg-purple-600',
};

export function colorAvatar(rol: RolLogistica): string {
  return COLOR_AVATAR[rol] ?? 'bg-slate-500';
}

/**
 * URL del portal del ERP (RRHH), donde se inicia sesión. El portal redirige a Logística con #token=<jwt>.
 * Solo se aceptan URLs http(s); cualquier otro valor se trata como no configurado.
 */
export function urlPortalRrhh(): string | null {
  const valor = import.meta.env.VITE_RRHH_PORTAL_URL?.trim();
  if (!valor) return null;
  try {
    const url = new URL(valor);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}
