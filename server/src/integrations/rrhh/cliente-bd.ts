import { Prisma } from '@prisma/client';
import { errorDesdeBd } from './errores.js';
import { fechaCalendario } from './fechas.js';
import type {
  ClienteRrhh,
  CuentaRrhh,
  EmpleadoRrhh,
  EstadoConexionRrhh,
  EstadoEmpleadoRrhh,
  EstadoUsuarioRrhh,
  FiltroEmpleadosRrhh,
} from './tipos.js';

/** Lo único que este cliente necesita de Prisma (inyectable en tests). */
export interface EjecutorSql {
  $queryRaw<T = unknown>(query: Prisma.Sql): PromiseLike<T>;
}

/*
 * REGLAS (docs/INTEGRACION_RRHH.md, sección 5):
 * - Solo SELECT sobre rrhh.*. Logística nunca escribe en el esquema de RRHH.
 * - Siempre Prisma.sql / $queryRaw con valores como parámetros. Nunca $queryRawUnsafe ni concatenar texto.
 * - password_hash solo se lee en las consultas de cuenta (login) y nunca se devuelve en EmpleadoRrhh.
 */

/** Roles del empleado (nombres de rrhh.rol ordenados por id_rol) como text[]. */
const SQL_ROLES = Prisma.sql`
  COALESCE((
    SELECT array_agg(r.nombre::text ORDER BY r.id_rol)
    FROM rrhh.empleado_rol er
    JOIN rrhh.rol r ON r.id_rol = er.id_rol
    WHERE er.id_empleado = e.id_empleado
  ), '{}'::text[])`;

/** Cargo del contrato activo más reciente (contrato → contrato_cargo → cargo). */
const SQL_CARGO = Prisma.sql`(
    SELECT c.nombre::text
    FROM rrhh.contrato ct
    JOIN rrhh.contrato_cargo cc ON cc.id_contrato = ct.id_contrato
    JOIN rrhh.cargo c ON c.id_cargo = cc.id_cargo
    WHERE ct.id_empleado = e.id_empleado AND lower(ct.estado::text) = 'activo'
    ORDER BY ct.fecha_inicio DESC
    LIMIT 1
  )`;

interface FilaCuenta {
  id_empleado: number | bigint;
  rut: string;
  nombre: string;
  apellido: string;
  email: string;
  estado_empleado: unknown;
  estado_usuario: unknown;
  password_hash: string | null;
  roles: string[] | null;
}

interface FilaEmpleado {
  id_empleado: number | bigint;
  rut: string;
  nombre: string;
  apellido: string;
  email: string | null;
  estado: unknown;
  roles: string[] | null;
  cargo: string | null;
}

/**
 * Cliente de RRHH que lee directamente el esquema `rrhh` de la BD del curso (RRHH_MODO=bd).
 * No depende de que el backend de RRHH esté levantado.
 */
export class ClienteRrhhBd implements ClienteRrhh {
  readonly modo = 'bd' as const;

  constructor(private readonly db: EjecutorSql) {}

  /** Comprueba la conexión leyendo rrhh.rol (sin datos sensibles; nunca rrhh.usuario). */
  async verificarConexion(): Promise<EstadoConexionRrhh> {
    try {
      await this.consultar(Prisma.sql`SELECT 1 AS ok FROM rrhh.rol LIMIT 1`, 'verificarConexion');
      return { modo: this.modo, ok: true };
    } catch (err) {
      return { modo: this.modo, ok: false, error: (err as Error).message };
    }
  }

  async buscarCuentaPorEmail(email: string): Promise<CuentaRrhh | null> {
    const buscado = typeof email === 'string' ? email.trim() : '';
    if (!buscado) return null;
    return this.buscarCuenta(Prisma.sql`lower(e.email) = lower(${buscado})`, 'buscarCuentaPorEmail');
  }

  async buscarCuentaPorId(idEmpleado: number): Promise<CuentaRrhh | null> {
    if (!esIdValido(idEmpleado)) return null;
    return this.buscarCuenta(Prisma.sql`e.id_empleado = ${idEmpleado}`, 'buscarCuentaPorId');
  }

  async obtenerEmpleado(idEmpleado: number): Promise<EmpleadoRrhh | null> {
    if (!esIdValido(idEmpleado)) return null;
    const filas = await this.consultar<FilaEmpleado[]>(
      Prisma.sql`
        SELECT e.id_empleado, e.rut, e.nombre, e.apellido, e.email, e.estado,
               ${SQL_ROLES} AS roles,
               ${SQL_CARGO} AS cargo
        FROM rrhh.empleado e
        WHERE e.id_empleado = ${idEmpleado}`,
      'obtenerEmpleado'
    );
    return filas[0] ? aEmpleado(filas[0]) : null;
  }

  async listarEmpleados(filtro: FiltroEmpleadosRrhh = {}): Promise<EmpleadoRrhh[]> {
    const rol = filtro.rol?.trim() || null;
    const soloActivos = filtro.soloActivos === true;
    const filas = await this.consultar<FilaEmpleado[]>(
      Prisma.sql`
        SELECT e.id_empleado, e.rut, e.nombre, e.apellido, e.email, e.estado,
               ${SQL_ROLES} AS roles,
               ${SQL_CARGO} AS cargo
        FROM rrhh.empleado e
        WHERE (${soloActivos}::boolean = false OR lower(e.estado::text) = 'activo')
          AND (${rol}::text IS NULL OR EXISTS (
            SELECT 1 FROM rrhh.empleado_rol er
            JOIN rrhh.rol r ON r.id_rol = er.id_rol
            WHERE er.id_empleado = e.id_empleado AND lower(r.nombre::text) = lower(${rol}::text)
          ))
        ORDER BY e.id_empleado`,
      'listarEmpleados'
    );
    return filas.map(aEmpleado);
  }

  async estaAusente(idEmpleado: number, fecha: Date): Promise<boolean> {
    const dia = fechaCalendario(fecha); // lanza TypeError si la fecha es inválida
    if (!esIdValido(idEmpleado)) return false;
    const filas = await this.consultar<{ ausente: boolean }[]>(
      Prisma.sql`
        SELECT EXISTS (
          SELECT 1 FROM rrhh.solicitud_ausencia sa
          WHERE sa.id_empleado = ${idEmpleado}
            AND lower(sa.estado::text) IN ('aprobada', 'en_curso')
            AND ${dia}::date BETWEEN sa.fecha_inicio::date AND sa.fecha_fin::date
        ) AS ausente`,
      'estaAusente'
    );
    return filas[0]?.ausente === true;
  }

  private async buscarCuenta(condicion: Prisma.Sql, operacion: string): Promise<CuentaRrhh | null> {
    const filas = await this.consultar<FilaCuenta[]>(
      Prisma.sql`
        SELECT e.id_empleado, e.rut, e.nombre, e.apellido, e.email,
               e.estado AS estado_empleado, u.estado AS estado_usuario, u.password_hash,
               ${SQL_ROLES} AS roles
        FROM rrhh.usuario u
        JOIN rrhh.empleado e ON e.id_empleado = u.id_empleado
        WHERE ${condicion}
        ORDER BY e.id_empleado
        LIMIT 1`,
      operacion
    );
    return filas[0] ? aCuenta(filas[0]) : null;
  }

  private async consultar<T>(sql: Prisma.Sql, operacion: string): Promise<T> {
    try {
      return await this.db.$queryRaw<T>(sql);
    } catch (err) {
      throw errorDesdeBd(err, operacion);
    }
  }
}

function esIdValido(id: number): boolean {
  return Number.isSafeInteger(id) && id > 0;
}

function texto(valor: unknown): string {
  return String(valor ?? '').trim().toLowerCase();
}

/** Estados desconocidos se tratan como no activos: ante la duda, no se da acceso. */
export function normalizarEstadoEmpleado(valor: unknown): EstadoEmpleadoRrhh {
  return valor === true || texto(valor) === 'activo' ? 'activo' : 'inactivo';
}

export function normalizarEstadoUsuario(valor: unknown): EstadoUsuarioRrhh {
  if (valor === true) return 'activo';
  const t = texto(valor);
  if (t === 'activo') return 'activo';
  if (t === 'bloqueado') return 'bloqueado';
  return 'inactivo';
}

function aCuenta(f: FilaCuenta): CuentaRrhh {
  return {
    id_empleado: Number(f.id_empleado),
    rut: f.rut,
    nombre: f.nombre,
    apellido: f.apellido,
    email: f.email,
    estado_empleado: normalizarEstadoEmpleado(f.estado_empleado),
    estado_usuario: normalizarEstadoUsuario(f.estado_usuario),
    // Sin hash = no puede iniciar sesión (bcrypt.compare contra '' siempre falla)
    password_hash: f.password_hash ?? '',
    roles: f.roles ?? [],
  };
}

function aEmpleado(f: FilaEmpleado): EmpleadoRrhh {
  return {
    id_empleado: Number(f.id_empleado),
    rut: f.rut,
    nombre: f.nombre,
    apellido: f.apellido,
    email: f.email,
    estado: texto(f.estado),
    roles: f.roles ?? [],
    cargo: f.cargo,
  };
}
