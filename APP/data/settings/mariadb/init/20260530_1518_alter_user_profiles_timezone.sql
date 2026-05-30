/* 20260530_1518_alter_user_profiles_timezone.sql */

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) NULL AFTER default_module_view;
