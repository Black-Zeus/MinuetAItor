// services/minutesService.js
import api from "@/services/axiosInterceptor";

const BASE = "/v1/minutes";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const unwrap = (res) => res?.data?.result ?? res?.data;

// ─── LIST ─────────────────────────────────────────────────────────────────────
/**
 * GET /v1/minutes
 * @param {Object} params
 * @param {number}      params.skip
 * @param {number}      params.limit
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
 *
 * Retorna { record, content, contentType } donde contentType indica
 * al editor qué mapper usar:
 *   "ai_output"  → loadFromIAResponse()   (JSON IA, ready-for-edit)
 *   "draft"      → loadFromDraft()         (formato editor, pending)
 *   "snapshot"   → loadFromDraft()         (formato editor, preview/completed)
 *   null         → sin contenido disponible
 *
 * @param {string} recordId
 * @returns {Promise<{ record: Object, content: Object|null, contentType: string|null }>}
 */
export const getMinuteDetail = async (recordId) => {
  const res = await api.get(`${BASE}/${recordId}`);
  return unwrap(res);
};

// ─── SAVE (autosave) ──────────────────────────────────────────────────────────
/**
 * PUT /v1/minutes/{record_id}/save
 *
 * Persiste el draft en MinIO (draft_current.json) en formato editor.
 * Solo disponible en estado "pending".
 *
 * El content debe ser el resultado de store.getExportPayload():
 *   { meetingInfo, meetingTimes, participants[], scopeSections[],
 *     agreements[], requirements[], aiTags[], userTags[],
 *     upcomingMeetings[], metadataLocked, additionalNote, timeline[], pdfFormat }
 *
 * @param {string} recordId
 * @param {Object} content  - Payload en formato editor (getExportPayload)
 * @returns {Promise<{ ok: boolean }>}
 */
export const saveMinuteDraft = async (recordId, content) => {
  const res = await api.put(`${BASE}/${recordId}/save`, { content });
  return unwrap(res);
};

// ─── TRANSITION ───────────────────────────────────────────────────────────────
/**
 * POST /v1/minutes/{record_id}/transition
 *
 * Transiciones disponibles según estado actual:
 *   ready-for-edit → pending          (abrir editor, genera draft_current.json)
 *   pending        → preview          (enviar a revisión, snapshot + PDF borrador)
 *   pending        → cancelled
 *   preview        → completed        (publicar, PDF final sin watermark)
 *   preview        → pending          (devolver a edición)
 *   preview        → cancelled
 *   in-progress    → cancelled
 *   *              → deleted
 *
 * @param {string}      recordId
 * @param {string}      targetStatus
 * @param {string|null} commitMessage  - Obligatorio en algunas transiciones (ej. reprocesar)
 * @returns {Promise<{ recordId, status, versionNum, versionId, message }>}
 */
export const transitionMinute = async (recordId, targetStatus, commitMessage = null) => {
  const body = { targetStatus };
  if (commitMessage) body.commitMessage = commitMessage;

  const res = await api.post(`${BASE}/${recordId}/transition`, body);
  return unwrap(res);
};

// ─── STATUS (polling) ─────────────────────────────────────────────────────────
/**
 * GET /v1/minutes/{transaction_id}/status
 *
 * Consulta puntual del estado de una transacción de generación.
 * Usar junto con SSE para recuperar estado al recargar la página.
 *
 * @param {string} transactionId
 * @returns {Promise<{ transactionId, recordId, status, errorMessage, createdAt, updatedAt, completedAt }>}
 */
export const getMinuteStatus = async (transactionId) => {
  const res = await api.get(`${BASE}/${transactionId}/status`);
  return unwrap(res);
};

// ─── VERSIONS (timeline) ──────────────────────────────────────────────────────
/**
 * GET /v1/minutes/{record_id}/versions
 *
 * Retorna el historial de versiones de una minuta, ordenado de más reciente
 * a más antigua. Cada versión incluye autor, fecha, estado y commit_message.
 *
 * @param {string} recordId
 * @returns {Promise<{ recordId, versions: Array<{
 *   versionId, versionNum, versionLabel, statusCode, statusLabel,
 *   publishedAt, publishedBy, commitMessage
 * }> }>}
 */
export const getMinuteVersions = async (recordId) => {
  const res = await api.get(`${BASE}/${recordId}/versions`);
  return unwrap(res);
};