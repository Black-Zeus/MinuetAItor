/**
 * services/authService.js
 * Servicio de autenticación - Encapsula todas las llamadas de auth
 * Login, logout, refresh, validación de tokens, cambio de contraseñas
 * 🔧 MEJORADO: Validaciones previas y mejor manejo de errores
 */

import api from '@/services/axiosInterceptor';
import { API_ENDPOINTS } from '@/constants';
import { parseError, getFormattedError } from '@/utils/errors'; // 🔧 USAR DICCIONARIO DE ERRORES
import { shouldLog } from '@/utils/environment';
import { 
  hasValidTokens as interceptorHasValidTokens, 
  hasAccessToken as interceptorHasAccessToken, 
  hasRefreshToken as interceptorHasRefreshToken 
} from '@/services/axiosInterceptor';

// ==========================================
// STORAGE KEYS
// ==========================================

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_INFO: 'user_info'
};

// ==========================================
// AUTH SERVICE CLASS - MEJORADO
// ==========================================

class AuthService {

  // ==========================================
  // AUTHENTICATION METHODS
  // ==========================================

  /**
   * Autenticar usuario (login)
   * @param {Object} credentials - Credenciales de login
   * @param {string} credentials.username - Usuario
   * @param {string} credentials.password - Contraseña
   * @param {boolean} credentials.remember_me - Recordar sesión
   * @returns {Promise<Object>} Respuesta del login
   */
  async login(credentials) {
    try {
      if (shouldLog()) {
        console.log('🔐 Attempting login for:', credentials.username);
      }

      const response = await api.post(API_ENDPOINTS.AUTH.LOGIN, {
        username: credentials.username,
        password: credentials.password,
        remember_me: credentials.remember_me || false
      });

      if (response.data?.success && response.data?.data) {
        if (shouldLog()) {
          console.log('✅ Login successful for:', credentials.username);
        }
        return response.data;
      }

      throw new Error('Invalid login response format');

    } catch (error) {
      const formattedError = getFormattedError(error);

      if (shouldLog()) {
        console.error('❌ Login failed:', formattedError);
      }

      throw formattedError;
    }
  }

  /**
   * Cerrar sesión (logout)
   * @returns {Promise<Object>} Respuesta del logout
   */
  async logout() {
    try {
      if (shouldLog()) {
        console.log('🚪 Attempting logout');
      }

      const response = await api.post(API_ENDPOINTS.AUTH.LOGOUT);

      if (response.data?.success) {
        if (shouldLog()) {
          console.log('✅ Logout successful');
        }
        return response.data;
      }

      throw new Error('Invalid logout response');

    } catch (error) {
      // En caso de error de logout, aún consideramos exitoso
      // porque el usuario quiere cerrar sesión
      if (shouldLog()) {
        console.warn('⚠️ Logout API failed, but proceeding:', error.message);
      }

      return {
        success: true,
        message: 'Logout completed (with API error)',
        data: { logged_out: true }
      };
    }
  }

  /**
   * Renovar token de acceso
   * Nota: Normalmente esto lo maneja el axios interceptor automáticamente
   * @returns {Promise<Object>} Nuevos tokens
   */
  async refreshToken() {
    try {
      const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      if (shouldLog()) {
        console.log('🔄 Attempting token refresh');
      }

      const response = await api.post(API_ENDPOINTS.AUTH.REFRESH, {
        refresh_token: refreshToken
      });

      if (response.data?.success && response.data?.data) {
        if (shouldLog()) {
          console.log('✅ Token refresh successful');
        }
        return response.data;
      }

      throw new Error('Invalid refresh response format');

    } catch (error) {
      const formattedError = getFormattedError(error);

      if (shouldLog()) {
        console.error('❌ Token refresh failed:', formattedError);
      }

      throw formattedError;
    }
  }

  /**
   * Validar token actual
   * @param {string} token - Token a validar (opcional, usa el del storage si no se proporciona)
   * @returns {Promise<Object>} Respuesta de la validación
   */
  async validateToken(token = null) {
    try {
      const tokenToValidate = token || localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);

      if (!tokenToValidate) {
        throw new Error('No token to validate');
      }

      if (shouldLog()) {
        console.log('🔍 Validating token');
      }

      const response = await api.post(API_ENDPOINTS.AUTH.VALIDATE_TOKEN, {
        token: tokenToValidate
      });

      if (response.data?.success) {
        if (shouldLog()) {
          console.log('✅ Token is valid');
        }
        return response.data;
      }

      throw new Error('Token validation failed');

    } catch (error) {
      const formattedError = getFormattedError(error);

      if (shouldLog()) {
        console.error('❌ Token validation failed:', formattedError);
      }

      throw formattedError;
    }
  }

  // ==========================================
  // PASSWORD MANAGEMENT - 🔧 MEJORADO
  // ==========================================

  /**
   * 🔧 VALIDACIÓN PREVIA - Verifica que hay tokens válidos antes de operaciones críticas
   * @returns {boolean} True si hay tokens válidos
   * @throws {Error} Si no hay tokens válidos
   */
  _validateTokensBeforeCriticalOperation() {
    if (!interceptorHasValidTokens()) {
      const hasAccess = interceptorHasAccessToken();
      const hasRefresh = interceptorHasRefreshToken();
      
      let errorMessage = 'No se puede realizar la operación: ';
      
      if (!hasAccess && !hasRefresh) {
        errorMessage += 'No hay tokens de autenticación. Es necesario iniciar sesión.';
      } else if (!hasAccess) {
        errorMessage += 'Token de acceso no válido. Intenta cerrar sesión e iniciar sesión nuevamente.';
      } else if (!hasRefresh) {
        errorMessage += 'Token de actualización no válido. Es necesario iniciar sesión nuevamente.';
      }

      if (shouldLog()) {
        console.error('❌ Token validation failed:', {
          hasAccess,
          hasRefresh,
          message: errorMessage
        });
      }

      throw new Error(errorMessage);
    }

    return true;
  }

  /**
   * Cambiar contraseña del usuario actual - 🔧 MEJORADO
   * @param {Object} passwordData - Datos de cambio de contraseña
   * @param {string} passwordData.current_password - Contraseña actual
   * @param {string} passwordData.new_password - Nueva contraseña
   * @param {string} passwordData.confirm_password - Confirmación de nueva contraseña
   * @returns {Promise<Object>} Respuesta del cambio
   */
  async changePassword(passwordData) {
    try {
      if (shouldLog()) {
        console.log('🔑 Attempting password change...');
      }

      // 🔧 VALIDACIÓN PREVIA CRÍTICA
      this._validateTokensBeforeCriticalOperation();

      // Validación de datos requeridos
      if (!passwordData.current_password) {
        throw new Error('La contraseña actual es requerida');
      }

      if (!passwordData.new_password) {
        throw new Error('La nueva contraseña es requerida');
      }

      if (!passwordData.confirm_password) {
        throw new Error('La confirmación de contraseña es requerida');
      }

      if (passwordData.new_password !== passwordData.confirm_password) {
        throw new Error('Las contraseñas no coinciden');
      }

      if (shouldLog()) {
        console.log('✅ Pre-validation passed, sending request...');
      }

      // 🔧 USAR PUT según el backend (no POST)
      const response = await api.put(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, {
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

      throw new Error('Password change failed');

    } catch (error) {
      const formattedError = getFormattedError(error);

      if (shouldLog()) {
        console.error('❌ Password change failed:', formattedError);
        
        // Log adicional para debugging
        if (error.response?.status === 401) {
          console.error('🔍 401 Error details:', {
            hasValidTokens: interceptorHasValidTokens(),
            hasAccessToken: interceptorHasAccessToken(),
            hasRefreshToken: interceptorHasRefreshToken(),
            errorData: error.response?.data
          });
        }
      }

      throw formattedError;
    }
  }

  /**
   * Cambio de contraseña por administrador - 🔧 MEJORADO
   * @param {Object} adminPasswordData - Datos del cambio admin
   * @param {number} adminPasswordData.target_user_id - ID del usuario objetivo
   * @param {string} adminPasswordData.new_password - Nueva contraseña
   * @param {string} adminPasswordData.confirm_password - Confirmación
   * @param {string} adminPasswordData.reason - Razón del cambio (opcional)
   * @returns {Promise<Object>} Respuesta del cambio
   */
  async adminChangePassword(adminPasswordData) {
    try {
      if (shouldLog()) {
        console.log('🔑 Admin attempting password change for user:', adminPasswordData.target_user_id);
      }

      // 🔧 VALIDACIÓN PREVIA CRÍTICA
      this._validateTokensBeforeCriticalOperation();

      // Validación de datos requeridos
      if (!adminPasswordData.target_user_id) {
        throw new Error('ID del usuario objetivo es requerido');
      }

      if (!adminPasswordData.new_password) {
        throw new Error('La nueva contraseña es requerida');
      }

      if (!adminPasswordData.confirm_password) {
        throw new Error('La confirmación de contraseña es requerida');
      }

      if (adminPasswordData.new_password !== adminPasswordData.confirm_password) {
        throw new Error('Las contraseñas no coinciden');
      }

      const requestData = {
        target_user_id: adminPasswordData.target_user_id,
        new_password: adminPasswordData.new_password,
        confirm_password: adminPasswordData.confirm_password
      };

      // Agregar razón si se proporciona
      if (adminPasswordData.reason) {
        requestData.reason = adminPasswordData.reason;
      }

      // 🔧 USAR PUT según el backend
      const response = await api.put(API_ENDPOINTS.AUTH.CHANGE_PASSWORD_ADMIN, requestData);

      if (response.data?.success) {
        if (shouldLog()) {
          console.log('✅ Admin password change successful');
        }
        return response.data;
      }

      throw new Error('Admin password change failed');

    } catch (error) {
      const formattedError = getFormattedError(error);

      if (shouldLog()) {
        console.error('❌ Admin password change failed:', formattedError);
      }

      throw formattedError;
    }
  }

  /**
   * Solicitar reset de contraseña (forgot password) - 🔧 MEJORADO
   * @param {string} email - Email del usuario
   * @returns {Promise<Object>} Respuesta de la solicitud
   */
  async forgotPassword(email) {
    try {
      if (shouldLog()) {
        console.log('📧 Requesting password reset for:', email);
      }

      // Validación de email
      if (!email || !email.trim()) {
        throw new Error('El email es requerido');
      }

      // Validación básica de formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('El formato del email no es válido');
      }

      const response = await api.post(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, {
        email: email.trim()
      });

      if (response.data?.success) {
        if (shouldLog()) {
          console.log('✅ Password reset email sent');
        }
        return response.data;
      }

      throw new Error('Password reset request failed');

    } catch (error) {
      const formattedError = getFormattedError(error);

      if (shouldLog()) {
        console.error('❌ Password reset request failed:', formattedError);
      }

      throw formattedError;
    }
  }

  /**
   * Resetear contraseña con token - 🔧 MEJORADO
   * @param {Object} resetData - Datos del reset
   * @param {string} resetData.token - Token de reset
   * @param {string} resetData.new_password - Nueva contraseña
   * @param {string} resetData.confirm_password - Confirmación
   * @returns {Promise<Object>} Respuesta del reset
   */
  async resetPassword(resetData) {
    try {
      if (shouldLog()) {
        console.log('🔄 Attempting password reset');
      }

      // Validación de datos requeridos
      if (!resetData.token) {
        throw new Error('Token de reset es requerido');
      }

      if (!resetData.new_password) {
        throw new Error('La nueva contraseña es requerida');
      }

      if (!resetData.confirm_password) {
        throw new Error('La confirmación de contraseña es requerida');
      }

      if (resetData.new_password !== resetData.confirm_password) {
        throw new Error('Las contraseñas no coinciden');
      }

      const response = await api.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, {
        token: resetData.token,
        new_password: resetData.new_password,
        confirm_password: resetData.confirm_password
      });

      if (response.data?.success) {
        if (shouldLog()) {
          console.log('✅ Password reset successful');
        }
        return response.data;
      }

      throw new Error('Password reset failed');

    } catch (error) {
      const formattedError = getFormattedError(error);

      if (shouldLog()) {
        console.error('❌ Password reset failed:', formattedError);
      }

      throw formattedError;
    }
  }

  // ==========================================
  // TOKEN UTILITIES - 🔧 MEJORADO
  // ==========================================

  /**
   * Verifica si hay tokens válidos en storage
   * @returns {boolean} True si hay tokens
   */
  hasValidTokens() {
    return interceptorHasValidTokens(); // Usar función del interceptor
  }

  /**
   * 🔧 NUEVO - Verifica si hay token de acceso
   * @returns {boolean} True si hay token de acceso
   */
  hasAccessToken() {
    return interceptorHasAccessToken();
  }

  /**
   * 🔧 NUEVO - Verifica si hay refresh token
   * @returns {boolean} True si hay refresh token
   */
  hasRefreshToken() {
    return interceptorHasRefreshToken();
  }

  /**
   * 🔧 NUEVO - Obtiene estado detallado de tokens
   * @returns {Object} Estado de tokens
   */
  getTokensStatus() {
    return {
      hasAccess: this.hasAccessToken(),
      hasRefresh: this.hasRefreshToken(),
      hasValid: this.hasValidTokens(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Obtiene información del usuario desde el token JWT
   * @returns {Object|null} Info del usuario decodificada del token
   */
  getUserFromToken() {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      if (!token) return null;

      // Decodificar el payload del JWT (segunda parte)
      const payload = JSON.parse(atob(token.split('.')[1]));

      return {
        user_id: payload.user_id,
        username: payload.username,
        email: payload.email,
        is_active: payload.is_active,
        roles: payload.roles || [],
        permissions: payload.permissions || [],
        token_type: payload.token_type,
        exp: payload.exp,
        iat: payload.iat
      };

    } catch (error) {
      if (shouldLog()) {
        console.error('Error decoding token:', error);
      }
      return null;
    }
  }

  /**
   * Verifica si el token está próximo a expirar
   * @param {number} bufferMinutes - Minutos de buffer antes de expiración
   * @returns {boolean} True si expira pronto
   */
  isTokenExpiringSoon(bufferMinutes = 5) {
    try {
      const userInfo = this.getUserFromToken();
      if (!userInfo?.exp) return true;

      const expirationTime = userInfo.exp * 1000; // Convertir a milliseconds
      const currentTime = Date.now();
      const bufferTime = bufferMinutes * 60 * 1000; // Convertir minutos a milliseconds

      return (expirationTime - currentTime) <= bufferTime;

    } catch (error) {
      if (shouldLog()) {
        console.error('Error checking token expiration:', error);
      }
      return true; // Si hay error, asumir que expira pronto
    }
  }

  /**
   * Obtiene el tiempo restante del token en segundos
   * @returns {number} Segundos restantes (0 si expirado o error)
   */
  getTokenTimeRemaining() {
    try {
      const userInfo = this.getUserFromToken();
      if (!userInfo?.exp) return 0;

      const expirationTime = userInfo.exp * 1000;
      const currentTime = Date.now();
      const timeRemaining = Math.max(0, (expirationTime - currentTime) / 1000);

      return Math.floor(timeRemaining);

    } catch (error) {
      if (shouldLog()) {
        console.error('Error calculating token time remaining:', error);
      }
      return 0;
    }
  }

  // ==========================================
  // CLEANUP UTILITIES
  // ==========================================

  /**
   * Limpia toda la información de auth del localStorage
   */
  clearAuthData() {
    const keysToRemove = [
      ...Object.values(STORAGE_KEYS),
      'auth_state' // Zustand persist key
    ];

    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });

    if (shouldLog()) {
      console.log('🧹 Auth data cleared from storage');
    }
  }

  // ==========================================
  // SESSION MANAGEMENT - 🔧 MEJORADO
  // ==========================================

  /**
   * Verifica si la sesión es válida
   * @returns {boolean} True si la sesión es válida
   */
  isSessionValid() {
    try {
      const hasTokens = this.hasValidTokens();
      const userInfo = this.getUserFromToken();
      const isNotExpired = !this.isTokenExpiringSoon(0); // Sin buffer para verificación estricta

      if (shouldLog()) {
        console.log('🔍 Session validation:', {
          hasTokens,
          hasUserInfo: !!userInfo,
          isNotExpired,
          isValid: hasTokens && userInfo && isNotExpired
        });
      }

      return hasTokens && userInfo && isNotExpired;

    } catch (error) {
      if (shouldLog()) {
        console.error('Error validating session:', error);
      }
      return false;
    }
  }

  /**
   * Obtiene información completa de la sesión actual
   * @returns {Object|null} Información de la sesión
   */
  getSessionInfo() {
    try {
      const userInfo = this.getUserFromToken();
      if (!userInfo) return null;

      const tokensStatus = this.getTokensStatus();

      return {
        isValid: this.isSessionValid(),
        user: userInfo,
        timeRemaining: this.getTokenTimeRemaining(),
        expiringSoon: this.isTokenExpiringSoon(),
        tokens: {
          hasAccess: tokensStatus.hasAccess,
          hasRefresh: tokensStatus.hasRefresh,
          hasValid: tokensStatus.hasValid
        },
        sessionCheckedAt: new Date().toISOString()
      };

    } catch (error) {
      if (shouldLog()) {
        console.error('Error getting session info:', error);
      }
      return null;
    }
  }
}

// ==========================================
// SINGLETON INSTANCE
// ==========================================

const authService = new AuthService();

// ==========================================
// CONVENIENCE METHODS (funciones directas) - 🔧 MEJORADAS
// ==========================================

/**
 * Login rápido - función directa
 * @param {Object} credentials - Credenciales
 * @returns {Promise<Object>} Respuesta del login
 */
export const login = (credentials) => authService.login(credentials);

/**
 * Logout rápido - función directa
 * @returns {Promise<Object>} Respuesta del logout
 */
export const logout = () => authService.logout();

/**
 * Validar token rápido - función directa
 * @param {string} token - Token a validar
 * @returns {Promise<Object>} Respuesta de la validación
 */
export const validateToken = (token) => authService.validateToken(token);

/**
 * Refresh token rápido - función directa
 * @returns {Promise<Object>} Respuesta del refresh
 */
export const refreshToken = () => authService.refreshToken();

/**
 * Cambio de contraseña rápido - función directa - 🔧 MEJORADO
 * @param {Object} passwordData - Datos de la contraseña
 * @returns {Promise<Object>} Respuesta del cambio
 */
export const changePassword = (passwordData) => authService.changePassword(passwordData);

/**
 * Cambio de contraseña admin rápido - función directa
 * @param {Object} adminPasswordData - Datos del cambio admin
 * @returns {Promise<Object>} Respuesta del cambio
 */
export const adminChangePassword = (adminPasswordData) => authService.adminChangePassword(adminPasswordData);

/**
 * Forgot password rápido - función directa
 * @param {string} email - Email del usuario
 * @returns {Promise<Object>} Respuesta de la solicitud
 */
export const forgotPassword = (email) => authService.forgotPassword(email);

/**
 * Reset password rápido - función directa
 * @param {Object} resetData - Datos del reset
 * @returns {Promise<Object>} Respuesta del reset
 */
export const resetPassword = (resetData) => authService.resetPassword(resetData);

// ==========================================
// UTILITY EXPORTS - 🔧 MEJORADAS
// ==========================================

/**
 * Verifica si hay tokens válidos en storage
 * @returns {boolean} True si hay tokens
 */
export const hasValidTokens = () => authService.hasValidTokens();

/**
 * 🔧 NUEVO - Verifica si hay token de acceso
 * @returns {boolean} True si hay token de acceso
 */
export const hasAccessToken = () => authService.hasAccessToken();

/**
 * 🔧 NUEVO - Verifica si hay refresh token
 * @returns {boolean} True si hay refresh token
 */
export const hasRefreshToken = () => authService.hasRefreshToken();

/**
 * 🔧 NUEVO - Obtiene estado detallado de tokens
 * @returns {Object} Estado de tokens
 */
export const getTokensStatus = () => authService.getTokensStatus();

/**
 * Obtiene información del usuario desde el token
 * @returns {Object|null} Info del usuario
 */
export const getUserFromToken = () => authService.getUserFromToken();

/**
 * Verifica si el token está próximo a expirar
 * @param {number} bufferMinutes - Minutos de buffer
 * @returns {boolean} True si expira pronto
 */
export const isTokenExpiringSoon = (bufferMinutes) => authService.isTokenExpiringSoon(bufferMinutes);

/**
 * Obtiene el tiempo restante del token en segundos
 * @returns {number} Segundos restantes
 */
export const getTokenTimeRemaining = () => authService.getTokenTimeRemaining();

/**
 * Verifica si la sesión es válida
 * @returns {boolean} True si la sesión es válida
 */
export const isSessionValid = () => authService.isSessionValid();

/**
 * Obtiene información completa de la sesión
 * @returns {Object|null} Información de la sesión
 */
export const getSessionInfo = () => authService.getSessionInfo();

/**
 * Limpia toda la información de auth del localStorage
 */
export const clearAuthData = () => authService.clearAuthData();

// ==========================================
// EXPORT POR DEFECTO
// ==========================================

export default authService;