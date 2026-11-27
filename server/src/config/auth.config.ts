/**
 * Configuración de autenticación (AUTH_MODO, JWT_SECRET, JWT_EXPIRES_IN).
 * Se lee una vez al arrancar: si es inválida, el servidor no debe abrir el puerto.
 */

export type ModoAuth = 'jwt' | 'simulado';

export interface ConfigAuth {
  modo: ModoAuth;
  /** Secreto HS256 compartido con RRHH. null = no se pueden emitir ni verificar tokens. */
  jwtSecret: string | null;
  /** Duración del token en segundos (JWT_EXPIRES_IN; 8 h por defecto, como RRHH). */
  jwtExpiresInSeg: number;
  /** Avisos no fatales para mostrar al arrancar */
  advertencias: string[];
}

export class ConfigAuthError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ConfigAuthError';
  }
}

export const DURACION_TOKEN_POR_DEFECTO_SEG = 8 * 60 * 60;
/** Largo mínimo recomendado para un secreto HS256 (256 bits) */
const LARGO_RECOMENDADO_SECRETO = 32;

const SEGUNDOS_POR_UNIDAD: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

/**
 * Convierte JWT_EXPIRES_IN a segundos. Acepta un número de segundos ("28800") o un número con
 * unidad s/m/h/d ("8h", "30m"). Se convierte a número a propósito: jsonwebtoken interpreta un texto
 * sin unidad como milisegundos ("120" = 120 ms), y así se evita ese error.
 */
export function duracionEnSegundos(valor: string): number {
  const coincidencia = /^(\d+)\s*([smhd])?$/i.exec(valor.trim());
  if (!coincidencia) {
    throw new ConfigAuthError(
      `JWT_EXPIRES_IN="${valor}" no es válido. Use segundos ("28800") o un número con unidad s, m, h o d ("8h").`
    );
  }
  const segundos = Number(coincidencia[1]) * SEGUNDOS_POR_UNIDAD[(coincidencia[2] ?? 's').toLowerCase()];
  if (!Number.isSafeInteger(segundos) || segundos <= 0) {
    throw new ConfigAuthError(`JWT_EXPIRES_IN="${valor}" debe ser mayor que cero.`);
  }
  return segundos;
}

export function leerConfigAuth(env: NodeJS.ProcessEnv = process.env): ConfigAuth {
  const advertencias: string[] = [];

  const modoTexto = env.AUTH_MODO?.trim().toLowerCase() ?? '';
  let modo: ModoAuth;
  if (modoTexto === 'jwt' || modoTexto === 'simulado') {
    modo = modoTexto;
  } else if (modoTexto === '') {
    modo = 'simulado';
    advertencias.push('AUTH_MODO vacío: se usa el modo simulado (cabeceras x-user-*). No usar así en la demo ni en producción.');
  } else {
    throw new ConfigAuthError(`AUTH_MODO="${env.AUTH_MODO}" no es válido. Use "jwt" o "simulado".`);
  }

  // El secreto no se recorta: debe ser idéntico al de RRHH. Solo se considera vacío si son puros espacios.
  const secreto = env.JWT_SECRET ?? '';
  const jwtSecret = secreto.trim() === '' ? null : secreto;

  if (modo === 'jwt' && !jwtSecret) {
    throw new ConfigAuthError(
      'AUTH_MODO=jwt requiere JWT_SECRET (el mismo secreto que usa el backend de RRHH). Defínalo en .env o use AUTH_MODO=simulado.'
    );
  }
  if (jwtSecret && jwtSecret.length < LARGO_RECOMENDADO_SECRETO) {
    advertencias.push(`JWT_SECRET tiene menos de ${LARGO_RECOMENDADO_SECRETO} caracteres: se recomienda uno más largo.`);
  }
  if (modo === 'simulado' && !jwtSecret) {
    advertencias.push('JWT_SECRET vacío: el login con email y contraseña no estará disponible en modo simulado.');
  }
  if (modo === 'simulado' && env.NODE_ENV === 'production') {
    advertencias.push('NODE_ENV=production con AUTH_MODO=simulado: cualquiera puede identificarse con cabeceras x-user-*.');
  }

  const expira = env.JWT_EXPIRES_IN?.trim();
  const jwtExpiresInSeg = expira ? duracionEnSegundos(expira) : DURACION_TOKEN_POR_DEFECTO_SEG;

  return { modo, jwtSecret, jwtExpiresInSeg, advertencias };
}
