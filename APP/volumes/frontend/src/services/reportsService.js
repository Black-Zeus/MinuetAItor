import api from "@/services/axiosInterceptor";

const BASE = "/v1/reports";

const unwrap = (res) => res?.data?.result ?? res?.data;
const wait = (ms, signal = null) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    const error = new Error("Report PDF preview polling cancelled");
    error.name = "AbortError";
    reject(error);
    return;
  }

  const timer = setTimeout(resolve, ms);
  signal?.addEventListener?.("abort", () => {
    clearTimeout(timer);
    const error = new Error("Report PDF preview polling cancelled");
    error.name = "AbortError";
    reject(error);
  }, { once: true });
});

const normalizePreviewId = (payload) => (
  payload?.previewId
  ?? payload?.preview_id
  ?? payload?.id
  ?? null
);

const waitForReportPdfPreview = async (previewId, {
  timeoutMs = 60000,
  intervalsMs = [1000, 2000, 5000],
  signal = null,
} = {}) => {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      const error = new Error("Report PDF preview polling cancelled");
      error.name = "AbortError";
      throw error;
    }

    const statusRes = await api.get(`${BASE}/pdf-preview/jobs/${previewId}/status`, { signal });
    const statusPayload = unwrap(statusRes);
    if (statusPayload?.status === "ready") return;

    const delayMs = intervalsMs[Math.min(attempt, intervalsMs.length - 1)] ?? 5000;
    attempt += 1;
    await wait(Math.min(delayMs, Math.max(0, deadline - Date.now())), signal);
  }

  throw new Error("REPORT_PDF_PREVIEW_TIMEOUT");
};

export const previewReportPdfBlob = async (payload, requestConfig = {}) => {
  const startRes = await api.post(`${BASE}/pdf-preview/jobs`, payload, requestConfig);
  const previewId = normalizePreviewId(unwrap(startRes));
  if (!previewId) {
    throw new Error("REPORT_PDF_PREVIEW_ID_MISSING");
  }

  await waitForReportPdfPreview(previewId, { signal: requestConfig.signal });

  const res = await api.get(`${BASE}/pdf-preview/jobs/${previewId}/result`, {
    responseType: "blob",
    ...requestConfig,
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
