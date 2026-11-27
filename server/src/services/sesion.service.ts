import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { ConfigAuth } from '../config/auth.config.js';
import { RrhhError, rolLogisticaDesde, type ClienteRrhh, type CuentaRrhh } from '../integrations/rrhh/index.js';
import type { RolLogistica, UsuarioLogistica } from '../types/auth.types.js';
import { ROLES_CONFIG } from './auth.service.js';

/** Mensajes de la especificación (docs/INTEGRACION_RRHH.md, Fase 2) */
export const MENSAJES_AUTH = {
  CREDENCIALES_INVALIDAS: 'Usuario o contraseña incorrectos',
  CUENTA_NO_ACTIVA: 'La cuenta no está activa',
  SIN_ACCESO_LOGISTICA: 'No tienes acceso al módulo de Logística',
  SESION_INVALIDA: 'Sesión inválida o expirada',
  TOKEN_DEMO: 'La cuenta de demostración de RRHH no es un empleado real y no tiene acceso a Logística',
  JWT_NO_CONFIGURADO: 'El inicio de sesión con token no está configurado en el servidor (JWT_SECRET)',
  RRHH_NO_DISPONIBLE: 'No se pudo verificar la cuenta en RRHH. Intenta nuevamente en unos minutos',
} as const;

export class AuthError extends Error {
  readonly status: 401 | 403 | 503;
  constructor(status: 401 | 403 | 503, mensaje: string, opciones?: { cause?: unknown }) {
    super(mensaje, opciones);
    this.name = 'AuthError';
    this.status = status;
  }
}

/** Payload de los tokens de RRHH (mismo formato en ambos módulos). */
export interface PayloadTokenRrhh {
  /** id_empleado. RRHH lo emite como número; se acepta también como texto numérico. */
  sub: number | string;
  /** Email con el que inició sesión */
  username: string;
  /** Primer rol de RRHH por id_rol. Solo informativo: los roles se releen de la BD en cada petición. */
  role: string | null;
  employeeId: number;
  /** 'db' = empleado real | 'demo' = admin en memoria del backend de RRHH */
  source: 'db' | 'demo';
}

export interface ResultadoLogin {
  accessToken: string;
  usuario: UsuarioLogistica;
}

/**
 * bcrypt de un texto aleatorio que nadie conoce. Cuando el email no existe se compara igual contra
 * este hash, para que el tiempo de respuesta no revele qué emails tienen cuenta.
 */
const HASH_FICTICIO = '$2b$10$0t0n2LSOF19rKAPHTp17ZumSKUt1a47LTPoroJ1QCCFfsNzcIwX82';

const COLOR_POR_ROL: Record<RolLogistica, string> = {
  COORDINADOR_LOGISTICA: 'bg-emerald-600',
  OPERADOR_DESPACHO: 'bg-blue-600',
  OPERADOR_RECEPCION: 'bg-purple-600',
};

/**
 * Login contra RRHH y tokens JWT compatibles con RRHH (HS256, mismo secreto y mismo payload).
 * Nunca devuelve ni registra password_hash.
 */
export class SesionService {
  constructor(
    private readonly clienteRrhh: ClienteRrhh,
    private readonly config: Pick<ConfigAuth, 'jwtSecret' | 'jwtExpiresInSeg'>
  ) {}

  /** POST /api/auth/login */
  async iniciarSesion(email: unknown, password: unknown): Promise<ResultadoLogin> {
    const secreto = this.secreto();
    const emailTexto = typeof email === 'string' ? email.trim() : '';
    const passwordTexto = typeof password === 'string' ? password : '';

    const cuenta = emailTexto ? await this.leerRrhh(() => this.clienteRrhh.buscarCuentaPorEmail(emailTexto)) : null;

    // 1. Email inexistente o contraseña incorrecta: mismo mensaje y mismo costo en ambos casos
    const hash = cuenta?.password_hash || HASH_FICTICIO;
    const coincide = await compararSeguro(passwordTexto, hash);
    if (!cuenta || !cuenta.password_hash || !passwordTexto || !coincide) {
      throw new AuthError(401, MENSAJES_AUTH.CREDENCIALES_INVALIDAS);
    }

    // 2 y 3. Estado de la cuenta y rol de Logística
    const rol = validarCuenta(cuenta);

    return { accessToken: this.firmarToken(cuenta, secreto), usuario: usuarioDesdeCuenta(cuenta, rol) };
  }

  /** Firma un token con el mismo formato que RRHH: HS256, { sub, username, role, employeeId, source }. */
  firmarToken(cuenta: CuentaRrhh, secreto: string = this.secreto()): string {
    const payload: PayloadTokenRrhh = {
      sub: cuenta.id_empleado,
      username: cuenta.email,
      role: cuenta.roles[0] ?? null,
      employeeId: cuenta.id_empleado,
      source: 'db',
    };
    return jwt.sign(payload, secreto, { algorithm: 'HS256', expiresIn: this.config.jwtExpiresInSeg });
  }

  /**
   * Verifica firma, algoritmo y expiración, y devuelve el id_empleado del token.
   * Acepta tokens emitidos por RRHH o por Logística.
   */
  verificarToken(token: string): number {
    const secreto = this.secreto();
    let payload: unknown;
    try {
      payload = jwt.verify(token, secreto, { algorithms: ['HS256'] });
    } catch (err) {
      throw new AuthError(401, MENSAJES_AUTH.SESION_INVALIDA, { cause: err });
    }

    const p = (payload ?? {}) as Partial<Record<keyof PayloadTokenRrhh, unknown>>;
    if (p.source === 'demo') throw new AuthError(401, MENSAJES_AUTH.TOKEN_DEMO);
    if (p.source !== 'db') throw new AuthError(401, MENSAJES_AUTH.SESION_INVALIDA);

    const id = idDesde(p.sub);
    if (id === null) throw new AuthError(401, MENSAJES_AUTH.SESION_INVALIDA);
    if (p.employeeId !== undefined && idDesde(p.employeeId) !== id) {
      throw new AuthError(401, MENSAJES_AUTH.SESION_INVALIDA);
    }
    return id;
  }

  /**
   * Verifica el token y relee la cuenta en RRHH, repitiendo las validaciones del login:
   * un bloqueo o un cambio de rol aplica en la siguiente petición. El rol del token se ignora.
   */
  async usuarioDesdeToken(token: string): Promise<UsuarioLogistica> {
    const idEmpleado = this.verificarToken(token);
    const cuenta = await this.leerRrhh(() => this.clienteRrhh.buscarCuentaPorId(idEmpleado));
    if (!cuenta) throw new AuthError(401, MENSAJES_AUTH.SESION_INVALIDA);
    return usuarioDesdeCuenta(cuenta, validarCuenta(cuenta));
  }

  private secreto(): string {
    if (!this.config.jwtSecret) throw new AuthError(503, MENSAJES_AUTH.JWT_NO_CONFIGURADO);
    return this.config.jwtSecret;
  }

  /** Si RRHH no responde (BD caída, sin permisos), 503: no es culpa de las credenciales. */
  private async leerRrhh<T>(leer: () => Promise<T>): Promise<T> {
    try {
      return await leer();
    } catch (err) {
      if (err instanceof RrhhError) throw new AuthError(503, MENSAJES_AUTH.RRHH_NO_DISPONIBLE, { cause: err });
      throw err;
    }
  }
}

/** Valida estado y rol de una cuenta. Devuelve el rol de Logística o lanza 401/403. */
export function validarCuenta(cuenta: CuentaRrhh): RolLogistica {
  if (cuenta.estado_usuario !== 'activo' || cuenta.estado_empleado !== 'activo') {
    throw new AuthError(401, MENSAJES_AUTH.CUENTA_NO_ACTIVA);
  }
  const rol = rolLogisticaDesde(cuenta.roles);
  if (!rol) throw new AuthError(403, MENSAJES_AUTH.SIN_ACCESO_LOGISTICA);
  return rol;
}

/** Usuario de Logística a partir de la cuenta de RRHH, sin datos sensibles. */
export function usuarioDesdeCuenta(cuenta: CuentaRrhh, rol: RolLogistica): UsuarioLogistica {
  const config = ROLES_CONFIG[rol];
  const iniciales = `${cuenta.nombre.trim().charAt(0)}${cuenta.apellido.trim().charAt(0)}`.toUpperCase();
  return {
    id_usuario: cuenta.id_empleado, // en RRHH la PK de usuario es id_empleado
    id_empleado: cuenta.id_empleado,
    username: cuenta.email,
    nombre: `${cuenta.nombre} ${cuenta.apellido}`.trim(),
    rut: cuenta.rut,
    cargo: cuenta.cargo ?? config.nombre,
    rol,
    rol_nombre: config.nombre,
    avatar_iniciales: iniciales || '?',
    avatar_color: COLOR_POR_ROL[rol],
    permisos: [...config.permisos],
    descripcion: config.descripcion,
    pestañas_permitidas: [...config.pestañas_permitidas],
  };
}

function idDesde(valor: unknown): number | null {
  const n = typeof valor === 'number' ? valor : typeof valor === 'string' && /^\d+$/.test(valor) ? Number(valor) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** bcrypt.compare que nunca lanza (hash mal formado = no coincide). */
async function compararSeguro(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}
