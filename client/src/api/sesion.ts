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

/** El AuthContext registra aquí qué hacer ante un 401 (cerrar sesión y volver al login). */
export function registrarManejadorNoAutorizado(fn: (() => void) | null): void {
  alNoAutorizado = fn;
}

export function notificarNoAutorizado(): void {
  alNoAutorizado?.();
}
