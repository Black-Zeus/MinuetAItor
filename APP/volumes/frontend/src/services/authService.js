/**
 * services/authService.js
 * Servicio de autenticación - Ajustado a OpenAPI v1
 *
 * Contrato esperado (API Gateway):
 *   { success, status, result, error, meta }
 * El payload real está en .result.
 *
 * Importante:
 *  - authService NO debe escribir ni borrar localStorage.
 *  - La persistencia/limpieza corresponde a authStore/userStore.
 */

import api from "@/services/axiosInterceptor";
import { API_ENDPOINTS } from "@/constants";
import { getFormattedError } from "@/utils/errors";
import { shouldLog } from "@/utils/environment";
import { hasAccessToken as interceptorHasAccessToken } from "@/services/axiosInterceptor";

// ==========================================
// HELPER — desenvuelve el wrapper del API Gateway
// { success, status, result, error, meta } → result
// ==========================================
const unwrap = (responseData) => responseData?.result ?? responseData;

// ==========================================
// AUTH SERVICE CLASS
// ==========================================
class AuthService {
  /**
   * Login
   * POST /v1/auth/login → result: { access_token, token_type, expires_in }
   */
  async login(credentials) {
    try {
      if (shouldLog()) {
        console.log(
          "🔐 Attempting login for:",
          credentials?.credential ?? credentials?.username ?? credentials?.email
        );
      }

      const response = await api.post(API_ENDPOINTS.AUTH.LOGIN, {
        credential: credentials?.credential ?? credentials?.username ?? credentials?.email,
        password: credentials?.password,
      });

      const result = unwrap(response.data);

      if (!result?.access_token) {
        throw new Error("Invalid login response: missing access_token");
      }

      if (shouldLog()) console.log("✅ Login successful");
      return result; // { access_token, token_type, expires_in }
    } catch (error) {
      const formattedError = getFormattedError(error);
      if (shouldLog()) console.error("❌ Login failed:", formattedError);
      throw formattedError;
    }
  }

  /**
   * Obtener usuario autenticado
   * GET /v1/auth/me → result: MeResponse
   */
  async getMe() {
    try {
      if (shouldLog()) console.log("👤 Fetching /auth/me …");

      const response = await api.get(API_ENDPOINTS.AUTH.ME);
      const result = unwrap(response.data);

      if (!result?.user_id) {
        throw new Error("Invalid /auth/me response");
      }

      if (shouldLog()) console.log("✅ /auth/me OK:", result.username);
      return result; // MeResponse
    } catch (error) {
      const formattedError = getFormattedError(error);
      if (shouldLog()) console.error("❌ /auth/me failed:", formattedError);
      throw formattedError;
    }
  }

  /**
   * Logout
   * POST /v1/auth/logout
   *
   * Nota:
   * - La limpieza de estado/token se hace en authStore/userStore.
   * - Aquí solo se intenta notificar al backend.
   */
  async logout() {
    try {
      if (shouldLog()) console.log("🚪 Attempting logout");
      await api.post(API_ENDPOINTS.AUTH.LOGOUT);
      if (shouldLog()) console.log("✅ Logout successful");
      return { success: true };
    } catch (error) {
      if (shouldLog()) console.warn("⚠️ Logout API failed (proceeding anyway):", error?.message);
      return { success: true, apiError: error?.message };
    }
  }

  /**
   * Validar token
   * GET /v1/auth/validate-token → result: { valid, user_id, expires_in }
   */
  async validateToken() {
    try {
      const response = await api.get(API_ENDPOINTS.AUTH.VALIDATE_TOKEN);
      return unwrap(response.data); // { valid, user_id, expires_in }
    } catch {
      return { valid: false };
    }
  }

  // ==========================================
  // PASSWORD METHODS
  // ==========================================

  /**
   * Cambiar contraseña propia
   * POST /v1/auth/change-password
   */
  async changePassword(passwordData) {
    try {
      if (shouldLog()) console.log("🔒 Changing password…");

      if (!passwordData?.current_password) throw new Error("Contraseña actual requerida");
      if (!passwordData?.new_password) throw new Error("Nueva contraseña requerida");

      if (
        passwordData?.confirm_password !== undefined &&
        passwordData?.new_password !== passwordData?.confirm_password
      ) {
        throw new Error("Las contraseñas no coinciden");
      }

      await api.post(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password,
        revoke_sessions: passwordData.revoke_sessions ?? false,
        ...(passwordData.confirm_password !== undefined
          ? { confirm_password: passwordData.confirm_password }
          : {}),
      });

      if (shouldLog()) console.log("✅ Password changed");
      return { success: true };
    } catch (error) {
      const formattedError = this._formatPasswordError(error);
      if (shouldLog()) console.error("❌ Change password failed:", formattedError);
      throw formattedError;
    }
  }

  /**
   * Cambiar contraseña de otro usuario (admin)
   * POST /v1/auth/change-password-by-admin
   */
  async changePasswordByAdmin(data) {
    try {
      if (shouldLog()) console.log("🔒 Admin changing password for user:", data?.user_id);

      if (!data?.user_id) throw new Error("user_id requerido");
      if (!data?.new_password) throw new Error("new_password requerido");
      if (!data?.reason) throw new Error("reason requerido");

      await api.post(API_ENDPOINTS.AUTH.CHANGE_PASSWORD_ADMIN, {
        user_id: data.user_id,
        new_password: data.new_password,
        reason: data.reason,
      });

      if (shouldLog()) console.log("✅ Admin password change done");
      return { success: true };
    } catch (error) {
      const formattedError = this._formatPasswordError(error);
      if (shouldLog()) console.error("❌ Admin change password failed:", formattedError);
      throw formattedError;
    }
  }

  /**
   * Forgot password
   * POST /v1/auth/forgot-password
   */
  async forgotPassword(email) {
    try {
      if (!email?.trim()) throw new Error("Email requerido");

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) throw new Error("El formato del email no es válido");

      await api.post(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, { email: email.trim() });

      if (shouldLog()) console.log("✅ Password reset email sent");
      return { success: true };
    } catch (error) {
      const formattedError = getFormattedError(error);
      if (shouldLog()) console.error("❌ Forgot password failed:", formattedError);
      throw formattedError;
    }
  }

  /**
   * Reset password
   * POST /v1/auth/reset-password
   */
  async resetPassword(resetData) {
    try {
      if (!resetData?.token) throw new Error("Token de reset requerido");
      if (!resetData?.new_password) throw new Error("Nueva contraseña requerida");

      if (
        resetData?.confirm_password !== undefined &&
        resetData?.new_password !== resetData?.confirm_password
      ) {
        throw new Error("Las contraseñas no coinciden");
      }

      await api.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, {
        token: resetData.token,
        new_password: resetData.new_password,
        ...(resetData.confirm_password !== undefined
          ? { confirm_password: resetData.confirm_password }
          : {}),
      });

      if (shouldLog()) console.log("✅ Password reset successful");
      return { success: true };
    } catch (error) {
      const formattedError = getFormattedError(error);
      if (shouldLog()) console.error("❌ Reset password failed:", formattedError);
      throw formattedError;
    }
  }

  // ==========================================
  // TOKEN UTILITIES (lectura)
  // ==========================================

  hasAccessToken() {
    return interceptorHasAccessToken();
  }

  hasValidTokens() {
    return this.hasAccessToken();
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  _formatPasswordError(error) {
    if (error?.response?.data) {
      const bd = unwrap(error.response.data) ?? error.response.data;

      let message = bd?.message || bd?.detail || "Error al cambiar la contraseña";

      if (Array.isArray(bd?.detail)) {
        message = bd.detail.map((d) => d?.msg || d).join(", ");
      }

      if (bd?.error?.details) {
        const details = bd.error.details;

        if (typeof details === "string" && details.startsWith("[")) {
          try {
            const parsed = JSON.parse(details.replace(/'/g, '"'));
            if (Array.isArray(parsed) && parsed.length > 0) {
              message += "\n\n" + parsed.map((item) => `\t• ${item}`).join("\n");
            }
          } catch {
            message += "\n\nDetalles: " + details;
          }
        } else if (Array.isArray(details) && details.length > 0) {
          message += "\n\n" + details.map((item) => `\t• ${item}`).join("\n");
        } else if (typeof details === "string") {
          message += "\n\nDetalles: " + details;
        }
      }

      return {
        code: bd?.error?.code || "BACKEND_ERROR",
        message,
        status: error.response.status,
      };
    }

    return getFormattedError(error);
  }
}

// ==========================================
// SINGLETON
// ==========================================
const authService = new AuthService();

// ==========================================
// CONVENIENCE EXPORTS
// ==========================================
export const login = (credentials) => authService.login(credentials);
export const getMe = () => authService.getMe();
export const logout = () => authService.logout();
export const validateToken = () => authService.validateToken();

export const changePassword = (data) => authService.changePassword(data);
export const changePasswordByAdmin = (data) => authService.changePasswordByAdmin(data);
export const forgotPassword = (email) => authService.forgotPassword(email);
export const resetPassword = (data) => authService.resetPassword(data);

export const hasAccessToken = () => authService.hasAccessToken();
export const hasValidTokens = () => authService.hasValidTokens();

// Alias compatibilidad
export const hasRefreshToken = () => authService.hasAccessToken();
export const getTokensStatus = () => ({
  hasAccess: authService.hasAccessToken(),
  hasRefresh: false,
  hasValid: authService.hasAccessToken(),
});

export default authService;
