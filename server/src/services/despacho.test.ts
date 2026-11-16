import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { LogisticaService, ValidationError } from './logistica.service.js';
import {
  ClienteInventarioSimulado,
  InventarioError,
  type ClienteInventario,
  type DespachoInventarioInput,
  type ReservaPedidoInventario,
} from '../integrations/inventario/index.js';

// ---------------------------------------------------------------------------
// Repositorio falso en memoria con lo que usa el flujo de despacho
// ---------------------------------------------------------------------------
function crearRepositorio(ot: any) {
  const guias = new Map<string, any>();
  let creadas = 0;
  const repo = {
    guias,
    get creadas() {
      return creadas;
    },
    async getOtById(id: string) {
      return id === ot.id ? ot : null;
    },
    async getGuiasPorOt(otId: string) {
      return [...guias.values()].filter((g) => g.ot_id === otId).map((g) => ({ id: g.id, estado_actual: g.estado_actual }));
    },
    async getTransportistaById(id: number) {
      return { id, nombre: 'Chilexpress', factor_volumetrico_default: 5000 };
    },
    async getServicioById(id: number) {
      return { id, transportista_id: 1 };
    },
    async getCoberturaActiva() {
      return { vigente: true };
    },
    async getTarifa() {
      return null;
    },
    async emitirGuiaTransaccional(data: any) {
      creadas++;
      const guia = {
        id: data.guia_id,
        ot_id: data.ot_id,
        num_seguimiento: data.num_seguimiento,
        estado_actual: data.estado_inicial,
        eventos: [{ estado: data.estado_inicial, observacion: 'creada' }],
        ot,
      };
      guias.set(guia.id, guia);
      return guia;
    },
    async getGuiaById(id: string) {
      return guias.get(id) ?? null;
    },
    async registrarEventoTracking(id: string, estado: string, _usuario: string, observacion: string) {
      const guia = guias.get(id);
      if (!guia) throw new Error(`La guía ${id} no fue encontrada.`);
      const nuevoEvento = { estado, observacion };
      guia.eventos.push(nuevoEvento);
      guia.estado_actual = estado;
      return { nuevoEvento, guia };
    },
  };
  return repo;
}

/** Cliente simulado que además registra los despachos enviados y puede fallar a pedido */
class InventarioEspia extends ClienteInventarioSimulado {
  enviados: DespachoInventarioInput[] = [];
  fallarDespacho: InventarioError | null = null;
  fallarReserva: InventarioError | null = null;

  async obtenerReserva(idPedido: number): Promise<ReservaPedidoInventario> {
    if (this.fallarReserva) throw this.fallarReserva;
    return super.obtenerReserva(idPedido);
  }

  async registrarDespacho(input: DespachoInventarioInput) {
    this.enviados.push(structuredClone(input));
    if (this.fallarDespacho) throw this.fallarDespacho;
    return super.registrarDespacho(input);
  }
}

const caido = () =>
  new InventarioError({ tipo: 'TIMEOUT', mensaje: 'Inventario no respondió en 8000 ms', ruta: '/movimientos/despacho' });

function otBase(overrides: Partial<any> = {}) {
  return {
    id: 'OT-4091',
    id_pedido: 10294,
    id_operador: 301,
    estado: 'CERRADO',
    direccion_id: 1,
    direccion: { comuna_id: 1 },
    detalles: [
      { id: 1, id_producto: 75192, cant_solicitada: 1, cant_recolectada: 1 },
      { id: 2, id_producto: 10294, cant_solicitada: 2, cant_recolectada: 2 },
    ],
    ...overrides,
  };
}

const SOLICITUD = {
  ot_id: 'OT-4091',
  transportista_id: 1,
  servicio_id: 1,
  bultos: [{ largo_cm: 50, alto_cm: 40, ancho_cm: 30, peso_real_kg: 5 }],
  usuario_responsable: 'Tester',
};

async function esperarError(promesa: Promise<unknown>, status: number, texto?: RegExp) {
  try {
    await promesa;
  } catch (err) {
    assert.ok(err instanceof ValidationError, `se esperaba ValidationError y llegó ${err}`);
    assert.equal(err.statusCode, status, err.message);
    if (texto) assert.match(err.message, texto);
    return;
  }
  assert.fail('se esperaba un error');
}

// ---------------------------------------------------------------------------
describe('Despacho con Inventario (Fase 3)', () => {
  let inventario: InventarioEspia;

  beforeEach(() => {
    inventario = new InventarioEspia();
  });

  const servicio = (repo: any, cliente: ClienteInventario = inventario) => new LogisticaService(repo, cliente);

  it('OT CERRADA: crea la guía, Inventario confirma y queda en "Preparado"', async () => {
    const repo = crearRepositorio(otBase());
    const res = await servicio(repo).emitirGuia(SOLICITUD);

    assert.equal(res.inventario.ok, true);
    assert.equal(res.guia.estado_actual, 'Preparado');
    assert.deepEqual(res.guia.eventos.map((e: any) => e.estado), ['Pendiente de stock', 'Preparado']);

    const enviado = inventario.enviados[0];
    assert.equal(enviado.id_despacho, res.guia.id);
    assert.equal(enviado.id_pedido, 10294);
    assert.equal(enviado.id_empleado, 301);
    assert.deepEqual(enviado.lineas, [
      { id_producto: 75192, cantidad: 1 },
      { id_producto: 10294, cantidad: 2 },
    ]);
  });

  it('OT PARCIAL: se puede emitir y envía lo recolectado tal cual, incluso 0 (bug #11)', async () => {
    const repo = crearRepositorio(
      otBase({
        estado: 'PARCIAL',
        detalles: [
          { id: 1, id_producto: 75192, cant_solicitada: 1, cant_recolectada: 1 },
          { id: 2, id_producto: 10294, cant_solicitada: 2, cant_recolectada: 0 },
        ],
      })
    );
    const res = await servicio(repo).emitirGuia(SOLICITUD);

    assert.equal(res.inventario.ok, true);
    assert.ok(res.inventario.id_movimiento_liberacion, 'Inventario libera lo no recolectado');
    assert.deepEqual(inventario.enviados[0].lineas, [
      { id_producto: 75192, cantidad: 1 },
      { id_producto: 10294, cantidad: 0 },
    ]);
  });

  it('suma líneas repetidas del mismo producto (Inventario no acepta productos repetidos)', async () => {
    const repo = crearRepositorio(
      otBase({
        detalles: [
          { id: 1, id_producto: 75192, cant_solicitada: 1, cant_recolectada: 1 },
          { id: 2, id_producto: 75192, cant_solicitada: 2, cant_recolectada: 2 },
        ],
      })
    );
    await servicio(repo).emitirGuia(SOLICITUD);
    assert.deepEqual(inventario.enviados[0].lineas, [{ id_producto: 75192, cantidad: 3 }]);
  });

  it('rechaza OT que no está CERRADO ni PARCIAL, sin crear guía', async () => {
    const repo = crearRepositorio(otBase({ estado: 'EN_PROCESO' }));
    await esperarError(servicio(repo).emitirGuia(SOLICITUD), 422, /CERRADO o PARCIAL/);
    assert.equal(repo.creadas, 0);
  });

  it('rechaza OT sin unidades recolectadas', async () => {
    const repo = crearRepositorio(
      otBase({ estado: 'PARCIAL', detalles: [{ id: 1, id_producto: 75192, cant_solicitada: 1, cant_recolectada: 0 }] })
    );
    await esperarError(servicio(repo).emitirGuia(SOLICITUD), 422, /recolectadas/);
    assert.equal(repo.creadas, 0);
  });

  it('un pedido, una guía: la segunda emisión se bloquea sin llamar a Inventario', async () => {
    const repo = crearRepositorio(otBase());
    await servicio(repo).emitirGuia(SOLICITUD);
    await esperarError(servicio(repo).emitirGuia(SOLICITUD), 409, /una sola guía/);
    assert.equal(repo.creadas, 1);
    assert.equal(inventario.enviados.length, 1);
  });

  it('pedido sin reserva en Inventario: 422 y no se crea la guía', async () => {
    inventario = new InventarioEspia({ pedidosSinReserva: [10294] });
    const repo = crearRepositorio(otBase());
    await esperarError(servicio(repo).emitirGuia(SOLICITUD), 422, /no tiene una reserva/);
    assert.equal(repo.creadas, 0);
  });

  it('reserva que no está PENDIENTE: 409 y no se crea la guía', async () => {
    inventario = new InventarioEspia({
      reservas: [{ id_pedido: 10294, id_movimiento: 1, estado: 'ANULADO', fecha_registro: '', lineas: [] }],
    });
    const repo = crearRepositorio(otBase());
    await esperarError(servicio(repo).emitirGuia(SOLICITUD), 409, /ANULADO/);
    assert.equal(repo.creadas, 0);
  });

  it('Inventario caído al consultar la reserva: 503 y no se crea la guía', async () => {
    inventario.fallarReserva = caido();
    const repo = crearRepositorio(otBase());
    await esperarError(servicio(repo).emitirGuia(SOLICITUD), 503, /Intente más tarde/);
    assert.equal(repo.creadas, 0);
  });

  it('Inventario falla al confirmar: la guía queda en "Error de stock" y el reintento la deja "Preparado"', async () => {
    const repo = crearRepositorio(otBase());
    inventario.fallarDespacho = caido();

    const res = await servicio(repo).emitirGuia(SOLICITUD);
    assert.equal(res.inventario.ok, false);
    assert.equal(res.inventario.reintentable, true);
    assert.equal(res.guia.estado_actual, 'Error de stock');
    assert.match(res.mensaje, /Error de stock/);

    // Mientras espera a Inventario no se registran eventos de transporte ni se emite otra guía
    await esperarError(servicio(repo).registrarEventoTracking(res.guia.id, 'Despachado', 'Tester', 'x'), 409);
    await esperarError(servicio(repo).emitirGuia(SOLICITUD), 409, /Reintente/);

    // Inventario vuelve: el reintento confirma el egreso
    inventario.fallarDespacho = null;
    const reintento = await servicio(repo).reintentarConfirmacionStock(res.guia.id, 'Tester');
    assert.equal(reintento.inventario.ok, true);
    assert.equal(reintento.guia.estado_actual, 'Preparado');
    assert.equal(inventario.enviados.length, 2);
    assert.equal(inventario.enviados[1].id_despacho, res.guia.id, 'se reintenta con la misma guía');
  });

  it('no reintenta guías que ya están confirmadas', async () => {
    const repo = crearRepositorio(otBase());
    const res = await servicio(repo).emitirGuia(SOLICITUD);
    await esperarError(servicio(repo).reintentarConfirmacionStock(res.guia.id), 409, /solo se reintentan/);
  });

  it('los estados de stock no se registran a mano en la bitácora', async () => {
    const repo = crearRepositorio(otBase());
    const res = await servicio(repo).emitirGuia(SOLICITUD);
    await esperarError(
      servicio(repo).registrarEventoTracking(res.guia.id, 'Error de stock', 'Tester', 'x'),
      400,
      /lo asigna el sistema/
    );
  });
});
