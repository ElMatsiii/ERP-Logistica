import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LogisticaService, ValidationError } from './logistica.service.js';

function repositorio(estado = 'Entrega Fallida') {
  let incidencia: any = null;
  return {
    async getGuiaById() {
      return { id: 'GD-1', estado_actual: estado,
        eventos: [{ id: 8, estado: 'Entrega Fallida', observacion: 'Domicilio cerrado' }] };
    },
    async derivarEntregaFallida(guiaId: string, eventoId: number, descripcion: string) {
      incidencia ??= { id: 4, guia_id: guiaId, evento_tracking_id: eventoId,
        descripcion, id_caso_postventa: null };
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
    assert.equal(primera, segunda);
    assert.equal(primera.evento_tracking_id, 8);
    assert.equal(primera.descripcion, 'Domicilio cerrado');
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
