/**
 * services/clientService.js
 * API client para Clients
 *
 * Endpoints:
 *  POST   /v1/clients/list       → lista paginada
 *  GET    /v1/clients/{id}       → detalle
 *  POST   /v1/clients            → crear
 *  PUT    /v1/clients/{id}       → actualizar
 *  DELETE /v1/clients/{id}       → soft delete
 *
 * Contrato backend: { success, status, result, error, meta }
 */

import axiosInstance from "@/services/axiosInterceptor";

const BASE = "/v1/clients";

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
  const skip = Number.isFinite(payload?.skip) ? payload.skip : 0;
  const limit = Number.isFinite(payload?.limit) ? payload.limit : items.length;
  return { items, total, skip, limit };
};

// ─── Build payload para /list ─────────────────────────────────────────────────

const buildListPayload = ({ skip = 0, limit = 50, isActive = null, filters = {} } = {}) => {
  const payload = { skip, limit };

  // Filtro de activos — null = sin filtro (trae todos)
  if (isActive !== null) payload.is_active = isActive;

  // Filtros opcionales (cuando tu backend los soporte)
  if (filters?.search) payload.search = String(filters.search);
  if (filters?.industry) payload.industry = String(filters.industry);

  return payload;
};

// ─── Client Service ───────────────────────────────────────────────────────────

export const clientService = {

  /**
   * 
   * GET /v1/clients/industries
   */
  async getIndustries() {
    const res = await axiosInstance.get(`${BASE}/industries`);
    return unwrap(res) ?? [];
  },

  /**
   * POST /v1/clients/list
   * @returns { items, total, skip, limit }
   */
  async list({ skip = 0, limit = 50, isActive = true, filters = {} } = {}) {
    const payload = buildListPayload({ skip, limit, isActive, filters });
    const res = await axiosInstance.post(`${BASE}/list`, payload);
    const result = unwrap(res);
    return normalizeListResult(result);
  },

  /**
   * GET /v1/clients/{id}
   */
  async getById(id) {
    if (!id) throw new Error("clientService.getById: id es requerido");
    const res = await axiosInstance.get(`${BASE}/${encodeURIComponent(id)}`);
    return unwrap(res);
  },

  /**
   * POST /v1/clients
   */
  async create(clientData) {
    if (!clientData || typeof clientData !== "object") {
      throw new Error("clientService.create: payload inválido");
    }
    const res = await axiosInstance.post(`${BASE}`, clientData);
    return unwrap(res);
  },

  /**
   * PUT /v1/clients/{id}
   */
  async update(id, clientData) {
    if (!id) throw new Error("clientService.update: id es requerido");
    const res = await axiosInstance.put(`${BASE}/${encodeURIComponent(id)}`, clientData);
    return unwrap(res);
  },

  /**
   * DELETE /v1/clients/{id}  — soft delete
   */
  async softDelete(id) {
    if (!id) throw new Error("clientService.softDelete: id es requerido");
    const res = await axiosInstance.delete(`${BASE}/${encodeURIComponent(id)}`);
    return unwrap(res);
  },
};

export default clientService;