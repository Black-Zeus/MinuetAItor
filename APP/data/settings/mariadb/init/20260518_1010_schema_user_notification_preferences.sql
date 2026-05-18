/* 20260518_1010_schema_user_notification_preferences.sql */

CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id         CHAR(36)    NOT NULL,
  preference_key  VARCHAR(80) NOT NULL,
  is_enabled      TINYINT(1)  NOT NULL DEFAULT 1,
  created_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (user_id, preference_key),
  CONSTRAINT fk_unp_user
    FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_unp_pref_enabled (preference_key, is_enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
