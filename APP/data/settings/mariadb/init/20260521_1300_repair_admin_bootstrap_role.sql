/* 20260521_1300_repair_admin_bootstrap_role.sql
   ============================================================================
   Propósito  : Reparar la asignación del rol ADMIN del usuario bootstrap
                en bases ya inicializadas donde el usuario `admin` existe
                con un ID distinto al UUID histórico del seed.
   Contexto   : El seed operativo original asumía un UUID fijo para el admin
                y podía dejar `user_roles` sin la fila activa esperada.
   Motor      : MySQL / MariaDB (InnoDB, utf8mb4)
   ============================================================================
*/

SET @bootstrap_admin_default_id := 'c168b91d-e16f-468c-afd1-547efd2c486b';

SET @bootstrap_admin_user_id := (
  SELECT u.id
  FROM users u
  WHERE u.username = 'admin' OR u.email = 'admin@minuetaitor.local'
  ORDER BY CASE WHEN u.username = 'admin' THEN 0 ELSE 1 END, u.created_at ASC, u.id ASC
  LIMIT 1
);

UPDATE users
SET
  is_active = 1,
  deleted_at = NULL,
  deleted_by = NULL
WHERE id = @bootstrap_admin_user_id;

INSERT INTO user_roles (user_id, role_id, created_at, created_by)
SELECT
  @bootstrap_admin_user_id,
  r.id,
  NOW(),
  @bootstrap_admin_user_id
FROM roles r
WHERE r.code = 'ADMIN'
  AND @bootstrap_admin_user_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  deleted_at = NULL,
  deleted_by = NULL,
  created_by = @bootstrap_admin_user_id;

INSERT IGNORE INTO user_profiles (user_id, initials, color, position)
SELECT
  @bootstrap_admin_user_id,
  'AD',
  '#6366f1',
  'Administrador'
WHERE @bootstrap_admin_user_id IS NOT NULL;
