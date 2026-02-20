/**
 * services/userService.js
 * Servicio para operaciones de usuario (perfil).
 *
 * Contrato esperado (API Gateway):
 *   { success, status, result, error, meta }
 * Payload real en .result.
 *
 * Importante:
 *  - Este servicio NO persiste localStorage (eso es responsabilidad del store).
 *  - Mantiene el wrapper unwrap() consistente con el resto de tu stack.
 */

import api from "@/services/axiosInterceptor";
import { API_ENDPOINTS } from "@/constants";
import { getFormattedError } from "@/utils/errors";
import { shouldLog } from "@/utils/environment";

// ==========================================
// HELPER — desenvuelve el wrapper del API Gateway
// { success, status, result, error, meta } → result
// ==========================================
const unwrap = (responseData) => responseData?.result ?? responseData;

// ==========================================
// USER SERVICE CLASS
// ==========================================
class UserService {
  // ==========================================
  // PROFILE METHODS
  // ==========================================

  /**
   * Obtener perfil del usuario actual (completo)
   * GET /users/me/profile (según tu implementación)
   * @returns {Promise<Object>} Perfil del usuario (payload real)
   */
  async getMyProfile() {
    try {
      if (shouldLog()) console.log("👤 Fetching current user profile...");

      const response = await api.get(`${API_ENDPOINTS.USERS.BASE}/me/profile`);
      const result = unwrap(response.data);

      if (!result) throw new Error("Invalid profile response");

      if (shouldLog()) console.log("✅ User profile fetched successfully");
      return result;
    } catch (error) {
      const formattedError = getFormattedError(error);
      if (shouldLog()) console.error("❌ Failed to fetch user profile:", formattedError);
      throw formattedError;
    }
  }

  /**
   * Obtener perfil público de otro usuario
   * GET /users/{id}/profile (según tu backend)
   * @param {string|number} userId
   * @returns {Promise<Object>}
   */
  async getUserProfile(userId) {
    try {
      if (!userId) throw new Error("userId requerido");

      if (shouldLog()) console.log(`👤 Fetching user profile for ID: ${userId}`);

      const response = await api.get(`${API_ENDPOINTS.USERS.BASE}/${userId}/profile`);
      const result = unwrap(response.data);

      if (!result) throw new Error("Invalid user profile response");

      if (shouldLog()) console.log(`✅ User profile fetched for ID: ${userId}`);
      return result;
    } catch (error) {
      const formattedError = getFormattedError(error);
      if (shouldLog()) console.error(`❌ Failed to fetch user profile for ID ${userId}:`, formattedError);
      throw formattedError;
    }
  }

  // ==========================================
  // PROFILE UPDATE METHODS
  // ==========================================

  /**
   * Actualizar perfil propio
   * PUT /users/me/profile (si existe) o PUT /users/{id} (fallback)
   *
   * Nota: dejo la forma conservadora: /users/{id} como en tu versión previa.
   * Si tu backend soporta /users/me/profile, cámbialo aquí.
   *
   * @param {Object} profileData
   * @param {string|number} profileData.userId|profileData.id
   * @returns {Promise<Object>} payload real
   */
  async updateMyProfile(profileData) {
    try {
      const userId = profileData?.userId ?? profileData?.id;
      if (!userId) throw new Error("User ID is required for profile update");

      if (shouldLog()) console.log("👤 Updating current user profile...");

      const response = await api.put(`${API_ENDPOINTS.USERS.BASE}/${userId}`, {
        email: profileData?.email,
        first_name: profileData?.first_name,
        last_name: profileData?.last_name,
        phone: profileData?.phone,
        is_active: profileData?.is_active,
        petty_cash_limit: profileData?.petty_cash_limit,
      });

      const result = unwrap(response.data);

      if (!result) throw new Error("Invalid profile update response");

      if (shouldLog()) console.log("✅ User profile updated successfully");
      return result;
    } catch (error) {
      const formattedError = getFormattedError(error);
      if (shouldLog()) console.error("❌ Failed to update user profile:", formattedError);
      throw formattedError;
    }
  }

  // ==========================================
  // TRANSFORM — backend → frontend
  // ==========================================

  /**
   * Transformar datos del perfil del backend al formato esperado por el frontend
   * Acepta directamente el payload real (ya unwrapped).
   *
   * @param {Object} data
   * @returns {Object|null}
   */
  transformProfileData(data) {
    if (!data) return null;

    return {
      // Información básica
      id: data.id,
      username: data.username,
      email: data.email,
      firstName: data.first_name,
      lastName: data.last_name,
      fullName: data.full_name,
      displayName: data.display_name,
      initials: data.initials,
      phone: data.phone,

      // Estado y actividad
      isActive: data.is_active,
      isAuthenticated: data.is_authenticated,
      isRecentlyActive: data.is_recently_active,

      // Seguridad
      lastLoginAt: data.last_login_at,
      lastLoginIp: data.last_login_ip,
      passwordChangedAt: data.password_changed_at,
      passwordAgeDays: data.password_age_days,
      needsPasswordChange: data.needs_password_change,

      // Roles y permisos
      roles: data.roles || [],
      permissions: data.permissions || [],
      roleNames: data.role_names || [],
      roleDetails: data.role_details || [],
      permissionDetails: data.permission_details || [],

      // Contadores
      roleCount: data.role_count || 0,
      permissionCount: data.permission_count || 0,

      // Flags
      hasAdminRole: data.has_admin_role || false,
      hasManagerRole: data.has_manager_role || false,
      isSupervisor: data.is_supervisor || false,
      isCashier: data.is_cashier || false,

      // Accesos
      warehouseAccesses: data.warehouse_accesses || [],
      warehouseCount: data.warehouse_count || 0,
      responsibleWarehouseCount: data.responsible_warehouse_count || 0,
      warehouseAccessTypes: data.warehouse_access_types || [],

      // Caja chica
      pettyCashLimit: data.petty_cash_limit,
      hasPettyCashAccess: data.has_petty_cash_access || false,

      // Auditoría
      createdAt: data.created_at,
      updatedAt: data.updated_at,

      // Metas
      isOwnProfile: data.is_own_profile || false,
      profileRequestedBy: data.profile_requested_by,
      profileGeneratedAt: data.profile_generated_at,

      // Métricas
      profileCompleteness: data.profile_completeness || {},
      securityScore: data.security_score || {},
    };
  }

  // ==========================================
  // AUTHZ HELPERS
  // ==========================================

  hasRole(userRoles, requiredRole) {
    if (!Array.isArray(userRoles)) return false;
    if (Array.isArray(requiredRole)) return requiredRole.some((r) => userRoles.includes(r));
    return userRoles.includes(requiredRole);
  }

  hasPermission(userPermissions, requiredPermission) {
    if (!Array.isArray(userPermissions)) return false;
    if (Array.isArray(requiredPermission)) return requiredPermission.some((p) => userPermissions.includes(p));
    return userPermissions.includes(requiredPermission);
  }

  calculateProfileCompleteness(profileData) {
    if (!profileData) {
      return {
        requiredCompleted: 0,
        totalRequired: 0,
        optionalCompleted: 0,
        totalOptional: 0,
        requiredPercentage: 0,
        overallPercentage: 0,
        isRequiredComplete: false,
        missingRequired: [],
      };
    }

    const requiredFields = ["firstName", "lastName", "email", "displayName"];
    const optionalFields = ["phone"];

    const completedRequired = requiredFields.filter(
      (field) => profileData[field] && String(profileData[field]).trim() !== ""
    ).length;

    const completedOptional = optionalFields.filter(
      (field) => profileData[field] && String(profileData[field]).trim() !== ""
    ).length;

    const totalRequired = requiredFields.length;
    const totalOptional = optionalFields.length;

    const requiredPercentage = totalRequired ? (completedRequired / totalRequired) * 100 : 0;
    const overallPercentage =
      totalRequired + totalOptional
        ? ((completedRequired + completedOptional) / (totalRequired + totalOptional)) * 100
        : 0;

    return {
      requiredCompleted: completedRequired,
      totalRequired,
      optionalCompleted: completedOptional,
      totalOptional,
      requiredPercentage: Math.round(requiredPercentage),
      overallPercentage: Math.round(overallPercentage),
      isRequiredComplete: completedRequired === totalRequired,
      missingRequired: requiredFields.filter(
        (field) => !profileData[field] || String(profileData[field]).trim() === ""
      ),
    };
  }
}

// ==========================================
// SINGLETON INSTANCE
// ==========================================
const userService = new UserService();

// ==========================================
// CONVENIENCE EXPORTS
// ==========================================
export const getMyProfile = () => userService.getMyProfile();
export const getUserProfile = (userId) => userService.getUserProfile(userId);
export const updateMyProfile = (profileData) => userService.updateMyProfile(profileData);

export const transformProfileData = (data) => userService.transformProfileData(data);

export const hasRole = (roles, requiredRole) => userService.hasRole(roles, requiredRole);
export const hasPermission = (permissions, requiredPermission) =>
  userService.hasPermission(permissions, requiredPermission);

export const calculateProfileCompleteness = (profileData) =>
  userService.calculateProfileCompleteness(profileData);

export default userService;
