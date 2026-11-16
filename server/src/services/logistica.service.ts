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

export class ValidationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 422) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = statusCode;
  }
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

  constructor(repository?: LogisticaRepository) {
    this.repository = repository || new LogisticaRepository();
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
   * Emite una nueva guía de despacho cumpliendo estrictamente con las 3 validaciones:
   * 1. OT en estado 'CERRADO'
   * 2. Comuna destino con cobertura activa (vigente = true)
   * 3. Peso y dimensiones mayores a 0
   * Realiza la transacción atómica en Prisma.
   */
  async emitirGuia(input: EmitirGuiaRequest) {
    // 1. Obtener la OT
    const ot = await this.repository.getOtById(input.ot_id);
    if (!ot) {
      throw new ValidationError(`La orden de trabajo ${input.ot_id} no existe`, 404);
    }

    // VALIDACIÓN 1: Verificar que la OT exista y su estado sea estrictamente 'CERRADO'
    if (ot.estado !== EstadoOT.CERRADO) {
      throw new ValidationError(
        'No se puede emitir guía: la OT no se encuentra en estado CERRADO',
        422
      );
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

    // Generar identificadores
    const guiaId = generarIdGuia();
    const numSeguimiento = generarNumeroSeguimiento(transportista.nombre);
    const usuarioResponsable = input.usuario_responsable || 'M. Pizarro';

    // Preparar ítems para rebaja de inventario inv_mov
    const itemsInventario = (ot.detalles || []).map((det: any) => ({
      id_producto: det.id_producto,
      cantidad: det.cant_recolectada || det.cant_solicitada,
      referencia_origen: `${guiaId} / ${ot.id}`,
    }));

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
      estado_inicial: 'Preparado',
      usuario_responsable: usuarioResponsable,
      bultos: bultosAPersistir,
      items_inventario: itemsInventario,
    };

    // EJECUCIÓN TRANSACCIONAL
    const guiaEmitida = await this.repository.emitirGuiaTransaccional(emisionData);

    return {
      mensaje: 'Guía de despacho emitida y movimiento de inventario registrado con éxito.',
      guia: guiaEmitida,
    };
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
