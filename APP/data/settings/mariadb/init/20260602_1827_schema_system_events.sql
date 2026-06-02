/* 20260602_1827_schema_system_events.sql */

-- ----------------------------------------------------------------------------
-- Bitacora operativa canonica para eventos relevantes del sistema
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_events (
  id                    BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  event_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  domain                VARCHAR(60) NOT NULL,
  event_type            VARCHAR(100) NOT NULL,
  severity              VARCHAR(30) NOT NULL DEFAULT 'info',
  status                VARCHAR(30) NOT NULL DEFAULT 'success',
  subject               VARCHAR(255) NOT NULL,
  detail                VARCHAR(700) NULL,
  entity_type           VARCHAR(80) NULL,
  entity_id             VARCHAR(80) NULL,
  actor_user_id         CHAR(36) NULL,
  actor_snapshot_json   TEXT NULL,
  metadata_json         TEXT NULL,

  KEY idx_system_events_event_at (event_at),
  KEY idx_system_events_domain_event_at (domain, event_at),
  KEY idx_system_events_event_type (event_type),
  KEY idx_system_events_status (status),
  KEY idx_system_events_actor (actor_user_id),
  KEY idx_system_events_entity (entity_type, entity_id),

  CONSTRAINT fk_system_events_actor FOREIGN KEY (actor_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
