/* 20260518_1020_alter_user_profiles_personalization.sql */

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS theme VARCHAR(20) NULL AFTER assignment_mode,
  ADD COLUMN IF NOT EXISTS ui_density VARCHAR(20) NULL AFTER theme,
  ADD COLUMN IF NOT EXISTS ui_animations TINYINT(1) NULL AFTER ui_density,
  ADD COLUMN IF NOT EXISTS sidebar_collapsed TINYINT(1) NULL AFTER ui_animations;
