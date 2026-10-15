/**
 * Lógica de dominio pura y desacoplada para cálculos de cubicación y tarificación.
 * LesGo ERP - Módulo de Logística y Transporte
 */

export interface BultoInput {
  largo_cm: number;
  alto_cm: number;
  ancho_cm: number;
  peso_real_kg: number;
}

export interface BultoCubicado extends BultoInput {
  peso_volumetrico_kg: number;
  peso_a_cobrar_kg: number;
}

export interface ResultadoCubicacionTotal {
  bultos: BultoCubicado[];
  peso_real_total_kg: number;
  peso_volumetrico_total_kg: number;
  peso_cobrado_total_kg: number;
  factor_volumetrico_aplicado: number;
}

export interface TarifaRegla {
  peso_desde_kg: number;
  peso_hasta_kg: number;
  precio_base: number;
  precio_kg_adicional: number;
}

/**
 * Valida que una dimensión o peso sea estrictamente mayor a 0.
 */
export function validarDimensionesBulto(bulto: BultoInput): { valido: boolean; error?: string } {
  if (bulto.largo_cm <= 0 || bulto.alto_cm <= 0 || bulto.ancho_cm <= 0) {
    return {
      valido: false,
      error: 'El largo, alto y ancho del bulto deben ser estrictamente mayores a 0 cm.',
    };
  }
  if (bulto.peso_real_kg <= 0) {
    return {
      valido: false,
      error: 'El peso real del bulto debe ser estrictamente mayor a 0 kg.',
    };
  }
  return { valido: true };
}

/**
 * Calcula el peso volumétrico para un bulto individual:
 * Peso Volumétrico = (Largo * Alto * Ancho) / Factor Volumétrico
 */
export function calcularPesoVolumetrico(
  largo_cm: number,
  alto_cm: number,
  ancho_cm: number,
  factor_volumetrico: number = 5000
): number {
  if (factor_volumetrico <= 0) {
    throw new Error('El factor volumétrico debe ser mayor a 0.');
  }
  const volumen_cm3 = largo_cm * alto_cm * ancho_cm;
  const peso_vol = volumen_cm3 / factor_volumetrico;
  return Number(peso_vol.toFixed(2));
}

/**
 * Determina el peso a cobrar (el mayor entre peso real y peso volumétrico).
 */
export function determinarPesoCobrado(peso_real_kg: number, peso_volumetrico_kg: number): number {
  return Number(Math.max(peso_real_kg, peso_volumetrico_kg).toFixed(2));
}

/**
 * Cubica una lista de bultos y calcula los totales agregados.
 */
export function cubicarBultos(
  bultos: BultoInput[],
  factor_volumetrico: number = 5000
): ResultadoCubicacionTotal {
  if (!bultos || bultos.length === 0) {
    throw new Error('Debe proporcionar al menos un bulto para realizar la cubicación.');
  }

  const bultosCubicados: BultoCubicado[] = bultos.map((b) => {
    const validacion = validarDimensionesBulto(b);
    if (!validacion.valido) {
      throw new Error(validacion.error);
    }

    const peso_volumetrico_kg = calcularPesoVolumetrico(
      b.largo_cm,
      b.alto_cm,
      b.ancho_cm,
      factor_volumetrico
    );

    const peso_a_cobrar_kg = determinarPesoCobrado(b.peso_real_kg, peso_volumetrico_kg);

    return {
      ...b,
      peso_volumetrico_kg,
      peso_a_cobrar_kg,
    };
  });

  const peso_real_total_kg = Number(
    bultosCubicados.reduce((acc, curr) => acc + curr.peso_real_kg, 0).toFixed(2)
  );

  const peso_volumetrico_total_kg = Number(
    bultosCubicados.reduce((acc, curr) => acc + curr.peso_volumetrico_kg, 0).toFixed(2)
  );

  const peso_cobrado_total_kg = Number(
    Math.max(peso_real_total_kg, peso_volumetrico_total_kg).toFixed(2)
  );

  return {
    bultos: bultosCubicados,
    peso_real_total_kg,
    peso_volumetrico_total_kg,
    peso_cobrado_total_kg,
    factor_volumetrico_aplicado: factor_volumetrico,
  };
}

/**
 * Calcula el costo de envío basado en el peso cobrado y las reglas tarifarias.
 */
export function calcularCostoEnvio(
  peso_cobrado_kg: number,
  tarifa?: TarifaRegla | null
): number {
  if (!tarifa) {
    // Tarifa base de estimación por defecto si no hay regla específica registrada
    const BASE_DEFAULT = 4500;
    const ADICIONAL_KG_DEFAULT = 1100;
    if (peso_cobrado_kg <= 2) {
      return BASE_DEFAULT;
    }
    const extraKg = Math.ceil(peso_cobrado_kg - 2);
    return BASE_DEFAULT + extraKg * ADICIONAL_KG_DEFAULT;
  }

  const { peso_hasta_kg, precio_base, precio_kg_adicional } = tarifa;

  if (peso_cobrado_kg <= peso_hasta_kg) {
    return Number(precio_base);
  }

  const kgExcedentes = Math.ceil(peso_cobrado_kg - peso_hasta_kg);
  const costoTotal = Number(precio_base) + kgExcedentes * Number(precio_kg_adicional);
  return Math.round(costoTotal);
}

/**
 * Genera un código de seguimiento con formato estándar de la empresa.
 * Ej: CHX-2026-98124, STK-2026-44123
 */
export function generarNumeroSeguimiento(transportistaNombre: string): string {
  const prefijo = transportistaNombre.toUpperCase().includes('CHILE')
    ? 'CHX'
    : transportistaNombre.toUpperCase().includes('STARKEN')
    ? 'STK'
    : transportistaNombre.toUpperCase().includes('BLUE')
    ? 'BLU'
    : 'LES';

  const randomNum = Math.floor(100000 + Math.random() * 900000);
  return `${prefijo}-2026-${randomNum}`;
}

/**
 * Genera el ID de guía único de despacho (ej: GD-52341).
 */
export function generarIdGuia(): string {
  const randomNum = Math.floor(52000 + Math.random() * 8000);
  return `GD-${randomNum}`;
}
