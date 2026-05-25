import axiosInstance from "@/services/axiosInterceptor";
import { extractErrorMessage } from "@/utils/errors";

const BASE = "/v1/system/maintenance";
const REQUEST_TIMEOUT_MS = 45000;
const PUBLIC_STATE_TIMEOUT_MS = 5000;

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
    const res = await request(
      {
        method: "get",
        url: `${BASE}/operation-state/public`,
        timeout: PUBLIC_STATE_TIMEOUT_MS,
      },
      "No fue posible obtener el modo operativo del sistema."
    );
    return unwrap(res);
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
