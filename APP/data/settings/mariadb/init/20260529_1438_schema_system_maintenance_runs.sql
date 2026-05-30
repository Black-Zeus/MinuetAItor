/* 20260529_1438_schema_system_maintenance_runs.sql */

-- ----------------------------------------------------------------------------
-- Historial minimo e idempotencia de ejecuciones de Sistema >> Mantenimiento
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_maintenance_runs (
  id                 CHAR(36) NOT NULL PRIMARY KEY,
  job_id             CHAR(36) NOT NULL,
  action             VARCHAR(80) NOT NULL,
  scheduled_slot     CHAR(12) NULL,
  trigger_type       VARCHAR(30) NOT NULL,
  status             VARCHAR(30) NOT NULL DEFAULT 'dispatch_pending',

  queued_at          DATETIME NULL,
  started_at         DATETIME NULL,
  finished_at        DATETIME NULL,
  duration_ms        BIGINT NULL,
  affected_count     INT NULL,
  attempt            INT NOT NULL DEFAULT 1,
  max_attempts       INT NOT NULL DEFAULT 1,

  message            VARCHAR(700) NULL,
  error_code         VARCHAR(80) NULL,
  error_detail       TEXT NULL,
  requested_by       CHAR(36) NULL,
  correlation_id     CHAR(36) NOT NULL,

  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_smr_job_id (job_id),
  UNIQUE KEY uq_smr_scheduler_slot_action (action, scheduled_slot, trigger_type),
  UNIQUE KEY uq_smr_correlation_id (correlation_id),
  KEY idx_smr_status_updated (status, updated_at),
  KEY idx_smr_action_created (action, created_at),
  KEY idx_smr_requested_by (requested_by),

  CONSTRAINT fk_smr_requested_by FOREIGN KEY (requested_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
