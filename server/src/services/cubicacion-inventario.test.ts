import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { LogisticaService } from './logistica.service.js';
import { ClienteInventarioSimulado, InventarioError } from '../integrations/inventario/index.js';

/** Cliente simulado que cuenta las consultas de productos y puede quedar "caído" */
class InventarioContador extends ClienteInventarioSimulado {
  consultas: number[] = [];
  caido = false;

  async obtenerProducto(id: number) {
    this.consultas.push(id);
    if (this.caido) {
      throw new InventarioError({ tipo: 'TIMEOUT', mensaje: 'Inventario no respondió', ruta: `/productos/${id}` });
    }
    return super.obtenerProducto(id);
  }
}

function repositorio(ot: any, ocs: any[] = []) {
  return {
    async getOtById(id: string) {
      return id === ot.id ? ot : null;
    },
    async getComprasPendientes() {
      return ocs;
    },
    async getCompraById(id: number) {
      return ocs.find((o) => o.id_oc === id) ?? null;
    },
  } as any;
}

// Titanic (112): 10.2 kg, 70x17x50 · Hulkbuster (32): 4.65 kg, 58x12x48 (maestro de Inventario)
const otBase = (overrides: any = {}) => ({
  id: 'OT-4094',
  estado: 'CERRADO',
  detalles: [
    { id: 1, id_producto: 112, cant_solicitada: 1, cant_recolectada: 1 },
    { id: 2, id_producto: 32, cant_solicitada: 2, cant_recolectada: 2 },
  ],
  ...overrides,
});

describe('Cubicación con el maestro de Inventario (Fase 5)', () => {
  let inventario: InventarioContador;
  beforeEach(() => {
    inventario = new InventarioContador();
  });

  it('el empaque sugerido usa peso y medidas de Inventario', async () => {
    const ot = await new LogisticaService(repositorio(otBase()), inventario).getOtById('OT-4094');

    assert.equal(ot.fichas_inventario.completas, true);
    assert.deepEqual(
      ot.detalles.map((d: any) => [d.id_producto, d.peso_unitario_kg, d.largo_cm, d.alto_cm, d.ancho_cm]),
      [
        [112, 10.2, 70, 17, 50],
        [32, 4.65, 58, 12, 48],
      ]
    );
    // 10.2 + 2 x 4.65 = 19.5 kg; la caja toma la mayor medida de cada eje
    assert.deepEqual(ot.empaque_sugerido, { largo_cm: 70, alto_cm: 20, ancho_cm: 50, peso_real_kg: 19.5 });
  });

  it('en una OT PARCIAL pesa solo lo recolectado', async () => {
    const ot = await new LogisticaService(
      repositorio(
        otBase({
          estado: 'PARCIAL',
          detalles: [
            { id: 1, id_producto: 112, cant_solicitada: 1, cant_recolectada: 0 },
            { id: 2, id_producto: 32, cant_solicitada: 2, cant_recolectada: 1 },
          ],
        })
      ),
      inventario
    ).getOtById('OT-4094');

    // Solo 1 Hulkbuster: 4.65 kg y medidas de esa caja (el Titanic no se despacha)
    assert.deepEqual(ot.empaque_sugerido, { largo_cm: 58, alto_cm: 20, ancho_cm: 48, peso_real_kg: 4.65 });
  });

  it('informa los productos que Inventario no tiene, en vez de inventar el dato', async () => {
    const ot = await new LogisticaService(
      repositorio(otBase({ detalles: [{ id: 1, id_producto: 99999, cant_solicitada: 1, cant_recolectada: 1 }] })),
      inventario
    ).getOtById('OT-4094');

    assert.equal(ot.fichas_inventario.completas, false);
    assert.deepEqual(ot.fichas_inventario.faltantes, [99999]);
    assert.equal(ot.fichas_inventario.error, undefined, 'que no exista no es un error de conexión');
  });

  it('si Inventario no responde, la OT igual se muestra y se informa el motivo', async () => {
    inventario.caido = true;
    const ot = await new LogisticaService(repositorio(otBase()), inventario).getOtById('OT-4094');
    assert.equal(ot.fichas_inventario.completas, false);
    assert.deepEqual(ot.fichas_inventario.faltantes.sort(), [112, 32].sort());
    assert.match(String(ot.fichas_inventario.error), /no respondió/);
  });

  it('no repite consultas a Inventario por el mismo producto (caché)', async () => {
    const servicio = new LogisticaService(repositorio(otBase()), inventario);
    await servicio.getOtById('OT-4094');
    await servicio.getOtById('OT-4094');
    assert.deepEqual(inventario.consultas.sort((a, b) => a - b), [32, 112]);
  });

  it('las OC muestran SKU, nombre y peso de Inventario; sin dato queda null (no 2.0 kg)', async () => {
    const ocs = [
      {
        id_oc: 8001,
        proveedor: 'LEGO',
        detalles: [
          { id: 1, id_oc: 8001, id_producto: 112, cantidad_esperada: 5 },
          { id: 2, id_oc: 8001, id_producto: 99999, cantidad_esperada: 1 },
        ],
      },
    ];
    const [oc] = await new LogisticaService(repositorio(otBase(), ocs), inventario).getComprasPendientes();

    assert.deepEqual(
      oc.detalles.map((d: any) => [d.id_producto, d.sku, d.nombre_producto, d.peso_unitario_kg]),
      [
        [112, '10294-1', 'Titanic', 10.2],
        [99999, null, 'Producto #99999', null],
      ]
    );
  });
});
