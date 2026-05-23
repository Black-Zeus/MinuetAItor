/* 20260522_1829_schema_ai_usage_metrics.sql */

CREATE TABLE IF NOT EXISTS ai_model_pricing (
  id                         CHAR(36) PRIMARY KEY,
  provider_type              VARCHAR(40) NOT NULL,
  model_name                 VARCHAR(180) NOT NULL,
  currency                   CHAR(3) NOT NULL DEFAULT 'USD',
  input_price_per_million    DECIMAL(14,6) NULL,
  output_price_per_million   DECIMAL(14,6) NULL,
  effective_from             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  effective_to               DATETIME NULL,
  notes                      TEXT NULL,
  is_active                  TINYINT(1) NOT NULL DEFAULT 1,

  created_at                 DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by                 CHAR(36) NULL,
  updated_at                 DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  updated_by                 CHAR(36) NULL,
  deleted_at                 DATETIME NULL,
  deleted_by                 CHAR(36) NULL,

  KEY idx_ai_model_pricing_provider_model (provider_type, model_name),
  KEY idx_ai_model_pricing_effective_from (effective_from),
  KEY idx_ai_model_pricing_effective_to (effective_to),
  KEY idx_ai_model_pricing_is_active (is_active),
  KEY idx_ai_model_pricing_deleted_at (deleted_at),

  CONSTRAINT fk_ai_model_pricing_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_ai_model_pricing_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_ai_model_pricing_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS ai_usage_events (
  id                         BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  event_type                 VARCHAR(40) NOT NULL,
  status                     ENUM('success','failed','timeout','cancelled') NOT NULL DEFAULT 'success',

  minute_transaction_id      CHAR(36) NULL,
  record_id                  CHAR(36) NULL,
  record_version_id          CHAR(36) NULL,
  client_id                  CHAR(36) NULL,
  project_id                 CHAR(36) NULL,
  ai_profile_id              CHAR(36) NULL,
  requested_by               CHAR(36) NULL,

  provider_config_id         CHAR(36) NULL,
  pricing_id                 CHAR(36) NULL,

  provider_type              VARCHAR(40) NULL,
  provider_family            VARCHAR(40) NULL,
  execution_adapter          VARCHAR(40) NULL,
  provider_name_snapshot     VARCHAR(120) NULL,
  model_name                 VARCHAR(180) NULL,

  external_run_id            VARCHAR(120) NULL,
  external_thread_id         VARCHAR(120) NULL,

  started_at                 DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at                DATETIME NULL,
  latency_ms                 INT UNSIGNED NULL,

  input_tokens               INT UNSIGNED NULL,
  output_tokens              INT UNSIGNED NULL,
  total_tokens               INT UNSIGNED NULL,

  currency                   CHAR(3) NOT NULL DEFAULT 'USD',
  input_cost                 DECIMAL(14,6) NULL,
  output_cost                DECIMAL(14,6) NULL,
  total_cost                 DECIMAL(14,6) NULL,
  cost_estimated             TINYINT(1) NOT NULL DEFAULT 0,
  cost_source                VARCHAR(40) NULL,

  error_code                 VARCHAR(80) NULL,
  error_message              TEXT NULL,

  provider_usage_raw_json    JSON NULL,
  provider_meta_json         JSON NULL,

  created_at                 DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  KEY idx_ai_usage_events_started_at (started_at),
  KEY idx_ai_usage_events_status_started_at (status, started_at),
  KEY idx_ai_usage_events_provider_model_started_at (provider_type, model_name, started_at),
  KEY idx_ai_usage_events_client_started_at (client_id, started_at),
  KEY idx_ai_usage_events_project_started_at (project_id, started_at),
  KEY idx_ai_usage_events_requested_by_started_at (requested_by, started_at),
  KEY idx_ai_usage_events_tx (minute_transaction_id),
  KEY idx_ai_usage_events_record (record_id),
  KEY idx_ai_usage_events_record_version (record_version_id),
  KEY idx_ai_usage_events_provider_config (provider_config_id),
  KEY idx_ai_usage_events_pricing (pricing_id),

  CONSTRAINT fk_ai_usage_events_tx FOREIGN KEY (minute_transaction_id) REFERENCES minute_transactions(id),
  CONSTRAINT fk_ai_usage_events_record FOREIGN KEY (record_id) REFERENCES records(id),
  CONSTRAINT fk_ai_usage_events_record_version FOREIGN KEY (record_version_id) REFERENCES record_versions(id),
  CONSTRAINT fk_ai_usage_events_client FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT fk_ai_usage_events_project FOREIGN KEY (project_id) REFERENCES projects(id),
  CONSTRAINT fk_ai_usage_events_ai_profile FOREIGN KEY (ai_profile_id) REFERENCES ai_profiles(id),
  CONSTRAINT fk_ai_usage_events_requested_by FOREIGN KEY (requested_by) REFERENCES users(id),
  CONSTRAINT fk_ai_usage_events_provider_config FOREIGN KEY (provider_config_id) REFERENCES ai_provider_configs(id),
  CONSTRAINT fk_ai_usage_events_pricing FOREIGN KEY (pricing_id) REFERENCES ai_model_pricing(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
