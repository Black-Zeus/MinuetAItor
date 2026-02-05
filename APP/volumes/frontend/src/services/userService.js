/**
 * services/userService.js
 * Servicio para operaciones de usuarios - Consume endpoints del backend
 * Especialmente /users/me/profile para información del usuario actual
 */

import api from '@/services/axiosInterceptor';
import { API_ENDPOINTS } from '@/constants';
import { parseError, getFormattedError } from '@/utils/errors';
import { shouldLog } from '@/utils/environment';

// ==========================================
// USER SERVICE CLASS
// ==========================================

class UserService {

  // ==========================================
  // PROFILE METHODS
  // ==========================================

  /**
   * Obtener perfil del usuario actual (completo)
   * @returns {Promise<Object>} Datos completos del perfil
   */
  async getMyProfile() {
    try {
      if (shouldLog()) {
        console.log('👤 Fetching current user profile...');
      }

      const response = await api.get(`${API_ENDPOINTS.USERS.BASE}/me/profile`);

      if (response.data?.success && response.data?.data) {
        if (shouldLog()) {
          console.log('✅ User profile fetched successfully');
        }
        return response.data;
      }

      throw new Error('Invalid profile response format');

    } catch (error) {
      const formattedError = getFormattedError(error);

      if (shouldLog()) {
        console.error('❌ Failed to fetch user profile:', formattedError);
      }

      throw formattedError;
    }
  }

  /**
   * Obtener perfil público de otro usuario
   * @param {number} userId - ID del usuario
   * @returns {Promise<Object>} Datos públicos del usuario
   */
  async getUserProfile(userId) {
    try {
      if (shouldLog()) {
        console.log(`👤 Fetching user profile for ID: ${userId}`);
      }

      const response = await api.get(`${API_ENDPOINTS.USERS.BASE}/${userId}/profile`);

      if (response.data?.success && response.data?.data) {
        if (shouldLog()) {
          console.log(`✅ User profile fetched for ID: ${userId}`);
        }
        return response.data;
      }

      throw new Error('Invalid user profile response format');

    } catch (error) {
      const formattedError = getFormattedError(error);

      if (shouldLog()) {
        console.error(`❌ Failed to fetch user profile for ID ${userId}:`, formattedError);
      }

      throw formattedError;
    }
  }

  // ==========================================
  // PROFILE UPDATE METHODS
  // ==========================================

  /**
   * Actualizar información personal del usuario actual
   * @param {Object} profileData - Datos a actualizar
   * @param {string} profileData.first_name - Nombre
   * @param {string} profileData.last_name - Apellido
   * @param {string} profileData.email - Email
   * @param {string} profileData.phone - Teléfono (opcional)
   * @param {boolean} profileData.is_active - Estado activo
   * @param {number} profileData.petty_cash_limit - Límite de caja chica
   * @returns {Promise<Object>} Respuesta del update
   */
  async updateMyProfile(profileData) {
    try {
      if (shouldLog()) {
        console.log('👤 Updating current user profile...');
      }

      // Obtener el ID del usuario actual del store o de donde corresponda
      // Por ahora asumiremos que está disponible en el profileData o lo obtendremos
      const userId = profileData.userId || profileData.id;

      if (!userId) {
        throw new Error('User ID is required for profile update');
      }

      const response = await api.put(`${API_ENDPOINTS.USERS.BASE}/${userId}`, {
        email: profileData.email,
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        phone: profileData.phone,
        is_active: profileData.is_active,
        petty_cash_limit: profileData.petty_cash_limit
      });

      if (response.data?.success && response.data?.data) {
        if (shouldLog()) {
          console.log('✅ User profile updated successfully');
        }
        return response.data;
      }

      throw new Error('Invalid profile update response format');

    } catch (error) {
      const formattedError = getFormattedError(error);

      if (shouldLog()) {
        console.error('❌ Failed to update user profile:', formattedError);
      }

      throw formattedError;
    }
  }

  /**
   * Cambiar contraseña del usuario actual - 🔧 CORREGIDO
   * @param {Object} passwordData - Datos de cambio de contraseña
   * @param {string} passwordData.current_password - Contraseña actual
   * @param {string} passwordData.new_password - Nueva contraseña
   * @param {string} passwordData.confirm_password - Confirmación
   * @returns {Promise<Object>} Respuesta del cambio
   */
  async changeMyPassword(passwordData) {
    try {
      if (shouldLog()) {
        console.log('🔒 Changing user password...');
      }

      const response = await api.put(`${API_ENDPOINTS.AUTH.CHANGE_PASSWORD}`, {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password,
        confirm_password: passwordData.confirm_password
      });

      if (response.data?.success) {
        if (shouldLog()) {
          console.log('✅ Password changed successfully');
        }
        return response.data;
      }

      throw new Error('Invalid password change response format');

    } catch (error) {
      // 🔧 SOLUCIÓN SIMPLE: Pasar el mensaje del backend directamente
      let errorToThrow = {
        code: 'UNKNOWN_ERROR',
        message: 'Error al cambiar la contraseña',
        status: error.response?.status || 0
      };

      // Si hay respuesta del backend, usar su mensaje directamente
      if (error.response?.data) {
        const backendData = error.response.data;

        let message = backendData.message || 'Error del servidor';

        // 🔧 NUEVO: Si hay detalles como array, mostrarlos como lista
        if (backendData.error?.details) {
          const details = backendData.error.details;

          // Si es un string que parece array de Python, parsearlo
          if (typeof details === 'string' && details.startsWith('[') && details.endsWith(']')) {
            try {
              const parsed = JSON.parse(details.replace(/'/g, '"')); // Convertir comillas simples a dobles
              if (Array.isArray(parsed) && parsed.length > 0) {
                message += '\n\n' + parsed.map(item => `\t• ${item}`).join('\n');
              }
            } catch (parseError) {
              // Si no se puede parsear, usar como string
              message += '\n\nDetalles: ' + details;
            }
          }
          // Si ya es un array
          else if (Array.isArray(details) && details.length > 0) {
            message += '\n\n' + details.map(item => `\t• ${item}`).join('\n');
          }
          // Si es string normal
          else if (typeof details === 'string') {
            message += '\n\nDetalles: ' + details;
          }
        }

        errorToThrow = {
          code: backendData.error?.code || 'BACKEND_ERROR',
          message: message,
          details: backendData.error?.details || 'Sin detalles adicionales',
          status: backendData.status || error.response.status
        };
      }

      if (shouldLog()) {
        console.error('❌ Failed to change password:', errorToThrow);
      }

      throw errorToThrow;
    }
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Transformar datos del perfil del backend al formato esperado por el frontend
   * @param {Object} backendData - Datos del backend
   * @returns {Object} Datos transformados para el frontend
   */
  transformProfileData(backendData) {
    if (!backendData?.data) {
      return null;
    }

    const data = backendData.data;

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

      // Información de seguridad
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

      // Flags de rol
      hasAdminRole: data.has_admin_role || false,
      hasManagerRole: data.has_manager_role || false,
      isSupervisor: data.is_supervisor || false,
      isCashier: data.is_cashier || false,

      // Accesos de bodega
      warehouseAccesses: data.warehouse_accesses || [],
      warehouseCount: data.warehouse_count || 0,
      responsibleWarehouseCount: data.responsible_warehouse_count || 0,
      warehouseAccessTypes: data.warehouse_access_types || [],

      // Caja chica
      pettyCashLimit: data.petty_cash_limit,
      hasPettyCashAccess: data.has_petty_cash_access || false,

      // Timestamps de auditoría
      createdAt: data.created_at,
      updatedAt: data.updated_at,

      // Información del perfil
      isOwnProfile: data.is_own_profile || false,
      profileRequestedBy: data.profile_requested_by,
      profileGeneratedAt: data.profile_generated_at,

      // Completitud y seguridad
      profileCompleteness: data.profile_completeness || {},
      securityScore: data.security_score || {}
    };
  }

  /**
   * Verifica si el usuario tiene un rol específico
   * @param {Array} userRoles - Roles del usuario
   * @param {string|Array} requiredRole - Rol(es) requerido(s)
   * @returns {boolean} True si tiene el rol
   */
  hasRole(userRoles, requiredRole) {
    if (!userRoles || !Array.isArray(userRoles)) {
      return false;
    }

    if (Array.isArray(requiredRole)) {
      return requiredRole.some(role => userRoles.includes(role));
    }

    return userRoles.includes(requiredRole);
  }

  /**
   * Verifica si el usuario tiene un permiso específico
   * @param {Array} userPermissions - Permisos del usuario
   * @param {string|Array} requiredPermission - Permiso(s) requerido(s)
   * @returns {boolean} True si tiene el permiso
   */
  hasPermission(userPermissions, requiredPermission) {
    if (!userPermissions || !Array.isArray(userPermissions)) {
      return false;
    }

    if (Array.isArray(requiredPermission)) {
      return requiredPermission.some(permission => userPermissions.includes(permission));
    }

    return userPermissions.includes(requiredPermission);
  }

  /**
   * Calcula el estado de completitud del perfil
   * @param {Object} profileData - Datos del perfil
   * @returns {Object} Información de completitud
   */
  calculateProfileCompleteness(profileData) {
    const requiredFields = ['firstName', 'lastName', 'email', 'displayName'];
    const optionalFields = ['phone'];

    const completedRequired = requiredFields.filter(field =>
      profileData[field] && profileData[field].trim() !== ''
    ).length;

    const completedOptional = optionalFields.filter(field =>
      profileData[field] && profileData[field].trim() !== ''
    ).length;

    const totalRequired = requiredFields.length;
    const totalOptional = optionalFields.length;

    const requiredPercentage = (completedRequired / totalRequired) * 100;
    const overallPercentage = ((completedRequired + completedOptional) / (totalRequired + totalOptional)) * 100;

    return {
      requiredCompleted: completedRequired,
      totalRequired: totalRequired,
      optionalCompleted: completedOptional,
      totalOptional: totalOptional,
      requiredPercentage: Math.round(requiredPercentage),
      overallPercentage: Math.round(overallPercentage),
      isRequiredComplete: completedRequired === totalRequired,
      missingRequired: requiredFields.filter(field =>
        !profileData[field] || profileData[field].trim() === ''
      )
    };
  }
}

// ==========================================
// SINGLETON INSTANCE
// ==========================================

const userService = new UserService();

// ==========================================
// CONVENIENCE METHODS (funciones directas)
// ==========================================

/**
 * Obtener mi perfil - función directa
 * @returns {Promise<Object>} Datos del perfil
 */
export const getMyProfile = () => userService.getMyProfile();

/**
 * Obtener perfil de usuario - función directa
 * @param {number} userId - ID del usuario
 * @returns {Promise<Object>} Datos del perfil
 */
export const getUserProfile = (userId) => userService.getUserProfile(userId);

/**
 * Actualizar mi perfil - función directa
 * @param {Object} profileData - Datos a actualizar
 * @returns {Promise<Object>} Respuesta del update
 */
export const updateMyProfile = (profileData) => userService.updateMyProfile(profileData);

/**
 * Cambiar mi contraseña - función directa
 * @param {Object} passwordData - Datos de cambio
 * @returns {Promise<Object>} Respuesta del cambio
 */
export const changeMyPassword = (passwordData) => userService.changeMyPassword(passwordData);

/**
 * Transformar datos del perfil - función directa
 * @param {Object} backendData - Datos del backend
 * @returns {Object} Datos transformados
 */
export const transformProfileData = (backendData) => userService.transformProfileData(backendData);

/**
 * Verificar rol - función directa
 * @param {Array} userRoles - Roles del usuario
 * @param {string|Array} requiredRole - Rol requerido
 * @returns {boolean} True si tiene el rol
 */
export const hasRole = (userRoles, requiredRole) => userService.hasRole(userRoles, requiredRole);

/**
 * Verificar permiso - función directa
 * @param {Array} userPermissions - Permisos del usuario
 * @param {string|Array} requiredPermission - Permiso requerido
 * @returns {boolean} True si tiene el permiso
 */
export const hasPermission = (userPermissions, requiredPermission) => userService.hasPermission(userPermissions, requiredPermission);

// ==========================================
// EXPORT POR DEFECTO 
// ==========================================

export default userService;