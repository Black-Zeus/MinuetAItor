/* 20260517_1920_alter_system_maintenance_settings_queue_thresholds.sql */

-- ----------------------------------------------------------------------------
-- Umbrales persistidos para observabilidad general de colas
-- ----------------------------------------------------------------------------
ALTER TABLE system_maintenance_settings
  ADD COLUMN IF NOT EXISTS minutes_queue_warning_threshold INT NOT NULL DEFAULT 5
    AFTER maintenance_queue_warning_threshold,
  ADD COLUMN IF NOT EXISTS email_queue_warning_threshold   INT NOT NULL DEFAULT 20
    AFTER minutes_queue_warning_threshold,
  ADD COLUMN IF NOT EXISTS pdf_queue_warning_threshold     INT NOT NULL DEFAULT 10
    AFTER email_queue_warning_threshold;
