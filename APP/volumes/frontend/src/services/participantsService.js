import axiosInstance from "@/services/axiosInterceptor";

const BASE = "/v1/participants";

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

export const participantsService = {
  async list({ skip = 0, limit = 20, filters = {} } = {}) {
    const payload = { skip, limit };
    if (filters?.search) payload.search = String(filters.search);
    if (filters?.isActive !== undefined && filters?.isActive !== null) payload.isActive = Boolean(filters.isActive);

    const res = await axiosInstance.post(`${BASE}/list`, payload);
    return normalizeListResult(unwrap(res));
  },

  async getById(id) {
    if (!id) throw new Error("participantsService.getById: id es requerido");
    const res = await axiosInstance.get(`${BASE}/${encodeURIComponent(id)}`);
    return unwrap(res);
  },

  async lookupEmails(names = []) {
    const cleanedNames = Array.isArray(names)
      ? names.map((name) => String(name ?? "").trim()).filter(Boolean)
      : [];

    if (cleanedNames.length === 0) return { items: [] };

    const res = await axiosInstance.post(`${BASE}/emails/lookup`, { names: cleanedNames });
    const payload = unwrap(res);
    return {
      items: Array.isArray(payload?.items) ? payload.items : [],
    };
  },

  async create(payload) {
    if (!payload || typeof payload !== "object") {
      throw new Error("participantsService.create: payload inválido");
    }
    const res = await axiosInstance.post(`${BASE}`, payload);
    return unwrap(res);
  },

  async update(id, payload) {
    if (!id) throw new Error("participantsService.update: id es requerido");
    if (!payload || typeof payload !== "object") {
      throw new Error("participantsService.update: payload inválido");
    }
    const res = await axiosInstance.put(`${BASE}/${encodeURIComponent(id)}`, payload);
    return unwrap(res);
  },

  async updateStatus(id, isActive) {
    if (!id) throw new Error("participantsService.updateStatus: id es requerido");
    const res = await axiosInstance.patch(
      `${BASE}/${encodeURIComponent(id)}/status`,
      { isActive: Boolean(isActive) }
    );
    return unwrap(res);
  },

  async softDelete(id) {
    if (!id) throw new Error("participantsService.softDelete: id es requerido");
    const res = await axiosInstance.delete(`${BASE}/${encodeURIComponent(id)}`);
    return unwrap(res);
  },

  async resolve(payload) {
    if (!payload?.displayName) {
      throw new Error("participantsService.resolve: displayName es requerido");
    }
    const res = await axiosInstance.post(`${BASE}/resolve`, payload);
    return unwrap(res);
  },
};

export default participantsService;
