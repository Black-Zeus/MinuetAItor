/* 20260517_1950_alter_system_maintenance_queue_monitoring.sql */

-- ----------------------------------------------------------------------------
-- Homologación de observabilidad: activo/inactivo para las 5 colas y estado de alerta persistido
-- ----------------------------------------------------------------------------
ALTER TABLE system_maintenance_settings
  ADD COLUMN IF NOT EXISTS monitor_minutes_queue_enabled TINYINT(1) NOT NULL DEFAULT 1
    AFTER maintenance_queue_warning_threshold,
  ADD COLUMN IF NOT EXISTS monitor_email_queue_enabled TINYINT(1) NOT NULL DEFAULT 1
    AFTER minutes_queue_warning_threshold,
  ADD COLUMN IF NOT EXISTS monitor_pdf_queue_enabled TINYINT(1) NOT NULL DEFAULT 1
    AFTER email_queue_warning_threshold,
  ADD COLUMN IF NOT EXISTS queue_monitor_state_json LONGTEXT NULL
    AFTER dlq_warning_threshold;
