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
  ADD COLUMN participant_id CHAR(36) NULL AFTER record_version_id;

ALTER TABLE record_version_participants
  ADD CONSTRAINT fk_rvp_participant FOREIGN KEY (participant_id) REFERENCES participants(id);

CREATE INDEX idx_rvp_participant ON record_version_participants(participant_id);
