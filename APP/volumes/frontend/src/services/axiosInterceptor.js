/**
 * services/axiosInterceptor.js
 * Axios + refresh silencioso + cola anti-colisión + toasts semánticos.
 *
 * Fuente de verdad del token: authStore (persistido en "auth-storage").
 * Importante:
 *  - NO leer/escribir localStorage directamente.
 *  - El refresh usa el access_token actual como Bearer (según la API).
 *  - Gateway wrapper: { success, status, result, error, meta }
 */

import axios from "axios";
import { shouldLog } from "@/utils/environment";
import { API_ENDPOINTS } from "@/constants";
import { extractErrorMessage } from "@/utils/errors";
import useAuthStore from "@/store/authStore";

// ─── Base URL ──────────────────────────────────────────────────────────────────
const getBaseUrl = () => "/api";

// ─── Toasts (lazy) ────────────────────────────────────────────────────────────
let toastModule;
const loadToast = async () => {
  if (!toastModule) {
    toastModule = await import("@/components/common/toast/toastHelpers");
  }
  return toastModule;
};

const notify = {
  error:   async (msg) => (await loadToast()).showErrorToast?.(msg),
  warning: async (msg) => (await loadToast()).showWarningToast?.(msg),
  info:    async (msg) => (await loadToast()).showInfoToast?.(msg),
};

// ─── Token Adapter — única fuente: authStore ──────────────────────────────────
const TokenAdapter = {
  get access() {
    return useAuthStore.getState?.()?.accessToken ?? null;
  },

  // Sin refresh_token separado — refresca con access_token actual
  get refresh() {
    return TokenAdapter.access;
  },

  updateTokens: ({ access_token }) => {
    const update = useAuthStore.getState?.()?.updateTokens;
    if (typeof update === "function") {
      update({ access_token });
    }
  },

  clearAll: (reason = "Auth clear (adapter)") => {
    const logout = useAuthStore.getState?.()?.logout;
    if (typeof logout === "function") logout(reason);
    if (shouldLog()) console.warn(`🧹 TokenAdapter.clearAll: ${reason}`);
  },
};

// ─── Axios instance ────────────────────────────────────────────────────────────
const axiosInstance = axios.create({
  baseURL: getBaseUrl(),
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// ─── Cola anti-colisión ───────────────────────────────────────────────────────
let isRefreshing = false;
let failedQueue  = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
};

// ─── JWT helpers ──────────────────────────────────────────────────────────────
const decodeExp = (token) => {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    return JSON.parse(atob(pad ? b64 + "=".repeat(4 - pad) : b64))?.exp ?? null;
  } catch {
    return null;
  }
};

const isAccessTokenExpiringSoon = (token, minTTLSeconds) => {
  const exp = decodeExp(token);
  if (!exp) return true;
  return exp - Math.floor(Date.now() / 1000) <= minTTLSeconds;
};

// ─── Refresh ──────────────────────────────────────────────────────────────────
const refreshAccessToken = async () => {
  const currentToken = TokenAdapter.access;
  if (!currentToken) throw new Error("No access token available for refresh");

  try {
    if (shouldLog()) console.log("🔄 Refreshing token…");

    const response = await axios.post(
      `${getBaseUrl()}${API_ENDPOINTS.AUTH.REFRESH}`,
      {},
      { headers: { Authorization: `Bearer ${currentToken}` } }
    );

    const data = response.data?.result ?? response.data;
    const access_token = data?.access_token;

    if (!access_token) throw new Error("Invalid refresh response: missing access_token");

    TokenAdapter.updateTokens({ access_token });

    if (shouldLog()) console.log("✅ Token refreshed");
    return access_token;
  } catch (error) {
    if (shouldLog()) {
      console.error("❌ Token refresh failed:", error?.message);
      if (error.response) {
        console.error("❌ Refresh details:", { status: error.response.status, data: error.response.data });
      }
    }
    TokenAdapter.clearAll("Refresh failed");
    throw error;
  }
};

// ─── Request interceptor ──────────────────────────────────────────────────────
axiosInstance.interceptors.request.use(
  (config) => {
    const accessToken = TokenAdapter.access;
    if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;

    config.metadata = { startTime: new Date() };

    if (shouldLog()) {
      console.group(`🔄 REQUEST: ${config.method?.toUpperCase()} ${getBaseUrl()}${config.url}`);
      if (config.data)   console.log("📤 Data:", config.data);
      if (config.params) console.log("🔗 Params:", config.params);
      if (config.headers.Authorization) {
        console.log("🔑 Token:", String(config.headers.Authorization).substring(0, 24) + "…");
      }
      console.groupEnd();
    }

    return config;
  },
  (error) => {
    if (shouldLog()) console.error("❌ Request interceptor error:", error);
    return Promise.reject(error);
  }
);

// ─── Toast semántico por status ───────────────────────────────────────────────
const showToastBySemantics = async (status, code, message) => {
  const msg = message || "Ha ocurrido un error procesando tu solicitud.";

  if (!status && !code) {
    await notify.error("Error de conexión. Verifica tu red e intenta nuevamente.");
    return;
  }

  if (typeof status === "number") {
    if (status >= 500) return await notify.error("Error interno del servidor. Intenta nuevamente más tarde.");
    if (status === 403) return await notify.warning("No tienes permisos para realizar esta acción.");
    if (status === 404) return await notify.info("Recurso no encontrado.");
    if (status === 422 || status === 400) return await notify.warning(msg);
  }

  await notify.error(msg);
};

// ─── Response interceptor ─────────────────────────────────────────────────────
const isAuthEndpoint = (url = "") =>
  url.includes("/auth/refresh") || url.includes("/auth/login");

axiosInstance.interceptors.response.use(
  (response) => {
    if (response?.config?.metadata?.startTime) {
      response.config.metadata.endTime = new Date();
      if (shouldLog()) {
        const ms = response.config.metadata.endTime - response.config.metadata.startTime;
        console.log(`⏱️ ${response.config.url} ${response.status} in ${ms}ms`);
      }
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    if (originalRequest?.metadata?.startTime) {
      originalRequest.metadata.endTime = new Date();
    }

    if (shouldLog()) {
      console.group(
        `❌ ERROR: ${originalRequest?.method?.toUpperCase()} ${originalRequest?.url} — ${
          error.response?.status || "Network Error"
        }`
      );
      if (error.response?.data) console.error("📥 Error Data:", error.response.data);
      console.error("🔍 Full Error:", error);
      console.groupEnd();
    }

    // ── 401: intenta refresh salvo que sea endpoint de auth ──────────────────
    if (error.response?.status === 401 && !originalRequest?._retry) {
      if (isAuthEndpoint(originalRequest?.url || "")) {
        TokenAdapter.clearAll("401 on auth endpoint");
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosInstance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      isRefreshing = true;
      try {
        const newToken = await refreshAccessToken();
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await notify.error("Tu sesión ha expirado. Por favor, vuelve a iniciar sesión.");
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // ── Otros errores: toast semántico ───────────────────────────────────────
    const status  = error.response?.status;
    const resData = error.response?.data;
    const code    = resData?.error?.code || null;
    const message = extractErrorMessage(resData, error.message);

    if (status !== 401) {
      await showToastBySemantics(status, code, message);
    }

    return Promise.reject(error);
  }
);

// ─── API Pública ──────────────────────────────────────────────────────────────
export const setAuthTokens = (accessToken) => {
  TokenAdapter.updateTokens({ access_token: accessToken });
  if (shouldLog()) console.log("🔐 Auth token configured (store)");
};

export const clearAuthTokens = () => {
  TokenAdapter.clearAll("Manual clearAuthTokens");
  if (shouldLog()) console.log("🧹 Auth token cleared (store)");
};

export const hasAccessToken  = () => !!TokenAdapter.access;
export const getAccessToken  = () => TokenAdapter.access;
export const hasRefreshToken = () => !!TokenAdapter.access;
export const hasValidTokens  = () => !!TokenAdapter.access;

export const reconnectSessionSilent = async (minTTLSeconds = 120) => {
  const access = TokenAdapter.access;
  if (!access) throw new Error("No access token available");

  if (isAccessTokenExpiringSoon(access, minTTLSeconds)) {
    if (isRefreshing) {
      return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }));
    }
    isRefreshing = true;
    try {
      const newToken = await refreshAccessToken();
      processQueue(null, newToken);
      return newToken;
    } catch (err) {
      processQueue(err, null);
      throw err;
    } finally {
      isRefreshing = false;
    }
  }

  return access;
};

export const refreshNow = async () => {
  if (!TokenAdapter.access) throw new Error("No access token available");
  if (isRefreshing) {
    return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }));
  }
  isRefreshing = true;
  try {
    const newToken = await refreshAccessToken();
    processQueue(null, newToken);
    return newToken;
  } finally {
    isRefreshing = false;
  }
};

export const forceTokenRefresh = async () => {
  try {
    return await refreshAccessToken();
  } catch {
    throw new Error("Failed to refresh token");
  }
};

// ─── Logout callbacks (para componentes que necesiten reaccionar) ──────────────
let logoutCallbacks = [];

export const onLogoutRequired = (callback) => {
  logoutCallbacks.push(callback);
  return () => {
    logoutCallbacks = logoutCallbacks.filter((cb) => cb !== callback);
  };
};

// ─── Dev helpers ──────────────────────────────────────────────────────────────
export const checkLogStatus = () => {
  const logEnabled = shouldLog();
  console.log(`🔍 Logging: ${logEnabled ? "✅ ON" : "❌ OFF"}`);
  console.log(`📋 Env:     ${process.env.NODE_ENV || "unknown"}`);
  console.log(`🌐 API:     ${getBaseUrl()}`);
  return logEnabled;
};

export const enableLogging  = () => { if (process.env.NODE_ENV === "development") window.__FORCE_LOGGING__ = true; };
export const disableLogging = () => { window.__FORCE_LOGGING__ = false; };

export default axiosInstance;