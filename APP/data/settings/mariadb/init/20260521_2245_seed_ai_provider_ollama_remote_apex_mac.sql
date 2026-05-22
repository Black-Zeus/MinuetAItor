SET @bootstrap_admin_user_id := (
  SELECT u.id
  FROM users u
  WHERE u.username = 'admin' OR u.email = 'admin@minuetaitor.local'
  ORDER BY CASE WHEN u.username = 'admin' THEN 0 ELSE 1 END, u.created_at ASC, u.id ASC
  LIMIT 1
);

SET @seed_ai_ollama_apex_id := 'a3d4d6a9-5634-4f0f-aed2-cf1467187d76';
SET @seed_ai_ollama_apex_name := 'Mac Ollama Remote';

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
  @seed_ai_ollama_apex_id,
  @seed_ai_ollama_apex_name,
  'ollama_remote',
  'http://100.112.117.14:11434',
  '/api/tags',
  '/api/tags',
  'qwen2.5:14b',
  'none',
  NULL,
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
