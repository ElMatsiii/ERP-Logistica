import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigAuthError, DURACION_TOKEN_POR_DEFECTO_SEG, duracionEnSegundos, leerConfigAuth } from './auth.config.js';

const SECRETO = 'secreto-de-prueba-con-mas-de-32-caracteres!!';

describe('Configuración de autenticación (AUTH_MODO / JWT)', () => {
  describe('AUTH_MODO', () => {
    it('jwt con JWT_SECRET es válido', () => {
      const config = leerConfigAuth({ AUTH_MODO: 'jwt', JWT_SECRET: SECRETO });
      assert.equal(config.modo, 'jwt');
      assert.equal(config.jwtSecret, SECRETO);
      assert.equal(config.jwtExpiresInSeg, DURACION_TOKEN_POR_DEFECTO_SEG);
      assert.deepEqual(config.advertencias, []);
    });

    it('jwt sin JWT_SECRET impide arrancar con un mensaje claro', () => {
      for (const JWT_SECRET of [undefined, '', '   ']) {
        assert.throws(
          () => leerConfigAuth({ AUTH_MODO: 'jwt', JWT_SECRET }),
          (err: unknown) => err instanceof ConfigAuthError && /AUTH_MODO=jwt requiere JWT_SECRET/.test(err.message)
        );
      }
    });

    it('no distingue mayúsculas ni espacios', () => {
      assert.equal(leerConfigAuth({ AUTH_MODO: ' JWT ', JWT_SECRET: SECRETO }).modo, 'jwt');
      assert.equal(leerConfigAuth({ AUTH_MODO: 'Simulado' }).modo, 'simulado');
    });

    it('vacío usa simulado con una advertencia', () => {
      const config = leerConfigAuth({});
      assert.equal(config.modo, 'simulado');
      assert.ok(config.advertencias.some((a) => a.includes('AUTH_MODO vacío')));
    });

    it('un valor desconocido impide arrancar (no cae en simulado por un error de tipeo)', () => {
      assert.throws(() => leerConfigAuth({ AUTH_MODO: 'jtw', JWT_SECRET: SECRETO }), ConfigAuthError);
      assert.throws(() => leerConfigAuth({ AUTH_MODO: 'produccion' }), /AUTH_MODO="produccion" no es válido/);
    });

    it('simulado sin JWT_SECRET arranca, avisando que no habrá login', () => {
      const config = leerConfigAuth({ AUTH_MODO: 'simulado' });
      assert.equal(config.jwtSecret, null);
      assert.ok(config.advertencias.some((a) => a.includes('login con email y contraseña no estará disponible')));
    });

    it('simulado en producción genera una advertencia', () => {
      const config = leerConfigAuth({ AUTH_MODO: 'simulado', JWT_SECRET: SECRETO, NODE_ENV: 'production' });
      assert.ok(config.advertencias.some((a) => a.includes('NODE_ENV=production')));
    });
  });

  describe('JWT_SECRET', () => {
    it('se conserva tal cual, sin recortar (debe ser idéntico al de RRHH)', () => {
      const conEspacios = `  ${SECRETO}  `;
      assert.equal(leerConfigAuth({ AUTH_MODO: 'jwt', JWT_SECRET: conEspacios }).jwtSecret, conEspacios);
    });

    it('advierte si es corto, sin impedir arrancar', () => {
      const config = leerConfigAuth({ AUTH_MODO: 'jwt', JWT_SECRET: 'corto' });
      assert.equal(config.jwtSecret, 'corto');
      assert.ok(config.advertencias.some((a) => a.includes('menos de 32 caracteres')));
    });

    it('las advertencias y errores nunca muestran el secreto', () => {
      const config = leerConfigAuth({ AUTH_MODO: 'jwt', JWT_SECRET: 'corto-secreto' });
      assert.ok(config.advertencias.every((a) => !a.includes('corto-secreto')));
    });
  });

  describe('JWT_EXPIRES_IN', () => {
    it('por defecto son 8 horas, como RRHH', () => {
      assert.equal(DURACION_TOKEN_POR_DEFECTO_SEG, 28800);
      assert.equal(leerConfigAuth({ JWT_EXPIRES_IN: '' }).jwtExpiresInSeg, 28800);
    });

    it('acepta segundos o número con unidad s, m, h, d', () => {
      assert.equal(duracionEnSegundos('8h'), 28800);
      assert.equal(duracionEnSegundos('30m'), 1800);
      assert.equal(duracionEnSegundos('45s'), 45);
      assert.equal(duracionEnSegundos('1d'), 86400);
      assert.equal(duracionEnSegundos(' 2 H '), 7200);
      assert.equal(duracionEnSegundos('28800'), 28800); // sin unidad = segundos (no milisegundos)
    });

    it('rechaza valores inválidos o cero, e impide arrancar', () => {
      for (const valor of ['ocho horas', '8 horas', '-1h', '1.5h', '0', '0h', 'h']) {
        assert.throws(() => duracionEnSegundos(valor), ConfigAuthError, valor);
      }
      assert.throws(() => leerConfigAuth({ AUTH_MODO: 'jwt', JWT_SECRET: SECRETO, JWT_EXPIRES_IN: '8 horas' }), /JWT_EXPIRES_IN/);
    });
  });
});
