-- =============================================================================
-- LesGo ERP - Módulo de Logística y Transporte (Grupo 6)
-- DML 001: alinear los IDs de producto de los datos de prueba con el maestro de Inventario
--
-- Antes usábamos el número de set LEGO como id_producto (10294). Inventario usa su propio ID
-- (inventario.inv_producto.id_producto = 112) y guarda el número de set en el SKU (10294-1).
-- Los sets que Inventario no tiene se reemplazan por uno del mismo tema.
-- Mapeo tomado del maestro de Inventario en Neon el 16-11-2026.
--
-- Qué hace: cambia id_producto en las 6 tablas de logistica que lo usan, y además el SKU y el
-- nombre en log_ot_picking_detalle y el SKU, nombre, peso y medidas en test_log_inv_producto.
-- No toca filas con otros productos ni otros esquemas.
--
-- Cómo correrlo (una sola transacción: si algo falla, no cambia nada):
--   psql -X -1 -v ON_ERROR_STOP=1 -f db/dml/001_alinear_productos_inventario.sql
-- Se puede correr más de una vez: la segunda vez no encuentra IDs antiguos y no cambia nada.
-- No lo ejecuta npm run db:ddl (ese script solo lee db/ddl).
-- =============================================================================

CREATE TEMP TABLE mapa_productos (
  id_viejo INTEGER PRIMARY KEY,
  id_nuevo INTEGER NOT NULL UNIQUE,
  sku TEXT NOT NULL,
  nombre TEXT NOT NULL,
  peso_unitario_kg NUMERIC(10, 2) NOT NULL,
  largo_cm NUMERIC(10, 2) NOT NULL,
  alto_cm NUMERIC(10, 2) NOT NULL,
  ancho_cm NUMERIC(10, 2) NOT NULL
) ON COMMIT DROP;

INSERT INTO mapa_productos VALUES
  (10278, 1, '60380-1', 'Downtown', 2.41, 48.00, 9.00, 38.00),
  (10283, 121, '10497-1', 'Galaxy Explorer', 1.58, 48.00, 9.00, 38.00),
  (10284, 117, '10284-1', 'Camp Nou - FC Barcelona', 6.26, 70.00, 17.00, 50.00),
  (10294, 112, '10294-1', 'Titanic', 10.20, 70.00, 17.00, 50.00),
  (10295, 72, '42172-1', 'McLaren P1', 4.48, 58.00, 12.00, 48.00),
  (10305, 119, '10305-1', 'Lion Knights'' Castle', 5.17, 58.00, 12.00, 48.00),
  (10307, 111, '10307-1', 'Eiffel Tower', 11.20, 70.00, 17.00, 50.00),
  (21323, 120, '10366-1', 'Tropical Aquarium', 4.77, 58.00, 12.00, 48.00),
  (42143, 74, '42143-1', 'Ferrari Daytona SP3', 4.36, 58.00, 12.00, 48.00),
  (71043, 88, '76419-1', 'Hogwarts Castle and Grounds', 3.13, 58.00, 12.00, 48.00),
  (71741, 42, '71741-1', 'NINJAGO City Gardens', 6.48, 70.00, 17.00, 50.00),
  (75192, 11, '75419-1', 'Death Star', 10.13, 70.00, 17.00, 50.00),
  (75252, 14, '75457-1', 'Executor Super Star Destroyer', 6.94, 70.00, 17.00, 50.00),
  (75288, 12, '75313-1', 'AT-AT', 7.66, 70.00, 17.00, 50.00),
  (76240, 32, '76210-1', 'Hulkbuster', 4.65, 58.00, 12.00, 48.00);

-- Seguridad: un producto pendiente de cambiar no puede chocar con otro que ya tenga el ID nuevo.
-- (Si el ID antiguo ya no existe, ese producto ya se alineó en una corrida anterior.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM logistica.test_log_inv_producto p
    JOIN mapa_productos m ON m.id_nuevo = p.id_producto
    WHERE EXISTS (SELECT 1 FROM logistica.test_log_inv_producto v WHERE v.id_producto = m.id_viejo)
  ) THEN
    RAISE EXCEPTION 'Algún id_producto nuevo ya existe en test_log_inv_producto: se cancela sin cambios';
  END IF;
END $$;

-- 1. Productos de prueba: ID, SKU, nombre, peso y medidas del maestro de Inventario
UPDATE logistica.test_log_inv_producto p
SET id_producto = m.id_nuevo, sku = m.sku, nombre = m.nombre, peso_unitario_kg = m.peso_unitario_kg,
    largo_cm = m.largo_cm, alto_cm = m.alto_cm, ancho_cm = m.ancho_cm
FROM mapa_productos m WHERE p.id_producto = m.id_viejo;

-- 2. Detalle de las OT: ID, SKU y nombre
UPDATE logistica.log_ot_picking_detalle d
SET id_producto = m.id_nuevo, sku = m.sku, nombre_producto = m.nombre
FROM mapa_productos m WHERE d.id_producto = m.id_viejo;

-- 3. Resto de tablas: solo el ID
UPDATE logistica.log_recepcion_detalle d SET id_producto = m.id_nuevo
FROM mapa_productos m WHERE d.id_producto = m.id_viejo;

UPDATE logistica.test_log_compras_oc_detalle d SET id_producto = m.id_nuevo
FROM mapa_productos m WHERE d.id_producto = m.id_viejo;

UPDATE logistica.test_log_ventas_pedido_detalle d SET id_producto = m.id_nuevo
FROM mapa_productos m WHERE d.id_producto = m.id_viejo;

UPDATE logistica.test_log_inv_mov d SET id_producto = m.id_nuevo
FROM mapa_productos m WHERE d.id_producto = m.id_viejo;

-- Verificación: no debe quedar ningún ID antiguo; si queda alguno, se deshace todo
DO $$
DECLARE restantes INTEGER;
BEGIN
  SELECT count(*) INTO restantes FROM (
    SELECT id_producto FROM logistica.test_log_inv_producto UNION ALL
    SELECT id_producto FROM logistica.log_ot_picking_detalle UNION ALL
    SELECT id_producto FROM logistica.log_recepcion_detalle UNION ALL
    SELECT id_producto FROM logistica.test_log_compras_oc_detalle UNION ALL
    SELECT id_producto FROM logistica.test_log_ventas_pedido_detalle UNION ALL
    SELECT id_producto FROM logistica.test_log_inv_mov
  ) x WHERE id_producto IN (10278, 10283, 10284, 10294, 10295, 10305, 10307, 21323, 42143, 71043, 71741, 75192, 75252, 75288, 76240);
  IF restantes > 0 THEN
    RAISE EXCEPTION 'Quedaron % filas con IDs antiguos: se cancela sin cambios', restantes;
  END IF;
  RAISE NOTICE 'Productos alineados con el maestro de Inventario';
END $$;
