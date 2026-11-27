/**
 * Sesión del usuario en el navegador.
 * - 'token': JWT emitido por POST /api/auth/login o por el portal de RRHH (AUTH_MODO=jwt o simulado).
 * - 'simulado': usuario de prueba identificado con x-user-id (solo AUTH_MODO=simulado, desarrollo).
 *
 * Es el único lugar que lee o escribe la sesión en localStorage.
 */
export type SesionGuardada =
  | { tipo: 'token'; token: string }
  | { tipo: 'simulado'; idEmpleado: number };

const CLAVE_SESION = 'lesgo_logistica_sesion';
/** Claves de versiones anteriores: se borran para no dejar datos huérfanos */
const CLAVES_ANTIGUAS = ['lesgo_logistica_usuario_activo', 'lesgo_logistica_usuario_activo_v2'];

let sesionEnMemoria: SesionGuardada | null | undefined;
const alCambiar = new Set<() => void>();
let alNoAutorizado: (() => void) | null = null;

function esSesionValida(valor: unknown): valor is SesionGuardada {
  const v = valor as Partial<SesionGuardada> | null;
  if (!v || typeof v !== 'object') return false;
  if (v.tipo === 'token') return typeof (v as { token?: unknown }).token === 'string' && (v as { token: string }).token.length > 0;
  if (v.tipo === 'simulado') return Number.isSafeInteger((v as { idEmpleado?: unknown }).idEmpleado);
  return false;
}

export function leerSesion(): SesionGuardada | null {
  if (sesionEnMemoria !== undefined) return sesionEnMemoria;
  try {
    for (const clave of CLAVES_ANTIGUAS) localStorage.removeItem(clave);
    const crudo = localStorage.getItem(CLAVE_SESION);
    const valor = crudo ? JSON.parse(crudo) : null;
    sesionEnMemoria = esSesionValida(valor) ? valor : null;
  } catch {
    sesionEnMemoria = null;
  }
  return sesionEnMemoria;
}

function mismaSesion(a: SesionGuardada | null, b: SesionGuardada | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function guardarSesion(sesion: SesionGuardada): void {
  const anterior = leerSesion();
  sesionEnMemoria = sesion;
  try {
    localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
  } catch {
    // Sin localStorage (modo privado estricto): la sesión dura mientras la pestaña esté abierta
  }
  if (!mismaSesion(anterior, sesion)) alCambiar.forEach((fn) => fn());
}

export function borrarSesion(): void {
  const anterior = leerSesion();
  sesionEnMemoria = null;
  try {
    localStorage.removeItem(CLAVE_SESION);
  } catch {
    // Ignorar
  }
  if (anterior !== null) alCambiar.forEach((fn) => fn());
}

/** Cabeceras de identificación para la API. Sin sesión, ninguna. */
export function cabecerasDeSesion(): Record<string, string> {
  const sesion = leerSesion();
  if (!sesion) return {};
  if (sesion.tipo === 'token') return { Authorization: `Bearer ${sesion.token}` };
  return { 'x-user-id': String(sesion.idEmpleado) };
}

/** Se llama cada vez que la sesión cambia (iniciar, cerrar o cambiar de usuario). Devuelve la función para desuscribirse. */
export function suscribirCambioSesion(fn: () => void): () => void {
  alCambiar.add(fn);
  return () => alCambiar.delete(fn);
}

/* =========================================================================
 * TOKEN DEL PORTAL DE RRHH (#token=<jwt>)
 * El portal redirige a Logística con el token en el fragmento de la URL. El fragmento nunca viaja al
 * servidor ni en el Referer; igual se borra de inmediato para que no quede en la barra ni en el historial.
 * ========================================================================= */

export type ResultadoTokenPortal = 'ninguno' | 'aplicado' | 'invalido';

let resultadoPortal: ResultadoTokenPortal | undefined;

/** Un JWT: tres partes base64url separadas por punto, de tamaño razonable */
const FORMATO_JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const LARGO_MAXIMO_TOKEN = 8192;

/**
 * Lee #token=<jwt> UNA sola vez (al cargar la app, antes de cualquier petición), lo quita de la URL con
 * history.replaceState y, si tiene formato de JWT, lo guarda como sesión (reemplaza la que hubiera).
 * El servidor lo valida después con GET /api/auth/me. Llamadas siguientes devuelven el mismo resultado.
 */
export function aplicarTokenDelPortal(): ResultadoTokenPortal {
  if (resultadoPortal !== undefined) return resultadoPortal;
  resultadoPortal = 'ninguno';
  try {
    const hash = window.location.hash;
    if (hash.length < 2) return resultadoPortal;
    const params = new URLSearchParams(hash.slice(1));
    if (!params.has('token')) return resultadoPortal;

    const token = (params.get('token') ?? '').trim();
    params.delete('token');
    const resto = params.toString();
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}${resto ? `#${resto}` : ''}`
    );

    if (token.length <= LARGO_MAXIMO_TOKEN && FORMATO_JWT.test(token)) {
      guardarSesion({ tipo: 'token', token });
      resultadoPortal = 'aplicado';
    } else {
      // Llegó algo que no es un token: no se usa, y tampoco se conserva la sesión anterior (puede ser de otra persona)
      borrarSesion();
      resultadoPortal = 'invalido';
    }
  } catch {
    // Sin acceso a location/history: se sigue sin token del portal
  }
  return resultadoPortal;
}

/** Resultado de aplicarTokenDelPortal mientras no se haya validado; 'ninguno' después de marcarlo como usado. */
export function resultadoTokenDelPortal(): ResultadoTokenPortal {
  return resultadoPortal ?? 'ninguno';
}

/** Tras validar (o descartar) el token del portal, los mensajes siguientes vuelven a ser los generales. */
export function marcarTokenDelPortalUsado(): void {
  resultadoPortal = 'ninguno';
}

/** El AuthContext registra aquí qué hacer ante un 401 (cerrar sesión y volver al login). */
export function registrarManejadorNoAutorizado(fn: (() => void) | null): void {
  alNoAutorizado = fn;
}

export function notificarNoAutorizado(): void {
  alNoAutorizado?.();
}
