SET @bootstrap_admin_user_id := (
  SELECT u.id
  FROM users u
  WHERE u.username = 'admin' OR u.email = 'admin@minuetaitor.local'
  ORDER BY CASE WHEN u.username = 'admin' THEN 0 ELSE 1 END, u.created_at ASC, u.id ASC
  LIMIT 1
);

SET @seed_smtp_mailpit_id := '4e9cf3bc-529d-4c5a-9e5f-9db6af6a1c10';
SET @seed_smtp_mailpit_name := 'Mailpit Desarrollo';

INSERT INTO smtp_configs (
  id,
  name,
  host,
  port,
  username,
  password,
  from_name,
  from_email,
  use_tls,
  use_ssl,
  timeout_seconds,
  is_active,
  last_tested_at,
  last_tested_by,
  created_at,
  created_by,
  updated_at,
  updated_by,
  deleted_at,
  deleted_by
) VALUES (
  @seed_smtp_mailpit_id,
  @seed_smtp_mailpit_name,
  'mailpit',
  1025,
  NULL,
  NULL,
  'MinuetAItor DEV',
  'no-reply@minuetaitor.local',
  0,
  0,
  10,
  1,
  NULL,
  NULL,
  NOW(),
  @bootstrap_admin_user_id,
  NOW(),
  @bootstrap_admin_user_id,
  NULL,
  NULL
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  host = VALUES(host),
  port = VALUES(port),
  username = VALUES(username),
  password = VALUES(password),
  from_name = VALUES(from_name),
  from_email = VALUES(from_email),
  use_tls = VALUES(use_tls),
  use_ssl = VALUES(use_ssl),
  timeout_seconds = VALUES(timeout_seconds),
  is_active = VALUES(is_active),
  deleted_at = NULL,
  deleted_by = NULL,
  updated_at = NOW(),
  updated_by = @bootstrap_admin_user_id;

UPDATE smtp_configs
SET
  is_active = 0,
  updated_at = NOW(),
  updated_by = @bootstrap_admin_user_id
WHERE deleted_at IS NULL
  AND name <> @seed_smtp_mailpit_name
  AND is_active = 1;
