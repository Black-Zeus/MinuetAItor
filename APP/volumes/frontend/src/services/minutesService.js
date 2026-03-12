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
 * @param {string|null} params.q
 * @param {string|null} params.status_filter
 * @param {string|null} params.client_id
 * @param {string|null} params.project_id
 * @param {boolean}     params.mine_as_preparer
 * @param {boolean}     params.mine_as_participant
 * @param {boolean}     params.exclude_mine_as_preparer
 * @returns {Promise<{ minutes: MinuteItem[], total: number, skip: number, limit: number }>}
 */
export const listMinutes = async ({
  skip = 0,
  limit = 12,
  q = null,
  status_filter = null,
  client_id = null,
  project_id = null,
  mine_as_preparer = false,
  mine_as_participant = false,
  exclude_mine_as_preparer = false,
} = {}) => {
  const params = { skip, limit };
  if (q)             params.q             = q;
  if (status_filter) params.status_filter = status_filter;
  if (client_id)     params.client_id     = client_id;
  if (project_id)    params.project_id    = project_id;
  if (mine_as_preparer)         params.mine_as_preparer = true;
  if (mine_as_participant)      params.mine_as_participant = true;
  if (exclude_mine_as_preparer) params.exclude_mine_as_preparer = true;

  const res = await api.get(BASE, { params });
  return unwrap(res);
};

// ─── GENERATE ─────────────────────────────────────────────────────────────────
/**
 * POST /v1/minutes/generate
 *
 * Crea una nueva minuta enviando metadatos como JSON + archivos adjuntos.
 * El request se envía como multipart/form-data:
 *   - Campo "input_json": string JSON con todos los metadatos de la reunión
 *   - Campo "files":      uno o más archivos (transcripción, resumen, etc.)
 *
 * La respuesta inmediata tiene status 202 y retorna { transactionId, recordId, status: "pending" }.
 * El procesamiento IA es asíncrono — usar getMinuteStatus() para polling.
 *
 * @param {Object} payload         - Metadatos de la reunión (se serializa a JSON string)
 * @param {File[]} files           - Array de archivos File (al menos uno requerido)
 * @returns {Promise<{ transactionId: string, recordId: string, status: string }>}
 *
 * @example
 * const result = await generateMinute(payload, [transcripcionFile, resumenFile]);
 * // result.transactionId → usar para polling con getMinuteStatus()
 * // result.recordId      → ID del registro creado en la BD
 */
export const generateMinute = async (payload, files = []) => {
  const fd = new FormData();

  // El backend espera el JSON como string en el campo "input_json"
  fd.append("input_json", JSON.stringify(payload));

  // Los archivos van todos bajo el mismo campo "files" (array)
  files.forEach((file) => {
    if (file instanceof File) {
      fd.append("files", file);
    }
  });

  // NO setear Content-Type manualmente — Axios lo genera con el boundary correcto
  const res = await api.post(`${BASE}/generate`, fd, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

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

export const listMinuteObservations = async (recordId) => {
  const res = await api.get(`${BASE}/${recordId}/observations`);
  return unwrap(res);
};

export const resolveMinuteObservation = async (observationId, payload) => {
  const res = await api.post(`${BASE}/observations/${observationId}/resolve`, payload);
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

/**
 * POST /v1/minutes/{record_id}/pdf-preview
 *
 * Genera un PDF temporal usando el payload actual del editor y lo retorna
 * directamente como Blob sin persistirlo como draft oficial.
 *
 * @param {string} recordId
 * @param {Object} content
 * @returns {Promise<Blob>}
 */
export const previewMinutePdfBlob = async (recordId, content) => {
  const res = await api.post(`${BASE}/${recordId}/pdf-preview`, { content }, {
    responseType: "blob",
  });
  return res.data;
};

/**
 * GET /v1/minutes/{record_id}/attachments/{sha256}
 *
 * Retorna el adjunto de entrada real asociado a la minuta como Blob.
 *
 * @param {string} recordId
 * @param {string} sha256
 * @returns {Promise<Blob>}
 */
export const getMinuteAttachmentBlob = async (recordId, sha256) => {
  const res = await api.get(`${BASE}/${recordId}/attachments/${sha256}`, {
    responseType: "blob",
  });
  return res.data;
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
 * @param {Object|null} reviewEmail    - Opciones de envío para pending → preview
 * @returns {Promise<{ recordId, status, versionNum, versionId, message }>}
 */
export const transitionMinute = async (recordId, targetStatus, commitMessage = null, reviewEmail = null) => {
  const body = { targetStatus };
  if (commitMessage) body.commitMessage = commitMessage;
  if (reviewEmail) body.reviewEmail = reviewEmail;

  const res = await api.post(`${BASE}/${recordId}/transition`, body);
  return unwrap(res);
};

export const sendMinuteEmail = async (recordId, reviewEmail) => {
  const res = await api.post(`${BASE}/${recordId}/send-email`, {
    reviewEmail,
  });
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

// ─── PDF (viewer / download) ───────────────────────────────────────────────
/**
 * GET /v1/minutes/{record_id}/pdf?type=draft|published
 *
 * Descarga el PDF desde el backend (proxy MinIO) como Blob.
 * El JWT viaja en el header Authorization (gestionado por axiosInterceptor).
 *
 * @param {string}              recordId
 * @param {'draft'|'published'} type     - 'draft' para borrador con marca de agua,
 *                                         'published' para versión final
 * @returns {Promise<Blob>}              - Blob PDF para crear objectURL
 * @throws {AxiosError}                  - 404 si el PDF aún no fue generado
 */
export const getMinutePdfBlob = async (recordId, type = "draft") => {
  const res = await api.get(`${BASE}/${recordId}/pdf`, {
    params:       { type },
    responseType: "blob",
  });
  return res.data;
};
