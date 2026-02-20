/**
 * services/teamsService.js
 * API client para Teams (Team Members)
 *
 * Endpoints:
 *  GET    /v1/teams/{id}
 *  POST   /v1/teams/list
 *  POST   /v1/teams
 *  PUT    /v1/teams/{id}
 *  PATCH  /v1/teams/{id}/status
 *  DELETE /v1/teams/{id}          (soft delete)
 *
 * Contrato backend esperado (gateway):
 * { success, status, result, error, meta }
 */

import axiosInstance from "@/services/axiosInterceptor";

// Base path (axiosInstance ya usa baseURL "/api")
const BASE = "/v1/teams";

// ──────────────────────────────────────────────────────────────────────────────
// Normalizadores del contrato
// ──────────────────────────────────────────────────────────────────────────────

const unwrap = (res) => {
  // En tu backend: response.data = { success, status, result, error, meta }
  const data = res?.data ?? {};
  // Si algún endpoint devolviera "data" plano por excepción, caemos a eso
  return data?.result ?? data;
};

const ensureArray = (v) => (Array.isArray(v) ? v : []);

const normalizeListResult = (payload) => {
  // Esperado: { teams: [...], total, skip, limit }
  const teams = ensureArray(payload?.teams);
  const total = Number.isFinite(payload?.total) ? payload.total : teams.length;
  const skip  = Number.isFinite(payload?.skip)  ? payload.skip  : 0;
  const limit = Number.isFinite(payload?.limit) ? payload.limit : teams.length;

  return { teams, total, skip, limit };
};

// ──────────────────────────────────────────────────────────────────────────────
// Helpers de filtros -> payload API
// (Ajusta nombres de campos si tu backend espera otros)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Convierte filtros UI a payload para /list
 * Nota: como no compartiste el schema de filtros del backend,
 * lo dejo conservador y no invento campos complejos.
 */
const buildListPayload = ({
  skip = 0,
  limit = 50,
  filters = {},
  sortBy = null,
} = {}) => {
  const payload = { skip, limit };

  // Filtros habituales (si tu backend no los soporta aún, simplemente ignora)
  if (filters?.search)     payload.search     = String(filters.search);
  if (filters?.status)     payload.status     = String(filters.status);
  if (filters?.systemRole) payload.systemRole = String(filters.systemRole);
  if (filters?.client)     payload.client     = String(filters.client);

  // Sorting (si tu API lo soporta)
  if (sortBy) payload.sortBy = String(sortBy);

  return payload;
};

// ──────────────────────────────────────────────────────────────────────────────
// Teams Service (público)
// ──────────────────────────────────────────────────────────────────────────────

export const teamsService = {
  /**
   * POST /v1/teams/list
   * @returns { teams, total, skip, limit }
   */
  async list({ skip = 0, limit = 50, filters = {}, sortBy = null } = {}) {
    const payload = buildListPayload({ skip, limit, filters, sortBy });
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
   * body: team member
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
   * body: team member completo
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
   * body: { status: "active" | "inactive" } (ajusta si tu backend usa otro schema)
   */
  async updateStatus(id, status) {
    if (!id) throw new Error("teamsService.updateStatus: id es requerido");
    if (!status) throw new Error("teamsService.updateStatus: status es requerido");

    const res = await axiosInstance.patch(
      `${BASE}/${encodeURIComponent(id)}/status`,
      { status }
    );
    return unwrap(res);
  },

  /**
   * DELETE /v1/teams/{id}
   * Soft delete
   */
  async softDelete(id) {
    if (!id) throw new Error("teamsService.softDelete: id es requerido");
    const res = await axiosInstance.delete(`${BASE}/${encodeURIComponent(id)}`);
    return unwrap(res);
  },
};

export default teamsService;

// ──────────────────────────────────────────────────────────────────────────────
// (Opcional) Adaptadores de UI
// Si tu UI aún espera ciertos campos (labels/ISO), puedes centralizar aquí
// ──────────────────────────────────────────────────────────────────────────────

export const teamsAdapters = {
  /**
   * Normaliza miembro para UI (derivado de tu Teams.jsx actual)
   */
  toUi(member) {
    if (!member || typeof member !== "object") return member;

    let clientsText = "Todos";
    let projectsText = "Todos";

    if (member.assignmentMode === "specific") {
      const clientCount = member.clients?.length || 0;
      const projectCount = member.projects?.length || 0;
      clientsText = clientCount > 0 ? String(clientCount) : "Ninguno";
      projectsText = projectCount > 0 ? String(projectCount) : "Ninguno";
    }

    const createdAtISO = member.createdAt ? new Date(member.createdAt).toISOString() : null;
    const createdAtLabel = member.createdAt
      ? new Date(member.createdAt).toLocaleDateString("es-ES", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—";

    return {
      ...member,
      clientsLabel: clientsText,
      projectsLabel: projectsText,
      createdAtISO,
      createdAtLabel,
    };
  },

  toUiList(list = []) {
    return ensureArray(list).map(teamsAdapters.toUi);
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// Cache + Dedupe (anti-saturación) para getById
// ──────────────────────────────────────────────────────────────────────────────

const _teamCache = new Map(); // id -> { data, ts }
const _inflight  = new Map(); // id -> Promise

const DEFAULT_TTL_MS = 60_000; // 60s (ajustable)

const isFresh = (entry, ttlMs) => !!entry && (Date.now() - entry.ts) < ttlMs;

export const teamsCache = {
  get(id) {
    return _teamCache.get(id)?.data ?? null;
  },
  set(id, data) {
    _teamCache.set(id, { data, ts: Date.now() });
  },
  invalidate(id) {
    _teamCache.delete(id);
  },
  clear() {
    _teamCache.clear();
  },
};

/**
 * getByIdCached(id, options)
 * - Cache TTL para evitar repetición
 * - Dedupe de requests concurrentes para el mismo id
 *
 * options:
 *  - ttlMs: number (default 60s)
 *  - bypassCache: boolean (default false)
 */
teamsService.getByIdCached = async (id, { ttlMs = DEFAULT_TTL_MS, bypassCache = false } = {}) => {
  if (!id) throw new Error("teamsService.getByIdCached: id es requerido");

  if (!bypassCache) {
    const cached = _teamCache.get(id);
    if (isFresh(cached, ttlMs)) return cached.data;
  }

  if (_inflight.has(id)) return _inflight.get(id);

  const p = teamsService
    .getById(id)
    .then((data) => {
      teamsCache.set(id, data);
      return data;
    })
    .finally(() => {
      _inflight.delete(id);
    });

  _inflight.set(id, p);
  return p;
};

