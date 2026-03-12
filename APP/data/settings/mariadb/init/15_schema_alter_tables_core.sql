/* 15_schema_alter_tables_core.sql */

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

ALTER TABLE record_version_observations
  MODIFY COLUMN status ENUM('new','inserted','approved','rejected') NOT NULL DEFAULT 'new';

ALTER TABLE record_version_observations
  ADD COLUMN IF NOT EXISTS resolution_type ENUM('none','direct_insert','manual_update') NOT NULL DEFAULT 'none' AFTER status,
  ADD COLUMN IF NOT EXISTS editor_comment TEXT NULL AFTER resolution_type,
  ADD COLUMN IF NOT EXISTS resolved_by CHAR(36) NULL AFTER editor_comment,
  ADD COLUMN IF NOT EXISTS applied_in_version_id CHAR(36) NULL AFTER resolved_at;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS auto_send_on_preview TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active,
  ADD COLUMN IF NOT EXISTS auto_send_on_completed TINYINT(1) NOT NULL DEFAULT 0 AFTER auto_send_on_preview;

SET @fk_rvo_resolved_by_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'record_version_observations'
    AND CONSTRAINT_NAME = 'fk_rvo_resolved_by'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql := IF(
  @fk_rvo_resolved_by_exists = 0,
  'ALTER TABLE record_version_observations ADD CONSTRAINT fk_rvo_resolved_by FOREIGN KEY (resolved_by) REFERENCES users(id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_rvo_applied_version_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'record_version_observations'
    AND CONSTRAINT_NAME = 'fk_rvo_applied_version'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql := IF(
  @fk_rvo_applied_version_exists = 0,
  'ALTER TABLE record_version_observations ADD CONSTRAINT fk_rvo_applied_version FOREIGN KEY (applied_in_version_id) REFERENCES record_versions(id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
