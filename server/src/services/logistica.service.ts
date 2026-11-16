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

export interface RegistrarRecepcionRequest {
  id_oc: number;
  id_empleado_receptor?: number;
  observacion?: string;
  lineas: LineaRecepcionInput[];
}

export class LogisticaService {
  private repository: LogisticaRepository;
  private inventarioInyectado?: ClienteInventario;

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

    // Peso y medidas de cada producto desde el maestro de Inventario
    const fichas = await this.repository.getFichasProducto(
      (ot.detalles || []).map((d: any) => d.id_producto)
    );
    const detalles = (ot.detalles || []).map((d: any) => ({ ...d, ...fichas.get(d.id_producto) }));

    // Calcular dimensiones sugeridas basadas en los productos del pedido
    let pesoSugerido = 0;
    let maxLargo = 25;
    let maxAlto = 20;
    let maxAncho = 15;

    if (detalles.length > 0) {
      pesoSugerido = detalles.reduce((acc: number, curr: any) => {
        const peso = Number(curr.peso_unitario_kg || 1.5) * curr.cant_solicitada;
        return acc + peso;
      }, 0);

      detalles.forEach((item: any) => {
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
    };
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
    return this.repository.getComprasPendientes();
  }

  /**
   * Obtiene el detalle de una orden de compra por su ID.
   */
  async getCompraById(id: number) {
    const oc = await this.repository.getCompraById(id);
    if (!oc) {
      throw new ValidationError(`La orden de compra ${id} no existe`, 404);
    }
    return oc;
  }

  /**
   * Registra la recepción física en muelle de una Orden de Compra (HU-06).
   * Aplica la 6ta validación de negocio:
   * cantidad_danada <= cantidad_recibida <= cantidad_esperada.
   * Dispara el ingreso automático como ENTRADA en inventario por las unidades aptas.
   */
  async registrarRecepcion(input: RegistrarRecepcionRequest) {
    if (!input.id_oc) {
      throw new ValidationError('El ID de la orden de compra es obligatorio.', 400);
    }
    if (!input.lineas || input.lineas.length === 0) {
      throw new ValidationError('Debe ingresar al menos una línea de producto para la recepción.', 400);
    }

    // Verificar que la OC exista
    const oc = await this.repository.getCompraById(input.id_oc);
    if (!oc) {
      throw new ValidationError(`La orden de compra #${input.id_oc} no existe.`, 404);
    }

    // Validación 6: Evaluar cantidades con la lógica pura de dominio
    let resultadoDominio;
    try {
      resultadoDominio = evaluarRecepcionOc(input.lineas);
    } catch (err: any) {
      throw new ValidationError(err.message || 'Error en las cantidades de recepción.', 422);
    }

    const recepcionData: RecepcionData = {
      id_oc: input.id_oc,
      // 304 existe en test_log_rrhh_empleado (FK). Se elimina en el punto 17 (empleado obligatorio).
      id_empleado_receptor: input.id_empleado_receptor || 304,
      estado: resultadoDominio.estado_recepcion,
      observacion: input.observacion || `Recepción en muelle ${resultadoDominio.estado_recepcion}`,
      detalles: input.lineas.map((l) => ({
        id_producto: l.id_producto,
        cantidad_esperada: l.cantidad_esperada,
        cantidad_recibida: l.cantidad_recibida,
        cantidad_danada: l.cantidad_danada,
        motivo_dano: l.motivo_dano || null,
      })),
      movimientos_entrada: resultadoDominio.movimientos_entrada,
    };

    const recepcionRegistrada = await this.repository.registrarRecepcionTransaccional(recepcionData);

    return {
      mensaje: 'Recepción en muelle confirmada e ingreso de existencias a inventario registrado.',
      recepcion: recepcionRegistrada,
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
   * Consulta el historial de recepciones en muelle.
   */
  async getHistorialRecepciones() {
    return this.repository.getHistorialRecepciones();
  }
}
