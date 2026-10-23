-- =============================================================================
-- LesGo ERP - Módulo de Logística y Transporte (Grupo 6)
-- Script DDL idempotente para el esquema propio: logistica
-- Regla de seguridad: Crea únicamente objetos dentro del esquema `logistica`
-- usando CREATE TABLE IF NOT EXISTS, sin tocar esquemas de otros módulos.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS logistica;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'EstadoOT' AND n.nspname = 'logistica'
  ) THEN
    CREATE TYPE logistica."EstadoOT" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'PARCIAL', 'CERRADO');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS logistica.log_transportista (
  id SERIAL PRIMARY KEY,
  rut TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  contacto_email TEXT NOT NULL,
  contacto_telefono TEXT NOT NULL,
  factor_volumetrico_default INTEGER NOT NULL DEFAULT 5000,
  activo BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS logistica.log_servicio (
  id SERIAL PRIMARY KEY,
  transportista_id INTEGER NOT NULL REFERENCES logistica.log_transportista(id) ON DELETE CASCADE ON UPDATE CASCADE,
  nombre TEXT NOT NULL,
  dias_transito_comprometidos INTEGER NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS logistica.log_region (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS logistica.log_comuna (
  id SERIAL PRIMARY KEY,
  region_id INTEGER NOT NULL REFERENCES logistica.log_region(id) ON DELETE CASCADE ON UPDATE CASCADE,
  nombre TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS logistica.log_cobertura (
  id SERIAL PRIMARY KEY,
  servicio_id INTEGER NOT NULL REFERENCES logistica.log_servicio(id) ON DELETE CASCADE ON UPDATE CASCADE,
  comuna_id INTEGER NOT NULL REFERENCES logistica.log_comuna(id) ON DELETE CASCADE ON UPDATE CASCADE,
  vigencia_desde TIMESTAMP(3) NOT NULL,
  vigencia_hasta TIMESTAMP(3) NOT NULL,
  vigente BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS logistica.log_tarifa (
  id SERIAL PRIMARY KEY,
  servicio_id INTEGER NOT NULL REFERENCES logistica.log_servicio(id) ON DELETE CASCADE ON UPDATE CASCADE,
  comuna_id INTEGER NOT NULL REFERENCES logistica.log_comuna(id) ON DELETE CASCADE ON UPDATE CASCADE,
  peso_desde_kg NUMERIC(10, 2) NOT NULL,
  peso_hasta_kg NUMERIC(10, 2) NOT NULL,
  precio_base NUMERIC(10, 2) NOT NULL,
  precio_kg_adicional NUMERIC(10, 2) NOT NULL,
  vigencia_desde TIMESTAMP(3) NOT NULL,
  vigencia_hasta TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS logistica.log_direccion (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL,
  cliente_nombre TEXT,
  cliente_rut TEXT,
  comuna_id INTEGER NOT NULL REFERENCES logistica.log_comuna(id) ON DELETE CASCADE ON UPDATE CASCADE,
  calle TEXT NOT NULL,
  numero TEXT NOT NULL,
  depto TEXT,
  referencia TEXT,
  activa BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS logistica.log_ot_picking (
  id TEXT PRIMARY KEY,
  id_pedido TEXT NOT NULL,
  id_operador INTEGER NOT NULL,
  nombre_operador TEXT NOT NULL,
  estado logistica."EstadoOT" NOT NULL,
  fecha_creacion TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cliente_id INTEGER,
  cliente_nombre TEXT,
  cliente_rut TEXT,
  direccion_id INTEGER REFERENCES logistica.log_direccion(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS logistica.log_ot_picking_detalle (
  id SERIAL PRIMARY KEY,
  ot_id TEXT NOT NULL REFERENCES logistica.log_ot_picking(id) ON DELETE CASCADE ON UPDATE CASCADE,
  id_producto INTEGER NOT NULL,
  sku TEXT NOT NULL,
  nombre_producto TEXT NOT NULL,
  cant_solicitada INTEGER NOT NULL,
  cant_recolectada INTEGER NOT NULL,
  peso_unitario_kg NUMERIC(10, 2),
  largo_cm NUMERIC(10, 2),
  alto_cm NUMERIC(10, 2),
  ancho_cm NUMERIC(10, 2)
);

CREATE TABLE IF NOT EXISTS logistica.log_guia_despacho (
  id TEXT PRIMARY KEY,
  ot_id TEXT NOT NULL REFERENCES logistica.log_ot_picking(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  transportista_id INTEGER NOT NULL REFERENCES logistica.log_transportista(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  servicio_id INTEGER NOT NULL REFERENCES logistica.log_servicio(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  direccion_id INTEGER NOT NULL REFERENCES logistica.log_direccion(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  num_seguimiento TEXT NOT NULL UNIQUE,
  factor_volumetrico_aplicado INTEGER NOT NULL,
  peso_real_total_kg NUMERIC(10, 2) NOT NULL,
  peso_volumetrico_total_kg NUMERIC(10, 2) NOT NULL,
  costo_envio NUMERIC(10, 2) NOT NULL,
  estado_actual TEXT NOT NULL,
  fecha_emision TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS logistica.log_bulto (
  id SERIAL PRIMARY KEY,
  guia_id TEXT NOT NULL REFERENCES logistica.log_guia_despacho(id) ON DELETE CASCADE ON UPDATE CASCADE,
  largo_cm NUMERIC(10, 2) NOT NULL,
  alto_cm NUMERIC(10, 2) NOT NULL,
  ancho_cm NUMERIC(10, 2) NOT NULL,
  peso_real_kg NUMERIC(10, 2) NOT NULL,
  peso_volumetrico_kg NUMERIC(10, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS logistica.log_evento_tracking (
  id SERIAL PRIMARY KEY,
  guia_id TEXT NOT NULL REFERENCES logistica.log_guia_despacho(id) ON DELETE CASCADE ON UPDATE CASCADE,
  estado TEXT NOT NULL,
  fecha_hora TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usuario_responsable TEXT NOT NULL,
  observacion TEXT NOT NULL
);

-- =============================================================================
-- 5 Tablas adicionales del Modelo Lógico del Informe (Completando las 17 log_*)
-- =============================================================================

CREATE TABLE IF NOT EXISTS logistica.log_estado_envio (
  id SERIAL PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  orden_flujo INTEGER NOT NULL,
  es_terminal BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS logistica.log_bulto_detalle (
  id SERIAL PRIMARY KEY,
  bulto_id INTEGER NOT NULL REFERENCES logistica.log_bulto(id) ON DELETE CASCADE ON UPDATE CASCADE,
  ot_detalle_id INTEGER NOT NULL REFERENCES logistica.log_ot_picking_detalle(id) ON DELETE CASCADE ON UPDATE CASCADE,
  cantidad INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS logistica.log_incidencia (
  id SERIAL PRIMARY KEY,
  guia_id TEXT NOT NULL REFERENCES logistica.log_guia_despacho(id) ON DELETE CASCADE ON UPDATE CASCADE,
  tipo TEXT NOT NULL,
  fecha_registro TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  descripcion TEXT NOT NULL,
  id_caso_postventa INTEGER,
  resuelta BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS logistica.log_recepcion (
  id SERIAL PRIMARY KEY,
  id_oc INTEGER NOT NULL,
  id_empleado_receptor INTEGER NOT NULL,
  fecha_recepcion TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado TEXT NOT NULL,
  observacion TEXT
);

CREATE TABLE IF NOT EXISTS logistica.log_recepcion_detalle (
  id SERIAL PRIMARY KEY,
  recepcion_id INTEGER NOT NULL REFERENCES logistica.log_recepcion(id) ON DELETE CASCADE ON UPDATE CASCADE,
  id_producto INTEGER NOT NULL,
  cantidad_esperada INTEGER NOT NULL,
  cantidad_recibida INTEGER NOT NULL,
  cantidad_danada INTEGER NOT NULL DEFAULT 0,
  motivo_dano TEXT
);

-- =============================================================================
-- 10 Tablas de prueba que simulan otros módulos (Sección 9.2 - test_log_*)
-- =============================================================================

CREATE TABLE IF NOT EXISTS logistica.test_log_ventas_cliente (
  id_cliente SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  rut TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS logistica.test_log_ventas_pedido (
  id_pedido SERIAL PRIMARY KEY,
  id_cliente INTEGER NOT NULL REFERENCES logistica.test_log_ventas_cliente(id_cliente) ON DELETE CASCADE ON UPDATE CASCADE,
  numero TEXT NOT NULL UNIQUE,
  fecha TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS logistica.test_log_ventas_pedido_detalle (
  id SERIAL PRIMARY KEY,
  id_pedido INTEGER NOT NULL REFERENCES logistica.test_log_ventas_pedido(id_pedido) ON DELETE CASCADE ON UPDATE CASCADE,
  id_producto INTEGER NOT NULL,
  cantidad INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS logistica.test_log_inv_producto (
  id_producto INTEGER PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  peso_unitario_kg NUMERIC(10, 2),
  largo_cm NUMERIC(10, 2),
  alto_cm NUMERIC(10, 2),
  ancho_cm NUMERIC(10, 2)
);

CREATE TABLE IF NOT EXISTS logistica.test_log_inv_mov (
  id_mov SERIAL PRIMARY KEY,
  id_producto INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  cantidad INTEGER NOT NULL,
  fecha TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  referencia_origen TEXT NOT NULL,
  id_usuario INTEGER
);

CREATE TABLE IF NOT EXISTS logistica.test_log_rrhh_empleado (
  id_empleado SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  cargo TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS logistica.test_log_rrhh_rol (
  id_rol SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS logistica.test_log_rrhh_usuario (
  id_usuario SERIAL PRIMARY KEY,
  id_empleado INTEGER NOT NULL REFERENCES logistica.test_log_rrhh_empleado(id_empleado) ON DELETE CASCADE ON UPDATE CASCADE,
  id_rol INTEGER NOT NULL REFERENCES logistica.test_log_rrhh_rol(id_rol) ON DELETE CASCADE ON UPDATE CASCADE,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS logistica.test_log_compras_oc (
  id_oc SERIAL PRIMARY KEY,
  proveedor TEXT NOT NULL,
  fecha TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS logistica.test_log_compras_oc_detalle (
  id SERIAL PRIMARY KEY,
  id_oc INTEGER NOT NULL REFERENCES logistica.test_log_compras_oc(id_oc) ON DELETE CASCADE ON UPDATE CASCADE,
  id_producto INTEGER NOT NULL,
  cantidad_esperada INTEGER NOT NULL
);
