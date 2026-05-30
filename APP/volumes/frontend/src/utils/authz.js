export const ADMIN_ROLE = "ADMIN";
export const CLIENTS_MANAGE_PERMISSION = "clients.manage";
// Contrato vigente: proyectos usa el mismo permiso operativo de clientes.
export const PROJECTS_MANAGE_PERMISSION = "clients.manage";

const listFrom = (authzOrList, key) =>
  Array.isArray(authzOrList) ? authzOrList : authzOrList?.[key];

const normalizeRole = (value) => String(value ?? "").trim().toUpperCase();
const normalizePermission = (value) => String(value ?? "").trim();

export const hasRole = (authzOrRoles, role) => {
  const roles = listFrom(authzOrRoles, "roles");
  if (!Array.isArray(roles)) return false;

  const normalizedRoles = roles.map(normalizeRole);
  if (Array.isArray(role)) {
    return role.some((item) => normalizedRoles.includes(normalizeRole(item)));
  }

  return normalizedRoles.includes(normalizeRole(role));
};

export const hasPermission = (authzOrPermissions, permission) => {
  const permissions = listFrom(authzOrPermissions, "permissions");
  if (!Array.isArray(permissions)) return false;

  const normalizedPermissions = permissions.map(normalizePermission);
  if (Array.isArray(permission)) {
    return permission.some((item) => normalizedPermissions.includes(normalizePermission(item)));
  }

  return normalizedPermissions.includes(normalizePermission(permission));
};

export const hasAnyRole = (authzOrRoles, roles = []) => hasRole(authzOrRoles, roles);
export const hasAnyPermission = (authzOrPermissions, permissions = []) =>
  hasPermission(authzOrPermissions, permissions);

export const isAdmin = (authz) => hasRole(authz, ADMIN_ROLE);

export const canManageClients = (authz) =>
  isAdmin(authz) || hasPermission(authz, CLIENTS_MANAGE_PERMISSION);

export const canManageProjects = (authz) =>
  isAdmin(authz) || hasPermission(authz, PROJECTS_MANAGE_PERMISSION);
