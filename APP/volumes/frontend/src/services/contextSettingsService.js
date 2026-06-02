import axiosInstance from "@/services/axiosInterceptor";
import { extractErrorMessage } from "@/utils/errors";

const BASE = "/v1/context/settings";
const REQUEST_TIMEOUT_MS = 30000;

const toContextSettingsError = (error, fallbackMessage) => {
  if (error?.response?.data) {
    return new Error(extractErrorMessage(error.response.data, fallbackMessage));
  }

  if (error?.code === "ERR_NETWORK" || !error?.response) {
    return new Error("No fue posible conectar con la configuración de Contexto IA.");
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
    throw toContextSettingsError(error, fallbackMessage);
  }
};

const unwrap = (res) => {
  const data = res?.data ?? {};
  return data?.result ?? data;
};

const contextSettingsService = {
  async getAvailability() {
    const res = await request(
      {
        method: "get",
        url: `${BASE}/availability`,
      },
      "No fue posible obtener la disponibilidad de la consulta contextual."
    );
    return unwrap(res);
  },

  async getConfig() {
    const res = await request(
      {
        method: "get",
        url: BASE,
      },
      "No fue posible obtener la configuración de Contexto IA."
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
      "No fue posible actualizar la configuración de Contexto IA."
    );
    return unwrap(res);
  },
};

export default contextSettingsService;
