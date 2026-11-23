import {
  LogisticaRepository,
  FiltrosTracking,
  EmisionGuiaData,
  RecepcionData,
} from '../repositories/logistica.repository.js';
import {
  cubicarBultos,
  calcularCostoEnvio,
  generarNumeroSeguimiento,
  generarIdGuia,
  validarDimensionesBulto,
  evaluarRecepcionOc,
  BultoInput,
  LineaRecepcionInput,
} from '../domain/cubicacion.js';
import { EstadoOT } from '@prisma/client';
import {
  obtenerClienteInventario,
  InventarioError,
  type ClienteInventario,
  type LineaDespachoInventario,
} from '../integrations/inventario/index.js';

/** Estados que asigna el sistema mientras Inventario confirma el egreso de stock */
export const ESTADO_PENDIENTE_STOCK = 'Pendiente de stock';
export const ESTADO_ERROR_STOCK = 'Error de stock';
export const ESTADO_PREPARADO = 'Preparado';
const ESTADOS_STOCK = [ESTADO_PENDIENTE_STOCK, ESTADO_ERROR_STOCK];

/** Resultado de pedirle a Inventario que confirme el egreso de una guía */
export interface ConfirmacionStock {
  ok: boolean;
  id_movimiento_egreso?: number;
  id_movimiento_liberacion?: number | null;
  error?: string;
  tipo_error?: string;
  reintentable?: boolean;
}

export class ValidationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 422) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = statusCode;
  }
}

/**
 * Convierte un error de Inventario en una respuesta para nuestro cliente:
 * 503 si Inventario no está disponible (reintentar más tarde) y 502 si respondió con error.
 */
function errorDeInventario(err: unknown, accion: string): Error {
  if (!(err instanceof InventarioError)) return err as Error;
  if (err.reintentable) {
    return new ValidationError(`Inventario no está disponible para ${accion}: ${err.message}. Intente más tarde.`, 503);
  }
  if (err.tipo === 'NO_AUTORIZADO') {
    return new ValidationError(`Inventario rechazó la API key de Logística al ${accion}. Revise INVENTARIO_API_KEY.`, 502);
  }
  // Datos que Inventario no reconoce (producto o bodega) o en conflicto con lo ya registrado
  if (err.tipo === 'NO_ENCONTRADO') {
    return new ValidationError(`Inventario no reconoce los datos al ${accion}: ${err.message}`, 422);
  }
  if (err.tipo === 'CONFLICTO') {
    return new ValidationError(`Inventario rechazó la operación al ${accion}: ${err.message}`, 409);
  }
  return new ValidationError(`Inventario respondió un error al ${accion}: ${err.message}`, 502);
}

export interface EmitirGuiaRequest {
  ot_id: string;
  transportista_id: number;
  servicio_id: number;
  bultos: BultoInput[];
  usuario_responsable?: string;
}

export interface CotizarRequest {
  ot_id: string;
  transportista_id: number;
  servicio_id: number;
  bultos: BultoInput[];
}

export interface LineaRecepcionRequest extends LineaRecepcionInput {
  /** Bodega de Inventario donde entran las unidades aptas (obligatoria si hay aptas) */
  id_bodega?: number | null;
}

export interface RegistrarRecepcionRequest {
  id_oc: number;
  /** Receptor en muelle (rrhh.empleado). Obligatorio. */
  id_empleado_receptor?: number;
  /** N° de la guía de despacho del proveedor. Obligatorio; una vez por OC. */
  nro_guia_proveedor?: string;
  observacion?: string;
  lineas: LineaRecepcionRequest[];
}

/** Resultado del ingreso de stock en Inventario para una recepción */
export interface IngresoInventario {
  registrado: boolean;
  id_movimiento_ingreso?: number;
  /** Por qué no se envió a Inventario (p. ej. todas las unidades llegaron dañadas) */
  motivo?: string;
}

/** Datos del maestro de productos de Inventario que usa Logística */
export interface FichaProducto {
  sku: string;
  nombre_set: string;
  peso_unitario_kg: number | null;
  largo_cm: number | null;
  alto_cm: number | null;
  ancho_cm: number | null;
}

export interface ResultadoFichas {
  fichas: Map<number, FichaProducto>;
  /** Productos que Inventario no entregó */
  faltantes: number[];
  /** Motivo si Inventario no respondió (no se informa cuando el producto simplemente no existe) */
  error?: string;
}

const TTL_FICHAS_MS = 5 * 60 * 1000;

function aNumeroONulo(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

export class LogisticaService {
  private repository: LogisticaRepository;
  private inventarioInyectado?: ClienteInventario;
  private cacheFichas = new Map<number, { ficha: FichaProducto; expira: number }>();

  constructor(repository?: LogisticaRepository, inventario?: ClienteInventario) {
    this.repository = repository || new LogisticaRepository();
    this.inventarioInyectado = inventario;
  }

  /** Cliente de Inventario (real o simulado según INVENTARIO_API_URL); inyectable en tests */
  private get inventario(): ClienteInventario {
    return this.inventarioInyectado ?? obtenerClienteInventario();
  }

  /**
   * Obtiene las órdenes de trabajo disponibles y su estado.
   */
  async getPedidosPendientes() {
    return this.repository.getPedidosPendientes();
  }

  /**
   * Obtiene el detalle completo de una OT, sugiriendo dimensiones y peso estimado.
   */
  async getOtById(id: string) {
    const ot = await this.repository.getOtById(id);
    if (!ot) {
      throw new ValidationError(`La orden de trabajo ${id} no existe`, 404);
    }

    // Peso y medidas de cada producto desde el maestro de Inventario (GET /productos/:id)
    const { fichas, faltantes, error } = await this.obtenerFichasProducto(
      (ot.detalles || []).map((d: any) => d.id_producto)
    );
    const detalles = (ot.detalles || []).map((d: any) => {
      const ficha = fichas.get(d.id_producto);
      return ficha
        ? {
            ...d,
            peso_unitario_kg: ficha.peso_unitario_kg,
            largo_cm: ficha.largo_cm,
            alto_cm: ficha.alto_cm,
            ancho_cm: ficha.ancho_cm,
          }
        : d;
    });

    // Calcular dimensiones sugeridas basadas en los productos del pedido
    let pesoSugerido = 0;
    let maxLargo = 25;
    let maxAlto = 20;
    let maxAncho = 15;

    // En una OT PARCIAL se despacha solo lo recolectado; en las demás, lo solicitado
    const unidades = (d: any) =>
      Number(ot.estado === EstadoOT.PARCIAL ? d.cant_recolectada ?? 0 : d.cant_solicitada) || 0;
    const aEmpacar = detalles.filter((d: any) => unidades(d) > 0);

    if (aEmpacar.length > 0) {
      pesoSugerido = aEmpacar.reduce((acc: number, curr: any) => {
        // 1.5 kg por unidad solo si Inventario no entregó el peso (se informa en fichas_inventario)
        const peso = Number(curr.peso_unitario_kg || 1.5) * unidades(curr);
        return acc + peso;
      }, 0);

      aEmpacar.forEach((item: any) => {
        if (item.largo_cm && Number(item.largo_cm) > maxLargo) maxLargo = Number(item.largo_cm);
        if (item.alto_cm && Number(item.alto_cm) > maxAlto) maxAlto = Number(item.alto_cm);
        if (item.ancho_cm && Number(item.ancho_cm) > maxAncho) maxAncho = Number(item.ancho_cm);
      });
    }

    return {
      ...ot,
      detalles,
      empaque_sugerido: {
        largo_cm: Number(maxLargo.toFixed(1)),
        alto_cm: Number(maxAlto.toFixed(1)),
        ancho_cm: Number(maxAncho.toFixed(1)),
        peso_real_kg: Number(pesoSugerido.toFixed(2)) || 2.5,
      },
      // Si faltan productos, el empaque sugerido es estimado y conviene medir la caja
      fichas_inventario: { completas: faltantes.length === 0, faltantes, error },
    };
  }

  /**
   * Peso, medidas, SKU y nombre de los productos desde el maestro de Inventario.
   * Consulta en paralelo y guarda 5 minutos lo encontrado. Un producto que Inventario
   * no entrega (no existe o Inventario no responde) queda en `faltantes`.
   */
  async obtenerFichasProducto(ids: number[]): Promise<ResultadoFichas> {
    const fichas = new Map<number, FichaProducto>();
    const faltantes: number[] = [];
    let error: string | undefined;
    const ahora = Date.now();

    const unicos = [...new Set(ids.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    const porConsultar = unicos.filter((id) => {
      const enCache = this.cacheFichas.get(id);
      if (enCache && enCache.expira > ahora) {
        fichas.set(id, enCache.ficha);
        return false;
      }
      return true;
    });

    const resultados = await Promise.allSettled(porConsultar.map((id) => this.inventario.obtenerProducto(id)));
    resultados.forEach((resultado, i) => {
      const id = porConsultar[i];
      if (resultado.status === 'fulfilled') {
        const p = resultado.value;
        const ficha: FichaProducto = {
          sku: p.sku,
          nombre_set: p.nombre_set,
          peso_unitario_kg: aNumeroONulo(p.peso_unitario_kg),
          largo_cm: aNumeroONulo(p.largo_cm),
          alto_cm: aNumeroONulo(p.alto_cm),
          ancho_cm: aNumeroONulo(p.ancho_cm),
        };
        fichas.set(id, ficha);
        this.cacheFichas.set(id, { ficha, expira: ahora + TTL_FICHAS_MS });
      } else {
        faltantes.push(id);
        const err = resultado.reason;
        if (!(err instanceof InventarioError && err.tipo === 'NO_ENCONTRADO')) {
          error = err instanceof Error ? err.message : String(err);
        }
      }
    });

    return { fichas, faltantes, error };
  }

  /** Completa las líneas de las OC con SKU, nombre y peso desde Inventario (sin valores inventados) */
  private async completarOrdenesCompra(ocs: any[]) {
    const ids = ocs.flatMap((oc) => (oc.detalles || []).map((d: any) => d.id_producto));
    const { fichas } = await this.obtenerFichasProducto(ids);
    return ocs.map((oc) => ({
      ...oc,
      detalles: (oc.detalles || []).map((d: any) => {
        const ficha = fichas.get(d.id_producto);
        return {
          ...d,
          sku: ficha?.sku ?? d.sku ?? null,
          nombre_producto: ficha?.nombre_set ?? d.nombre_producto ?? `Producto #${d.id_producto}`,
          peso_unitario_kg: ficha?.peso_unitario_kg ?? d.peso_unitario_kg ?? null,
        };
      }),
    }));
  }

  /**
   * Lista transportistas activos y sus servicios.
   */
  async getTransportistas() {
    return this.repository.getTransportistasActivos();
  }

  /**
   * Cotiza el envío verificando cobertura y cubicación en tiempo real.
   */
  async cotizarEnvio(input: CotizarRequest) {
    const ot = await this.repository.getOtById(input.ot_id);
    if (!ot) {
      throw new ValidationError(`La OT ${input.ot_id} no existe`, 404);
    }

    const comunaId = ot.direccion?.comuna_id;
    if (!comunaId) {
      throw new ValidationError('La OT no posee una dirección o comuna asociada.', 422);
    }

    const transportista = await this.repository.getTransportistaById(input.transportista_id);
    if (!transportista) {
      throw new ValidationError('Transportista no encontrado.', 404);
    }

    const factorVolumetrico = transportista.factor_volumetrico_default || 5000;

    // Validación 3: Validar que el peso real y las dimensiones ingresadas sean mayores a 0
    for (const b of input.bultos) {
      const val = validarDimensionesBulto(b);
      if (!val.valido) {
        throw new ValidationError(val.error || 'Dimensiones o peso inválidos.', 400);
      }
    }

    // Cubicar bultos
    const cubicacion = cubicarBultos(input.bultos, factorVolumetrico);

    // Validación 2: Cobertura
    const cobertura = await this.repository.getCoberturaActiva(input.servicio_id, comunaId);
    const tieneCobertura = !!cobertura && cobertura.vigente;

    // Obtener tarifa
    let costoEstimado = 4900;
    if (tieneCobertura) {
      const tarifa = await this.repository.getTarifa(
        input.servicio_id,
        comunaId,
        cubicacion.peso_cobrado_total_kg
      );
      if (tarifa) {
        costoEstimado = calcularCostoEnvio(cubicacion.peso_cobrado_total_kg, {
          peso_desde_kg: Number(tarifa.peso_desde_kg),
          peso_hasta_kg: Number(tarifa.peso_hasta_kg),
          precio_base: Number(tarifa.precio_base),
          precio_kg_adicional: Number(tarifa.precio_kg_adicional),
        });
      } else {
        costoEstimado = calcularCostoEnvio(cubicacion.peso_cobrado_total_kg, null);
      }
    }

    return {
      cubicacion,
      tiene_cobertura: tieneCobertura,
      costo_estimado: costoEstimado,
      comuna_destino: ot.direccion?.comuna?.nombre,
      transportista_nombre: transportista.nombre,
    };
  }

  /**
   * Emite una guía de despacho y pide a Inventario que confirme el egreso de stock.
   * Validaciones antes de crear nada:
   * 1. OT en estado CERRADO o PARCIAL, con unidades recolectadas y sin otra guía (un pedido, una guía)
   * 2. Comuna destino con cobertura activa (vigente = true)
   * 3. Peso y dimensiones mayores a 0
   * 4. Reserva del pedido PENDIENTE en Inventario
   * Luego la guía se crea en 'Pendiente de stock' y, según responda Inventario,
   * pasa a 'Preparado' o queda en 'Error de stock' (se reintenta con reintentarConfirmacionStock).
   */
  async emitirGuia(input: EmitirGuiaRequest) {
    // 1. Obtener la OT
    const ot = await this.repository.getOtById(input.ot_id);
    if (!ot) {
      throw new ValidationError(`La orden de trabajo ${input.ot_id} no existe`, 404);
    }

    // VALIDACIÓN 1: OT CERRADA (todo recolectado) o PARCIAL (se despacha lo recolectado e Inventario libera el resto)
    if (ot.estado !== EstadoOT.CERRADO && ot.estado !== EstadoOT.PARCIAL) {
      throw new ValidationError(
        `No se puede emitir guía: la OT debe estar CERRADO o PARCIAL (estado actual: ${ot.estado}).`,
        422
      );
    }

    // Un pedido se despacha en una sola guía (acordado con Inventario).
    const guiasPrevias = await this.repository.getGuiasPorOt(ot.id);
    if (guiasPrevias.length > 0) {
      const enEspera = guiasPrevias.find((g) => ESTADOS_STOCK.includes(g.estado_actual));
      if (enEspera) {
        throw new ValidationError(
          `La OT ${ot.id} ya tiene la guía ${enEspera.id} en "${enEspera.estado_actual}". Reintente la confirmación de stock de esa guía desde la consola de tracking.`,
          409
        );
      }
      throw new ValidationError(
        `La OT ${ot.id} ya tiene la guía ${guiasPrevias[0].id} (${guiasPrevias[0].estado_actual}). Un pedido se despacha en una sola guía.`,
        409
      );
    }

    if (!this.lineasDespacho(ot).some((l) => l.cantidad > 0)) {
      throw new ValidationError('La OT no tiene unidades recolectadas para despachar.', 422);
    }

    // Obtener transportista y servicio
    const transportista = await this.repository.getTransportistaById(input.transportista_id);
    if (!transportista) {
      throw new ValidationError('El transportista seleccionado no existe o no está activo.', 404);
    }

    const servicio = await this.repository.getServicioById(input.servicio_id);
    if (!servicio || servicio.transportista_id !== transportista.id) {
      throw new ValidationError(
        'El servicio seleccionado no corresponde al transportista indicado.',
        400
      );
    }

    const direccionId = ot.direccion_id;
    const comunaId = ot.direccion?.comuna_id;

    if (!direccionId || !comunaId) {
      throw new ValidationError(
        'La orden de trabajo no tiene una dirección de entrega válida asignada.',
        422
      );
    }

    // VALIDACIÓN 2: Verificar cobertura activa en comuna de destino
    const cobertura = await this.repository.getCoberturaActiva(input.servicio_id, comunaId);
    if (!cobertura || !cobertura.vigente) {
      throw new ValidationError(
        'El servicio seleccionado no cuenta con cobertura vigente en la comuna de destino',
        422
      );
    }

    // VALIDACIÓN 3: Validar que el peso real y las dimensiones ingresadas sean mayores a 0
    if (!input.bultos || input.bultos.length === 0) {
      throw new ValidationError('Debe ingresar al menos un bulto para la emisión de la guía.', 400);
    }

    for (const bulto of input.bultos) {
      const validacion = validarDimensionesBulto(bulto);
      if (!validacion.valido) {
        throw new ValidationError(
          validacion.error || 'El peso real y las dimensiones deben ser mayores a 0',
          400
        );
      }
    }

    // LÓGICA DE CUBICACIÓN
    const factorVolumetrico = transportista.factor_volumetrico_default || 5000;
    const resultadoCubicacion = cubicarBultos(input.bultos, factorVolumetrico);

    // CALCULAR TARIFA
    const tarifa = await this.repository.getTarifa(
      input.servicio_id,
      comunaId,
      resultadoCubicacion.peso_cobrado_total_kg
    );

    let costoEnvio = 4500;
    if (tarifa) {
      costoEnvio = calcularCostoEnvio(resultadoCubicacion.peso_cobrado_total_kg, {
        peso_desde_kg: Number(tarifa.peso_desde_kg),
        peso_hasta_kg: Number(tarifa.peso_hasta_kg),
        precio_base: Number(tarifa.precio_base),
        precio_kg_adicional: Number(tarifa.precio_kg_adicional),
      });
    } else {
      costoEnvio = calcularCostoEnvio(resultadoCubicacion.peso_cobrado_total_kg, null);
    }

    // VALIDACIÓN 4: la reserva del pedido debe estar PENDIENTE en Inventario
    await this.verificarReservaPendiente(ot.id_pedido);

    // Generar identificadores
    const guiaId = generarIdGuia();
    const numSeguimiento = generarNumeroSeguimiento(transportista.nombre);
    const usuarioResponsable = input.usuario_responsable || 'M. Pizarro';

    // Bultos a persistir
    const bultosAPersistir = resultadoCubicacion.bultos.map((b) => ({
      largo_cm: b.largo_cm,
      alto_cm: b.alto_cm,
      ancho_cm: b.ancho_cm,
      peso_real_kg: b.peso_real_kg,
      peso_volumetrico_kg: b.peso_volumetrico_kg,
    }));

    const emisionData: EmisionGuiaData = {
      guia_id: guiaId,
      ot_id: ot.id,
      transportista_id: transportista.id,
      servicio_id: servicio.id,
      direccion_id: direccionId,
      num_seguimiento: numSeguimiento,
      factor_volumetrico_aplicado: factorVolumetrico,
      peso_real_total_kg: resultadoCubicacion.peso_real_total_kg,
      peso_volumetrico_total_kg: resultadoCubicacion.peso_volumetrico_total_kg,
      costo_envio: costoEnvio,
      estado_inicial: ESTADO_PENDIENTE_STOCK,
      usuario_responsable: usuarioResponsable,
      bultos: bultosAPersistir,
    };

    // EJECUCIÓN TRANSACCIONAL: guía, bultos y evento inicial (sin tocar stock)
    const guiaCreada = await this.repository.emitirGuiaTransaccional(emisionData);

    // Inventario confirma el egreso; la guía pasa a 'Preparado' o queda en 'Error de stock'
    const { guia, inventario } = await this.confirmarEgreso(
      guiaId,
      ot,
      numSeguimiento,
      usuarioResponsable
    );

    return {
      mensaje: inventario.ok
        ? 'Guía de despacho emitida. Inventario confirmó el egreso de stock.'
        : `La guía ${guiaId} se creó, pero Inventario no confirmó el egreso: ${inventario.error}. Quedó en "${ESTADO_ERROR_STOCK}" y se puede reintentar desde la consola de tracking.`,
      guia: guia ?? guiaCreada,
      inventario,
    };
  }

  /**
   * Vuelve a pedir a Inventario que confirme el egreso de una guía en 'Pendiente de stock'
   * o 'Error de stock'. Es seguro repetirlo: Inventario es idempotente por id_despacho.
   */
  async reintentarConfirmacionStock(guiaId: string, usuarioResponsable?: string) {
    const guiaActual = await this.repository.getGuiaById(guiaId);
    if (!guiaActual) {
      throw new ValidationError(`La guía ${guiaId} no existe`, 404);
    }
    if (!ESTADOS_STOCK.includes(guiaActual.estado_actual)) {
      throw new ValidationError(
        `La guía ${guiaId} está en "${guiaActual.estado_actual}"; solo se reintentan guías en "${ESTADO_PENDIENTE_STOCK}" o "${ESTADO_ERROR_STOCK}".`,
        409
      );
    }

    const ot = guiaActual.ot ?? (await this.repository.getOtById(guiaActual.ot_id));
    if (!ot) {
      throw new ValidationError(`La OT ${guiaActual.ot_id} de la guía ${guiaId} no existe`, 404);
    }

    const { guia, inventario } = await this.confirmarEgreso(
      guiaId,
      ot,
      guiaActual.num_seguimiento,
      usuarioResponsable || 'M. Pizarro'
    );

    return {
      mensaje: inventario.ok
        ? 'Inventario confirmó el egreso de stock. La guía quedó en "Preparado".'
        : `Inventario aún no confirma el egreso: ${inventario.error}`,
      guia,
      inventario,
    };
  }

  /**
   * Líneas del egreso para Inventario: todas las de la OT, con lo recolectado tal cual
   * (0 si no se encontró; Inventario libera esa parte de la reserva). Sin productos repetidos.
   */
  private lineasDespacho(ot: { detalles?: any[] }): LineaDespachoInventario[] {
    const porProducto = new Map<number, number>();
    for (const det of ot.detalles || []) {
      const recolectada = Number(det.cant_recolectada ?? 0);
      porProducto.set(det.id_producto, (porProducto.get(det.id_producto) ?? 0) + recolectada);
    }
    return [...porProducto].map(([id_producto, cantidad]) => ({ id_producto, cantidad }));
  }

  private async verificarReservaPendiente(idPedido: number) {
    let reserva;
    try {
      reserva = await this.inventario.obtenerReserva(idPedido);
    } catch (err) {
      if (err instanceof InventarioError && err.tipo === 'NO_ENCONTRADO') {
        throw new ValidationError(
          `El pedido ${idPedido} no tiene una reserva de stock en Inventario; no se puede despachar.`,
          422
        );
      }
      throw errorDeInventario(err, 'consultar la reserva del pedido');
    }

    if (reserva.estado !== 'PENDIENTE') {
      throw new ValidationError(
        `La reserva del pedido ${idPedido} en Inventario está ${reserva.estado}; solo se despachan reservas PENDIENTE.`,
        409
      );
    }
  }

  /**
   * Llama al egreso de Inventario y deja registrado el resultado en la bitácora de la guía.
   * Si Inventario falla, la guía queda en 'Error de stock' (no se lanza: la guía ya existe).
   */
  private async confirmarEgreso(
    guiaId: string,
    ot: { id_pedido: number; id_operador: number; detalles?: any[] },
    numSeguimiento: string,
    usuarioResponsable: string
  ): Promise<{ guia: any; inventario: ConfirmacionStock }> {
    try {
      const resultado = await this.inventario.registrarDespacho({
        id_despacho: guiaId,
        num_seguimiento: numSeguimiento,
        id_pedido: ot.id_pedido,
        id_empleado: ot.id_operador,
        lineas: this.lineasDespacho(ot),
      });

      const liberacion = resultado.liberacion
        ? ` y liberó lo no recolectado (movimiento #${resultado.liberacion.id_movimiento})`
        : '';
      const { guia } = await this.repository.registrarEventoTracking(
        guiaId,
        ESTADO_PREPARADO,
        usuarioResponsable,
        `Inventario confirmó el egreso de stock (movimiento #${resultado.egreso.id_movimiento})${liberacion}.`
      );

      return {
        guia,
        inventario: {
          ok: true,
          id_movimiento_egreso: resultado.egreso.id_movimiento,
          id_movimiento_liberacion: resultado.liberacion?.id_movimiento ?? null,
        },
      };
    } catch (err) {
      // Errores propios (p. ej. de base de datos) no se disfrazan de error de stock
      if (!(err instanceof InventarioError)) throw err;

      const { guia } = await this.repository.registrarEventoTracking(
        guiaId,
        ESTADO_ERROR_STOCK,
        usuarioResponsable,
        `Inventario no confirmó el egreso de stock: ${err.message}`
      );

      return {
        guia,
        inventario: { ok: false, error: err.message, tipo_error: err.tipo, reintentable: err.reintentable },
      };
    }
  }

  /**
   * Consulta guías de tracking con filtros aplicables.
   */
  async getTracking(filtros: FiltrosTracking) {
    return this.repository.getTrackingGuias(filtros);
  }

  /** Prepara la derivación local. El envío a Postventa requiere un contrato API acordado. */
  async derivarEntregaFallida(guiaId: string) {
    const guia = await this.repository.getGuiaById(guiaId);
    if (!guia) throw new ValidationError(`La guía ${guiaId} no existe`, 404);
    if (guia.estado_actual !== 'Entrega Fallida') {
      throw new ValidationError('Solo se puede derivar una guía con estado Entrega Fallida', 409);
    }
    const eventos = (guia.eventos ?? []) as Array<{ id: number; estado: string; observacion: string }>;
    const evento = [...eventos].reverse().find((item) => item.estado === 'Entrega Fallida');
    if (!evento) throw new ValidationError('La guía no tiene un evento de entrega fallida', 409);
    return this.repository.derivarEntregaFallida(guiaId, evento.id, evento.observacion);
  }

  async vincularCasoPostventa(incidenciaId: number, casoId: number) {
    if (!Number.isSafeInteger(incidenciaId) || incidenciaId <= 0 ||
        !Number.isSafeInteger(casoId) || casoId <= 0) {
      throw new ValidationError('Los identificadores de incidencia y caso deben ser enteros positivos', 400);
    }
    const incidencia = await this.repository.getIncidencia(incidenciaId);
    if (!incidencia) throw new ValidationError(`La incidencia ${incidenciaId} no existe`, 404);
    if (incidencia.id_caso_postventa !== null && incidencia.id_caso_postventa !== casoId) {
      throw new ValidationError('La incidencia ya está vinculada a otro caso de Postventa', 409);
    }
    const vinculada = await this.repository.vincularCasoPostventa(incidenciaId, casoId);
    if (vinculada?.id_caso_postventa !== casoId) {
      throw new ValidationError('La incidencia ya está vinculada a otro caso de Postventa', 409);
    }
    return vinculada;
  }

  /**
   * Inserta un nuevo evento append-only en la bitácora y actualiza el estado_actual denormalizado.
   */
  async registrarEventoTracking(
    guiaId: string,
    estado: string,
    usuarioResponsable: string = 'M. Pizarro',
    observacion: string
  ) {
    if (!estado || estado.trim() === '') {
      throw new ValidationError('El estado del evento es obligatorio', 400);
    }

    // Los estados de stock los asigna el sistema según la respuesta de Inventario
    if (ESTADOS_STOCK.includes(estado.trim())) {
      throw new ValidationError(
        `El estado "${estado.trim()}" lo asigna el sistema según la respuesta de Inventario; no se registra a mano.`,
        400
      );
    }
    const guiaActual = await this.repository.getGuiaById(guiaId);
    if (guiaActual && ESTADOS_STOCK.includes(guiaActual.estado_actual)) {
      throw new ValidationError(
        `La guía ${guiaId} está en "${guiaActual.estado_actual}": Inventario aún no confirma el egreso. Reintente la confirmación de stock antes de registrar eventos.`,
        409
      );
    }

    return this.repository.registrarEventoTracking(
      guiaId,
      estado.trim(),
      usuarioResponsable || 'M. Pizarro',
      observacion ? observacion.trim() : 'Actualización de estado en consola de tracking'
    );
  }

  /**
   * Obtiene la lista de órdenes de compra pendientes de recepción en muelle.
   */
  async getComprasPendientes() {
    return this.completarOrdenesCompra(await this.repository.getComprasPendientes());
  }

  /**
   * Obtiene el detalle de una orden de compra por su ID.
   */
  async getCompraById(id: number) {
    const oc = await this.repository.getCompraById(id);
    if (!oc) {
      throw new ValidationError(`La orden de compra ${id} no existe`, 404);
    }
    const [completa] = await this.completarOrdenesCompra([oc]);
    return completa;
  }

  /**
   * Registra la recepción física en muelle de una Orden de Compra (HU-06).
   * Aplica la 6ta validación de negocio:
   * cantidad_danada <= cantidad_recibida <= cantidad_esperada.
   * Exige receptor real, guía del proveedor y bodega por línea con unidades aptas.
   * Inventario registra primero el ingreso (POST /movimientos/recepcion); si falla no se guarda
   * nada. Luego se guarda el acta en Logística.
   */
  async registrarRecepcion(input: RegistrarRecepcionRequest) {
    if (!input.id_oc) {
      throw new ValidationError('El ID de la orden de compra es obligatorio.', 400);
    }
    if (!input.lineas || input.lineas.length === 0) {
      throw new ValidationError('Debe ingresar al menos una línea de producto para la recepción.', 400);
    }

    // El receptor debe ser un empleado real (#17): ya no hay receptor por defecto
    const idReceptor = Number(input.id_empleado_receptor);
    if (!Number.isInteger(idReceptor) || idReceptor <= 0) {
      throw new ValidationError('Debe indicar el empleado receptor en muelle.', 400);
    }

    // Guía de despacho del proveedor: Inventario la exige y no acepta la misma dos veces por OC
    const nroGuia = (input.nro_guia_proveedor ?? '').trim().toUpperCase();
    if (!nroGuia) {
      throw new ValidationError('Debe indicar el N° de guía de despacho del proveedor.', 400);
    }
    if (nroGuia.length > 50) {
      throw new ValidationError('El N° de guía del proveedor no puede superar 50 caracteres.', 400);
    }

    // Verificar que la OC exista; el proveedor se toma de la OC
    const oc = await this.repository.getCompraById(input.id_oc);
    if (!oc) {
      throw new ValidationError(`La orden de compra #${input.id_oc} no existe.`, 404);
    }
    const idProveedor = Number((oc as { id_proveedor?: number }).id_proveedor);
    if (!Number.isInteger(idProveedor) || idProveedor <= 0) {
      throw new ValidationError(`La orden de compra #${input.id_oc} no tiene un proveedor asociado.`, 422);
    }

    if (!(await this.repository.existeEmpleado(idReceptor))) {
      throw new ValidationError(`El empleado receptor ${idReceptor} no existe en RRHH.`, 422);
    }

    // Validación 6: Evaluar cantidades con la lógica pura de dominio
    let resultadoDominio;
    try {
      resultadoDominio = evaluarRecepcionOc(input.lineas);
    } catch (err: any) {
      throw new ValidationError(err.message || 'Error en las cantidades de recepción.', 422);
    }

    // Cada línea con unidades aptas necesita la bodega de Inventario donde entra
    for (const l of input.lineas) {
      const aptas = l.cantidad_recibida - l.cantidad_danada;
      const bodega = Number(l.id_bodega);
      if (aptas > 0 && (!Number.isInteger(bodega) || bodega <= 0)) {
        throw new ValidationError(`Indique la bodega de ingreso para el producto ${l.id_producto}.`, 400);
      }
    }

    if (await this.repository.existeRecepcion(input.id_oc, nroGuia)) {
      throw new ValidationError(
        `La guía ${nroGuia} del proveedor ya se registró para la OC #${input.id_oc}.`,
        409
      );
    }

    // 1. Inventario registra el ingreso de las unidades aptas. Si falla, no se guarda nada
    //    y la misma recepción se puede volver a confirmar (Inventario es idempotente por OC + guía).
    const ingreso = await this.registrarIngresoInventario(input, idProveedor, nroGuia, idReceptor);

    const observacionBase = input.observacion?.trim() || `Recepción en muelle ${resultadoDominio.estado_recepcion}`;
    const recepcionData: RecepcionData = {
      id_oc: input.id_oc,
      id_proveedor: idProveedor,
      nro_guia_proveedor: nroGuia,
      id_empleado_receptor: idReceptor,
      estado: resultadoDominio.estado_recepcion,
      observacion: ingreso.registrado
        ? `${observacionBase} (ingreso en Inventario: movimiento #${ingreso.id_movimiento_ingreso})`
        : observacionBase,
      detalles: input.lineas.map((l) => ({
        id_producto: l.id_producto,
        id_bodega: Number(l.id_bodega) > 0 ? Number(l.id_bodega) : null,
        cantidad_esperada: l.cantidad_esperada,
        cantidad_recibida: l.cantidad_recibida,
        cantidad_danada: l.cantidad_danada,
        motivo_dano: l.motivo_dano || null,
      })),
    };

    // 2. Guardar el acta en Logística
    let recepcionRegistrada;
    try {
      recepcionRegistrada = await this.repository.registrarRecepcionTransaccional(recepcionData);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ValidationError(
          `La guía ${nroGuia} del proveedor ya se registró para la OC #${input.id_oc}.`,
          409
        );
      }
      if (!ingreso.registrado) throw err;
      throw new ValidationError(
        `Inventario registró el ingreso (movimiento #${ingreso.id_movimiento_ingreso}), pero no se pudo guardar el acta: ${err?.message || err}. ` +
          'Vuelva a confirmar la misma recepción: Inventario no duplica el ingreso.',
        500
      );
    }

    return {
      mensaje: ingreso.registrado
        ? 'Recepción en muelle confirmada. Inventario registró el ingreso de las unidades aptas.'
        : `Recepción en muelle registrada. ${ingreso.motivo}`,
      recepcion: recepcionRegistrada,
      inventario: ingreso,
      resumen: {
        total_esperado: resultadoDominio.total_esperado,
        total_recibido: resultadoDominio.total_recibido,
        total_danado: resultadoDominio.total_danado,
        total_apto_inventario: resultadoDominio.total_apto_inventario,
        estado_recepcion: resultadoDominio.estado_recepcion,
      },
    };
  }

  /**
   * Pide a Inventario el ingreso de las unidades aptas (recibida - dañada) por producto y bodega.
   * Las líneas sin aptas no se envían; si ninguna tiene aptas, no se llama a Inventario.
   */
  private async registrarIngresoInventario(
    input: RegistrarRecepcionRequest,
    idProveedor: number,
    nroGuia: string,
    idReceptor: number
  ): Promise<IngresoInventario> {
    const porProductoYBodega = new Map<string, { id_producto: number; id_bodega: number; cantidad: number }>();
    for (const l of input.lineas) {
      const aptas = l.cantidad_recibida - l.cantidad_danada;
      if (aptas <= 0) continue;
      const clave = `${l.id_producto}-${l.id_bodega}`;
      const linea = porProductoYBodega.get(clave) ?? { id_producto: l.id_producto, id_bodega: Number(l.id_bodega), cantidad: 0 };
      linea.cantidad += aptas;
      porProductoYBodega.set(clave, linea);
    }

    if (porProductoYBodega.size === 0) {
      return { registrado: false, motivo: 'No hay unidades aptas: no se registró ingreso en Inventario.' };
    }

    try {
      const resultado = await this.inventario.registrarRecepcion({
        id_oc: input.id_oc,
        id_proveedor: idProveedor,
        nro_guia_proveedor: nroGuia,
        id_empleado: idReceptor,
        fecha_recepcion: new Date().toISOString(),
        lineas: [...porProductoYBodega.values()],
      });
      return { registrado: true, id_movimiento_ingreso: resultado.ingreso.id_movimiento };
    } catch (err) {
      throw errorDeInventario(err, 'registrar el ingreso de la recepción');
    }
  }

  /**
   * Consulta el historial de recepciones en muelle.
   */
  async getHistorialRecepciones() {
    return this.repository.getHistorialRecepciones();
  }

  /** Empleados para elegir al receptor en muelle */
  async getEmpleados() {
    return this.repository.getEmpleados();
  }

  /** Bodegas de Inventario donde puede ingresar la mercadería recibida */
  async getBodegas() {
    try {
      return await this.inventario.obtenerBodegas();
    } catch (err) {
      throw errorDeInventario(err, 'consultar las bodegas');
    }
  }
}
