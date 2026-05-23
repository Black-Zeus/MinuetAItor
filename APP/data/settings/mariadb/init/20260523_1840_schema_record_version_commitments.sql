/* 20260523_1840_schema_record_version_commitments.sql */

CREATE TABLE IF NOT EXISTS record_version_agreements (
  id                BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  record_id         CHAR(36) NOT NULL,
  record_version_id CHAR(36) NOT NULL,
  agreement_code    VARCHAR(60) NOT NULL,
  subject           VARCHAR(300) NOT NULL,
  body              TEXT NULL,
  responsible       VARCHAR(220) NULL,
  due_date          DATE NULL,
  status            VARCHAR(40) NOT NULL DEFAULT 'pending',
  source_index      INT UNSIGNED NOT NULL DEFAULT 0,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_rva_record FOREIGN KEY (record_id) REFERENCES records(id),
  CONSTRAINT fk_rva_version FOREIGN KEY (record_version_id) REFERENCES record_versions(id),

  UNIQUE KEY uq_rva_version_code_index (record_version_id, agreement_code, source_index),
  KEY idx_rva_record (record_id),
  KEY idx_rva_version (record_version_id),
  KEY idx_rva_due_date (due_date),
  KEY idx_rva_status (status),
  KEY idx_rva_responsible (responsible)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS record_version_requirements (
  id                  BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  record_id           CHAR(36) NOT NULL,
  record_version_id   CHAR(36) NOT NULL,
  requirement_code    VARCHAR(60) NOT NULL,
  entity              VARCHAR(220) NULL,
  body                TEXT NOT NULL,
  responsible         VARCHAR(220) NULL,
  priority            VARCHAR(40) NOT NULL DEFAULT 'medium',
  status              VARCHAR(40) NOT NULL DEFAULT 'open',
  source_index        INT UNSIGNED NOT NULL DEFAULT 0,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_rvr_record FOREIGN KEY (record_id) REFERENCES records(id),
  CONSTRAINT fk_rvr_version FOREIGN KEY (record_version_id) REFERENCES record_versions(id),

  UNIQUE KEY uq_rvr_version_code_index (record_version_id, requirement_code, source_index),
  KEY idx_rvr_record (record_id),
  KEY idx_rvr_version (record_version_id),
  KEY idx_rvr_priority (priority),
  KEY idx_rvr_status (status),
  KEY idx_rvr_responsible (responsible)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
