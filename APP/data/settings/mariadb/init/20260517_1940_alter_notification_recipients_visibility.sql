/* 20260517_1940_alter_notification_recipients_visibility.sql */

-- ----------------------------------------------------------------------------
-- Ocultado lógico por destinatario para la bandeja de notificaciones
-- ----------------------------------------------------------------------------
ALTER TABLE notification_recipients
  ADD COLUMN IF NOT EXISTS is_hidden TINYINT(1) NOT NULL DEFAULT 0
    AFTER read_at,
  ADD COLUMN IF NOT EXISTS hidden_at DATETIME NULL
    AFTER is_hidden;
