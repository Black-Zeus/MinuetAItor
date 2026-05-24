export const ACTIVE_AUDIT_REPORT_IDS = [
  "audit-user-sessions",
  "audit-remote-session-close",
  "audit-password-changes",
  "audit-available-activity",
  "audit-minute-otp-requests",
  "audit-guest-sessions",
  "audit-external-observations-evidence",
  "audit-external-access-by-minute",
  "audit-available-change-log",
  "audit-changes-by-entity",
  "audit-changes-by-actor",
  "audit-changes-by-period",
  "audit-system-sendmail",
];

export const ACTIVE_AUDIT_REPORT_ID_SET = new Set(ACTIVE_AUDIT_REPORT_IDS);

export const isActiveAuditReport = (reportId) =>
  ACTIVE_AUDIT_REPORT_ID_SET.has(reportId);
