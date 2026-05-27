import axiosInstance from "@/services/axiosInterceptor";
import { extractErrorMessage } from "@/utils/errors";

const BASE = "/v1/system/maintenance";
const REQUEST_TIMEOUT_MS = 45000;
const PUBLIC_STATE_TIMEOUT_MS = 10000;
const PUBLIC_STATE_CACHE_MS = 1200;

let publicStateInFlight = null;
let publicStateCache = {
  expiresAt: 0,
  value: null,
};

const isTimeoutError = (error) =>
  error?.code === "ECONNABORTED" ||
  String(error?.message || "").toLowerCase().includes("timeout");

const toSystemMaintenanceError = (error, fallbackMessage) => {
  if (error?.response?.data) {
    return new Error(extractErrorMessage(error.response.data, fallbackMessage));
  }

  if (isTimeoutError(error)) {
    return new Error("El módulo de mantenimiento tardó demasiado en responder. Intenta nuevamente.");
  }

  if (error?.code === "ERR_NETWORK" || !error?.response) {
    return new Error("No fue posible conectar con el módulo de mantenimiento.");
  }

  return new Error(fallbackMessage);
};

const request = async (config, fallbackMessage) => {
  try {
    return await axiosInstance({
      timeout: REQUEST_TIMEOUT_MS,
      ...config,
    });
  } catch (error) {
    throw toSystemMaintenanceError(error, fallbackMessage);
  }
};

const unwrap = (res) => {
  const data = res?.data ?? {};
  return data?.result ?? data;
};

const getCachedPublicState = () => {
  const now = Date.now();
  if (publicStateCache.value && publicStateCache.expiresAt > now) {
    return publicStateCache.value;
  }
  return null;
};

const setCachedPublicState = (value) => {
  publicStateCache = {
    value,
    expiresAt: Date.now() + PUBLIC_STATE_CACHE_MS,
  };
};

const systemMaintenanceService = {
  async getConfig() {
    const res = await request(
      {
        method: "get",
        url: BASE,
      },
      "No fue posible obtener la configuración actual de mantenimiento."
    );
    return unwrap(res);
  },

  async update(payload) {
    const res = await request(
      {
        method: "put",
        url: BASE,
        data: payload,
      },
      "No fue posible actualizar la configuración de mantenimiento."
    );
    return unwrap(res);
  },

  async getStatus() {
    const res = await request(
      {
        method: "get",
        url: `${BASE}/status`,
      },
      "No fue posible obtener el estado actual de mantenimiento."
    );
    return unwrap(res);
  },

  async getPublicOperationState() {
    const cached = getCachedPublicState();
    if (cached) return cached;

    if (publicStateInFlight) return publicStateInFlight;

    publicStateInFlight = request(
      {
        method: "get",
        url: `${BASE}/operation-state/public`,
        timeout: PUBLIC_STATE_TIMEOUT_MS,
      },
      "No fue posible obtener el modo operativo del sistema."
    )
      .then((res) => {
        const state = unwrap(res);
        setCachedPublicState(state);
        return state;
      })
      .finally(() => {
        publicStateInFlight = null;
      });

    return publicStateInFlight;
  },

  async setOperationMode(mode, reason = "") {
    const res = await request(
      {
        method: "post",
        url: `${BASE}/operation-state`,
        data: { mode, reason },
      },
      "No fue posible cambiar el modo operativo del sistema."
    );
    const state = unwrap(res);
    setCachedPublicState(state);
    return state;
  },

  async getReadiness() {
    const res = await request(
      {
        method: "get",
        url: `${BASE}/readiness`,
      },
      "No fue posible obtener la validación de puesta en marcha."
    );
    return unwrap(res);
  },

  async runReadiness() {
    const res = await request(
      {
        method: "get",
        url: `${BASE}/readiness`,
      },
      "No fue posible ejecutar la validación de puesta en marcha."
    );
    return unwrap(res);
  },

  async runSessionCleanupNow() {
    const res = await request(
      {
        method: "post",
        url: `${BASE}/run/session-cleanup`,
      },
      "No fue posible encolar la limpieza de sesiones."
    );
    return unwrap(res);
  },

  async runTempCleanupNow() {
    const res = await request(
      {
        method: "post",
        url: `${BASE}/run/temp-cleanup`,
      },
      "No fue posible encolar la limpieza de temporales."
    );
    return unwrap(res);
  },
};

export default systemMaintenanceService;
