export const ACTIVE_GESTION_REPORT_IDS = [
  "gestion-executive-general",
  "gestion-executive-client",
  "gestion-executive-project",
  "gestion-minute-production",
  "gestion-minute-status",
  "gestion-minute-author",
  "gestion-minute-client",
  "gestion-minute-project",
  "gestion-minute-reprocess",
  "gestion-review-minutes",
  "gestion-ai-usage",
  "gestion-ai-cost-client",
  "gestion-ai-cost-project",
  "gestion-ai-cost-model",
  "gestion-ai-cost-provider",
  "gestion-ai-latency-model",
  "gestion-ai-profile-usage",
  "gestion-ai-errors",
];

export const ACTIVE_GESTION_REPORT_ID_SET = new Set(ACTIVE_GESTION_REPORT_IDS);

export const isActiveGestionReport = (reportId) =>
  ACTIVE_GESTION_REPORT_ID_SET.has(reportId);
