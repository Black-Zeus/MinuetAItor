/* 20260526_0132_restrict_audit_read_to_admin.sql
   Proposito: limitar audit.read a ADMIN en bases ya inicializadas.
   Contexto : la lectura de auditoria expone actividad sensible del sistema.
*/

DELETE rp
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE p.code = 'audit.read'
  AND r.code <> 'ADMIN';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'audit.read'
WHERE r.code = 'ADMIN'
  AND NOT EXISTS (
    SELECT 1
    FROM role_permissions existing
    WHERE existing.role_id = r.id
      AND existing.permission_id = p.id
  );
