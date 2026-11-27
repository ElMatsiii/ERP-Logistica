/**
 * Fecha calendario (YYYY-MM-DD) en la zona horaria local del servidor.
 * Las ausencias de RRHH son por día completo: se compara solo la fecha, sin hora,
 * y de la misma forma en el cliente simulado y en el de BD.
 */
export function fechaCalendario(fecha: Date): string {
  if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) {
    throw new TypeError('Fecha inválida para consultar RRHH');
  }
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/** Devuelve una copia de `fecha` desplazada `dias` días calendario. */
export function sumarDias(fecha: Date, dias: number): Date {
  const copia = new Date(fecha.getTime());
  copia.setDate(copia.getDate() + dias);
  return copia;
}
