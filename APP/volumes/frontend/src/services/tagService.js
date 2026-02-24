/**
 * services/tagService.js
 * API client para Tags
 *
 * Endpoints:
 *  GET    /v1/tags/{id}           → detalle
 *  POST   /v1/tags/list           → lista paginada
 *  POST   /v1/tags                → crear
 *  PUT    /v1/tags/{id}           → actualizar
 *  PATCH  /v1/tags/{id}/status    → cambiar is_active
 *  DELETE /v1/tags/{id}           → soft delete
 *
 * Contrato backend: { success, status, result, error, meta }
 * TagFilterRequest acepta: skip, limit, is_active, category_id, source, status, name
 *
 * También expone tagCategoryService para cargar el catálogo de categorías.
 */

import axiosInstance from "@/services/axiosInterceptor";

const BASE      = "/v1/tags";
const BASE_CAT  = "/v1/tag-categories";

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

const buildListPayload = ({ skip = 0, limit = 100, isActive = null, filters = {} } = {}) => {
  const payload = { skip, limit };

  if (isActive !== null) payload.is_active = isActive;

  if (filters?.search)     payload.name        = String(filters.search);
  if (filters?.status)     payload.status      = String(filters.status);
  if (filters?.categoryId) payload.category_id = Number(filters.categoryId);
  if (filters?.source)     payload.source      = String(filters.source);

  return payload;
};

// ─── Tag Service ──────────────────────────────────────────────────────────────

export const tagService = {

  /**
   * POST /v1/tags/list
   * @returns { items, total, skip, limit }
   */
  async list({ skip = 0, limit = 100, isActive = null, filters = {} } = {}) {
    const payload = buildListPayload({ skip, limit, isActive, filters });
    const res = await axiosInstance.post(`${BASE}/list`, payload);
    const result = unwrap(res);
    return normalizeListResult(result);
  },

  /**
   * GET /v1/tags/{id}
   */
  async getById(id) {
    if (!id) throw new Error("tagService.getById: id es requerido");
    const res = await axiosInstance.get(`${BASE}/${encodeURIComponent(id)}`);
    return unwrap(res);
  },

  /**
   * POST /v1/tags
   * Payload esperado:
   *   { category_id, name, description?, source?, status?, is_active? }
   * El backend genera: id, created_at, updated_at, etc.
   */
  async create(tagData) {
    if (!tagData || typeof tagData !== "object") {
      throw new Error("tagService.create: payload inválido");
    }
    const res = await axiosInstance.post(`${BASE}`, tagData);
    return unwrap(res);
  },

  /**
   * PUT /v1/tags/{id}
   * Payload esperado:
   *   { category_id?, name?, description?, source?, status?, is_active? }
   */
  async update(id, tagData) {
    if (!id) throw new Error("tagService.update: id es requerido");
    const res = await axiosInstance.put(`${BASE}/${encodeURIComponent(id)}`, tagData);
    return unwrap(res);
  },

  /**
   * PATCH /v1/tags/{id}/status
   * Payload: { is_active: boolean }
   */
  async changeStatus(id, isActive) {
    if (!id) throw new Error("tagService.changeStatus: id es requerido");
    const res = await axiosInstance.patch(`${BASE}/${encodeURIComponent(id)}/status`, {
      is_active: Boolean(isActive),
    });
    return unwrap(res);
  },

  /**
   * DELETE /v1/tags/{id}  — soft delete
   */
  async softDelete(id) {
    if (!id) throw new Error("tagService.softDelete: id es requerido");
    await axiosInstance.delete(`${BASE}/${encodeURIComponent(id)}`);
    return true;
  },
};

// ─── Tag Category Service ─────────────────────────────────────────────────────

export const tagCategoryService = {

  /**
   * POST /v1/tag-categories/list
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

export default tagService;