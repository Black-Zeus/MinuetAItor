export const ACTIVE_GESTION_REPORT_IDS = [
  "gestion-executive-general",
  "gestion-executive-client",
  "gestion-executive-project",
  "gestion-minute-production",
  "gestion-minute-status",
  "gestion-minute-author",
  "gestion-minute-client",
  "gestion-minute-project",
  "gestion-review-minutes",
];

export const ACTIVE_GESTION_REPORT_ID_SET = new Set(ACTIVE_GESTION_REPORT_IDS);

export const isActiveGestionReport = (reportId) =>
  ACTIVE_GESTION_REPORT_ID_SET.has(reportId);
