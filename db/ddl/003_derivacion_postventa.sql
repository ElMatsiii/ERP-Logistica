ALTER TABLE logistica.log_incidencia
  ADD COLUMN IF NOT EXISTS evento_tracking_id INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS log_incidencia_evento_tracking_id_key
  ON logistica.log_incidencia (evento_tracking_id);
