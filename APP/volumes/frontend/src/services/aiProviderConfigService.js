import axiosInstance from "@/services/axiosInterceptor";

const BASE = "/v1/ai-provider-configs";
const RESILIENT_READ_CONFIG = { timeout: 8000, _transientRetry: true };

const unwrap = (res) => {
  const data = res?.data ?? {};
  return data?.result ?? data;
};

const normalizeListResult = (payload) => {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const total = Number.isFinite(payload?.total) ? payload.total : items.length;
  const skip = Number.isFinite(payload?.skip) ? payload.skip : 0;
  const limit = Number.isFinite(payload?.limit) ? payload.limit : items.length;
  return { items, total, skip, limit };
};

const aiProviderConfigService = {
  async list(
    { skip = 0, limit = 100, isActive = null, providerType = null, search = "" } = {},
    requestConfig = {}
  ) {
    const payload = { skip, limit };
    if (isActive !== null) payload.is_active = isActive;
    if (providerType) payload.provider_type = providerType;
    if (String(search || "").trim()) payload.search = String(search).trim();
    const res = await axiosInstance.post(`${BASE}/list`, payload, { ...RESILIENT_READ_CONFIG, ...requestConfig });
    return normalizeListResult(unwrap(res));
  },

  async getById(id) {
    const res = await axiosInstance.get(`${BASE}/${encodeURIComponent(id)}`);
    return unwrap(res);
  },

  async getCatalog(requestConfig = {}) {
    const res = await axiosInstance.get(`${BASE}/catalog`, { ...RESILIENT_READ_CONFIG, ...requestConfig });
    return Array.isArray(res?.data?.result) ? res.data.result : Array.isArray(res?.data) ? res.data : [];
  },

  async create(payload) {
    const res = await axiosInstance.post(`${BASE}`, payload);
    return unwrap(res);
  },

  async update(id, payload) {
    const res = await axiosInstance.put(`${BASE}/${encodeURIComponent(id)}`, payload);
    return unwrap(res);
  },

  async activate(id) {
    const res = await axiosInstance.patch(`${BASE}/${encodeURIComponent(id)}/activate`, {
      is_active: true,
    });
    return unwrap(res);
  },

  async deactivate(id) {
    const res = await axiosInstance.patch(`${BASE}/${encodeURIComponent(id)}/deactivate`);
    return unwrap(res);
  },

  async validate(payload) {
    const res = await axiosInstance.post(`${BASE}/validate`, payload);
    return unwrap(res);
  },

  async discoverModels(payload) {
    const res = await axiosInstance.post(`${BASE}/discover-models`, payload);
    return unwrap(res);
  },

  async remove(id) {
    const res = await axiosInstance.delete(`${BASE}/${encodeURIComponent(id)}`);
    return unwrap(res);
  },
};

export default aiProviderConfigService;
