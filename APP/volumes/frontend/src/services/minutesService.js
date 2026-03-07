// services/minutesService.js
import api from "@/services/axiosInterceptor";

const BASE = "/v1/minutes";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const unwrap = (res) => res?.data?.result ?? res?.data;

// ─── LIST ─────────────────────────────────────────────────────────────────────
/**
 * GET /v1/minutes
 * @param {Object} params
 * @param {number} params.skip
 * @param {number} params.limit
 * @param {string|null} params.status_filter
 * @param {string|null} params.client_id
 * @param {string|null} params.project_id
 * @returns {Promise<{ minutes: MinuteItem[], total: number, skip: number, limit: number }>}
 */
export const listMinutes = async ({
  skip = 0,
  limit = 12,
  status_filter = null,
  client_id = null,
  project_id = null,
} = {}) => {
  const params = { skip, limit };
  if (status_filter) params.status_filter = status_filter;
  if (client_id)     params.client_id     = client_id;
  if (project_id)    params.project_id    = project_id;

  const res = await api.get(BASE, { params });
  return unwrap(res);
};

// ─── DETAIL ───────────────────────────────────────────────────────────────────
/**
 * GET /v1/minutes/{record_id}
 */
export const getMinuteDetail = async (recordId) => {
  const res = await api.get(`${BASE}/${recordId}`);
  return unwrap(res);
};

// ─── TRANSITION ───────────────────────────────────────────────────────────────
/**
 * POST /v1/minutes/{record_id}/transition
 * @param {string} recordId
 * @param {string} targetStatus
 * @param {string|null} commitMessage
 */
export const transitionMinute = async (recordId, targetStatus, commitMessage = null) => {
  const body = { target_status: targetStatus };
  if (commitMessage) body.commit_message = commitMessage;

  const res = await api.post(`${BASE}/${recordId}/transition`, body);
  return unwrap(res);
};

// ─── STATUS (polling) ─────────────────────────────────────────────────────────
/**
 * GET /v1/minutes/{transaction_id}/status
 */
export const getMinuteStatus = async (transactionId) => {
  const res = await api.get(`${BASE}/${transactionId}/status`);
  return unwrap(res);
};