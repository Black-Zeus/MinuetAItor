/* 20260530_1834_schema_ai_provider_bindings.sql */

-- ----------------------------------------------------------------------------
-- Asignacion de provider/modelo por proposito operativo de IA
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_provider_bindings (
  id                       CHAR(36) NOT NULL PRIMARY KEY,
  purpose                  VARCHAR(60) NOT NULL,
  provider_config_id        CHAR(36) NOT NULL,
  model_name               VARCHAR(180) NOT NULL,
  embedding_dimensions     INT NULL,
  is_active                TINYINT(1) NOT NULL DEFAULT 1,

  created_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by               CHAR(36) NULL,
  updated_at               DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by               CHAR(36) NULL,
  deleted_at               DATETIME NULL,
  deleted_by               CHAR(36) NULL,

  KEY idx_ai_provider_bindings_purpose_active (purpose, is_active),
  KEY idx_ai_provider_bindings_provider_config (provider_config_id),
  KEY idx_ai_provider_bindings_created_by (created_by),
  KEY idx_ai_provider_bindings_updated_by (updated_by),
  KEY idx_ai_provider_bindings_deleted_by (deleted_by),

  CONSTRAINT fk_ai_provider_bindings_provider_config FOREIGN KEY (provider_config_id) REFERENCES ai_provider_configs(id),
  CONSTRAINT fk_ai_provider_bindings_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_ai_provider_bindings_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_ai_provider_bindings_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO ai_provider_bindings (
  id,
  purpose,
  provider_config_id,
  model_name,
  embedding_dimensions,
  is_active
)
SELECT
  UUID(),
  'minute_analysis',
  cfg.id,
  cfg.model_name,
  NULL,
  1
FROM ai_provider_configs cfg
WHERE cfg.deleted_at IS NULL
  AND cfg.is_active = 1
  AND cfg.model_name IS NOT NULL
  AND TRIM(cfg.model_name) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM ai_provider_bindings existing
    WHERE existing.purpose = 'minute_analysis'
      AND existing.is_active = 1
      AND existing.deleted_at IS NULL
  )
ORDER BY cfg.updated_at DESC, cfg.created_at DESC
LIMIT 1;
