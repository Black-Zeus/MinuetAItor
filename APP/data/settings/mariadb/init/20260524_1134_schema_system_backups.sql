/* 20260524_1134_schema_system_backups.sql */

-- ----------------------------------------------------------------------------
-- Estado operativo global para modos protegidos y locks de operaciones criticas
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_operation_state (
  id                         TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  mode                       VARCHAR(40) NOT NULL DEFAULT 'normal',
  operation_id               CHAR(36) NULL,
  operation_type             VARCHAR(60) NULL,
  reason                     VARCHAR(500) NULL,
  started_by                 CHAR(36) NULL,
  started_by_snapshot_json   LONGTEXT NULL,
  allowed_session_jti        VARCHAR(80) NULL,
  started_at                 DATETIME NULL,
  expires_at                 DATETIME NULL,
  metadata_json              LONGTEXT NULL,
  updated_at                 DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  KEY idx_system_operation_state_mode (mode),
  KEY idx_system_operation_state_operation_id (operation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Configuracion singleton del modulo de respaldos
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_backup_settings (
  id                         TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  retention_days             INT NOT NULL DEFAULT 14,
  history_visible            TINYINT(1) NOT NULL DEFAULT 1,
  backup_purge_queue         VARCHAR(120) NOT NULL DEFAULT 'queue:backups / backup_purge',
  policies_json              LONGTEXT NOT NULL,
  created_at                 DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by                 CHAR(36) NULL,
  created_by_snapshot_json   LONGTEXT NULL,
  updated_at                 DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by                 CHAR(36) NULL,
  updated_by_snapshot_json   LONGTEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Artefactos de respaldo generados o importados
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_backup_artifacts (
  id                         CHAR(36) NOT NULL PRIMARY KEY,
  scope                      VARCHAR(30) NOT NULL,
  name                       VARCHAR(255) NOT NULL,
  status                     VARCHAR(30) NOT NULL,
  origin_type                VARCHAR(30) NOT NULL DEFAULT 'manual',
  storage_path               VARCHAR(700) NULL,
  file_path                  VARCHAR(700) NULL,
  size_bytes                 BIGINT UNSIGNED NOT NULL DEFAULT 0,
  checksum_sha256            CHAR(64) NULL,
  db_schema_version          VARCHAR(255) NULL,
  app_version                VARCHAR(80) NULL,
  metadata_json              LONGTEXT NULL,
  manifest_json              LONGTEXT NULL,
  created_at                 DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by                 CHAR(36) NULL,
  created_by_snapshot_json   LONGTEXT NULL,
  updated_at                 DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                 DATETIME NULL,
  deleted_by                 CHAR(36) NULL,
  deleted_by_snapshot_json   LONGTEXT NULL,

  KEY idx_sba_scope_created (scope, created_at),
  KEY idx_sba_status (status),
  KEY idx_sba_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Ejecuciones de operaciones de backup/restore/purge
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_backup_operations (
  id                         CHAR(36) NOT NULL PRIMARY KEY,
  operation_type             VARCHAR(60) NOT NULL,
  scope                      VARCHAR(30) NOT NULL,
  status                     VARCHAR(30) NOT NULL,
  trigger_source             VARCHAR(30) NOT NULL DEFAULT 'manual',
  job_id                     CHAR(36) NULL,
  artifact_id                CHAR(36) NULL,
  requested_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  requested_by               CHAR(36) NULL,
  requested_by_snapshot_json LONGTEXT NULL,
  started_at                 DATETIME NULL,
  finished_at                DATETIME NULL,
  message                    VARCHAR(700) NULL,
  error_message              TEXT NULL,
  payload_json               LONGTEXT NULL,
  result_json                LONGTEXT NULL,

  UNIQUE KEY uq_sbo_job_id (job_id),
  KEY idx_sbo_type_scope_status (operation_type, scope, status),
  KEY idx_sbo_requested_at (requested_at),
  KEY idx_sbo_artifact_id (artifact_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Auditoria dedicada de respaldos/restauraciones/purge
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_backup_audit_events (
  id                         BIGINT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
  event_at                   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  event_type                 VARCHAR(80) NOT NULL,
  operation_id               CHAR(36) NULL,
  artifact_id                CHAR(36) NULL,
  actor_user_id              CHAR(36) NULL,
  actor_snapshot_json        LONGTEXT NULL,
  details_json               LONGTEXT NULL,

  KEY idx_sbae_event_at (event_at),
  KEY idx_sbae_event_type (event_type),
  KEY idx_sbae_operation (operation_id),
  KEY idx_sbae_artifact (artifact_id),
  KEY idx_sbae_actor (actor_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Tareas diferidas por ventanas de mantenimiento / solo lectura
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_deferred_tasks (
  id                         BIGINT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
  action                     VARCHAR(80) NOT NULL,
  scheduled_slot             CHAR(12) NULL,
  reason                     VARCHAR(120) NOT NULL,
  maintenance_operation_id   CHAR(36) NULL,
  decision                   VARCHAR(40) NOT NULL DEFAULT 'pending',
  payload_json               LONGTEXT NULL,
  created_at                 DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at                 DATETIME NULL,
  decided_by                 CHAR(36) NULL,
  decided_by_snapshot_json   LONGTEXT NULL,

  KEY idx_sdt_decision (decision),
  KEY idx_sdt_action_slot (action, scheduled_slot),
  KEY idx_sdt_operation (maintenance_operation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

