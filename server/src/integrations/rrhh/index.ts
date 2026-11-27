import { prisma } from '../../lib/prisma.js';
import { ClienteRrhhBd, type EjecutorSql } from './cliente-bd.js';
import { ClienteRrhhSimulado } from './cliente-simulado.js';
import type { ClienteRrhh } from './tipos.js';

export * from './tipos.js';
export { RrhhError } from './errores.js';
export type { TipoErrorRrhh } from './errores.js';
export { ClienteRrhhBd } from './cliente-bd.js';
export type { EjecutorSql } from './cliente-bd.js';
export { ClienteRrhhSimulado, EMPLEADOS_SIMULADOS } from './cliente-simulado.js';
export { rolLogisticaDesde, traducirRolRrhh, rolesRrhhPara } from './roles.js';

/**
 * Elige el cliente según RRHH_MODO:
 * - bd       -> lee el esquema rrhh de la BD del curso (solo SELECT).
 * - simulado -> datos en memoria, no toca la BD. Es el valor por defecto si la variable
 *               está vacía o no se reconoce.
 */
export function crearClienteRrhh(env: NodeJS.ProcessEnv = process.env, db: EjecutorSql = prisma): ClienteRrhh {
  const modo = env.RRHH_MODO?.trim().toLowerCase() ?? '';

  if (modo === 'bd') {
    console.log('[RRHH] Modo BD: se lee el esquema rrhh de la BD del curso (solo lectura).');
    return new ClienteRrhhBd(db);
  }

  if (modo !== 'simulado') {
    console.warn(
      modo
        ? `[RRHH] RRHH_MODO="${env.RRHH_MODO}" no es válido (use "bd" o "simulado"): se usa el cliente SIMULADO.`
        : '[RRHH] RRHH_MODO vacío: se usa el cliente SIMULADO (no se lee el esquema rrhh).'
    );
  } else {
    console.log('[RRHH] Modo SIMULADO: empleados de prueba en memoria (no se lee el esquema rrhh).');
  }
  return new ClienteRrhhSimulado();
}

let instancia: ClienteRrhh | null = null;

/**
 * Cliente compartido por el servidor. Se crea en el primer uso (no al importar el módulo),
 * para que ya estén cargadas las variables del .env.
 */
export function obtenerClienteRrhh(): ClienteRrhh {
  if (!instancia) instancia = crearClienteRrhh();
  return instancia;
}

/** Solo para tests: permite inyectar un cliente o volver a leer el entorno. */
export function fijarClienteRrhh(cliente: ClienteRrhh | null): void {
  instancia = cliente;
}
