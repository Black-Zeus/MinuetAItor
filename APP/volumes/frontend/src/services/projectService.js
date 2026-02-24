/**
 * services/projectService.js
 * API client para Projects
 *
 * Endpoints:
 *  POST   /v1/projects/list     → lista paginada
 *  GET    /v1/projects/{id}     → detalle
 *  POST   /v1/projects          → crear
 *  PUT    /v1/projects/{id}     → actualizar
 *  DELETE /v1/projects/{id}     → soft delete
 *
 * Contrato backend: { success, status, result, error, meta }
 * ProjectFilterRequest acepta: client_id, q, status, is_confidential, is_active
 */

import axiosInstance from "@/services/axiosInterceptor";

const BASE = "/v1/projects";

// ─── Unwrap gateway wrapper ───────────────────────────────────────────────────

const unwrap = (res) => {
  const data = res?.data ?? {};
  return data?.result ?? data;
};

// ─── Normalizar resultado de /list ────────────────────────────────────────────
// La API devuelve: { items, total, skip, limit }

const normalizeListResult = (payload) => {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const total = Number.isFinite(payload?.total) ? payload.total : items.length;
  const skip  = Number.isFinite(payload?.skip)  ? payload.skip  : 0;
  const limit = Number.isFinite(payload?.limit) ? payload.limit : items.length;
  return { items, total, skip, limit };
};

// ─── Build payload para /list ─────────────────────────────────────────────────

const buildListPayload = ({ skip = 0, limit = 50, isActive = null, filters = {} } = {}) => {
  const payload = { skip, limit };

  if (isActive !== null) payload.is_active = isActive;

  // Filtros que acepta ProjectFilterRequest
  if (filters?.search)         payload.q              = String(filters.search);
  if (filters?.status)         payload.status         = String(filters.status);
  if (filters?.clientId)       payload.client_id      = String(filters.clientId);
  if (filters?.isConfidential != null) payload.is_confidential = Boolean(filters.isConfidential);

  return payload;
};

// ─── Project Service ──────────────────────────────────────────────────────────

export const projectService = {

  /**
   * POST /v1/projects/list
   * @returns { items, total, skip, limit }
   */
  async list({ skip = 0, limit = 50, isActive = null, filters = {} } = {}) {
    const payload = buildListPayload({ skip, limit, isActive, filters });
    const res = await axiosInstance.post(`${BASE}/list`, payload);
    const result = unwrap(res);
    return normalizeListResult(result);
  },

  /**
   * GET /v1/projects/{id}
   */
  async getById(id) {
    if (!id) throw new Error("projectService.getById: id es requerido");
    const res = await axiosInstance.get(`${BASE}/${encodeURIComponent(id)}`);
    return unwrap(res);
  },

  /**
   * POST /v1/projects
   */
  async create(projectData) {
    if (!projectData || typeof projectData !== "object") {
      throw new Error("projectService.create: payload inválido");
    }
    const res = await axiosInstance.post(`${BASE}`, projectData);
    return unwrap(res);
  },

  /**
   * PUT /v1/projects/{id}
   */
  async update(id, projectData) {
    if (!id) throw new Error("projectService.update: id es requerido");
    const res = await axiosInstance.put(`${BASE}/${encodeURIComponent(id)}`, projectData);
    return unwrap(res);
  },

  /**
   * DELETE /v1/projects/{id}  — soft delete
   */
  async softDelete(id) {
    if (!id) throw new Error("projectService.softDelete: id es requerido");
    const res = await axiosInstance.delete(`${BASE}/${encodeURIComponent(id)}`);
    return unwrap(res);
  },
};

export default projectService;