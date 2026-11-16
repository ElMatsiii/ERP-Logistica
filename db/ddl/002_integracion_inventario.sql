-- =============================================================================
-- LesGo ERP - Módulo de Logística y Transporte (Grupo 6)
-- 002: cambios de la integración con Inventario (acuerdo del 16-11-2026)
-- Se ejecuta después de 001. Idempotente: se puede correr más de una vez.
-- Solo toca el esquema logistica.
-- Nota para run-ddl.ts: sin punto y coma dentro de comentarios ni de textos.
-- =============================================================================

-- 1. id_pedido pasa a entero, como en e-Commerce e Inventario (PED-10294 -> 10294)
ALTER TABLE logistica.log_ot_picking
  ALTER COLUMN id_pedido TYPE INTEGER
  USING regexp_replace(id_pedido::text, '[^0-9]', '', 'g')::integer;

-- 2. Proveedor y guía del proveedor en la recepción (Inventario los exige)
-- La OC de prueba también guarda el id del proveedor, para copiarlo a la recepción.
ALTER TABLE logistica.test_log_compras_oc ADD COLUMN IF NOT EXISTS id_proveedor INTEGER;

UPDATE logistica.test_log_compras_oc oc
SET id_proveedor = p.rk
FROM (
  SELECT id_oc, DENSE_RANK() OVER (ORDER BY proveedor) AS rk
  FROM logistica.test_log_compras_oc
) p
WHERE oc.id_oc = p.id_oc AND oc.id_proveedor IS NULL;

ALTER TABLE logistica.test_log_compras_oc ALTER COLUMN id_proveedor SET NOT NULL;

-- Quedan opcionales hasta que el formulario de recepción los envíe.
ALTER TABLE logistica.log_recepcion ADD COLUMN IF NOT EXISTS id_proveedor INTEGER;
ALTER TABLE logistica.log_recepcion ADD COLUMN IF NOT EXISTS nro_guia_proveedor TEXT;

UPDATE logistica.log_recepcion r
SET id_proveedor = oc.id_proveedor
FROM logistica.test_log_compras_oc oc
WHERE r.id_oc = oc.id_oc AND r.id_proveedor IS NULL;

-- Una OC puede llegar en varias entregas, pero cada guía del proveedor se registra una vez.
CREATE UNIQUE INDEX IF NOT EXISTS log_recepcion_id_oc_nro_guia_proveedor_key
  ON logistica.log_recepcion (id_oc, nro_guia_proveedor);

-- 3. Bodega de Inventario donde entra cada línea recibida
ALTER TABLE logistica.log_recepcion_detalle ADD COLUMN IF NOT EXISTS id_bodega INTEGER;

-- 4. Peso y medidas viven en el maestro de productos de Inventario
ALTER TABLE logistica.log_ot_picking_detalle DROP COLUMN IF EXISTS peso_unitario_kg;
ALTER TABLE logistica.log_ot_picking_detalle DROP COLUMN IF EXISTS largo_cm;
ALTER TABLE logistica.log_ot_picking_detalle DROP COLUMN IF EXISTS alto_cm;
ALTER TABLE logistica.log_ot_picking_detalle DROP COLUMN IF EXISTS ancho_cm;

-- 5. Estados de la guía mientras Inventario confirma el egreso
INSERT INTO logistica.log_estado_envio (codigo, nombre, orden_flujo, es_terminal) VALUES
  ('PENDIENTE_STOCK', 'Pendiente de stock', 0, false),
  ('ERROR_STOCK', 'Error de stock', 0, false)
ON CONFLICT (codigo) DO NOTHING;

-- 6. Operador y receptor deben ser empleados de RRHH.
-- Por ahora apuntan a la tabla de prueba test_log_rrhh_empleado. Cuando RRHH entregue los
-- id reales, se cambian a rrhh.empleado. NOT VALID: no revisa filas antiguas, solo las nuevas.
ALTER TABLE logistica.log_ot_picking DROP CONSTRAINT IF EXISTS log_ot_picking_id_operador_fkey;
ALTER TABLE logistica.log_ot_picking
  ADD CONSTRAINT log_ot_picking_id_operador_fkey
  FOREIGN KEY (id_operador) REFERENCES logistica.test_log_rrhh_empleado (id_empleado)
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

ALTER TABLE logistica.log_recepcion DROP CONSTRAINT IF EXISTS log_recepcion_id_empleado_receptor_fkey;
ALTER TABLE logistica.log_recepcion
  ADD CONSTRAINT log_recepcion_id_empleado_receptor_fkey
  FOREIGN KEY (id_empleado_receptor) REFERENCES logistica.test_log_rrhh_empleado (id_empleado)
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
