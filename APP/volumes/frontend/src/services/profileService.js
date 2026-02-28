/**
 * services/profileService.js
 * API client para AI Profiles y AI Profile Categories
 *
 * Endpoints AI Profiles:
 *  GET    /v1/ai-profiles/{id}         → detalle
 *  POST   /v1/ai-profiles/list         → lista paginada
 *  POST   /v1/ai-profiles              → crear
 *  PUT    /v1/ai-profiles/{id}         → actualizar
 *  PATCH  /v1/ai-profiles/{id}/status  → cambiar is_active
 *  DELETE /v1/ai-profiles/{id}         → soft delete
 *
 * Endpoints AI Profile Categories:
 *  POST   /v1/ai-profile-categories/list → lista paginada
 *
 * Contrato backend: { success, status, result, error, meta }
 * AiProfileFilterRequest acepta: skip, limit, is_active, category_id, q
 */

import axiosInstance from "@/services/axiosInterceptor";

const BASE     = "/v1/ai-profiles";
const BASE_CAT = "/v1/ai-profile-categories";

// ─── Unwrap gateway wrapper ───────────────────────────────────────────────────

const unwrap = (res) => {
  const data = res?.data ?? {};
  return data?.result ?? data;
};

// ─── Normalizar resultado de /list ────────────────────────────────────────────

const normalizeListResult = (payload) => {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const total = Number.isFinite(payload?.total) ? payload.total : items.length;
  const skip  = Number.isFinite(payload?.skip)  ? payload.skip  : 0;
  const limit = Number.isFinite(payload?.limit) ? payload.limit : items.length;
  return { items, total, skip, limit };
};

// ─── Build payload para /list ─────────────────────────────────────────────────

const buildListPayload = ({ skip = 0, limit = 200, isActive = null, filters = {} } = {}) => {
  const payload = { skip, limit };

  if (isActive !== null) payload.is_active = isActive;

  if (filters?.search)     payload.q           = String(filters.search);
  if (filters?.categoryId) payload.category_id = Number(filters.categoryId);

  return payload;
};

// ─── AI Profile Service ───────────────────────────────────────────────────────

export const profileService = {

  /**
   * POST /v1/ai-profiles/list
   * @returns { items, total, skip, limit }
   */
  async list({ skip = 0, limit = 200, isActive = null, filters = {} } = {}) {
    const payload = buildListPayload({ skip, limit, isActive, filters });
    const res = await axiosInstance.post(`${BASE}/list`, payload);
    const result = unwrap(res);
    return normalizeListResult(result);
  },

  /**
   * GET /v1/ai-profiles/{id}
   */
  async getById(id) {
    if (!id) throw new Error("profileService.getById: id es requerido");
    const res = await axiosInstance.get(`${BASE}/${encodeURIComponent(id)}`);
    return unwrap(res);
  },

  /**
   * POST /v1/ai-profiles
   * Payload: { category_id, name, description?, prompt, is_active? }
   */
  async create(profileData) {
    if (!profileData || typeof profileData !== "object") {
      throw new Error("profileService.create: payload inválido");
    }
    const res = await axiosInstance.post(`${BASE}`, profileData);
    return unwrap(res);
  },

  /**
   * PUT /v1/ai-profiles/{id}
   * Payload: { category_id?, name?, description?, prompt?, is_active? }
   */
  async update(id, profileData) {
    if (!id) throw new Error("profileService.update: id es requerido");
    const res = await axiosInstance.put(`${BASE}/${encodeURIComponent(id)}`, profileData);
    return unwrap(res);
  },

  /**
   * PATCH /v1/ai-profiles/{id}/status
   * Payload: { is_active: boolean }
   */
  async changeStatus(id, isActive) {
    if (!id) throw new Error("profileService.changeStatus: id es requerido");
    const res = await axiosInstance.patch(`${BASE}/${encodeURIComponent(id)}/status`, {
      is_active: Boolean(isActive),
    });
    return unwrap(res);
  },

  /**
   * DELETE /v1/ai-profiles/{id}  — soft delete
   */
  async softDelete(id) {
    if (!id) throw new Error("profileService.softDelete: id es requerido");
    await axiosInstance.delete(`${BASE}/${encodeURIComponent(id)}`);
    return true;
  },
};

// ─── AI Profile Category Service ─────────────────────────────────────────────

export const profileCategoryService = {

  /**
   * POST /v1/ai-profile-categories/list
   * @returns { items, total, skip, limit }
   */
  async list({ skip = 0, limit = 200, isActive = true } = {}) {
    const payload = { skip, limit };
    if (isActive !== null) payload.is_active = isActive;
    const res = await axiosInstance.post(`${BASE_CAT}/list`, payload);
    const result = unwrap(res);
    return normalizeListResult(result);
  },
};

export default profileService;