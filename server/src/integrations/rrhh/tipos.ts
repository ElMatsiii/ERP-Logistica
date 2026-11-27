/**
 * Tipos de la integración con RRHH (repo Pabluntt/Lesgo-RRHH).
 * Reflejan las tablas reales del esquema `rrhh` de la BD del curso, que Logística solo lee.
 */

export type ModoRrhh = 'bd' | 'simulado';

export type EstadoEmpleadoRrhh = 'activo' | 'inactivo';
export type EstadoUsuarioRrhh = 'activo' | 'inactivo' | 'bloqueado';

/**
 * Cuenta de acceso: rrhh.usuario + rrhh.empleado + roles (rrhh.empleado_rol / rrhh.rol).
 * Se usa solo para autenticar dentro del servidor.
 */
export interface CuentaRrhh {
  id_empleado: number;
  rut: string;
  nombre: string;
  apellido: string;
  email: string;
  estado_empleado: EstadoEmpleadoRrhh;
  estado_usuario: EstadoUsuarioRrhh;
  /** Hash bcrypt de RRHH. Nunca sale del servidor: no se devuelve en respuestas ni se registra en logs. */
  password_hash: string;
  /** Nombres de rrhh.rol, ordenados por id_rol */
  roles: string[];
}

/** Datos públicos de un empleado (sin credenciales). */
export interface EmpleadoRrhh {
  id_empleado: number;
  rut: string;
  nombre: string;
  apellido: string;
  email: string | null;
  estado: string;
  /** Nombres de rrhh.rol, ordenados por id_rol */
  roles: string[];
  /** Cargo vigente (contrato activo → contrato_cargo → cargo), si existe */
  cargo: string | null;
}

export interface FiltroEmpleadosRrhh {
  /** Nombre de rol en RRHH (p. ej. 'LOG_DESPACHO'); sin distinguir mayúsculas */
  rol?: string;
  soloActivos?: boolean;
}

export interface EstadoConexionRrhh {
  modo: ModoRrhh;
  ok: boolean;
  error?: string;
}

export interface ClienteRrhh {
  readonly modo: ModoRrhh;
  verificarConexion(): Promise<EstadoConexionRrhh>;
  buscarCuentaPorEmail(email: string): Promise<CuentaRrhh | null>;
  buscarCuentaPorId(idEmpleado: number): Promise<CuentaRrhh | null>;
  obtenerEmpleado(idEmpleado: number): Promise<EmpleadoRrhh | null>;
  listarEmpleados(filtro?: FiltroEmpleadosRrhh): Promise<EmpleadoRrhh[]>;
  /** true si el empleado tiene una ausencia aprobada o en curso que cubre `fecha` */
  estaAusente(idEmpleado: number, fecha: Date): Promise<boolean>;
}
