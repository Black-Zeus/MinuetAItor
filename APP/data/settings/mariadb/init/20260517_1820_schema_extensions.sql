/* 20260517_1820_schema_extensions.sql */

-- ----------------------------------------------------------------------------
-- Catálogo maestro de participantes reutilizable entre minutas/versiones
-- ----------------------------------------------------------------------------
CREATE TABLE participants (
  id               CHAR(36) PRIMARY KEY,
  display_name     VARCHAR(220) NOT NULL,
  normalized_name  VARCHAR(220) NOT NULL,
  organization     VARCHAR(220) NULL,
  title            VARCHAR(160) NULL,
  notes            TEXT NULL,
  is_active        TINYINT(1) NOT NULL DEFAULT 1,

  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by       CHAR(36) NULL,
  updated_at       DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  updated_by       CHAR(36) NULL,

  deleted_at       DATETIME NULL,
  deleted_by       CHAR(36) NULL,

  KEY idx_participants_display_name (display_name),
  KEY idx_participants_normalized_name (normalized_name),
  KEY idx_participants_active (is_active),
  KEY idx_participants_deleted_at (deleted_at),

  CONSTRAINT fk_participants_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_participants_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_participants_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Un participante puede tener 0..N correos
-- ----------------------------------------------------------------------------
CREATE TABLE participant_emails (
  id               BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  participant_id   CHAR(36) NOT NULL,
  email            VARCHAR(254) NOT NULL,
  is_primary       TINYINT(1) NOT NULL DEFAULT 0,
  is_active        TINYINT(1) NOT NULL DEFAULT 1,

  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by       CHAR(36) NULL,
  updated_at       DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  updated_by       CHAR(36) NULL,

  deleted_at       DATETIME NULL,
  deleted_by       CHAR(36) NULL,

  UNIQUE KEY uq_participant_emails_email (email),
  KEY idx_participant_emails_participant (participant_id),
  KEY idx_participant_emails_primary (participant_id, is_primary),
  KEY idx_participant_emails_active (is_active),
  KEY idx_participant_emails_deleted_at (deleted_at),

  CONSTRAINT fk_participant_emails_participant FOREIGN KEY (participant_id) REFERENCES participants(id),
  CONSTRAINT fk_participant_emails_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_participant_emails_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_participant_emails_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Enlace opcional del snapshot por versión al catálogo maestro.
-- El mail histórico de la versión se mantiene en la propia tabla.
-- ----------------------------------------------------------------------------
ALTER TABLE record_version_participants
  ADD COLUMN IF NOT EXISTS participant_id CHAR(36) NULL AFTER record_version_id;

SET @fk_rvp_participant_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'record_version_participants'
    AND CONSTRAINT_NAME = 'fk_rvp_participant'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql := IF(
  @fk_rvp_participant_exists = 0,
  'ALTER TABLE record_version_participants ADD CONSTRAINT fk_rvp_participant FOREIGN KEY (participant_id) REFERENCES participants(id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_rvp_participant_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'record_version_participants'
    AND INDEX_NAME = 'idx_rvp_participant'
);
SET @sql := IF(
  @idx_rvp_participant_exists = 0,
  'CREATE INDEX idx_rvp_participant ON record_version_participants(participant_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_rvp_ver_email_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'record_version_participants'
    AND INDEX_NAME = 'idx_rvp_ver_email'
);
SET @sql := IF(
  @idx_rvp_ver_email_exists = 0,
  'CREATE INDEX idx_rvp_ver_email ON record_version_participants(record_version_id, email)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------------------
-- Configuraciones SMTP administrables
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS smtp_configs (
  id               CHAR(36) PRIMARY KEY,
  name             VARCHAR(120) NOT NULL,
  host             VARCHAR(255) NOT NULL,
  port             INT NOT NULL DEFAULT 587,
  username         VARCHAR(255) NULL,
  password         VARCHAR(255) NULL,
  from_name        VARCHAR(180) NOT NULL,
  from_email       VARCHAR(254) NOT NULL,
  use_tls          TINYINT(1) NOT NULL DEFAULT 0,
  use_ssl          TINYINT(1) NOT NULL DEFAULT 0,
  timeout_seconds  INT NOT NULL DEFAULT 10,
  is_active        TINYINT(1) NOT NULL DEFAULT 0,
  last_tested_at   DATETIME NULL,
  last_tested_by   CHAR(36) NULL,

  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by       CHAR(36) NULL,
  updated_at       DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  updated_by       CHAR(36) NULL,

  deleted_at       DATETIME NULL,
  deleted_by       CHAR(36) NULL,

  UNIQUE KEY uq_smtp_configs_name (name),
  KEY idx_smtp_configs_active (is_active),
  KEY idx_smtp_configs_deleted_at (deleted_at),
  KEY idx_smtp_configs_host (host),

  CONSTRAINT fk_smtp_configs_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_smtp_configs_last_tested_by FOREIGN KEY (last_tested_by) REFERENCES users(id),
  CONSTRAINT fk_smtp_configs_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_smtp_configs_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Configuraciones AI administrables
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_provider_configs (
  id                    CHAR(36) PRIMARY KEY,
  name                  VARCHAR(120) NOT NULL,
  provider_type         VARCHAR(40) NOT NULL,
  base_url              VARCHAR(255) NOT NULL,
  validation_endpoint   VARCHAR(255) NULL,
  models_endpoint       VARCHAR(255) NULL,
  model_name            VARCHAR(180) NULL,
  auth_type             VARCHAR(40) NOT NULL DEFAULT 'none',
  token_secret          TEXT NULL,
  username              VARCHAR(255) NULL,
  password_secret       TEXT NULL,
  custom_headers_json   TEXT NULL,
  allow_model_discovery TINYINT(1) NOT NULL DEFAULT 1,
  is_active             TINYINT(1) NOT NULL DEFAULT 0,
  validation_status     VARCHAR(40) NOT NULL DEFAULT 'unvalidated',
  last_validated_at     DATETIME NULL,
  last_validated_by     CHAR(36) NULL,
  last_error            TEXT NULL,
  timeout_seconds       INT NOT NULL DEFAULT 15,

  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by            CHAR(36) NULL,
  updated_at            DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  updated_by            CHAR(36) NULL,

  deleted_at            DATETIME NULL,
  deleted_by            CHAR(36) NULL,

  UNIQUE KEY uq_ai_provider_configs_name (name),
  KEY idx_ai_provider_configs_active (is_active),
  KEY idx_ai_provider_configs_provider_type (provider_type),
  KEY idx_ai_provider_configs_validation_status (validation_status),
  KEY idx_ai_provider_configs_deleted_at (deleted_at),

  CONSTRAINT fk_ai_provider_configs_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_ai_provider_configs_last_validated_by FOREIGN KEY (last_validated_by) REFERENCES users(id),
  CONSTRAINT fk_ai_provider_configs_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_ai_provider_configs_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
