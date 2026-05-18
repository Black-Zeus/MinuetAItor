import axiosInstance from "@/services/axiosInterceptor";
import { extractErrorMessage } from "@/utils/errors";

const BASE = "/v1/system/queues";
const REQUEST_TIMEOUT_MS = 45000;

const isTimeoutError = (error) =>
  error?.code === "ECONNABORTED" ||
  String(error?.message || "").toLowerCase().includes("timeout");

const toSystemQueueError = (error, fallbackMessage) => {
  if (error?.response?.data) {
    return new Error(extractErrorMessage(error.response.data, fallbackMessage));
  }

  if (isTimeoutError(error)) {
    return new Error("El módulo de colas tardó demasiado en responder. Intenta nuevamente.");
  }

  if (error?.code === "ERR_NETWORK" || !error?.response) {
    return new Error("No fue posible conectar con el módulo de colas.");
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
    throw toSystemQueueError(error, fallbackMessage);
  }
};

const unwrap = (res) => {
  const data = res?.data ?? {};
  return data?.result ?? data;
};

const systemQueueService = {
  async getStatus() {
    const res = await request(
      {
        method: "get",
        url: `${BASE}/status`,
      },
      "No fue posible obtener el estado actual de las colas del sistema."
    );
    return unwrap(res);
  },
};

export default systemQueueService;
