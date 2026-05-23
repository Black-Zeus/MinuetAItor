/* 20260523_1241_schema_record_status_transitions.sql */

CREATE TABLE IF NOT EXISTS record_status_transitions (
  id                        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  record_id                 CHAR(36) NOT NULL,
  minute_transaction_id     CHAR(36) NULL,
  record_version_id         CHAR(36) NULL,
  from_status_id            SMALLINT UNSIGNED NULL,
  to_status_id              SMALLINT UNSIGNED NOT NULL,
  changed_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  changed_by                CHAR(36) NULL,
  source                    VARCHAR(40) NOT NULL,
  transition_reason         VARCHAR(80) NULL,
  metadata_json             JSON NULL,

  PRIMARY KEY (id),
  KEY idx_rst_record_changed_at (record_id, changed_at),
  KEY idx_rst_to_status_changed_at (to_status_id, changed_at),
  KEY idx_rst_tx (minute_transaction_id),
  KEY idx_rst_version (record_version_id),
  KEY idx_rst_actor (changed_by),

  CONSTRAINT fk_rst_record FOREIGN KEY (record_id) REFERENCES records(id),
  CONSTRAINT fk_rst_tx FOREIGN KEY (minute_transaction_id) REFERENCES minute_transactions(id),
  CONSTRAINT fk_rst_version FOREIGN KEY (record_version_id) REFERENCES record_versions(id),
  CONSTRAINT fk_rst_from_status FOREIGN KEY (from_status_id) REFERENCES record_statuses(id),
  CONSTRAINT fk_rst_to_status FOREIGN KEY (to_status_id) REFERENCES record_statuses(id),
  CONSTRAINT fk_rst_actor FOREIGN KEY (changed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
