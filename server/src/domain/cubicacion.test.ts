import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarDimensionesBulto,
  calcularPesoVolumetrico,
  determinarPesoCobrado,
  cubicarBultos,
  calcularCostoEnvio,
  validarTransicionEstado,
  validarCantidadRecolectada,
  evaluarEstadoPickingOt,
  evaluarRecepcionOc,
} from './cubicacion.js';

describe('ELT-34 · Tests Unitarios de Dominio (Logística y Transporte)', () => {
  describe('1. Cubicación Volumétrica (HU-04)', () => {
    it('calcula correctamente el peso volumétrico para LEGO Millennium Falcon 75192 con factor 5000', () => {
      // (53 * 46 * 38) / 5000 = 92644 / 5000 = 18.5288 -> 18.53 kg
      const pesoVol = calcularPesoVolumetrico(53, 46, 38, 5000);
      assert.equal(pesoVol, 18.53);
    });

    it('calcula correctamente el peso volumétrico con factor 4000 (Starken)', () => {
      // (53 * 46 * 38) / 4000 = 23.161 -> 23.16 kg
      const pesoVol = calcularPesoVolumetrico(53, 46, 38, 4000);
      assert.equal(pesoVol, 23.16);
    });

    it('determina el peso a cobrar como el máximo entre peso real y volumétrico', () => {
      assert.equal(determinarPesoCobrado(13.2, 18.53), 18.53);
      assert.equal(determinarPesoCobrado(20.0, 15.4), 20.0);
    });

    it('rechaza dimensiones o pesos menores o iguales a cero', () => {
      assert.equal(validarDimensionesBulto({ largo_cm: 0, alto_cm: 30, ancho_cm: 20, peso_real_kg: 2 }).valido, false);
      assert.equal(validarDimensionesBulto({ largo_cm: 40, alto_cm: 30, ancho_cm: 20, peso_real_kg: -1 }).valido, false);
      assert.equal(validarDimensionesBulto({ largo_cm: 40, alto_cm: 30, ancho_cm: 20, peso_real_kg: 2.5 }).valido, true);
    });

    it('cubica múltiples bultos sumando sus pesos y determinando la base tarifable total', () => {
      const resultado = cubicarBultos(
        [
          { largo_cm: 50, alto_cm: 40, ancho_cm: 30, peso_real_kg: 5.0 }, // vol: 60000/5000 = 12.0 kg
          { largo_cm: 40, alto_cm: 30, ancho_cm: 20, peso_real_kg: 3.5 }, // vol: 24000/5000 = 4.8 kg
        ],
        5000
      );
      assert.equal(resultado.peso_real_total_kg, 8.5);
      assert.equal(resultado.peso_volumetrico_total_kg, 16.8);
      assert.equal(resultado.peso_cobrado_total_kg, 16.8);
    });
  });

  describe('2. Tarificación de Transporte (HU-04)', () => {
    const tarifaLaSerena = {
      peso_desde_kg: 0,
      peso_hasta_kg: 3,
      precio_base: 4500,
      precio_kg_adicional: 1200,
    };

    it('cobra solo el precio base cuando el peso cobrado está dentro del tramo base', () => {
      const costo = calcularCostoEnvio(2.4, tarifaLaSerena);
      assert.equal(costo, 4500);
    });

    it('aplica recargo por cada kg adicional redondeado hacia arriba cuando supera el tramo base', () => {
      // 18.53 kg -> excedente sobre 3 kg = 15.53 kg -> ceil(15.53) = 16 kg adicionales
      // 4500 + 16 * 1200 = 4500 + 19200 = 23700
      const costo = calcularCostoEnvio(18.53, tarifaLaSerena);
      assert.equal(costo, 23700);
    });
  });

  describe('3. Máquina de Estados del Envío (HU-07)', () => {
    it('permite transiciones válidas en el flujo normal y de contingencia', () => {
      assert.equal(validarTransicionEstado('Preparado', 'Despachado').valido, true);
      assert.equal(validarTransicionEstado('Despachado', 'En tránsito').valido, true);
      assert.equal(validarTransicionEstado('En tránsito', 'Entregado conforme').valido, true);
      assert.equal(validarTransicionEstado('En tránsito', 'Entrega Fallida').valido, true);
      assert.equal(validarTransicionEstado('Entrega Fallida', 'Devuelto').valido, true);
    });

    it('bloquea transiciones desde estados terminales (Entregado conforme / Devuelto)', () => {
      const res1 = validarTransicionEstado('Entregado conforme', 'En tránsito');
      assert.equal(res1.valido, false);
      const res2 = validarTransicionEstado('Devuelto', 'Preparado');
      assert.equal(res2.valido, false);
    });

    it('bloquea saltos regresivos inválidos (ej. de En tránsito a Preparado)', () => {
      const res = validarTransicionEstado('En tránsito', 'Preparado');
      assert.equal(res.valido, false);
    });
  });

  describe('4. Picking (HU-03) y Recepción de Órdenes de Compra (HU-06)', () => {
    it('impide recolectar una cantidad mayor a la solicitada en la OT', () => {
      const res = validarCantidadRecolectada(2, 3);
      assert.equal(res.valido, false);
    });

    it('marca la OT como CERRADO si se recolecta el 100% y PARCIAL si existe faltante', () => {
      assert.equal(
        evaluarEstadoPickingOt([
          { id_producto: 75192, cant_solicitada: 1, cant_recolectada: 1 },
          { id_producto: 75288, cant_solicitada: 2, cant_recolectada: 2 },
        ]),
        'CERRADO'
      );
      assert.equal(
        evaluarEstadoPickingOt([
          { id_producto: 10278, cant_solicitada: 1, cant_recolectada: 1 },
          { id_producto: 10284, cant_solicitada: 1, cant_recolectada: 0 },
        ]),
        'PARCIAL'
      );
    });

    it('evalúa recepción de OC descontando unidades dañadas del ingreso ENTRADA a inventario', () => {
      const recepcion = evaluarRecepcionOc([
        { id_producto: 75192, cantidad_esperada: 10, cantidad_recibida: 10, cantidad_danada: 0 },
        { id_producto: 75288, cantidad_esperada: 15, cantidad_recibida: 15, cantidad_danada: 2 },
      ]);
      assert.equal(recepcion.estado_recepcion, 'CON_OBSERVACIONES');
      assert.equal(recepcion.total_esperado, 25);
      assert.equal(recepcion.total_recibido, 25);
      assert.equal(recepcion.total_danado, 2);
      assert.equal(recepcion.total_apto_inventario, 23);
      assert.deepEqual(recepcion.movimientos_entrada, [
        { id_producto: 75192, tipo: 'ENTRADA', cantidad: 10 },
        { id_producto: 75288, tipo: 'ENTRADA', cantidad: 13 },
      ]);
    });

    it('clasifica recepción como PARCIAL cuando llegan menos unidades que las esperadas en la OC', () => {
      const recepcion = evaluarRecepcionOc([
        { id_producto: 10284, cantidad_esperada: 12, cantidad_recibida: 10, cantidad_danada: 0 },
      ]);
      assert.equal(recepcion.estado_recepcion, 'PARCIAL');
      assert.equal(recepcion.total_apto_inventario, 10);
    });
  });
});
