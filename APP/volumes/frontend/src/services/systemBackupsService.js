import axiosInstance from "@/services/axiosInterceptor";
import { extractErrorMessage } from "@/utils/errors";

const BASE = "/v1/system/backups";
const REQUEST_TIMEOUT_MS = 45000;

const isTimeoutError = (error) =>
  error?.code === "ECONNABORTED" ||
  String(error?.message || "").toLowerCase().includes("timeout");

const extractValidationDetails = (data) => {
  const details = data?.error?.details;
  if (!Array.isArray(details) || !details.length) return "";

  return details
    .map((detail) => {
      const field = String(detail?.field || "").trim();
      const issue = String(detail?.issue || "").trim();
      if (field && issue) return `${field}: ${issue}`;
      return issue || field;
    })
    .filter(Boolean)
    .join(" | ");
};

const toSystemBackupsError = (error, fallbackMessage) => {
  if (error?.response?.data) {
    const data = error.response.data;
    const validationDetails = extractValidationDetails(data);
    return new Error(validationDetails || data?.error?.message || extractErrorMessage(data, fallbackMessage));
  }

  if (isTimeoutError(error)) {
    return new Error("El módulo de respaldos tardó demasiado en responder. Intenta nuevamente.");
  }

  if (error?.code === "ERR_NETWORK" || !error?.response) {
    return new Error("No fue posible conectar con el módulo de respaldos.");
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
    throw toSystemBackupsError(error, fallbackMessage);
  }
};

const unwrap = (res) => {
  const data = res?.data ?? {};
  return data?.result ?? data;
};

const systemBackupsService = {
  async getConfig() {
    const res = await request(
      {
        method: "get",
        url: `${BASE}/config`,
      },
      "No fue posible obtener la configuración actual de respaldos."
    );
    return unwrap(res);
  },

  async updateConfig(payload) {
    const res = await request(
      {
        method: "put",
        url: `${BASE}/config`,
        data: payload,
      },
      "No fue posible actualizar la configuración de respaldos."
    );
    return unwrap(res);
  },

  async getStatus() {
    const res = await request(
      {
        method: "get",
        url: `${BASE}/status`,
      },
      "No fue posible obtener el estado actual de respaldos."
    );
    return unwrap(res);
  },

  async getHistory(limit = 50) {
    const res = await request(
      {
        method: "get",
        url: `${BASE}/history`,
        params: { limit },
      },
      "No fue posible obtener el historial de respaldos."
    );
    return unwrap(res);
  },

  async syncCatalog() {
    const res = await request(
      {
        method: "post",
        url: `${BASE}/sync`,
      },
      "No fue posible sincronizar el catálogo de respaldos."
    );
    return unwrap(res);
  },

  async importPackage(file) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await request(
      {
        method: "post",
        url: `${BASE}/import`,
        data: formData,
        timeout: 120000,
      },
      "No fue posible importar el paquete de respaldo."
    );
    return unwrap(res);
  },

  async inspectArtifact(artifactId) {
    const res = await request(
      {
        method: "get",
        url: `${BASE}/${encodeURIComponent(artifactId)}/inspect`,
      },
      "No fue posible inspeccionar el paquete de respaldo."
    );
    return unwrap(res);
  },

  async downloadArtifact(artifactId) {
    try {
      const res = await axiosInstance({
        method: "get",
        url: `${BASE}/${encodeURIComponent(artifactId)}/download`,
        responseType: "blob",
        timeout: 120000,
      });
      const disposition = res?.headers?.["content-disposition"] || "";
      const filenameMatch = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
      const filename = filenameMatch
        ? decodeURIComponent(filenameMatch[1] || filenameMatch[2] || "")
        : null;
      return { blob: res.data, filename };
    } catch (error) {
      throw toSystemBackupsError(error, "No fue posible descargar el paquete de respaldo.");
    }
  },

  async restoreArtifact(artifactId) {
    const res = await request(
      {
        method: "post",
        url: `${BASE}/${encodeURIComponent(artifactId)}/restore`,
      },
      "No fue posible solicitar la restauración del respaldo."
    );
    return unwrap(res);
  },

  async runBackup(scope) {
    const normalizedScope = String(scope || "").trim();
    const res = await request(
      {
        method: "post",
        url: `${BASE}/run/${encodeURIComponent(normalizedScope)}`,
      },
      "No fue posible solicitar el respaldo manual."
    );
    return unwrap(res);
  },

  async cancelOperation(operationId) {
    const res = await request(
      {
        method: "post",
        url: `${BASE}/operations/${encodeURIComponent(operationId)}/cancel`,
      },
      "No fue posible cancelar la operación de respaldo."
    );
    return unwrap(res);
  },

  async previewPurge() {
    const res = await request(
      {
        method: "post",
        url: `${BASE}/purge/preview`,
      },
      "No fue posible calcular la limpieza de respaldos."
    );
    return unwrap(res);
  },

  async runPurge() {
    const res = await request(
      {
        method: "post",
        url: `${BASE}/purge`,
      },
      "No fue posible solicitar la limpieza de respaldos."
    );
    return unwrap(res);
  },

  async purgeArtifact(artifactId) {
    const res = await request(
      {
        method: "post",
        url: `${BASE}/${encodeURIComponent(artifactId)}/purge`,
      },
      "No fue posible solicitar la eliminación manual del respaldo."
    );
    return unwrap(res);
  },
};

export default systemBackupsService;
