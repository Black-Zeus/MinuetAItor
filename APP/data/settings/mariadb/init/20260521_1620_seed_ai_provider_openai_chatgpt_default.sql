SET @bootstrap_admin_user_id := (
  SELECT u.id
  FROM users u
  WHERE u.username = 'admin' OR u.email = 'admin@minuetaitor.local'
  ORDER BY CASE WHEN u.username = 'admin' THEN 0 ELSE 1 END, u.created_at ASC, u.id ASC
  LIMIT 1
);

SET @seed_ai_openai_id := '77a7f978-c9cb-4aa8-bf1d-5b4b4c55c420';
SET @seed_ai_openai_name := 'OpenAI / ChatGPT Bootstrap';

INSERT INTO ai_provider_configs (
  id,
  name,
  provider_type,
  base_url,
  validation_endpoint,
  models_endpoint,
  model_name,
  auth_type,
  token_secret,
  username,
  password_secret,
  custom_headers_json,
  allow_model_discovery,
  is_active,
  validation_status,
  last_validated_at,
  last_validated_by,
  last_error,
  timeout_seconds,
  created_at,
  created_by,
  updated_at,
  updated_by,
  deleted_at,
  deleted_by
) VALUES (
  @seed_ai_openai_id,
  @seed_ai_openai_name,
  'openai',
  'https://api.openai.com/v1',
  '/models',
  '/models',
  'gpt-4o',
  'api_key',
  'sk-fake-bootstrap-20260521-p4L9xQ2mN7rT6vW1',
  NULL,
  NULL,
  NULL,
  1,
  0,
  'unvalidated',
  NULL,
  NULL,
  NULL,
  120,
  NOW(),
  @bootstrap_admin_user_id,
  NOW(),
  @bootstrap_admin_user_id,
  NULL,
  NULL
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  provider_type = VALUES(provider_type),
  base_url = VALUES(base_url),
  validation_endpoint = VALUES(validation_endpoint),
  models_endpoint = VALUES(models_endpoint),
  model_name = VALUES(model_name),
  auth_type = VALUES(auth_type),
  token_secret = VALUES(token_secret),
  username = VALUES(username),
  password_secret = VALUES(password_secret),
  custom_headers_json = VALUES(custom_headers_json),
  allow_model_discovery = VALUES(allow_model_discovery),
  is_active = VALUES(is_active),
  validation_status = VALUES(validation_status),
  last_validated_at = NULL,
  last_validated_by = NULL,
  last_error = NULL,
  timeout_seconds = VALUES(timeout_seconds),
  deleted_at = NULL,
  deleted_by = NULL,
  updated_at = NOW(),
  updated_by = @bootstrap_admin_user_id;
