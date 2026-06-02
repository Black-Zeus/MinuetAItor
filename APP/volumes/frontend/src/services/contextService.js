import axiosInstance from "@/services/axiosInterceptor";
import { extractErrorMessage } from "@/utils/errors";

const BASE = "/v1/context";
const REQUEST_TIMEOUT_MS = 120000;

const unwrap = (res) => {
  const data = res?.data ?? {};
  return data?.result ?? data;
};

const toContextError = (error, fallbackMessage) => {
  if (error?.response?.data) {
    return new Error(extractErrorMessage(error.response.data, fallbackMessage));
  }
  if (error?.code === "ERR_NETWORK" || !error?.response) {
    return new Error("No fue posible conectar con la consulta contextual.");
  }
  return new Error(fallbackMessage);
};

const request = async (config, fallbackMessage) => {
  try {
    const res = await axiosInstance({
      timeout: REQUEST_TIMEOUT_MS,
      ...config,
    });
    return unwrap(res);
  } catch (error) {
    throw toContextError(error, fallbackMessage);
  }
};

const contextService = {
  async query(payload) {
    return request(
      {
        method: "post",
        url: `${BASE}/query`,
        data: payload,
      },
      "No fue posible consultar el contexto."
    );
  },

  async getQuery(queryId) {
    return request(
      {
        method: "get",
        url: `${BASE}/query/${encodeURIComponent(queryId)}`,
      },
      "No fue posible obtener la consulta."
    );
  },

  async getSyncStatus() {
    return request(
      {
        method: "get",
        url: `${BASE}/sync/status`,
      },
      "No fue posible obtener el estado de sincronización."
    );
  },

  async getQdrantHealth() {
    return request(
      {
        method: "get",
        url: `${BASE}/sync/qdrant-health`,
      },
      "No fue posible verificar Qdrant."
    );
  },

  async listSyncMinutes(params = {}) {
    return request(
      {
        method: "get",
        url: `${BASE}/sync/minutes`,
        params,
      },
      "No fue posible listar las minutas sincronizadas."
    );
  },

  async retryFailedSync() {
    return request(
      {
        method: "post",
        url: `${BASE}/sync/retry-failed`,
      },
      "No fue posible reintentar los errores de sincronización."
    );
  },

  async reindexMinute(recordId) {
    return request(
      {
        method: "post",
        url: `${BASE}/sync/reindex-minute/${encodeURIComponent(recordId)}`,
      },
      "No fue posible reindexar la minuta."
    );
  },

  async cleanupMinute(recordId) {
    return request(
      {
        method: "post",
        url: `${BASE}/sync/cleanup-minute/${encodeURIComponent(recordId)}`,
      },
      "No fue posible limpiar la minuta del índice."
    );
  },

  async reindexProject(projectId) {
    return request(
      {
        method: "post",
        url: `${BASE}/sync/reindex-project/${encodeURIComponent(projectId)}`,
      },
      "No fue posible reindexar el proyecto."
    );
  },

  async reindexClient(clientId) {
    return request(
      {
        method: "post",
        url: `${BASE}/sync/reindex-client/${encodeURIComponent(clientId)}`,
      },
      "No fue posible reindexar el cliente."
    );
  },

  async reindexAll() {
    return request(
      {
        method: "post",
        url: `${BASE}/sync/reindex-all`,
      },
      "No fue posible reindexar todo el contexto."
    );
  },

  async rebuildCollection() {
    return request(
      {
        method: "post",
        url: `${BASE}/sync/rebuild-collection`,
      },
      "No fue posible regenerar la colección vectorial."
    );
  },

  async reconcileStatus() {
    return request(
      {
        method: "post",
        url: `${BASE}/sync/reconcile-status`,
      },
      "No fue posible reconciliar los estados de sincronización."
    );
  },
};

export default contextService;
