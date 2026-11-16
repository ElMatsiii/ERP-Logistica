import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { LogisticaService, ValidationError, type RegistrarRecepcionRequest } from './logistica.service.js';
import {
  ClienteInventarioSimulado,
  InventarioError,
  type RecepcionInventarioInput,
} from '../integrations/inventario/index.js';

// ---------------------------------------------------------------------------
// Repositorio falso en memoria con lo que usa la recepción en muelle
// ---------------------------------------------------------------------------
function crearRepositorio() {
  const actas: any[] = [];
  const repo = {
    actas,
    fallarGuardado: null as Error | null,
    async getCompraById(id: number) {
      return id === 8001 ? { id_oc: 8001, id_proveedor: 4, proveedor: 'LEGO System A/S', estado: 'PENDIENTE' } : null;
    },
    async existeEmpleado(id: number) {
      return [301, 304].includes(id);
    },
    async existeRecepcion(idOc: number, guia: string) {
      return actas.some((a) => a.id_oc === idOc && a.nro_guia_proveedor === guia);
    },
    async registrarRecepcionTransaccional(data: any) {
      if (repo.fallarGuardado) {
        const err = repo.fallarGuardado;
        repo.fallarGuardado = null;
        throw err;
      }
      const acta = { id: actas.length + 1, ...data };
      actas.push(acta);
      return acta;
    },
  };
  return repo;
}

/** Cliente simulado que registra lo enviado y puede fallar a pedido */
class InventarioEspia extends ClienteInventarioSimulado {
  enviados: RecepcionInventarioInput[] = [];
  fallar: InventarioError | null = null;

  async registrarRecepcion(input: RecepcionInventarioInput) {
    this.enviados.push(structuredClone(input));
    if (this.fallar) throw this.fallar;
    return super.registrarRecepcion(input);
  }
}

const SOLICITUD = (): RegistrarRecepcionRequest => ({
  id_oc: 8001,
  id_empleado_receptor: 304,
  nro_guia_proveedor: 'gp-8001-1',
  lineas: [
    { id_producto: 75192, id_bodega: 1, cantidad_esperada: 10, cantidad_recibida: 10, cantidad_danada: 1, motivo_dano: 'Caja aplastada' },
    { id_producto: 75288, id_bodega: 2, cantidad_esperada: 5, cantidad_recibida: 3, cantidad_danada: 0 },
  ],
});

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
describe('Recepción en muelle con Inventario (Fase 4)', () => {
  let inventario: InventarioEspia;
  let repo: ReturnType<typeof crearRepositorio>;
  const servicio = () => new LogisticaService(repo as any, inventario);

  beforeEach(() => {
    inventario = new InventarioEspia();
    repo = crearRepositorio();
  });

  it('Inventario registra el ingreso de las aptas por bodega y luego se guarda el acta', async () => {
    const res = await servicio().registrarRecepcion(SOLICITUD());

    assert.equal(res.inventario.registrado, true);
    assert.ok(res.inventario.id_movimiento_ingreso);

    const enviado = inventario.enviados[0];
    assert.equal(enviado.id_oc, 8001);
    assert.equal(enviado.id_proveedor, 4, 'el proveedor se toma de la OC');
    assert.equal(enviado.nro_guia_proveedor, 'GP-8001-1', 'la guía se normaliza en mayúsculas');
    assert.equal(enviado.id_empleado, 304);
    assert.deepEqual(enviado.lineas, [
      { id_producto: 75192, id_bodega: 1, cantidad: 9 },
      { id_producto: 75288, id_bodega: 2, cantidad: 3 },
    ]);

    const acta = repo.actas[0];
    assert.equal(acta.id_proveedor, 4);
    assert.equal(acta.nro_guia_proveedor, 'GP-8001-1');
    assert.deepEqual(acta.detalles.map((d: any) => d.id_bodega), [1, 2]);
    assert.match(acta.observacion, /movimiento #/);
  });

  it('suma en una línea el mismo producto en la misma bodega', async () => {
    const solicitud = SOLICITUD();
    solicitud.lineas = [
      { id_producto: 75192, id_bodega: 1, cantidad_esperada: 4, cantidad_recibida: 4, cantidad_danada: 0 },
      { id_producto: 75192, id_bodega: 1, cantidad_esperada: 3, cantidad_recibida: 2, cantidad_danada: 0 },
    ];
    await servicio().registrarRecepcion(solicitud);
    assert.deepEqual(inventario.enviados[0].lineas, [{ id_producto: 75192, id_bodega: 1, cantidad: 6 }]);
  });

  it('no envía líneas sin aptas; si todo llegó dañado, guarda el acta sin llamar a Inventario', async () => {
    const solicitud = SOLICITUD();
    solicitud.lineas = [
      { id_producto: 75192, id_bodega: null, cantidad_esperada: 2, cantidad_recibida: 2, cantidad_danada: 2, motivo_dano: 'Humedad' },
    ];
    const res = await servicio().registrarRecepcion(solicitud);
    assert.equal(res.inventario.registrado, false);
    assert.match(String(res.inventario.motivo), /No hay unidades aptas/);
    assert.equal(inventario.enviados.length, 0);
    assert.equal(repo.actas.length, 1);
  });

  it('exige receptor, guía del proveedor y bodega en líneas con aptas (#16 y #17)', async () => {
    const sinReceptor = { ...SOLICITUD(), id_empleado_receptor: undefined };
    await esperarError(servicio().registrarRecepcion(sinReceptor), 400, /receptor/);

    const sinGuia = { ...SOLICITUD(), nro_guia_proveedor: '  ' };
    await esperarError(servicio().registrarRecepcion(sinGuia), 400, /guía/);

    const sinBodega = SOLICITUD();
    sinBodega.lineas[1].id_bodega = null;
    await esperarError(servicio().registrarRecepcion(sinBodega), 400, /bodega/);

    assert.equal(inventario.enviados.length, 0);
    assert.equal(repo.actas.length, 0);
  });

  it('rechaza un receptor que no existe en RRHH', async () => {
    await esperarError(servicio().registrarRecepcion({ ...SOLICITUD(), id_empleado_receptor: 999 }), 422, /no existe/);
    assert.equal(inventario.enviados.length, 0);
  });

  it('la misma guía del proveedor no se registra dos veces para la OC', async () => {
    await servicio().registrarRecepcion(SOLICITUD());
    await esperarError(servicio().registrarRecepcion(SOLICITUD()), 409, /ya se registró/);
    assert.equal(inventario.enviados.length, 1, 'no se vuelve a llamar a Inventario');
  });

  it('Inventario caído: 503 y no se guarda el acta', async () => {
    inventario.fallar = new InventarioError({ tipo: 'SIN_CONEXION', mensaje: 'No se pudo conectar', ruta: '/movimientos/recepcion' });
    await esperarError(servicio().registrarRecepcion(SOLICITUD()), 503, /Intente más tarde/);
    assert.equal(repo.actas.length, 0);
  });

  it('Inventario no reconoce una bodega: 422 con su mensaje', async () => {
    const solicitud = SOLICITUD();
    solicitud.lineas[0].id_bodega = 99;
    await esperarError(servicio().registrarRecepcion(solicitud), 422, /bodega con ID 99/);
    assert.equal(repo.actas.length, 0);
  });

  it('si falla el guardado después del ingreso, reintentar la misma recepción no duplica el ingreso', async () => {
    repo.fallarGuardado = new Error('conexión perdida a mitad de la transacción');
    await esperarError(servicio().registrarRecepcion(SOLICITUD()), 500, /Vuelva a confirmar/);
    assert.equal(repo.actas.length, 0);

    const res = await servicio().registrarRecepcion(SOLICITUD());
    assert.equal(repo.actas.length, 1);
    assert.equal(inventario.enviados.length, 2);
    // Inventario devuelve el mismo movimiento: no hubo doble ingreso
    const primero = await inventario.registrarRecepcion({ ...inventario.enviados[0] });
    assert.equal(res.inventario.id_movimiento_ingreso, primero.ingreso.id_movimiento);
  });
});
