/* 20260524_2025_schema_access_requests.sql */

CREATE TABLE IF NOT EXISTS access_requests (
  id                  CHAR(36) NOT NULL PRIMARY KEY,
  full_name           VARCHAR(200) NOT NULL,
  email               VARCHAR(200) NOT NULL,
  observation         TEXT NULL,
  status              VARCHAR(30) NOT NULL DEFAULT 'pending',
  source              VARCHAR(60) NOT NULL DEFAULT 'login',
  request_ip          VARCHAR(80) NULL,
  request_user_agent  VARCHAR(500) NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at         DATETIME NULL,
  resolved_by         CHAR(36) NULL,
  resolution_notes    TEXT NULL,

  KEY idx_access_requests_status_created (status, created_at),
  KEY idx_access_requests_email_status (email, status),
  CONSTRAINT fk_access_requests_resolved_by FOREIGN KEY (resolved_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE system_maintenance_settings
  ADD COLUMN IF NOT EXISTS access_request_enabled TINYINT(1) NOT NULL DEFAULT 1
    AFTER queue_monitor_state_json;

UPDATE system_maintenance_settings
SET access_request_enabled = COALESCE(access_request_enabled, 1)
WHERE id = 1;
