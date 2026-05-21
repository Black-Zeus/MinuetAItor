ALTER TABLE organization_settings
  ADD COLUMN IF NOT EXISTS avatar_object_id CHAR(36) NULL AFTER notes,
  ADD COLUMN IF NOT EXISTS banner_object_id CHAR(36) NULL AFTER avatar_object_id;

SET @idx_org_avatar_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'organization_settings'
    AND INDEX_NAME = 'idx_organization_settings_avatar_object_id'
);
SET @sql := IF(
  @idx_org_avatar_exists = 0,
  'CREATE INDEX idx_organization_settings_avatar_object_id ON organization_settings(avatar_object_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_org_banner_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'organization_settings'
    AND INDEX_NAME = 'idx_organization_settings_banner_object_id'
);
SET @sql := IF(
  @idx_org_banner_exists = 0,
  'CREATE INDEX idx_organization_settings_banner_object_id ON organization_settings(banner_object_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_org_avatar_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'organization_settings'
    AND CONSTRAINT_NAME = 'fk_organization_settings_avatar_object'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql := IF(
  @fk_org_avatar_exists = 0,
  'ALTER TABLE organization_settings ADD CONSTRAINT fk_organization_settings_avatar_object FOREIGN KEY (avatar_object_id) REFERENCES objects(id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_org_banner_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'organization_settings'
    AND CONSTRAINT_NAME = 'fk_organization_settings_banner_object'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql := IF(
  @fk_org_banner_exists = 0,
  'ALTER TABLE organization_settings ADD CONSTRAINT fk_organization_settings_banner_object FOREIGN KEY (banner_object_id) REFERENCES objects(id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
