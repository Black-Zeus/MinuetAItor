/**
 * services/axiosInterceptor.js
 * Axios + refresh silencioso + cola anti-colisión + toasts semánticos.
 * Fuente de verdad: Zustand authStore (sin duplicar persistencia).
 */

import axios from "axios";
import { getApiUrl, shouldLog } from "@/utils/environment";
import { API_ENDPOINTS } from "@/constants";
import { parseError, shouldLogout, isRetryableError } from "@/utils/errors";
import useAuthStore from "@/store/authStore";

// ===================================================
// Toasts (lazy, para no cargar JSX en services)
// ===================================================
let toastModule;
const loadToast = async () => {
  if (!toastModule) {
    toastModule = await import("@/components/common/toast/toastHelpers");
  }
  return toastModule;
};
const notify = {
  error: async (msg) => (await loadToast()).showErrorToast?.(msg),
  warning: async (msg) => (await loadToast()).showWarningToast?.(msg),
  info: async (msg) => (await loadToast()).showInfoToast?.(msg),
};

// ===================================================
// Adaptador de tokens -> usa el store como única fuente de verdad
// (con fallback de solo-lectura a localStorage en arranque frío)
// ===================================================
const LS_KEYS = {
  ACCESS: "access_token",
  REFRESH: "refresh_token",
  USER_INFO: "user_info",
};

const TokenAdapter = {
  get access() {
    const state = useAuthStore.getState?.();
    return state?.accessToken ?? localStorage.getItem(LS_KEYS.ACCESS) ?? null;
  },
  get refresh() {
    const state = useAuthStore.getState?.();
    return state?.refreshToken ?? localStorage.getItem(LS_KEYS.REFRESH) ?? null;
  },
  updateTokens: (tokens) => {
    // Espera { access_token, refresh_token? }
    const update = useAuthStore.getState?.().updateTokens;
    if (typeof update === "function") {
      update(tokens);
    } else {
      // Fallback de emergencia si el store aún no expone updateTokens (no debería pasar)
      if (tokens?.access_token) localStorage.setItem(LS_KEYS.ACCESS, tokens.access_token);
      if (tokens?.refresh_token) localStorage.setItem(LS_KEYS.REFRESH, tokens.refresh_token);
    }
  },
  clearAll: (reason = "Auth clear (adapter)") => {
    const logout = useAuthStore.getState?.().logout;
    if (typeof logout === "function") {
      logout(reason);
    } else {
      // Fallback: limpiar claves conocidas
      Object.values(LS_KEYS).forEach((k) => localStorage.removeItem(k));
    }
  },
};

// ===================================================
// Axios base
// ===================================================
const axiosInstance = axios.create({
  baseURL: getApiUrl(),
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// ===================================================
// Refresh handling (cola + guards)
// ===================================================
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
};

// decode exp de JWT
const decodeExp = (jwt) => {
  try {
    const [, payloadB64] = jwt.split(".");
    if (!payloadB64) return null;
    const json = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json)?.exp ?? null;
  } catch {
    return null;
  }
};

const isAccessTokenExpiringSoon = (token, minTTL) => {
  const exp = decodeExp(token);
  if (!exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return exp - now <= minTTL;
};

// === REFRESH (Authorization: Bearer <refresh_token>, body {} )
const refreshAccessToken = async () => {
  const refreshToken = TokenAdapter.refresh;
  if (!refreshToken) throw new Error("No refresh token available");

  try {
    if (shouldLog()) console.log("🔄 Refreshing token…");

    const response = await axios.post(
      `${getApiUrl()}${API_ENDPOINTS.AUTH.REFRESH}`,
      {},
      { headers: { Authorization: `Bearer ${refreshToken}` } }
    );

    const data = response?.data?.data;
    const access_token = data?.access_token;
    const new_refresh = data?.refresh_token;

    if (!access_token) throw new Error("Invalid refresh response");

    TokenAdapter.updateTokens({
      access_token,
      ...(new_refresh && { refresh_token: new_refresh }),
    });

    if (shouldLog()) console.log("✅ Token refreshed");
    return access_token;
  } catch (error) {
    if (shouldLog()) {
      console.error("❌ Token refresh failed:", error);
      if (error.response) {
        console.error("❌ Refresh error details:", {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers,
        });
      }
    }
    TokenAdapter.clearAll("Refresh failed");
    throw error;
  }
};

// ===================================================
// Request interceptor (Auth + timing + logs)
// ===================================================
axiosInstance.interceptors.request.use(
  (config) => {
    const accessToken = TokenAdapter.access;
    if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;

    // timing
    config.metadata = { startTime: new Date() };

    if (shouldLog()) {
      console.group(
        `🔄 REQUEST: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`
      );
      if (config.data) console.log("📤 Data:", config.data);
      if (config.params) console.log("🔗 Params:", config.params);
      if (config.headers.Authorization) {
        console.log(
          "🔑 Token:",
          String(config.headers.Authorization).substring(0, 24) + "…"
        );
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

// ===================================================
// Toasts semánticos por status/código
// ===================================================
const showToastBySemantics = async (status, code, message) => {
  const msg = message || "Ha ocurrido un error procesando tu solicitud.";

  // timeouts / network
  if (code === "ECONNABORTED" || code === "NETWORK_ERROR") {
    await notify.error("No hay conexión con el servidor o la solicitud expiró.");
    return;
  }

  if (typeof status === "number") {
    if (status >= 500)
      return await notify.error(
        "Error interno del servidor. Intenta nuevamente más tarde."
      );
    if (status === 403)
      return await notify.warning("No tienes permisos para realizar esta acción.");
    if (status === 404) return await notify.info("Recurso no encontrado.");
    if (status === 422 || status === 400) return await notify.warning(msg);
  }

  await notify.error(msg);
};

// ===================================================
// Response interceptor (401->refresh, reintentos, toasts, timing)
// ===================================================
const isAuthEndpoint = (url = "") =>
  url.includes("/auth/refresh") ||
  url.includes("/auth/login") ||
  url.includes("/auth/register");

axiosInstance.interceptors.response.use(
  (response) => {
    if (response?.config?.metadata?.startTime) {
      response.config.metadata.endTime = new Date();
      if (shouldLog()) {
        const ms =
          response.config.metadata.endTime - response.config.metadata.startTime;
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
        `❌ ERROR: ${originalRequest?.method?.toUpperCase()} ${originalRequest?.url
        } - ${error.response?.status || "Network Error"}`
      );
      if (error.response?.data)
        console.error("📥 Error Data:", error.response.data);
      if (error.response?.headers)
        console.error("📊 Error Headers:", error.response.headers);
      console.error("🔍 Full Error:", error);
      console.groupEnd();
    }

    // -------- 401: intenta refresh salvo que sea endpoint de auth
    if (error.response?.status === 401 && !originalRequest?._retry) {
      if (isAuthEndpoint(originalRequest?.url || "")) {
        TokenAdapter.clearAll("401 on auth endpoint");
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      if (isRefreshing) {
        // En cola mientras otro refresh ocurre
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
        TokenAdapter.clearAll("Refresh failed -> logout");
        triggerLogout("Token refresh failed");
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // -------- Otros errores: reintento simple si es retryable
    const parsed = parseError(error); // { code, message, userMessage? }
    if (isRetryableError(parsed.code) && !originalRequest?._retryCount) {
      originalRequest._retryCount = 1;
      await new Promise((r) => setTimeout(r, 1000));
      if (shouldLog()) {
        console.log(
          `🔄 RETRY: ${originalRequest.method?.toUpperCase()} ${originalRequest.url}`
        );
      }
      return axiosInstance(originalRequest);
    }

    // -------- Errores que requieren logout según política
    if (shouldLogout(parsed.code)) {
      TokenAdapter.clearAll(`Auth error: ${parsed.code}`);
      triggerLogout(`Auth error: ${parsed.code}`);
      if (!originalRequest?._toastShown) {
        originalRequest._toastShown = true;
        await notify.error("Autenticación inválida. Vuelve a iniciar sesión.");
      }
      return Promise.reject(error);
    }

    // -------- Toast semántico (una sola vez por request)
    if (!originalRequest?._toastShown) {
      originalRequest._toastShown = true;
      const status = error.response?.status;
      const code =
        parsed.code || (error.message === "Network Error" ? "NETWORK_ERROR" : undefined);
      const displayMessage = parsed.userMessage || parsed.message || undefined;
      await showToastBySemantics(status, code, displayMessage);
    }

    return Promise.reject(error);
  }
);

// ===================================================
// Logout callbacks (para layout/header, etc.)
// ===================================================
let logoutCallbacks = [];
const triggerLogout = (reason) => {
  if (shouldLog()) console.warn(`⚠️ Triggering logout: ${reason}`);

  // Notificar listeners externos (opcional)
  logoutCallbacks.forEach((cb) => {
    try {
      cb(reason);
    } catch (e) {
      console.error("Error in logout callback:", e);
    }
  });

  // Asegurar estado consistente en store
  const logout = useAuthStore.getState?.().logout;
  if (typeof logout === "function") {
    logout(reason);
  }
};

// ===================================================
// API Públicas (usadas por tus módulos)
// ===================================================
export const onLogoutRequired = (callback) => {
  logoutCallbacks.push(callback);
  return () => {
    logoutCallbacks = logoutCallbacks.filter((cb) => cb !== callback);
  };
};

export const setAuthTokens = (accessToken, refreshToken) => {
  // Normaliza a la forma esperada por el store
  TokenAdapter.updateTokens({
    access_token: accessToken,
    ...(refreshToken && { refresh_token: refreshToken }),
  });
  if (shouldLog()) console.log("🔐 Auth tokens configured (store)");
};

export const clearAuthTokens = () => {
  TokenAdapter.clearAll("Manual clearAuthTokens");
  if (shouldLog()) console.log("🧹 Auth tokens cleared (store)");
};

export const hasAccessToken = () => !!TokenAdapter.access;
export const getAccessToken = () => TokenAdapter.access;
export const hasRefreshToken = () => !!TokenAdapter.refresh;

export const forceTokenRefresh = async () => {
  try {
    return await refreshAccessToken();
  } catch {
    throw new Error("Failed to refresh token");
  }
};

export const hasValidTokens = () => hasAccessToken() && hasRefreshToken();

export const checkLogStatus = () => {
  const logEnabled = shouldLog();
  console.log(`🔍 Logging Status: ${logEnabled ? "✅ ENABLED" : "❌ DISABLED"}`);
  console.log(`📋 Environment: ${process.env.NODE_ENV || "unknown"}`);
  console.log(`🌐 API URL: ${getApiUrl()}`);
  return logEnabled;
};

export const enableLogging = () => {
  if (process.env.NODE_ENV === "development") {
    window.__FORCE_LOGGING__ = true;
    console.log("✅ Logging enabled temporarily");
  } else {
    console.warn("⚠️ Logging can only be enabled in development mode");
  }
};

export const disableLogging = () => {
  window.__FORCE_LOGGING__ = false;
  console.log("❌ Logging disabled");
};

/**
 * Revalida en silencio:
 *  - Si no hay access o expira en <= minTTLSeconds, refresca.
 *  - Retorna el access token vigente.
 */
export const reconnectSessionSilent = async (minTTLSeconds = 120) => {
  const access = TokenAdapter.access;
  const refresh = TokenAdapter.refresh;
  if (!refresh) throw new Error("No refresh token available");

  if (!access || isAccessTokenExpiringSoon(access, minTTLSeconds)) {
    if (isRefreshing) {
      return new Promise((resolve, reject) =>
        failedQueue.push({ resolve, reject })
      );
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

/** Fuerza refresh independientemente del TTL. */
export const refreshNow = async () => {
  if (!TokenAdapter.refresh) throw new Error("No refresh token available");
  if (isRefreshing) {
    return new Promise((resolve, reject) =>
      failedQueue.push({ resolve, reject })
    );
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
};

export default axiosInstance;
