import axiosInstance from "@/services/axiosInterceptor";

const BASE = "/v1/smtp-configs";
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

const smtpConfigService = {
  async list({ skip = 0, limit = 100, isActive = null, search = "" } = {}, requestConfig = {}) {
    const payload = { skip, limit };
    if (isActive !== null) payload.is_active = isActive;
    if (String(search || "").trim()) payload.search = String(search).trim();
    const res = await axiosInstance.post(`${BASE}/list`, payload, { ...RESILIENT_READ_CONFIG, ...requestConfig });
    return normalizeListResult(unwrap(res));
  },

  async getById(id) {
    const res = await axiosInstance.get(`${BASE}/${encodeURIComponent(id)}`);
    return unwrap(res);
  },

  async test(payload) {
    const res = await axiosInstance.post(`${BASE}/test`, payload);
    return unwrap(res);
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

  async remove(id) {
    const res = await axiosInstance.delete(`${BASE}/${encodeURIComponent(id)}`);
    return unwrap(res);
  },
};

export default smtpConfigService;
