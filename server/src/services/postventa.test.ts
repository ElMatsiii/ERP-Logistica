import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LogisticaService, ValidationError } from './logistica.service.js';

function repositorio(estado = 'Entrega Fallida') {
  let incidencia: any = null;
  return {
    async getGuiaById() {
      return { id: 'GD-1', num_seguimiento: 'CHX-1', estado_actual: estado,
        ot: { id_pedido: 10295, detalles: [
          { id: 2, id_producto: 12, sku: '75313-1', cant_recolectada: 1 },
          { id: 3, id_producto: 12, sku: '75313-1', cant_recolectada: 2 },
          { id: 4, id_producto: 32, sku: '76210-1', cant_recolectada: 0 },
        ] },
        eventos: [{ id: 8, estado: 'Entrega Fallida', observacion: 'Domicilio cerrado',
          fecha_hora: new Date('2026-11-23T14:45:00.000Z') }] };
    },
    async derivarEntregaFallida(guiaId: string, eventoId: number, descripcion: string) {
      incidencia ??= { id: 4, guia_id: guiaId, evento_tracking_id: eventoId,
        tipo: 'ENTREGA_FALLIDA', descripcion, fecha_registro: new Date('2026-11-23T15:30:00.000Z'),
        id_caso_postventa: null };
      return incidencia;
    },
    async getIncidencia(id: number) { return id === 4 ? incidencia : null; },
    async vincularCasoPostventa(_id: number, casoId: number) {
      if (incidencia.id_caso_postventa === null) incidencia.id_caso_postventa = casoId;
      return incidencia;
    },
  };
}

describe('Derivación local a Postventa', () => {
  it('reutiliza la incidencia del mismo evento fallido', async () => {
    const servicio = new LogisticaService(repositorio() as any);
    const primera = await servicio.derivarEntregaFallida('GD-1');
    const segunda = await servicio.derivarEntregaFallida('GD-1');
    assert.equal(primera.incidencia, segunda.incidencia);
    assert.deepEqual(primera.payload, segunda.payload);
    assert.deepEqual(primera.payload, {
      id_incidencia: 4,
      id_evento_tracking: 8,
      id_guia: 'GD-1',
      numero_seguimiento: 'CHX-1',
      tipo: 'ENTREGA_FALLIDA',
      motivo: 'Domicilio cerrado',
      fecha_evento: '2026-11-23T14:45:00.000Z',
      fecha_incidencia: '2026-11-23T15:30:00.000Z',
      id_pedido: 10295,
      lineas_despachadas: [
        { id_linea_ot: 2, id_producto: 12, sku: '75313-1', cantidad_despachada: 1 },
        { id_linea_ot: 3, id_producto: 12, sku: '75313-1', cantidad_despachada: 2 },
      ],
    });
  });

  it('exige que la entrega siga fallida', async () => {
    const servicio = new LogisticaService(repositorio('En tránsito') as any);
    await assert.rejects(servicio.derivarEntregaFallida('GD-1'),
      (error: any) => error instanceof ValidationError && error.statusCode === 409);
  });

  it('vincula el mismo caso de forma idempotente y rechaza otro', async () => {
    const servicio = new LogisticaService(repositorio() as any);
    await servicio.derivarEntregaFallida('GD-1');
    assert.equal((await servicio.vincularCasoPostventa(4, 12)).id_caso_postventa, 12);
    assert.equal((await servicio.vincularCasoPostventa(4, 12)).id_caso_postventa, 12);
    await assert.rejects(servicio.vincularCasoPostventa(4, 13),
      (error: any) => error instanceof ValidationError && error.statusCode === 409);
  });
});
