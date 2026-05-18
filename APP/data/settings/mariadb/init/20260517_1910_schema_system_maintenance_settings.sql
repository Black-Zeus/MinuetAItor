/* 20260517_1910_schema_system_maintenance_settings.sql */

-- ----------------------------------------------------------------------------
-- Configuración singleton del submódulo de mantenimiento del sistema
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_maintenance_settings (
  id                                     TINYINT UNSIGNED NOT NULL PRIMARY KEY,

  session_cleanup_enabled                TINYINT(1) NOT NULL DEFAULT 1,
  session_cleanup_cron                   VARCHAR(40) NOT NULL DEFAULT '0 * * * *',
  session_cleanup_mode                   VARCHAR(40) NOT NULL DEFAULT 'soft_logout',

  temp_cleanup_enabled                   TINYINT(1) NOT NULL DEFAULT 1,
  temp_cleanup_cron                      VARCHAR(40) NOT NULL DEFAULT '0 3 * * *',
  temp_cleanup_max_age_days              INT NOT NULL DEFAULT 7,

  monitor_maintenance_queue_enabled      TINYINT(1) NOT NULL DEFAULT 1,
  maintenance_queue_warning_threshold    INT NOT NULL DEFAULT 25,
  monitor_minutes_queue_enabled          TINYINT(1) NOT NULL DEFAULT 1,
  minutes_queue_warning_threshold        INT NOT NULL DEFAULT 5,
  monitor_email_queue_enabled            TINYINT(1) NOT NULL DEFAULT 1,
  email_queue_warning_threshold          INT NOT NULL DEFAULT 20,
  monitor_pdf_queue_enabled              TINYINT(1) NOT NULL DEFAULT 1,
  pdf_queue_warning_threshold            INT NOT NULL DEFAULT 10,
  monitor_dlq_enabled                    TINYINT(1) NOT NULL DEFAULT 1,
  dlq_warning_threshold                  INT NOT NULL DEFAULT 10,
  queue_monitor_state_json               LONGTEXT NULL,

  last_session_cleanup_enqueued_at       DATETIME NULL,
  last_session_cleanup_enqueued_slot     CHAR(12) NULL,
  last_session_cleanup_started_at        DATETIME NULL,
  last_session_cleanup_finished_at       DATETIME NULL,
  last_session_cleanup_status            VARCHAR(20) NULL,
  last_session_cleanup_message           VARCHAR(500) NULL,
  last_session_cleanup_affected_count    INT NULL,

  last_temp_cleanup_enqueued_at          DATETIME NULL,
  last_temp_cleanup_enqueued_slot        CHAR(12) NULL,
  last_temp_cleanup_started_at           DATETIME NULL,
  last_temp_cleanup_finished_at          DATETIME NULL,
  last_temp_cleanup_status               VARCHAR(20) NULL,
  last_temp_cleanup_message              VARCHAR(500) NULL,
  last_temp_cleanup_affected_count       INT NULL,

  created_at                             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by                             CHAR(36) NULL,
  updated_at                             DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by                             CHAR(36) NULL,

  CONSTRAINT fk_sms_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_sms_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
