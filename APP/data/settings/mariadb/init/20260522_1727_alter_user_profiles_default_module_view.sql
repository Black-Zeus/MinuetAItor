/* 20260522_1727_alter_user_profiles_default_module_view.sql */

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS default_module_view VARCHAR(20) NULL AFTER sidebar_collapsed;
