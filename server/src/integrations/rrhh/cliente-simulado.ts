import { fechaCalendario, sumarDias } from './fechas.js';
import type {
  ClienteRrhh,
  CuentaRrhh,
  EmpleadoRrhh,
  EstadoConexionRrhh,
  EstadoEmpleadoRrhh,
  EstadoUsuarioRrhh,
  FiltroEmpleadosRrhh,
} from './tipos.js';

/** Empleado de prueba: rrhh.empleado + rrhh.usuario (opcional) + roles + cargo vigente. */
export interface EmpleadoSimulado {
  id_empleado: number;
  rut: string;
  nombre: string;
  apellido: string;
  email: string | null;
  estado: EstadoEmpleadoRrhh;
  cargo: string | null;
  /** Nombres de rrhh.rol, en orden de id_rol */
  roles: string[];
  /** Sin usuario = el empleado existe pero no puede iniciar sesión */
  usuario?: { estado: EstadoUsuarioRrhh; password_hash: string };
}

/** Fila de rrhh.solicitud_ausencia (fechas YYYY-MM-DD, ambas inclusive). */
export interface AusenciaSimulada {
  id_empleado: number;
  estado: 'pendiente' | 'aprobada' | 'en_curso' | 'rechazada';
  fecha_inicio: string;
  fecha_fin: string;
}

/** Estados de solicitud_ausencia que cuentan como ausencia (igual que en el cliente de BD). */
export const ESTADOS_AUSENCIA_VIGENTE: readonly AusenciaSimulada['estado'][] = ['aprobada', 'en_curso'];

/**
 * Hash de relleno: no corresponde a ninguna contraseña, así que ninguna cuenta simulada
 * puede iniciar sesión todavía. Se reemplaza por hashes bcrypt reales en la Fase 2.
 */
export const HASH_SIMULADO = '$simulado$sin-contrasena';

/**
 * IDs de los empleados de prueba, para usarlos en tests sin repetir números.
 * 301, 304 y 305 coinciden con USUARIOS_LOGISTICA (auth.service.ts) y con los datos de prueba existentes.
 */
export const EMPLEADOS_SIMULADOS = {
  COORDINADOR: 305,
  DESPACHO: 301,
  RECEPCION: 304,
  ADMINISTRADOR_ERP: 310,
  DESPACHO_AUSENTE: 302,
  VARIOS_ROLES: 303,
  BLOQUEADO: 311,
  INACTIVO: 312,
  SIN_ROL_LOGISTICA: 313,
  SIN_USUARIO: 314,
} as const;

const E = EMPLEADOS_SIMULADOS;
const activo = { estado: 'activo' as const, password_hash: HASH_SIMULADO };

export function empleadosSimuladosPorDefecto(): EmpleadoSimulado[] {
  return [
    {
      id_empleado: E.DESPACHO, rut: '15.432.908-2', nombre: 'Carlos', apellido: 'Gómez',
      email: 'cgomez@lesgo.test', estado: 'activo', cargo: 'Encargado de Despacho e-Commerce',
      roles: ['LOG_DESPACHO'], usuario: { ...activo },
    },
    {
      id_empleado: E.DESPACHO_AUSENTE, rut: '16.204.551-8', nombre: 'Valentina', apellido: 'Rojas',
      email: 'vrojas@lesgo.test', estado: 'activo', cargo: 'Operadora de Picking',
      roles: ['LOG_DESPACHO'], usuario: { ...activo },
    },
    {
      id_empleado: E.VARIOS_ROLES, rut: '18.553.120-4', nombre: 'Javiera', apellido: 'Muñoz',
      email: 'jmunoz@lesgo.test', estado: 'activo', cargo: 'Operadora Logística Polivalente',
      roles: ['Asistente', 'LOG_DESPACHO', 'LOG_RECEPCION'], usuario: { ...activo },
    },
    {
      id_empleado: E.RECEPCION, rut: '14.981.452-3', nombre: 'Esteban', apellido: 'Paredes',
      email: 'eparedes@lesgo.test', estado: 'activo', cargo: 'Encargado de Recepción en Muelle',
      roles: ['LOG_RECEPCION'], usuario: { ...activo },
    },
    {
      id_empleado: E.COORDINADOR, rut: '17.892.341-5', nombre: 'Maximiliano', apellido: 'Pizarro',
      email: 'mpizarro@lesgo.test', estado: 'activo', cargo: 'Coordinador General de Logística',
      roles: ['LOG_COORDINADOR'], usuario: { ...activo },
    },
    {
      id_empleado: E.ADMINISTRADOR_ERP, rut: '12.345.678-5', nombre: 'Andrea', apellido: 'Soto',
      email: 'asoto@lesgo.test', estado: 'activo', cargo: 'Administradora del ERP',
      roles: ['Administrador'], usuario: { ...activo },
    },
    {
      id_empleado: E.BLOQUEADO, rut: '19.876.543-1', nombre: 'Diego', apellido: 'Fuentes',
      email: 'dfuentes@lesgo.test', estado: 'activo', cargo: 'Operador de Picking',
      roles: ['LOG_DESPACHO'], usuario: { estado: 'bloqueado', password_hash: HASH_SIMULADO },
    },
    {
      id_empleado: E.INACTIVO, rut: '13.579.246-0', nombre: 'Patricio', apellido: 'Vera',
      email: 'pvera@lesgo.test', estado: 'inactivo', cargo: null,
      roles: ['LOG_RECEPCION'], usuario: { ...activo },
    },
    {
      id_empleado: E.SIN_ROL_LOGISTICA, rut: '16.789.012-3', nombre: 'Camila', apellido: 'Herrera',
      email: 'cherrera@lesgo.test', estado: 'activo', cargo: 'Ejecutiva Comercial',
      roles: ['CRM_EJECUTIVO'], usuario: { ...activo },
    },
    {
      id_empleado: E.SIN_USUARIO, rut: '20.111.222-6', nombre: 'Tomás', apellido: 'Lagos',
      email: null, estado: 'activo', cargo: 'Bodeguero',
      roles: ['LOG_DESPACHO'],
    },
  ];
}

/** Ausencias relativas a `hoy`, para que el caso "ausente hoy" no caduque. */
export function ausenciasSimuladasPorDefecto(hoy: Date): AusenciaSimulada[] {
  const f = (dias: number) => fechaCalendario(sumarDias(hoy, dias));
  return [
    // Vigente hoy
    { id_empleado: E.DESPACHO_AUSENTE, estado: 'aprobada', fecha_inicio: f(-1), fecha_fin: f(3) },
    // Ya terminó: no cuenta
    { id_empleado: E.DESPACHO, estado: 'aprobada', fecha_inicio: f(-20), fecha_fin: f(-10) },
    // Cubre hoy, pero no está aprobada: no cuenta
    { id_empleado: E.RECEPCION, estado: 'pendiente', fecha_inicio: f(0), fecha_fin: f(2) },
    { id_empleado: E.VARIOS_ROLES, estado: 'rechazada', fecha_inicio: f(-1), fecha_fin: f(1) },
  ];
}

export interface OpcionesClienteSimulado {
  empleados?: EmpleadoSimulado[];
  ausencias?: AusenciaSimulada[];
  /** Fecha de referencia para las ausencias por defecto (inyectable en tests) */
  hoy?: Date;
}

/**
 * Cliente de RRHH en memoria (RRHH_MODO=simulado). No toca la BD: sirve para desarrollo y tests
 * mientras RRHH crea los roles y las cuentas de Logística. Devuelve copias, para que quien llama
 * no pueda alterar los datos de prueba.
 */
export class ClienteRrhhSimulado implements ClienteRrhh {
  readonly modo = 'simulado' as const;
  private readonly empleados: EmpleadoSimulado[];
  private readonly ausencias: AusenciaSimulada[];

  constructor(opciones: OpcionesClienteSimulado = {}) {
    this.empleados = structuredClone(opciones.empleados ?? empleadosSimuladosPorDefecto());
    this.ausencias = structuredClone(opciones.ausencias ?? ausenciasSimuladasPorDefecto(opciones.hoy ?? new Date()));
  }

  async verificarConexion(): Promise<EstadoConexionRrhh> {
    return { modo: this.modo, ok: true };
  }

  async buscarCuentaPorEmail(email: string): Promise<CuentaRrhh | null> {
    const buscado = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!buscado) return null;
    const empleado = this.empleados.find((e) => e.email?.toLowerCase() === buscado);
    return empleado ? aCuenta(empleado) : null;
  }

  async buscarCuentaPorId(idEmpleado: number): Promise<CuentaRrhh | null> {
    const empleado = this.empleados.find((e) => e.id_empleado === idEmpleado);
    return empleado ? aCuenta(empleado) : null;
  }

  async obtenerEmpleado(idEmpleado: number): Promise<EmpleadoRrhh | null> {
    const empleado = this.empleados.find((e) => e.id_empleado === idEmpleado);
    return empleado ? aEmpleado(empleado) : null;
  }

  async listarEmpleados(filtro: FiltroEmpleadosRrhh = {}): Promise<EmpleadoRrhh[]> {
    const rol = filtro.rol?.trim().toLowerCase();
    return this.empleados
      .filter((e) => !filtro.soloActivos || e.estado === 'activo')
      .filter((e) => !rol || e.roles.some((r) => r.toLowerCase() === rol))
      .sort((a, b) => a.id_empleado - b.id_empleado)
      .map(aEmpleado);
  }

  async estaAusente(idEmpleado: number, fecha: Date): Promise<boolean> {
    const dia = fechaCalendario(fecha);
    return this.ausencias.some(
      (a) =>
        a.id_empleado === idEmpleado &&
        ESTADOS_AUSENCIA_VIGENTE.includes(a.estado) &&
        a.fecha_inicio <= dia &&
        dia <= a.fecha_fin
    );
  }
}

/** Solo empleados con usuario y email tienen cuenta (el login de RRHH es por email). */
function aCuenta(e: EmpleadoSimulado): CuentaRrhh | null {
  if (!e.usuario || !e.email) return null;
  return {
    id_empleado: e.id_empleado,
    rut: e.rut,
    nombre: e.nombre,
    apellido: e.apellido,
    email: e.email,
    estado_empleado: e.estado,
    estado_usuario: e.usuario.estado,
    password_hash: e.usuario.password_hash,
    roles: [...e.roles],
  };
}

/** Datos públicos: nunca incluye password_hash ni el estado del usuario. */
function aEmpleado(e: EmpleadoSimulado): EmpleadoRrhh {
  return {
    id_empleado: e.id_empleado,
    rut: e.rut,
    nombre: e.nombre,
    apellido: e.apellido,
    email: e.email,
    estado: e.estado,
    roles: [...e.roles],
    cargo: e.cargo,
  };
}
