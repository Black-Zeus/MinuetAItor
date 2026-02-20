/**
 * services/usersAdminService.js
 * Servicio para administración de usuarios - Operaciones CRUD
 * Integrado con apiAdapter para transformación de datos
 *
 * Asume API Gateway wrapper:
 *   { success, status, result, error, meta }
 * Payload real: .result (fallback: raíz)
 */

import api from "@/services/axiosInterceptor";
import { API_ENDPOINTS } from "@/constants";
import { getFormattedError } from "@/utils/errors";
import { shouldLog } from "@/utils/environment";
import {
  adaptApiUserToComponent,
  adaptApiStatsToComponent,
  adaptComponentUserToApi,
} from "@/services/adapters/apiAdapter";

// ==========================================
// HELPER — desenvuelve el wrapper del gateway
// ==========================================
const unwrap = (data) => data?.result ?? data;

// ==========================================
// USERS ADMIN SERVICE CLASS
// ==========================================
class UsersAdminService {
  // ==========================================
  // READ OPERATIONS
  // ==========================================
  async getUsers(options = {}) {
    try {
      if (shouldLog()) console.log("👥 Fetching users list...", options);

      // Evitar flags contradictorias
      // Regla sugerida:
      // - include_inactive=true => active_only=false
      // - active_only=true => include_inactive=false (o no se envía)
      const includeInactive = options.include_inactive ?? false;
      const activeOnly = includeInactive ? false : (options.active_only ?? false);

      const params = new URLSearchParams({
        skip: String(options.skip ?? 0),
        limit: String(options.limit ?? 1000),
        active_only: String(activeOnly),
        ...(options.search ? { search: String(options.search) } : {}),
        ...(options.role_filter ? { role_filter: String(options.role_filter) } : {}),
        ...(includeInactive ? { include_inactive: "true" } : {}),
      });

      const response = await api.get(`${API_ENDPOINTS.USERS.BASE}/?${params.toString()}`);
      const payload = unwrap(response.data);

      // Esperamos shape tipo:
      // payload = { users: [], pagination, total_found, filters_applied, ... }
      const apiData = payload?.data ?? payload; // compat si backend mete data interno
      const usersRaw = apiData?.users ?? [];

      if (!Array.isArray(usersRaw)) {
        throw new Error("Invalid users response format: missing users[]");
      }

      const adaptedUsers = usersRaw.map(adaptApiUserToComponent);
      const adaptedStats = adaptApiStatsToComponent(apiData);

      const skip = apiData?.pagination?.skip ?? (options.skip ?? 0);
      const limit = apiData?.pagination?.limit ?? (options.limit ?? 1000);
      const total = apiData?.total_found ?? apiData?.total ?? adaptedUsers.length;

      const result = {
        users: adaptedUsers,
        stats: adaptedStats,
        pagination: {
          skip,
          limit,
          total,
          currentPage: Math.floor((skip || 0) / (limit || 1)) + 1,
          totalPages: Math.ceil((total || 0) / (limit || 1)),
        },
        filters: apiData?.filters_applied ?? {},
        meta: response.data?.meta ?? {},
      };

      if (shouldLog()) console.log(`✅ Users fetched: ${adaptedUsers.length} users`);

      return result;
    } catch (error) {
      const formattedError = getFormattedError(error);
      if (shouldLog()) console.error("❌ Failed to fetch users:", formattedError);
      throw formattedError;
    }
  }

  async getUser(userId) {
    try {
      if (!userId) throw new Error("userId requerido");
      if (shouldLog()) console.log(`👤 Fetching user ID: ${userId}`);

      const response = await api.get(`${API_ENDPOINTS.USERS.BASE}/${userId}`);
      const payload = unwrap(response.data);
      const apiData = payload?.data ?? payload;

      if (!apiData) throw new Error("Invalid user response format: missing data");

      const adaptedUser = adaptApiUserToComponent(apiData);

      if (shouldLog()) console.log(`✅ User fetched: ${adaptedUser.username}`);
      return { user: adaptedUser, meta: response.data?.meta ?? {} };
    } catch (error) {
      const formattedError = getFormattedError(error);
      if (shouldLog()) console.error(`❌ Failed to fetch user ${userId}:`, formattedError);
      throw formattedError;
    }
  }

  // ==========================================
  // CREATE OPERATIONS
  // ==========================================
  async createUser(userData) {
    try {
      if (!userData) throw new Error("userData requerido");
      if (shouldLog()) console.log("👤 Creating new user...", userData.username);

      const apiData = adaptComponentUserToApi(userData);
      const response = await api.post(`${API_ENDPOINTS.USERS.BASE}/`, apiData);

      const payload = unwrap(response.data);
      const created = payload?.data ?? payload;

      if (!created) throw new Error("Invalid create user response format: missing data");

      const adaptedUser = adaptApiUserToComponent(created);

      if (shouldLog()) console.log(`✅ User created: ${adaptedUser.username}`);
      return {
        user: adaptedUser,
        message: response.data?.message ?? payload?.message,
        meta: response.data?.meta ?? {},
      };
    } catch (error) {
      const formattedError = getFormattedError(error);
      if (shouldLog()) console.error("❌ Failed to create user:", formattedError);
      throw formattedError;
    }
  }

  // ==========================================
  // UPDATE OPERATIONS
  // ==========================================
  async updateUser(userId, userData) {
    try {
      if (!userId) throw new Error("userId requerido");
      if (!userData) throw new Error("userData requerido");
      if (shouldLog()) console.log(`👤 Updating user ID: ${userId}`);

      const apiData = adaptComponentUserToApi(userData);
      const response = await api.put(`${API_ENDPOINTS.USERS.BASE}/${userId}`, apiData);

      const payload = unwrap(response.data);
      const updated = payload?.data ?? payload;

      if (!updated) throw new Error("Invalid update user response format: missing data");

      const adaptedUser = adaptApiUserToComponent(updated);

      if (shouldLog()) console.log(`✅ User updated: ${adaptedUser.username}`);
      return {
        user: adaptedUser,
        message: response.data?.message ?? payload?.message,
        meta: response.data?.meta ?? {},
      };
    } catch (error) {
      const formattedError = getFormattedError(error);
      if (shouldLog()) console.error(`❌ Failed to update user ${userId}:`, formattedError);
      throw formattedError;
    }
  }

  async toggleUserStatus(userId, isActive) {
    try {
      if (!userId) throw new Error("userId requerido");
      if (typeof isActive !== "boolean") throw new Error("isActive debe ser boolean");
      if (shouldLog()) console.log(`👤 Toggling user ${userId} status to: ${isActive}`);

      const response = await api.put(
        `${API_ENDPOINTS.USERS.BASE}/${userId}/toggle-activation`,
        { is_active: isActive }
      );

      const payload = unwrap(response.data);
      const apiData = payload?.data ?? payload;

      if (!apiData) throw new Error("Invalid toggle status response format: missing data");

      const adaptedUser = adaptApiUserToComponent(apiData);

      if (shouldLog()) console.log(`✅ User status toggled: ${adaptedUser.username} -> ${isActive}`);
      return {
        user: adaptedUser,
        message: response.data?.message ?? payload?.message,
        meta: response.data?.meta ?? {},
      };
    } catch (error) {
      const formattedError = getFormattedError(error);
      if (shouldLog()) console.error(`❌ Failed to toggle user ${userId} status:`, formattedError);
      throw formattedError;
    }
  }

  /**
   * Cambiar contraseña de un usuario (admin)
   * POST /v1/auth/change-password-by-admin
   *
   * @param {string|number} userId
   * @param {string} newPassword
   * @param {string} reason
   */
  async changeUserPassword(userId, newPassword, reason) {
    try {
      if (shouldLog()) console.log(`🔒 Admin changing password for user: ${userId}`);

      if (!userId) throw new Error("user_id requerido");
      if (!newPassword) throw new Error("new_password requerido");
      if (!reason) throw new Error("reason requerido (auditoría)");

      await api.post(API_ENDPOINTS.AUTH.CHANGE_PASSWORD_ADMIN, {
        user_id: String(userId),
        new_password: newPassword,
        reason,
      });

      if (shouldLog()) console.log("✅ Admin password change done");
      return { success: true };
    } catch (error) {
      const formattedError = this._formatPasswordError(error);
      if (shouldLog()) console.error("❌ Admin change password failed:", formattedError);
      throw formattedError;
    }
  }

  // ==========================================
  // DELETE OPERATIONS
  // ==========================================
  async deleteUser(userId) {
    try {
      if (!userId) throw new Error("userId requerido");
      if (shouldLog()) console.log(`🗑️ Deleting user ID: ${userId}`);

      const response = await api.delete(`${API_ENDPOINTS.USERS.BASE}/${userId}`);

      // Algunos backends devuelven null/{} con 204. Validar por status también.
      if (response.status === 204) {
        return { message: "Usuario eliminado", meta: {} };
      }

      const payload = unwrap(response.data);
      const ok = payload?.success ?? response.data?.success ?? true;

      if (!ok) throw new Error("Delete user failed");

      if (shouldLog()) console.log(`✅ User deleted: ID ${userId}`);
      return { message: response.data?.message ?? payload?.message, meta: response.data?.meta ?? {} };
    } catch (error) {
      const formattedError = getFormattedError(error);
      if (shouldLog()) console.error(`❌ Failed to delete user ${userId}:`, formattedError);
      throw formattedError;
    }
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================
  async getUsersStats() {
    // Recomendación: si tu backend no soporta limit=0, usa limit=1
    const response = await this.getUsers({ limit: 1, skip: 0, active_only: false });
    return response.stats;
  }

  async searchUsers(searchTerm, limit = 10) {
    const response = await this.getUsers({ search: searchTerm, limit, active_only: false });
    return response.users;
  }

  async getUsersByRole(roleCode, options = {}) {
    const response = await this.getUsers({ role_filter: roleCode, ...options });
    return response.users;
  }

  validateUserData(userData) {
    const errors = {};

    if (!userData?.username || userData.username.trim().length < 3) {
      errors.username = "El nombre de usuario debe tener al menos 3 caracteres";
    }
    if (!userData?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
      errors.email = "El email no tiene un formato válido";
    }
    if (!userData?.firstName || userData.firstName.trim().length < 2) {
      errors.firstName = "El nombre debe tener al menos 2 caracteres";
    }
    if (!userData?.lastName || userData.lastName.trim().length < 2) {
      errors.lastName = "El apellido debe tener al menos 2 caracteres";
    }
    if (userData?.phone && !/^\+?[\d\s\-\(\)]+$/.test(userData.phone)) {
      errors.phone = "El teléfono no tiene un formato válido";
    }

    const isValid = Object.keys(errors).length === 0;
    return {
      isValid,
      errors,
      summary: isValid ? "Datos válidos" : `${Object.keys(errors).length} errores encontrados`,
    };
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================
  _formatPasswordError(error) {
    // Mantener coherencia con gateway wrapper
    if (error?.response?.data) {
      const raw = error.response.data;
      const payload = unwrap(raw) ?? raw;

      // Gateway puede traer { error: { code, message, details } }
      const gatewayErr = raw?.error ?? payload?.error ?? null;
      const detail = payload?.detail ?? raw?.detail;

      let message =
        gatewayErr?.message ||
        payload?.message ||
        detail ||
        "Error al cambiar la contraseña";

      // FastAPI 422 detail array
      if (Array.isArray(detail)) {
        message = detail.map((d) => d.msg || d).join(", ");
      }

      const details = gatewayErr?.details ?? payload?.error?.details;

      if (details) {
        if (typeof details === "string" && details.startsWith("[")) {
          try {
            const parsed = JSON.parse(details.replace(/'/g, '"'));
            if (Array.isArray(parsed) && parsed.length) {
              message += "\n\n" + parsed.map((x) => `\t• ${x}`).join("\n");
            }
          } catch {
            message += "\n\nDetalles: " + details;
          }
        } else if (Array.isArray(details) && details.length) {
          message += "\n\n" + details.map((x) => `\t• ${x}`).join("\n");
        } else if (typeof details === "string") {
          message += "\n\nDetalles: " + details;
        }
      }

      return {
        code: gatewayErr?.code || payload?.error?.code || "BACKEND_ERROR",
        message,
        status: error.response.status,
      };
    }

    return getFormattedError(error);
  }
}

// ==========================================
// SINGLETON + EXPORTS
// ==========================================
const usersAdminService = new UsersAdminService();

export const getUsers = (options) => usersAdminService.getUsers(options);
export const getUser = (userId) => usersAdminService.getUser(userId);
export const createUser = (userData) => usersAdminService.createUser(userData);
export const updateUser = (userId, userData) => usersAdminService.updateUser(userId, userData);
export const toggleUserStatus = (userId, isActive) => usersAdminService.toggleUserStatus(userId, isActive);
export const changeUserPassword = (userId, newPassword, reason) =>
  usersAdminService.changeUserPassword(userId, newPassword, reason);
export const deleteUser = (userId) => usersAdminService.deleteUser(userId);
export const getUsersStats = () => usersAdminService.getUsersStats();
export const searchUsers = (searchTerm, limit) => usersAdminService.searchUsers(searchTerm, limit);
export const getUsersByRole = (roleCode, options) => usersAdminService.getUsersByRole(roleCode, options);
export const validateUserData = (userData) => usersAdminService.validateUserData(userData);

export default usersAdminService;
