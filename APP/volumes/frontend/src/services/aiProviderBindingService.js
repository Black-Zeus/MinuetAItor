import axiosInstance from "@/services/axiosInterceptor";
import { extractErrorMessage } from "@/utils/errors";

const BASE = "/v1/ai-provider-bindings";
const REQUEST_TIMEOUT_MS = 30000;

const unwrap = (res) => {
  const data = res?.data ?? {};
  return data?.result ?? data;
};

const toBindingError = (error, fallbackMessage) => {
  if (error?.response?.data) {
    return new Error(extractErrorMessage(error.response.data, fallbackMessage));
  }
  if (error?.code === "ERR_NETWORK" || !error?.response) {
    return new Error("No fue posible conectar con la asignación de modelos IA.");
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
    throw toBindingError(error, fallbackMessage);
  }
};

const aiProviderBindingService = {
  async list(requestConfig = {}) {
    const res = await request(
      {
        method: "get",
        url: BASE,
        ...requestConfig,
      },
      "No fue posible obtener la asignación de modelos IA."
    );
    const payload = unwrap(res);
    return Array.isArray(payload?.items) ? payload.items : [];
  },

  async upsert(payload) {
    const res = await request(
      {
        method: "put",
        url: BASE,
        data: payload,
      },
      "No fue posible guardar la asignación de modelo IA."
    );
    return unwrap(res);
  },
};

export default aiProviderBindingService;
