/* 20260530_1818_schema_ai_context_settings.sql */

-- ----------------------------------------------------------------------------
-- Configuracion singleton del modulo Knowledge Search / Contexto IA
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_context_settings (
  id                       TINYINT UNSIGNED NOT NULL PRIMARY KEY,

  context_ai_enabled       TINYINT(1) NOT NULL DEFAULT 0,
  query_enabled            TINYINT(1) NOT NULL DEFAULT 0,
  indexing_enabled         TINYINT(1) NOT NULL DEFAULT 0,
  sync_enabled             TINYINT(1) NOT NULL DEFAULT 0,

  created_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by               CHAR(36) NULL,
  updated_at               DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by               CHAR(36) NULL,

  CONSTRAINT fk_ai_context_settings_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_ai_context_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO ai_context_settings (
  id,
  context_ai_enabled,
  query_enabled,
  indexing_enabled,
  sync_enabled
) VALUES (
  1,
  0,
  0,
  0,
  0
);
