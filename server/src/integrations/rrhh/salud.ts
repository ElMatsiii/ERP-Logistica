import { RrhhError } from './errores.js';
import type { ClienteRrhh, EstadoConexionRrhh } from './tipos.js';

export const LIMITE_HEALTH_RRHH_MS = 3000;

/**
 * Estado de RRHH para GET /api/health. Nunca lanza ni se queda esperando:
 * si verificarConexion falla o tarda más de `limiteMs`, responde ok=false con el motivo.
 */
export async function verificarRrhhConLimite(
  cliente: ClienteRrhh,
  limiteMs: number = LIMITE_HEALTH_RRHH_MS
): Promise<EstadoConexionRrhh> {
  const modo = cliente.modo;
  let temporizador: NodeJS.Timeout | undefined;

  const porTiempo = new Promise<EstadoConexionRrhh>((resolve) => {
    temporizador = setTimeout(
      () => resolve({ modo, ok: false, error: `RRHH no respondió en ${limiteMs} ms` }),
      limiteMs
    );
  });

  const verificacion = Promise.resolve()
    .then(() => cliente.verificarConexion())
    .then((estado): EstadoConexionRrhh =>
      estado?.ok === true ? { modo, ok: true } : { modo, ok: false, error: estado?.error || 'RRHH no está disponible' }
    )
    .catch((err: unknown): EstadoConexionRrhh => ({
      modo,
      ok: false,
      // Solo mensajes propios (genéricos); nunca el texto de un error desconocido
      error: err instanceof RrhhError ? err.message : 'Error inesperado al verificar RRHH',
    }));

  try {
    return await Promise.race([verificacion, porTiempo]);
  } finally {
    clearTimeout(temporizador);
  }
}
