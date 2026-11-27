export type TipoErrorRrhh =
  | 'SIN_CONEXION' // No se pudo llegar a la BD (Neon caída, DATABASE_URL mala, sin red)
  | 'SIN_PERMISO' // La BD rechazó la lectura del esquema rrhh (falta GRANT SELECT)
  | 'ESQUEMA_INVALIDO' // Falta una tabla o columna de rrhh (RRHH cambió su esquema)
  | 'ERROR_BD'; // Cualquier otro error al consultar

/**
 * Error al leer RRHH. El mensaje es genérico a propósito: nunca incluye valores de la consulta
 * (emails, hashes). El error original queda en `cause`, para depurar en el servidor.
 */
export class RrhhError extends Error {
  readonly tipo: TipoErrorRrhh;
  /** Código de Prisma o de PostgreSQL, si existe (p. ej. P1001, 42P01) */
  readonly codigo: string | null;
  readonly operacion: string;

  constructor(opciones: { tipo: TipoErrorRrhh; mensaje: string; operacion: string; codigo?: string | null; cause?: unknown }) {
    super(opciones.mensaje, { cause: opciones.cause });
    this.name = 'RrhhError';
    this.tipo = opciones.tipo;
    this.codigo = opciones.codigo ?? null;
    this.operacion = opciones.operacion;
  }
}

const CODIGOS_SIN_CONEXION = new Set(['P1000', 'P1001', 'P1002', 'P1008', 'P1017', 'P2024']);

/** Código de PostgreSQL dentro de un error de $queryRaw (P2010 / meta.code) */
function codigoPostgres(err: Record<string, unknown>): string | null {
  const meta = err.meta as Record<string, unknown> | undefined;
  const codigo = meta?.code ?? meta?.database_error_code;
  return typeof codigo === 'string' ? codigo : null;
}

/** Clasifica un error de Prisma/PostgreSQL al consultar el esquema rrhh. */
export function errorDesdeBd(err: unknown, operacion: string): RrhhError {
  if (err instanceof RrhhError) return err;

  const e = (err ?? {}) as Record<string, unknown>;
  const nombre = typeof e.name === 'string' ? e.name : '';
  const codigoPrisma = typeof e.code === 'string' ? e.code : typeof e.errorCode === 'string' ? e.errorCode : null;
  const codigoPg = codigoPostgres(e);
  const codigo = codigoPg ?? codigoPrisma;

  if (nombre === 'PrismaClientInitializationError' || (codigoPrisma && CODIGOS_SIN_CONEXION.has(codigoPrisma))) {
    return new RrhhError({ tipo: 'SIN_CONEXION', mensaje: 'No se pudo conectar con la BD para leer RRHH', operacion, codigo, cause: err });
  }
  if (codigoPg === '42501') {
    return new RrhhError({ tipo: 'SIN_PERMISO', mensaje: 'Sin permiso de lectura sobre el esquema rrhh', operacion, codigo, cause: err });
  }
  if (codigoPg === '42P01' || codigoPg === '42703' || codigoPg === '3F000') {
    return new RrhhError({ tipo: 'ESQUEMA_INVALIDO', mensaje: 'El esquema rrhh no tiene la tabla o columna esperada', operacion, codigo, cause: err });
  }
  return new RrhhError({ tipo: 'ERROR_BD', mensaje: 'Error al consultar RRHH', operacion, codigo, cause: err });
}
