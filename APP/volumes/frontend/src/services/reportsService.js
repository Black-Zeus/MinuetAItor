import api from "@/services/axiosInterceptor";

const BASE = "/v1/reports";

const unwrap = (res) => res?.data?.result ?? res?.data;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizePreviewId = (payload) => (
  payload?.previewId
  ?? payload?.preview_id
  ?? payload?.id
  ?? null
);

const waitForReportPdfPreview = async (previewId, {
  timeoutMs = 60000,
  intervalMs = 800,
} = {}) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const statusRes = await api.get(`${BASE}/pdf-preview/jobs/${previewId}/status`);
    const statusPayload = unwrap(statusRes);
    if (statusPayload?.status === "ready") return;
    await wait(intervalMs);
  }

  throw new Error("REPORT_PDF_PREVIEW_TIMEOUT");
};

export const previewReportPdfBlob = async (payload) => {
  const startRes = await api.post(`${BASE}/pdf-preview/jobs`, payload);
  const previewId = normalizePreviewId(unwrap(startRes));
  if (!previewId) {
    throw new Error("REPORT_PDF_PREVIEW_ID_MISSING");
  }

  await waitForReportPdfPreview(previewId);

  const res = await api.get(`${BASE}/pdf-preview/jobs/${previewId}/result`, {
    responseType: "blob",
  });
  return res.data;
};

export const listManagementTopicAnalytics = async ({
  reportType,
  dateFrom = null,
  dateTo = null,
  client = null,
  project = null,
  limit = 200,
} = {}, requestConfig = {}) => {
  const payload = {
    report_type: reportType,
    date_from: dateFrom || null,
    date_to: dateTo || null,
    client: client || null,
    project: project || null,
    limit,
  };
  const res = await api.post(`${BASE}/management/topic-analytics`, payload, requestConfig);
  return unwrap(res);
};

export const listManagementReviewObservations = async ({
  dateFrom = null,
  dateTo = null,
  client = null,
  project = null,
  status = null,
  limit = 500,
} = {}, requestConfig = {}) => {
  const payload = {
    date_from: dateFrom || null,
    date_to: dateTo || null,
    client: client || null,
    project: project || null,
    status: status || null,
    limit,
  };
  const res = await api.post(`${BASE}/management/review-observations`, payload, requestConfig);
  return unwrap(res);
};

export const listManagementCommitmentItems = async ({
  dateFrom = null,
  dateTo = null,
  client = null,
  project = null,
  limit = 300,
} = {}, requestConfig = {}) => {
  const payload = {
    date_from: dateFrom || null,
    date_to: dateTo || null,
    client: client || null,
    project: project || null,
    limit,
  };
  const res = await api.post(`${BASE}/management/commitment-items`, payload, requestConfig);
  return unwrap(res);
};

export const listManagementEmailDeliveries = async ({
  dateFrom = null,
  dateTo = null,
  client = null,
  project = null,
  status = null,
  emailKinds = null,
  limit = 500,
} = {}, requestConfig = {}) => {
  const payload = {
    date_from: dateFrom || null,
    date_to: dateTo || null,
    client: client || null,
    project: project || null,
    status: status || null,
    email_kinds: Array.isArray(emailKinds) && emailKinds.length ? emailKinds : null,
    limit,
  };
  const res = await api.post(`${BASE}/management/email-deliveries`, payload, requestConfig);
  return unwrap(res);
};

export const listAuditEvents = async ({
  reportType,
  dateFrom = null,
  dateTo = null,
  actor = null,
  entityType = null,
  status = null,
  client = null,
  project = null,
  limit = 500,
} = {}, requestConfig = {}) => {
  const payload = {
    report_type: reportType,
    date_from: dateFrom || null,
    date_to: dateTo || null,
    actor: actor || null,
    entity_type: entityType || null,
    status: status || null,
    client: client || null,
    project: project || null,
    limit,
  };
  const res = await api.post(`${BASE}/audit/events`, payload, requestConfig);
  return unwrap(res);
};
