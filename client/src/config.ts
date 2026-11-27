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
