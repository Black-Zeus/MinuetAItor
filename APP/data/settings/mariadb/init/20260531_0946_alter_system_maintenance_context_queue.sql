/* 20260531_0946_alter_system_maintenance_context_queue.sql */

-- ----------------------------------------------------------------------------
-- Observabilidad de queue:context para Knowledge Search / Contexto IA
-- ----------------------------------------------------------------------------
ALTER TABLE system_maintenance_settings
  ADD COLUMN IF NOT EXISTS monitor_context_queue_enabled TINYINT(1) NOT NULL DEFAULT 1
    AFTER pdf_queue_warning_threshold,
  ADD COLUMN IF NOT EXISTS context_queue_warning_threshold INT NOT NULL DEFAULT 10
    AFTER monitor_context_queue_enabled;

UPDATE system_maintenance_settings
SET
  monitor_context_queue_enabled = COALESCE(monitor_context_queue_enabled, 1),
  context_queue_warning_threshold = COALESCE(context_queue_warning_threshold, 10)
WHERE id = 1;

