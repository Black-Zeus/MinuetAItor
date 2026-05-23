/* 20260523_1902_alter_email_delivery_events_event_at.sql */

ALTER TABLE email_delivery_events
  ADD COLUMN IF NOT EXISTS event_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  AFTER failed_at;

UPDATE email_delivery_events
SET event_at = COALESCE(sent_at, failed_at, queued_at, created_at, event_at, CURRENT_TIMESTAMP);

SET @idx_ede_event_at_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'email_delivery_events'
    AND INDEX_NAME = 'idx_ede_event_at'
);
SET @idx_ede_event_at_sql := IF(
  @idx_ede_event_at_exists = 0,
  'CREATE INDEX idx_ede_event_at ON email_delivery_events(event_at)',
  'SELECT 1'
);
PREPARE stmt FROM @idx_ede_event_at_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_ede_kind_event_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'email_delivery_events'
    AND INDEX_NAME = 'idx_ede_kind_event'
);
SET @idx_ede_kind_event_sql := IF(
  @idx_ede_kind_event_exists = 0,
  'CREATE INDEX idx_ede_kind_event ON email_delivery_events(email_kind, event_at)',
  'SELECT 1'
);
PREPARE stmt FROM @idx_ede_kind_event_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_ede_status_event_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'email_delivery_events'
    AND INDEX_NAME = 'idx_ede_status_event'
);
SET @idx_ede_status_event_sql := IF(
  @idx_ede_status_event_exists = 0,
  'CREATE INDEX idx_ede_status_event ON email_delivery_events(status, event_at)',
  'SELECT 1'
);
PREPARE stmt FROM @idx_ede_status_event_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
