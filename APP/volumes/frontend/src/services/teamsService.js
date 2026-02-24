/**
 * services/teamsService.js
 * API client para Teams (Team Members)
 *
 * Endpoints:
 *  POST   /v1/teams/list         → lista paginada
 *  GET    /v1/teams/{id}         → detalle
 *  POST   /v1/teams              → crear
 *  PUT    /v1/teams/{id}         → actualizar
 *  PATCH  /v1/teams/{id}/status  → cambiar estado
 *  DELETE /v1/teams/{id}         → soft delete
 *
 * Contrato backend: { success, status, result, error, meta }
 * TeamListResponse devuelve: { teams, total, skip, limit }
 */

import axiosInstance from "@/services/axiosInterceptor";

const BASE = "/v1/teams";

// ─── Unwrap gateway wrapper ───────────────────────────────────────────────────

const unwrap = (res) => {
  const data = res?.data ?? {};
  return data?.result ?? data;
};

// ─── Normalizar resultado de /list ────────────────────────────────────────────
// El backend devuelve: { teams: [...], total, skip, limit }

const normalizeListResult = (payload) => {
  const teams = Array.isArray(payload?.teams) ? payload.teams : [];
  const total = Number.isFinite(payload?.total) ? payload.total : teams.length;
  const skip  = Number.isFinite(payload?.skip)  ? payload.skip  : 0;
  const limit = Number.isFinite(payload?.limit) ? payload.limit : teams.length;
  return { teams, total, skip, limit };
};

// ─── Build payload para /list ─────────────────────────────────────────────────
// TeamFilterRequest acepta: search, department, systemRole, status, skip, limit

const buildListPayload = ({ skip = 0, limit = 50, filters = {} } = {}) => {
  const payload = { skip, limit };

  if (filters?.search)     payload.search     = String(filters.search);
  if (filters?.status)     payload.status     = String(filters.status);
  if (filters?.systemRole) payload.systemRole = String(filters.systemRole);
  if (filters?.department) payload.department = String(filters.department);

  return payload;
};

// ─── Teams Service ────────────────────────────────────────────────────────────

export const teamsService = {
  /**
   * POST /v1/teams/list
   * @returns { teams, total, skip, limit }
   */
  async list({ skip = 0, limit = 50, filters = {} } = {}) {
    const payload = buildListPayload({ skip, limit, filters });
    const res = await axiosInstance.post(`${BASE}/list`, payload);
    const result = unwrap(res);
    return normalizeListResult(result);
  },

  /**
   * GET /v1/teams/{id}
   */
  async getById(id) {
    if (!id) throw new Error("teamsService.getById: id es requerido");
    const res = await axiosInstance.get(`${BASE}/${encodeURIComponent(id)}`);
    return unwrap(res);
  },

  /**
   * POST /v1/teams
   */
  async create(teamMember) {
    if (!teamMember || typeof teamMember !== "object") {
      throw new Error("teamsService.create: payload inválido");
    }
    const res = await axiosInstance.post(`${BASE}`, teamMember);
    return unwrap(res);
  },

  /**
   * PUT /v1/teams/{id}
   */
  async update(id, teamMember) {
    if (!id) throw new Error("teamsService.update: id es requerido");
    if (!teamMember || typeof teamMember !== "object") {
      throw new Error("teamsService.update: payload inválido");
    }
    const res = await axiosInstance.put(`${BASE}/${encodeURIComponent(id)}`, teamMember);
    return unwrap(res);
  },

  /**
   * PATCH /v1/teams/{id}/status
   */
  async updateStatus(id, status) {
    if (!id)     throw new Error("teamsService.updateStatus: id es requerido");
    if (!status) throw new Error("teamsService.updateStatus: status es requerido");
    const res = await axiosInstance.patch(
      `${BASE}/${encodeURIComponent(id)}/status`,
      { status }
    );
    return unwrap(res);
  },

  /**
   * DELETE /v1/teams/{id}  — soft delete
   */
  async softDelete(id) {
    if (!id) throw new Error("teamsService.softDelete: id es requerido");
    const res = await axiosInstance.delete(`${BASE}/${encodeURIComponent(id)}`);
    return unwrap(res);
  },
};

export default teamsService;