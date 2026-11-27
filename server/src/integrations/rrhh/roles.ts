import type { RolLogistica } from '../../types/auth.types.js';

/**
 * Traducción de roles de RRHH (rrhh.rol.nombre) a roles internos de Logística.
 *
 * ÚNICO lugar donde viven los nombres de rol de RRHH. Los nombres LOG_* son una propuesta:
 * cuando RRHH confirme los nombres reales, basta con editar este mapa.
 * La comparación no distingue mayúsculas ni espacios al inicio o al final.
 */
export const MAPA_ROLES_RRHH: Readonly<Record<string, RolLogistica>> = {
  LOG_COORDINADOR: 'COORDINADOR_LOGISTICA',
  LOG_DESPACHO: 'OPERADOR_DESPACHO',
  LOG_RECEPCION: 'OPERADOR_RECEPCION',
  // Rol global del ERP
  Administrador: 'COORDINADOR_LOGISTICA',
};

/** Si un empleado tiene varios roles de Logística, gana el primero de esta lista. */
export const PRIORIDAD_ROLES: readonly RolLogistica[] = [
  'COORDINADOR_LOGISTICA',
  'OPERADOR_DESPACHO',
  'OPERADOR_RECEPCION',
];

const normalizar = (nombre: string) => nombre.trim().toLowerCase();

const MAPA_NORMALIZADO = new Map<string, RolLogistica>(
  Object.entries(MAPA_ROLES_RRHH).map(([nombre, rol]) => [normalizar(nombre), rol])
);

/** Rol interno para un único nombre de rol de RRHH, o null si no da acceso a Logística. */
export function traducirRolRrhh(nombreRol: string): RolLogistica | null {
  if (typeof nombreRol !== 'string') return null;
  return MAPA_NORMALIZADO.get(normalizar(nombreRol)) ?? null;
}

/**
 * Rol de Logística de mayor privilegio entre los roles de RRHH del empleado.
 * Devuelve null si ninguno da acceso al módulo (el login debe responder 403).
 */
export function rolLogisticaDesde(roles: readonly string[] | null | undefined): RolLogistica | null {
  if (!roles || roles.length === 0) return null;
  const traducidos = new Set(
    roles.map(traducirRolRrhh).filter((r): r is RolLogistica => r !== null)
  );
  return PRIORIDAD_ROLES.find((r) => traducidos.has(r)) ?? null;
}

/** Nombres de rol de RRHH que se traducen a un rol interno dado (útil para filtrar empleados). */
export function rolesRrhhPara(rol: RolLogistica): string[] {
  return Object.entries(MAPA_ROLES_RRHH)
    .filter(([, interno]) => interno === rol)
    .map(([nombre]) => nombre);
}
