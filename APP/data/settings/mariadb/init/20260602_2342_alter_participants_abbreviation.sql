/* 20260602_2342_alter_participants_abbreviation.sql */

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS abbreviation VARCHAR(24) NULL AFTER normalized_name;

SET @idx_participants_abbreviation_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'participants'
    AND INDEX_NAME = 'idx_participants_abbreviation'
);
SET @sql := IF(
  @idx_participants_abbreviation_exists = 0,
  'CREATE INDEX idx_participants_abbreviation ON participants(abbreviation)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE record_version_participants
  ADD COLUMN IF NOT EXISTS abbreviation VARCHAR(24) NULL AFTER display_name;
