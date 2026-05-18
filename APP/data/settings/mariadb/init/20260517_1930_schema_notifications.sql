/* 20260517_1930_schema_notifications.sql */

-- ----------------------------------------------------------------------------
-- Notificaciones in-app persistentes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id                 CHAR(36)      NOT NULL PRIMARY KEY,
  notification_type  VARCHAR(80)   NOT NULL,
  level              VARCHAR(20)   NOT NULL DEFAULT 'info',
  title              VARCHAR(200)  NOT NULL,
  message            VARCHAR(2000) NOT NULL,
  tags_json          LONGTEXT      NULL,
  scope_type         VARCHAR(80)   NULL,
  scope_id           VARCHAR(64)   NULL,
  action_url         VARCHAR(255)  NULL,
  actor_user_id      CHAR(36)      NULL,
  metadata_json      LONGTEXT      NULL,
  created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_notifications_actor_user
    FOREIGN KEY (actor_user_id) REFERENCES users(id),

  INDEX idx_notifications_type_created (notification_type, created_at),
  INDEX idx_notifications_scope (scope_type, scope_id),
  INDEX idx_notifications_actor (actor_user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS notification_recipients (
  id               CHAR(36)     NOT NULL PRIMARY KEY,
  notification_id  CHAR(36)     NOT NULL,
  user_id          CHAR(36)     NOT NULL,
  is_read          TINYINT(1)   NOT NULL DEFAULT 0,
  read_at          DATETIME     NULL,
  is_hidden        TINYINT(1)   NOT NULL DEFAULT 0,
  hidden_at        DATETIME     NULL,
  delivered_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_notification_recipients_notification
    FOREIGN KEY (notification_id) REFERENCES notifications(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_notification_recipients_user
    FOREIGN KEY (user_id) REFERENCES users(id),

  UNIQUE KEY uq_notification_recipient (notification_id, user_id),
  INDEX idx_notification_recipients_user_read_created (user_id, is_hidden, is_read, created_at),
  INDEX idx_notification_recipients_notification (notification_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
