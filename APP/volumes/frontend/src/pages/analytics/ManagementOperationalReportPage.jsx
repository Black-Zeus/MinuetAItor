import React, {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";

import AsyncEChart from "@/components/charts/AsyncEChart";
import ModalManager from "@/components/ui/modal";
import { openPdfViewer } from "@/components/ui/pdf/PdfViewerModal";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import useAbortableRequestScope from "@/hooks/useAbortableRequestScope";
import useTableSorting from "@/hooks/useTableSorting";
import ReportModulePage from "@/pages/analytics/reports/components/ReportModulePage";
import { STATUS_CONFIG } from "@/pages/minutes/MinuteCard";
import clientService from "@/services/clientService";
import {
  listMinuteCycleTimes,
  listMinuteReprocessHistory,
  listMinutes,
} from "@/services/minutesService";
import projectService from "@/services/projectService";
import {
  listManagementCommitmentItems,
  listManagementEmailDeliveries,
  listManagementReviewObservations,
  listManagementTopicAnalytics,
  previewReportPdfBlob,
} from "@/services/reportsService";
import aiProviderConfigService from "@/services/aiProviderConfigService";
import systemMaintenanceService from "@/services/systemMaintenanceService";
import systemQueueService from "@/services/systemQueueService";
import teamsService from "@/services/teamsService";
import { formatDate, formatDateInputValue, formatDateTime, formatNumber, parseAppDate } from "@/utils/formats";
import logger from "@/utils/logger";

const reportLog = logger.scope("reports");

const ITEMS_PER_PAGE = 10;
const ECHART_TEXT = "#94a3b8";
const ECHART_TITLE = "#e2e8f0";
const ECHART_TOOLTIP_BG = "rgba(15,23,42,0.94)";
const ECHART_BORDER = "rgba(148,163,184,0.18)";
const CHART_EXPORT_BG = "#3b4252";
const CHART_THEME = {
  grid: "rgba(148,163,184,0.28)",
  bar: "#2563eb",
  line: "#059669",
  donut: ["#2563eb", "#059669", "#f59e0b", "#7c3aed", "#dc2626", "#64748b"],
};

const DEFAULT_VISIBLE_FILTERS = {
  dateFrom: true,
  dateTo: true,
  client: true,
  project: true,
  responsible: false,
  status: false,
};

const SYSTEM_REPORT_VISIBLE_FILTERS = {
  dateFrom: true,
  dateTo: true,
  client: false,
  project: false,
  responsible: false,
  status: true,
};

const SYSTEM_NO_STATUS_VISIBLE_FILTERS = {
  dateFrom: true,
  dateTo: true,
  client: false,
  project: false,
  responsible: false,
  status: false,
};

const TOPIC_REPORT_VISIBLE_FILTERS = {
  dateFrom: true,
  dateTo: true,
  client: true,
  project: true,
  responsible: false,
  status: false,
};

const QUEUE_STATUS_FILTER_OPTIONS = [
  { value: "idle", label: "Sin carga" },
  { value: "active", label: "Con carga" },
  { value: "warning", label: "Advertencia" },
  { value: "critical", label: "Crítico" },
];

const PROVIDER_VALIDATION_STATUS_OPTIONS = [
  { value: "valid", label: "Válido" },
  { value: "unvalidated", label: "Sin validar" },
  { value: "error", label: "Error" },
  { value: "timeout", label: "Timeout" },
  { value: "model_not_found", label: "Modelo no encontrado" },
];

const REVIEW_OBSERVATION_STATUS_OPTIONS = [
  { value: "new", label: "Nueva" },
  { value: "inserted", label: "Insertada" },
  { value: "approved", label: "Aprobada" },
  { value: "rejected", label: "Rechazada" },
];

const COMMITMENT_STATUS_OPTIONS = [
  { value: "pending", label: "Pendiente" },
  { value: "open", label: "Abierto" },
  { value: "in-progress", label: "En curso" },
  { value: "completed", label: "Completado" },
  { value: "closed", label: "Cerrado" },
  { value: "cancelled", label: "Cancelado" },
];

const REQUIREMENT_PRIORITY_OPTIONS = [
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baja" },
  { value: "critical", label: "Crítica" },
];

const EMAIL_DELIVERY_STATUS_OPTIONS = [
  { value: "queued", label: "En cola" },
  { value: "sent", label: "Enviado" },
  { value: "failed", label: "Fallido" },
];

const MAINTENANCE_RUNTIME_STATUS_OPTIONS = [
  { value: "queued", label: "En cola" },
  { value: "running", label: "En curso" },
  { value: "success", label: "OK" },
  { value: "error", label: "Error" },
  { value: "warning", label: "Advertencia" },
];

const STATUS_FILTER_OPTIONS = [
  { value: "in-progress", label: "En procesamiento" },
  { value: "ready-for-edit", label: "Listo para editar" },
  { value: "pending", label: "Pendiente" },
  { value: "preview", label: "En revisión" },
  { value: "completed", label: "Completado" },
  { value: "cancelled", label: "Cancelado" },
  { value: "llm-failed", label: "Fallo IA" },
  { value: "processing-error", label: "Error de proceso" },
  { value: "deleted", label: "Eliminado" },
];

const STATUS_SORT_WEIGHT = {
  "in-progress": 1,
  "ready-for-edit": 2,
  pending: 3,
  preview: 4,
  completed: 5,
  cancelled: 6,
  "llm-failed": 7,
  "processing-error": 8,
  deleted: 9,
};

const REPROCESS_REASON_LABELS = {
  "record-error": "Error de registro",
  "stale-failed-transaction": "Transacción fallida previa",
  "stale-processing": "Procesamiento atascado",
};

const TOPIC_STATUS_CONFIG = {
  active: {
    label: "Activo",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  inactive: {
    label: "Inactivo",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  converted: {
    label: "Convertido",
    className: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  },
  unconverted: {
    label: "Sin conversión",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  trend: {
    label: "Tendencia",
    className: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  },
};

const REVIEW_OBSERVATION_STATUS_CONFIG = {
  new: {
    label: "Nueva",
    className: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  },
  inserted: {
    label: "Insertada",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  approved: {
    label: "Aprobada",
    className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  },
  rejected: {
    label: "Rechazada",
    className: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  },
};

const EMAIL_DELIVERY_STATUS_CONFIG = {
  queued: {
    label: "En cola",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  sent: {
    label: "Enviado",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  failed: {
    label: "Fallido",
    className: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  },
};

const COMMITMENT_STATUS_CONFIG = {
  pending: {
    label: "Pendiente",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  open: {
    label: "Abierto",
    className: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  },
  "in-progress": {
    label: "En curso",
    className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  },
  completed: {
    label: "Completado",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  closed: {
    label: "Cerrado",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  cancelled: {
    label: "Cancelado",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
};

const PERCENT_FORMATTER = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const SORTERS = {
  date: (row) => row.dateTimestamp ?? 0,
  lastActivity: (row) =>
    row.lastActivityAtTimestamp ?? row.lastDateTimestamp ?? row.lastTransitionAtTimestamp ?? 0,
  lastDate: (row) => row.lastDateTimestamp ?? 0,
  lastTransitionAt: (row) => row.lastTransitionAtTimestamp ?? 0,
  client: (row) => row.client ?? row.label ?? "",
  project: (row) => row.project ?? row.label ?? "",
  responsible: (row) => row.responsible ?? row.label ?? "",
  status: (row) =>
    row.statusWeight ??
    STATUS_SORT_WEIGHT[row.status?.key] ??
    STATUS_SORT_WEIGHT[row.statusKey] ??
    999,
  title: (row) => row.title ?? "",
  totalRecords: (row) => row.totalRecords ?? 0,
  completedRecords: (row) => row.completedRecords ?? 0,
  pendingRecords: (row) => row.pendingRecords ?? 0,
  reviewRecords: (row) => row.reviewRecords ?? 0,
  backlogRecords: (row) => row.backlogRecords ?? 0,
  clientCount: (row) => row.clientCount ?? 0,
  projectCount: (row) => row.projectCount ?? 0,
  responsibleCount: (row) => row.responsibleCount ?? 0,
  documentLoadScore: (row) => row.documentLoadScore ?? 0,
  daysWithoutActivity: (row) => row.daysWithoutActivity ?? 0,
  statusLabel: (row) => row.statusLabel ?? "",
  priorityLabel: (row) => row.priorityLabel ?? "",
  industry: (row) => row.industry ?? "",
  code: (row) => row.code ?? "",
  isConfidential: (row) => (row.isConfidential ? 1 : 0),
  isActive: (row) => (row.isActive ? 1 : 0),
  autoSendCount: (row) => row.autoSendCount ?? 0,
  queue: (row) => row.queue ?? row.label ?? "",
  size: (row) => row.size ?? 0,
  warningThreshold: (row) => row.warningThreshold ?? 0,
  loadPercent: (row) => row.loadPercent ?? 0,
  priority: (row) => row.priority ?? "",
  priorityWeight: (row) => row.priorityWeight ?? 99,
  consumer: (row) => row.consumer ?? "",
  monitoringEnabled: (row) => (row.monitoringEnabled ? 1 : 0),
  alertActive: (row) => (row.alertActive ? 1 : 0),
  lastAlertAt: (row) => row.lastAlertAtTimestamp ?? 0,
  runtimeScope: (row) => row.runtimeScope ?? "",
  affectedCount: (row) => row.affectedCount ?? 0,
  provider: (row) => row.provider ?? row.label ?? "",
  providerType: (row) => row.providerType ?? "",
  model: (row) => row.model ?? "",
  lastValidatedAt: (row) => row.lastValidatedAtTimestamp ?? 0,
  tag: (row) => row.tag ?? row.label ?? "",
  aiTag: (row) => row.aiTag ?? row.label ?? "",
  category: (row) => row.category ?? "",
  period: (row) => row.period ?? "",
  totalAssignments: (row) => row.totalAssignments ?? 0,
  detectedCount: (row) => row.detectedCount ?? 0,
  convertedCount: (row) => row.convertedCount ?? 0,
  unconvertedCount: (row) => row.unconvertedCount ?? 0,
  conversionTarget: (row) => row.conversionTarget ?? "",
  conversionRate: (row) => row.conversionRate ?? 0,
  observationId: (row) => row.observationId ?? 0,
  authorEmail: (row) => row.authorEmail ?? "",
  versionNum: (row) => row.versionNum ?? 0,
  resolutionType: (row) => row.resolutionTypeLabel ?? row.resolutionType ?? "",
  resolvedAt: (row) => row.resolvedAtTimestamp ?? 0,
  completedAt: (row) => row.completedAtTimestamp ?? 0,
  queuedAt: (row) => row.queuedAtTimestamp ?? 0,
  sentAt: (row) => row.sentAtTimestamp ?? 0,
  failedAt: (row) => row.failedAtTimestamp ?? 0,
  emailKind: (row) => row.emailKindLabel ?? row.emailKind ?? "",
  recipientCount: (row) => row.recipientCount ?? 0,
  attachmentCount: (row) => row.attachmentCount ?? 0,
  attempt: (row) => row.attempt ?? 0,
  body: (row) => row.body ?? "",
  editorComment: (row) => row.editorComment ?? "",
  itemType: (row) => row.itemTypeLabel ?? row.itemType ?? "",
  itemCode: (row) => row.itemCode ?? "",
  dueDate: (row) => row.dueDateTimestamp ?? 0,
  agreementCount: (row) => row.agreementCount ?? 0,
  requirementCount: (row) => row.requirementCount ?? 0,
  expiredCount: (row) => row.expiredCount ?? 0,
  percentage: (row) => row.percentageRaw ?? 0,
  reprocessReady: (row) => (row.canReprocess ? 1 : 0),
  reprocessReason: (row) => row.reprocessReasonLabel ?? "",
  errorMessage: (row) => row.errorMessage ?? "",
  totalTokens: (row) => row.totalTokens ?? 0,
  cycleStartedAt: (row) => row.cycleStartedAtTimestamp ?? 0,
  processingDuration: (row) => row.processingDurationMs ?? 0,
  editingDuration: (row) => row.editingDurationMs ?? 0,
  reviewDuration: (row) => row.reviewDurationMs ?? 0,
  totalCycleDuration: (row) => row.totalCycleDurationMs ?? 0,
  transitionCount: (row) => row.transitionCount ?? 0,
  returnToEditCount: (row) => row.returnToEditCount ?? 0,
};

const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("es");

const compareByLabel = (left, right) =>
  String(left ?? "").localeCompare(String(right ?? ""), "es", {
    numeric: true,
    sensitivity: "base",
  });

const formatPercent = (value) =>
  `${PERCENT_FORMATTER.format(Number(value ?? 0))}%`;

const formatDurationMs = (value) => {
  const totalMs = Math.max(0, Number(value ?? 0));
  const totalMinutes = Math.floor(totalMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days} d ${hours} h`;
  }
  if (hours > 0) {
    return `${hours} h ${minutes} min`;
  }
  return `${minutes} min`;
};

const getReprocessReasonLabel = (reason, fallback = "Señal operativa") =>
  REPROCESS_REASON_LABELS[String(reason ?? "").trim()] ?? fallback;

const formatDateForInput = (date) => formatDateInputValue(date);

const buildDefaultFilters = () => {
  const today = new Date();
  const dateTo = formatDateForInput(today);
  const dateFromRef = new Date(today);
  dateFromRef.setDate(dateFromRef.getDate() - 7);

  return {
    dateFrom: formatDateForInput(dateFromRef),
    dateTo,
    client: "",
    project: "",
    responsible: "",
    status: "",
  };
};

const REPROCESS_STATUS_FILTER_OPTIONS = [
  { value: "in-progress", label: "En procesamiento" },
  { value: "completed", label: "OK / siguió flujo" },
  { value: "llm-failed", label: "Con error IA" },
  { value: "processing-error", label: "Con error de proceso" },
];

const parseFlexibleDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const raw = String(value).trim();
  if (!raw) return null;

  const directDate = parseAppDate(raw);
  if (!Number.isNaN(directDate.getTime())) return directDate;

  const monthMap = {
    ene: 0,
    feb: 1,
    mar: 2,
    abr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    ago: 7,
    sep: 8,
    set: 8,
    oct: 9,
    nov: 10,
    dic: 11,
  };

  const ddMmYyyyMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddMmYyyyMatch) {
    const [, dd, mm, yyyy] = ddMmYyyyMatch;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  }

  const textMatch = raw.match(/^(\d{1,2})\s+([A-Za-zÁÉÍÓÚáéíóúñÑ]{3,})\s+(\d{4})$/);
  if (textMatch) {
    const [, day, monthRaw, year] = textMatch;
    const monthKey = normalizeText(monthRaw).slice(0, 3);
    const monthIndex = monthMap[monthKey];
    if (monthIndex != null) {
      return new Date(Number(year), monthIndex, Number(day));
    }
  }

  return null;
};

const formatDateLabel = (value) => {
  const parsedDate = parseFlexibleDate(value);
  if (!parsedDate) return String(value ?? "Sin fecha");
  return formatDate(parsedDate);
};

const formatDateTimeLabel = (value) => {
  const parsedDate = parseFlexibleDate(value);
  if (!parsedDate) return String(value ?? "Sin fecha");
  return formatDateTime(parsedDate);
};

const toInputDate = (value) => {
  const parsedDate = parseFlexibleDate(value);
  if (!parsedDate) return "";

  return formatDateInputValue(parsedDate);
};

const isBacklogStatus = (statusKey) =>
  !["completed", "cancelled", "deleted"].includes(String(statusKey ?? ""));

const getStatusPresentation = (status, explicitLabel = null) => {
  const key = String(status ?? "processing-error");
  const config = STATUS_CONFIG[key] ?? STATUS_CONFIG["processing-error"];

  return {
    key,
    label: explicitLabel ?? config.label ?? "Sin estado",
    className: config.className,
    sortWeight: STATUS_SORT_WEIGHT[key] ?? 999,
  };
};

const getReviewObservationStatusPresentation = (status, explicitLabel = null) => {
  const key = String(status ?? "new").trim().toLowerCase() || "new";
  const config = REVIEW_OBSERVATION_STATUS_CONFIG[key] ?? REVIEW_OBSERVATION_STATUS_CONFIG.new;
  return {
    key,
    label: explicitLabel ?? config.label,
    className: config.className,
    sortWeight: key === "new" ? 1 : key === "approved" ? 2 : key === "inserted" ? 3 : 4,
  };
};

const getEmailDeliveryStatusPresentation = (status, explicitLabel = null) => {
  const key = String(status ?? "queued").trim().toLowerCase() || "queued";
  const config = EMAIL_DELIVERY_STATUS_CONFIG[key] ?? EMAIL_DELIVERY_STATUS_CONFIG.queued;
  const sortWeight = key === "failed" ? 1 : key === "queued" ? 2 : 3;
  return {
    key,
    label: explicitLabel ?? config.label,
    className: config.className,
    sortWeight,
  };
};

const getEmailKindLabel = (value) => {
  const labels = {
    minute_review: "Revisión",
    minute_publication: "Publicación",
    minute_officialized: "Oficialización",
    minute_analysis: "Análisis IA",
    system_queue: "Colas",
    templated: "Plantilla",
    system: "Sistema",
  };
  return labels[String(value ?? "").trim()] ?? value ?? "Sistema";
};

const normalizeStatusKey = (value, fallback = "pending") =>
  normalizeText(value).replace(/_/g, "-") || fallback;

const getCommitmentStatusPresentation = (status, explicitLabel = null) => {
  const aliases = {
    done: "completed",
    complete: "completed",
    terminado: "completed",
    cerrada: "closed",
    cerrado: "closed",
    pendiente: "pending",
    abierto: "open",
    abierta: "open",
  };
  const rawKey = normalizeStatusKey(status);
  const key = aliases[rawKey] ?? rawKey;
  const config = COMMITMENT_STATUS_CONFIG[key] ?? COMMITMENT_STATUS_CONFIG.pending;
  const sortWeight = ["pending", "open", "in-progress", "completed", "closed", "cancelled"].indexOf(key);
  return {
    key,
    label: explicitLabel ?? config.label,
    className: config.className,
    sortWeight: sortWeight >= 0 ? sortWeight + 1 : 99,
  };
};

const getRequirementPriorityPresentation = (priority) => {
  const aliases = {
    alta: "high",
    media: "medium",
    baja: "low",
    critica: "critical",
    crítico: "critical",
    critico: "critical",
  };
  const key = aliases[normalizeStatusKey(priority, "medium")] ?? normalizeStatusKey(priority, "medium");
  const config = REQUIREMENT_PRIORITY_OPTIONS.find((option) => option.value === key);
  const weight = { critical: 1, high: 2, medium: 3, low: 4 };
  return {
    key,
    label: config?.label ?? key,
    weight: weight[key] ?? 99,
  };
};

const isClosedCommitmentStatus = (statusKey) =>
  ["completed", "closed", "cancelled", "done"].includes(String(statusKey ?? ""));

const getResolutionTypeLabel = (value) => {
  const key = String(value ?? "none").trim().toLowerCase();
  const labels = {
    none: "Sin resolución",
    direct_insert: "Inserción directa",
    manual_update: "Actualización manual",
  };
  return labels[key] ?? (key || "Sin resolución");
};

const getClientLabel = (client) =>
  client?.company ?? client?.name ?? client?.client ?? "Sin cliente";

const getProjectLabel = (project) =>
  project?.name ?? project?.projectName ?? project?.project ?? "Sin proyecto";

const getClientId = (client) => client?.id ?? client?.clientId ?? client?.client_id ?? null;

const getProjectClientId = (project) =>
  project?.clientId ?? project?.client_id ?? project?.client?.id ?? null;

const getBooleanLabel = (value) => (value ? "Sí" : "No");

const formatCatalogLabel = (value, fallback = "Sin dato") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const formatStatusLabel = (value, isActive = true) => {
  const text = String(value ?? "").trim();
  if (text) return text;
  return isActive ? "Activo" : "Inactivo";
};

const buildDaysWithoutActivity = (lastTimestamp, referenceTimestamp) => {
  if (!lastTimestamp) return null;
  const diffMs = Math.max(0, Number(referenceTimestamp ?? Date.now()) - Number(lastTimestamp));
  return Math.floor(diffMs / 86400000);
};

const extractMinuteDate = (minute) =>
  minute?.meeting_date ??
  minute?.meetingDate ??
  minute?.date_meeting ??
  minute?.date ??
  minute?.createdAt ??
  minute?.created_at ??
  minute?.updatedAt ??
  minute?.updated_at ??
  null;

const normalizeMinuteRecord = (minute, index) => {
  const rawDate = extractMinuteDate(minute);
  const parsedDate = parseFlexibleDate(rawDate);
  const status = getStatusPresentation(
    minute?.status ?? minute?.statusCode,
    minute?.statusLabel ?? minute?.status_label ?? null
  );
  const errorMessage = String(
    minute?.errorMessage ?? minute?.error_message ?? ""
  ).trim();
  const canReprocess = Boolean(
    minute?.canReprocess ?? minute?.can_reprocess ?? false
  );
  const reprocessReason = String(
    minute?.reprocessReason ?? minute?.reprocess_reason ?? ""
  ).trim();
  const hasTerminalError = ["llm-failed", "processing-error"].includes(status.key);
  const hasReprocessSignal = Boolean(
    canReprocess || reprocessReason || errorMessage || hasTerminalError
  );
  const inputTokens = Number(
    minute?.tokensInput ?? minute?.tokens_input ?? 0
  );
  const outputTokens = Number(
    minute?.tokensOutput ?? minute?.tokens_output ?? 0
  );
  const totalTokens = Number(
    minute?.totalTokens ?? minute?.total_tokens ?? inputTokens + outputTokens
  );
  const reprocessReasonLabel = reprocessReason
    ? getReprocessReasonLabel(reprocessReason)
    : errorMessage
      ? "Error visible"
      : hasTerminalError
        ? "Error terminal"
        : canReprocess
          ? "Reproceso disponible"
          : "Sin señal";

  return {
    id: minute?.id ?? minute?.recordId ?? `report-row-${index + 1}`,
    rawId: minute?.id ?? minute?.recordId ?? index + 1,
    dateLabel: formatDateLabel(rawDate),
    dateInput: toInputDate(rawDate),
    dateTimestamp: parsedDate?.getTime?.() ?? 0,
    client: minute?.clientName ?? minute?.client ?? "Sin cliente",
    project: minute?.projectName ?? minute?.project ?? "Sin proyecto",
    responsible:
      minute?.preparedBy ??
      minute?.prepared_by ??
      minute?.ownerName ??
      minute?.createdBy ??
      "Sistema",
    status,
    statusKey: status.key,
    statusWeight: status.sortWeight,
    canReprocess,
    reprocessReason,
    reprocessReasonLabel,
    errorMessage,
    hasTerminalError,
    hasReprocessSignal,
    inputTokens,
    outputTokens,
    totalTokens,
    title:
      minute?.title ??
      minute?.subject ??
      minute?.minuteTitle ??
      "Minuta sin título",
  };
};

const normalizeReprocessAttemptRecord = (attempt, index) => {
  const rawDate = attempt?.date ?? attempt?.createdAt ?? attempt?.created_at ?? null;
  const parsedDate = parseFlexibleDate(rawDate);
  const status = getStatusPresentation(
    attempt?.status ?? attempt?.statusCode,
    attempt?.statusLabel ?? attempt?.status_label ?? null
  );
  const inputTokens = Number(
    attempt?.tokensInput ?? attempt?.tokens_input ?? 0
  );
  const outputTokens = Number(
    attempt?.tokensOutput ?? attempt?.tokens_output ?? 0
  );

  return {
    id: attempt?.transactionId ?? attempt?.transaction_id ?? `reprocess-row-${index + 1}`,
    rawId: attempt?.recordId ?? attempt?.record_id ?? index + 1,
    transactionId: attempt?.transactionId ?? attempt?.transaction_id ?? null,
    attemptNumber: Number(attempt?.attemptNumber ?? attempt?.attempt_number ?? 0),
    dateLabel: formatDateTimeLabel(rawDate),
    dateInput: toInputDate(rawDate),
    dateTimestamp: parsedDate?.getTime?.() ?? 0,
    client: attempt?.client ?? "Sin cliente",
    project: attempt?.project ?? "Sin proyecto",
    responsible:
      attempt?.preparedBy ??
      attempt?.prepared_by ??
      attempt?.ownerName ??
      attempt?.createdBy ??
      "Sistema",
    status,
    statusKey: status.key,
    statusWeight: status.sortWeight,
    canReprocess: Boolean(
      attempt?.canReprocess ?? attempt?.can_reprocess ?? false
    ),
    reprocessReason: String(
      attempt?.reprocessReason ?? attempt?.reprocess_reason ?? ""
    ).trim(),
    reprocessReasonLabel: String(
      attempt?.reprocessReason ?? attempt?.reprocess_reason ?? ""
    ).trim()
      ? getReprocessReasonLabel(attempt?.reprocessReason ?? attempt?.reprocess_reason)
      : "Reproceso histórico",
    errorMessage: String(
      attempt?.errorMessage ?? attempt?.error_message ?? ""
    ).trim(),
    hasTerminalError: ["llm-failed", "processing-error"].includes(status.key),
    hasReprocessSignal: true,
    inputTokens,
    outputTokens,
    totalTokens: Number(
      attempt?.totalTokens ?? attempt?.total_tokens ?? inputTokens + outputTokens
    ),
    title:
      attempt?.title ??
      attempt?.subject ??
      attempt?.minuteTitle ??
      "Minuta sin título",
  };
};

const normalizeCycleTimeRecord = (item, index) => {
  const rawDate = item?.date ?? null;
  const parsedDate = parseFlexibleDate(rawDate);
  const cycleStartedAt = item?.cycleStartedAt ?? item?.cycle_started_at ?? null;
  const lastTransitionAt = item?.lastTransitionAt ?? item?.last_transition_at ?? null;
  const completedAt = item?.completedAt ?? item?.completed_at ?? null;
  const parsedCycleStartedAt = parseFlexibleDate(cycleStartedAt);
  const parsedLastTransitionAt = parseFlexibleDate(lastTransitionAt);
  const parsedCompletedAt = parseFlexibleDate(completedAt);
  const status = getStatusPresentation(
    item?.status ?? item?.statusCode,
    item?.statusLabel ?? item?.status_label ?? null
  );

  return {
    id: item?.recordId ?? item?.record_id ?? `cycle-row-${index + 1}`,
    rawId: item?.recordId ?? item?.record_id ?? index + 1,
    dateLabel: formatDateLabel(rawDate),
    dateInput: toInputDate(rawDate),
    dateTimestamp: parsedDate?.getTime?.() ?? 0,
    client: item?.client ?? "Sin cliente",
    project: item?.project ?? "Sin proyecto",
    responsible:
      item?.preparedBy ??
      item?.prepared_by ??
      item?.ownerName ??
      item?.createdBy ??
      "Sistema",
    status,
    statusKey: status.key,
    statusWeight: status.sortWeight,
    title:
      item?.title ??
      item?.subject ??
      item?.minuteTitle ??
      "Minuta sin título",
    cycleStartedAtLabel: formatDateTimeLabel(cycleStartedAt),
    cycleStartedAtTimestamp: parsedCycleStartedAt?.getTime?.() ?? 0,
    lastTransitionAtLabel: formatDateTimeLabel(lastTransitionAt),
    lastTransitionAtTimestamp: parsedLastTransitionAt?.getTime?.() ?? 0,
    completedAtLabel: completedAt ? formatDateTimeLabel(completedAt) : "—",
    completedAtInput: toInputDate(completedAt),
    completedAtTimestamp: parsedCompletedAt?.getTime?.() ?? 0,
    processingDurationMs: Number(
      item?.processingDurationMs ?? item?.processing_duration_ms ?? 0
    ),
    editingDurationMs: Number(
      item?.editingDurationMs ?? item?.editing_duration_ms ?? 0
    ),
    reviewDurationMs: Number(
      item?.reviewDurationMs ?? item?.review_duration_ms ?? 0
    ),
    totalCycleDurationMs: Number(
      item?.totalCycleDurationMs ?? item?.total_cycle_duration_ms ?? 0
    ),
    transitionCount: Number(item?.transitionCount ?? item?.transition_count ?? 0),
    returnToEditCount: Number(
      item?.returnToEditCount ?? item?.return_to_edit_count ?? 0
    ),
    cycleClosed: Boolean(item?.cycleClosed ?? item?.cycle_closed ?? false),
  };
};

const normalizeClientCatalogRecord = (client, index) => {
  const isActive = Boolean(client?.isActive ?? client?.is_active ?? true);
  const createdAt = client?.createdAt ?? client?.created_at ?? null;
  const parsedCreatedAt = parseFlexibleDate(createdAt);

  return {
    id: getClientId(client) ?? `client-catalog-${index + 1}`,
    client: getClientLabel(client),
    label: getClientLabel(client),
    industry: formatCatalogLabel(client?.industry),
    statusLabel: formatStatusLabel(client?.status, isActive),
    priorityLabel: formatCatalogLabel(client?.priority),
    isActive,
    isConfidential: Boolean(client?.isConfidential ?? client?.is_confidential ?? false),
    createdAtLabel: createdAt ? formatDateLabel(createdAt) : "Sin fecha",
    createdAtTimestamp: parsedCreatedAt?.getTime?.() ?? 0,
  };
};

const normalizeProjectCatalogRecord = (project, index) => {
  const isActive = Boolean(project?.isActive ?? project?.is_active ?? true);
  const createdAt = project?.createdAt ?? project?.created_at ?? null;
  const parsedCreatedAt = parseFlexibleDate(createdAt);
  const autoSendOnPreview = Boolean(
    project?.autoSendOnPreview ?? project?.auto_send_on_preview ?? false
  );
  const autoSendOnCompleted = Boolean(
    project?.autoSendOnCompleted ?? project?.auto_send_on_completed ?? false
  );

  return {
    id: project?.id ?? project?.projectId ?? project?.project_id ?? `project-catalog-${index + 1}`,
    project: getProjectLabel(project),
    label: getProjectLabel(project),
    clientId: getProjectClientId(project),
    client:
      project?.clientName ??
      project?.client_name ??
      project?.client?.name ??
      project?.client ??
      "Sin cliente",
    code: formatCatalogLabel(project?.code, "Sin código"),
    statusLabel: formatStatusLabel(project?.status, isActive),
    isActive,
    isConfidential: Boolean(project?.isConfidential ?? project?.is_confidential ?? false),
    autoSendOnPreview,
    autoSendOnCompleted,
    autoSendCount: Number(autoSendOnPreview) + Number(autoSendOnCompleted),
    automationLabel:
      autoSendOnPreview && autoSendOnCompleted
        ? "Revisión y cierre"
        : autoSendOnPreview
          ? "Revisión"
          : autoSendOnCompleted
            ? "Cierre"
            : "Sin automatización",
    createdAtLabel: createdAt ? formatDateLabel(createdAt) : "Sin fecha",
    createdAtTimestamp: parsedCreatedAt?.getTime?.() ?? 0,
  };
};

const normalizeQueueStatusRecord = (item, index, refreshedAt = null) => {
  const rawDate = item?.lastActivityAt ?? item?.last_activity_at ?? refreshedAt;
  const parsedDate = parseFlexibleDate(rawDate);
  const statusKey = String(item?.status ?? "").trim() || "idle";
  const statusLabel = item?.statusLabel ?? item?.status_label ?? statusKey;
  const alertState = item?.alertState ?? item?.alert_state ?? {};
  const lastAlertAt = alertState?.lastAlertAt ?? alertState?.last_alert_at ?? null;
  const parsedLastAlertAt = parseFlexibleDate(lastAlertAt);

  return {
    id: item?.queue ?? `queue-row-${index + 1}`,
    queue: item?.queue ?? "queue:unknown",
    label: item?.label ?? item?.queue ?? "Cola sin nombre",
    description: item?.description ?? "",
    dateLabel: formatDateTimeLabel(rawDate),
    dateInput: toInputDate(rawDate),
    dateTimestamp: parsedDate?.getTime?.() ?? 0,
    lastActivityLabel: rawDate ? formatDateTimeLabel(rawDate) : "Sin actividad",
    consumer: item?.consumer ?? "Sin consumidor",
    priority: item?.priority ?? "Sin prioridad",
    size: Number(item?.size ?? 0),
    monitoringEnabled: Boolean(item?.monitoringEnabled ?? item?.monitoring_enabled ?? false),
    warningThreshold: Number(item?.warningThreshold ?? item?.warning_threshold ?? 0),
    loadPercent: Number(item?.loadPercent ?? item?.load_percent ?? 0),
    statusKey,
    statusLabel,
    status: getStatusPresentation(statusKey, statusLabel),
    isWarning: Boolean(item?.isWarning ?? item?.is_warning ?? false),
    alertActive: Boolean(alertState?.alertActive ?? alertState?.alert_active ?? item?.isWarning ?? false),
    lastAlertAtLabel: lastAlertAt ? formatDateTimeLabel(lastAlertAt) : "Sin alerta",
    lastAlertAtTimestamp: parsedLastAlertAt?.getTime?.() ?? 0,
    jobTypesLabel: Array.isArray(item?.jobTypes ?? item?.job_types)
      ? (item.jobTypes ?? item.job_types).join(", ")
      : "Sin tipos",
  };
};

const normalizeMaintenanceRuntimeRecord = (scope, runtime = {}, index = 0) => {
  const lastEnqueuedAt = runtime?.lastEnqueuedAt ?? runtime?.last_enqueued_at ?? null;
  const lastStartedAt = runtime?.lastStartedAt ?? runtime?.last_started_at ?? null;
  const lastFinishedAt = runtime?.lastFinishedAt ?? runtime?.last_finished_at ?? null;
  const rawDate = lastFinishedAt || lastStartedAt || lastEnqueuedAt;
  const parsedDate = parseFlexibleDate(rawDate);
  const statusKey = String(runtime?.lastStatus ?? runtime?.last_status ?? "sin-ejecucion").trim();
  const statusLabel =
    MAINTENANCE_RUNTIME_STATUS_OPTIONS.find((option) => option.value === statusKey)?.label ??
    "Sin ejecuciones";

  return {
    id: `runtime-${scope}-${index + 1}`,
    runtimeScope: scope,
    label: scope === "session_cleanup" ? "Limpieza de sesiones" : "Limpieza de temporales",
    dateLabel: rawDate ? formatDateTimeLabel(rawDate) : "Sin fecha",
    dateInput: toInputDate(rawDate),
    dateTimestamp: parsedDate?.getTime?.() ?? 0,
    lastEnqueuedAtLabel: lastEnqueuedAt ? formatDateTimeLabel(lastEnqueuedAt) : "Sin registro",
    lastStartedAtLabel: lastStartedAt ? formatDateTimeLabel(lastStartedAt) : "Sin registro",
    lastFinishedAtLabel: lastFinishedAt ? formatDateTimeLabel(lastFinishedAt) : "Sin registro",
    statusKey,
    statusLabel,
    status: getStatusPresentation(statusKey, statusLabel),
    message: runtime?.lastMessage ?? runtime?.last_message ?? "Sin mensaje registrado",
    affectedCount: Number(runtime?.affectedCount ?? runtime?.affected_count ?? 0),
  };
};

const normalizeProviderValidationRecord = (item, index) => {
  const validationDate = item?.lastValidatedAt ?? item?.last_validated_at ?? null;
  const rawDate =
    validationDate ??
    item?.updatedAt ??
    item?.updated_at ??
    item?.createdAt ??
    item?.created_at ??
    new Date().toISOString();
  const parsedDate = parseFlexibleDate(rawDate);
  const statusKey = String(item?.validationStatus ?? item?.validation_status ?? "unvalidated").trim();
  const statusLabel =
    PROVIDER_VALIDATION_STATUS_OPTIONS.find((option) => option.value === statusKey)?.label ??
    statusKey;

  return {
    id: item?.id ?? `provider-row-${index + 1}`,
    provider: item?.name ?? item?.label ?? `Provider ${index + 1}`,
    label: item?.name ?? item?.label ?? `Provider ${index + 1}`,
    providerType: item?.providerType ?? item?.provider_type ?? "Sin tipo",
    model: item?.model ?? item?.defaultModel ?? item?.default_model ?? "Sin modelo",
    dateLabel: rawDate ? formatDateTimeLabel(rawDate) : "Sin fecha",
    dateInput: toInputDate(rawDate),
    dateTimestamp: parsedDate?.getTime?.() ?? 0,
    lastValidatedAtLabel: validationDate ? formatDateTimeLabel(validationDate) : "Sin validación",
    lastValidatedAtTimestamp: parseFlexibleDate(validationDate)?.getTime?.() ?? 0,
    statusKey,
    statusLabel,
    status: getStatusPresentation(statusKey, statusLabel),
    isActive: Boolean(item?.isActive ?? item?.is_active ?? false),
    errorMessage: item?.lastError ?? item?.last_error ?? "",
  };
};

const getTopicStatusPresentation = (statusKey, explicitLabel = null) => {
  const key = String(statusKey ?? "active").trim() || "active";
  const config = TOPIC_STATUS_CONFIG[key] ?? TOPIC_STATUS_CONFIG.active;
  return {
    key,
    label: explicitLabel ?? config.label,
    className: config.className,
    sortWeight: key === "active" || key === "converted" ? 1 : key === "trend" ? 2 : 3,
  };
};

const normalizeTopicAnalyticsRecord = (item, index) => {
  const rawDate = item?.lastActivity ?? item?.last_activity ?? null;
  const parsedDate = parseFlexibleDate(rawDate);
  const statusKey = item?.statusKey ?? item?.status_key ?? "active";
  const statusLabel = item?.statusLabel ?? item?.status_label ?? null;
  const conversionRate = Number(item?.conversionRate ?? item?.conversion_rate ?? 0);

  return {
    id: item?.id ?? `topic-row-${index + 1}`,
    label: item?.label ?? item?.tag ?? item?.aiTag ?? item?.ai_tag ?? "Sin etiqueta",
    tagId: item?.tagId ?? item?.tag_id ?? null,
    tag: item?.tag ?? item?.label ?? "Sin tag",
    aiTagId: item?.aiTagId ?? item?.ai_tag_id ?? null,
    aiTag: item?.aiTag ?? item?.ai_tag ?? item?.label ?? "Sin AI tag",
    category: item?.category ?? "Sin categoría",
    source: item?.source ?? "Sin dato",
    conversionTarget: item?.conversionTarget ?? item?.conversion_target ?? "Sin conversión",
    period: item?.period ?? "Sin período",
    totalRecords: Number(item?.totalRecords ?? item?.total_records ?? 0),
    totalAssignments: Number(item?.totalAssignments ?? item?.total_assignments ?? 0),
    detectedCount: Number(item?.detectedCount ?? item?.detected_count ?? 0),
    convertedCount: Number(item?.convertedCount ?? item?.converted_count ?? 0),
    unconvertedCount: Number(item?.unconvertedCount ?? item?.unconverted_count ?? 0),
    clientCount: Number(item?.clientCount ?? item?.client_count ?? 0),
    projectCount: Number(item?.projectCount ?? item?.project_count ?? 0),
    conversionRate,
    conversionRateLabel: formatPercent(conversionRate),
    dateLabel: rawDate ? formatDateLabel(rawDate) : "Sin fecha",
    dateInput: toInputDate(rawDate),
    dateTimestamp: parsedDate?.getTime?.() ?? 0,
    lastDateLabel: rawDate ? formatDateLabel(rawDate) : "Sin fecha",
    lastDateInput: toInputDate(rawDate),
    lastDateTimestamp: parsedDate?.getTime?.() ?? 0,
    client: item?.client ?? "",
    project: item?.project ?? "",
    responsible: "",
    statusKey,
    statusLabel: statusLabel ?? statusKey,
    status: getTopicStatusPresentation(statusKey, statusLabel),
  };
};

const normalizeReviewObservationRecord = (item, index) => {
  const createdAt = item?.createdAt ?? item?.created_at ?? null;
  const resolvedAt = item?.resolvedAt ?? item?.resolved_at ?? null;
  const parsedCreatedAt = parseFlexibleDate(createdAt);
  const parsedResolvedAt = parseFlexibleDate(resolvedAt);
  const statusKey = item?.status ?? "new";
  const status = getReviewObservationStatusPresentation(statusKey);
  const resolutionType = item?.resolutionType ?? item?.resolution_type ?? "none";

  return {
    id: item?.id ?? `review-observation-${index + 1}`,
    observationId: Number(item?.observationId ?? item?.observation_id ?? index + 1),
    rawId: item?.recordId ?? item?.record_id ?? index + 1,
    recordVersionId: item?.recordVersionId ?? item?.record_version_id ?? null,
    versionNum: Number(item?.versionNum ?? item?.version_num ?? 0),
    title: item?.title ?? "Minuta sin título",
    client: item?.client ?? "Sin cliente",
    project: item?.project ?? "Sin proyecto",
    responsible: item?.authorName ?? item?.author_name ?? item?.authorEmail ?? item?.author_email ?? "Invitado",
    authorName: item?.authorName ?? item?.author_name ?? "",
    authorEmail: item?.authorEmail ?? item?.author_email ?? "",
    body: item?.body ?? "",
    editorComment: item?.editorComment ?? item?.editor_comment ?? "",
    resolutionType,
    resolutionTypeLabel: getResolutionTypeLabel(resolutionType),
    status,
    statusKey: status.key,
    statusWeight: status.sortWeight,
    dateLabel: createdAt ? formatDateTimeLabel(createdAt) : "Sin fecha",
    dateInput: toInputDate(createdAt),
    dateTimestamp: parsedCreatedAt?.getTime?.() ?? 0,
    resolvedAtLabel: resolvedAt ? formatDateTimeLabel(resolvedAt) : "Sin resolver",
    resolvedAtInput: toInputDate(resolvedAt),
    resolvedAtTimestamp: parsedResolvedAt?.getTime?.() ?? 0,
  };
};

const normalizeEmailDeliveryRecord = (item, index) => {
  const rawDate = item?.date ?? item?.sentAt ?? item?.sent_at ?? item?.failedAt ?? item?.failed_at ?? item?.queuedAt ?? item?.queued_at ?? null;
  const queuedAt = item?.queuedAt ?? item?.queued_at ?? null;
  const sentAt = item?.sentAt ?? item?.sent_at ?? null;
  const failedAt = item?.failedAt ?? item?.failed_at ?? null;
  const parsedDate = parseFlexibleDate(rawDate);
  const parsedQueuedAt = parseFlexibleDate(queuedAt);
  const parsedSentAt = parseFlexibleDate(sentAt);
  const parsedFailedAt = parseFlexibleDate(failedAt);
  const status = getEmailDeliveryStatusPresentation(item?.status);
  const emailKind = item?.emailKind ?? item?.email_kind ?? "system";
  const to = Array.isArray(item?.to) ? item.to : [];
  const cc = Array.isArray(item?.cc) ? item.cc : [];

  return {
    id: item?.id ?? `email-delivery-${index + 1}`,
    rawId: item?.recordId ?? item?.record_id ?? item?.jobId ?? item?.job_id ?? index + 1,
    jobId: item?.jobId ?? item?.job_id ?? "",
    title: item?.subject ?? "Correo sin asunto",
    subject: item?.subject ?? "Correo sin asunto",
    minuteTitle: item?.minuteTitle ?? item?.minute_title ?? "Sin minuta asociada",
    client: item?.client ?? "Sin cliente",
    project: item?.project ?? "Sin proyecto",
    responsible: item?.actorUserId ?? item?.actor_user_id ?? "",
    status,
    statusKey: status.key,
    statusWeight: status.sortWeight,
    emailKind,
    emailKindLabel: getEmailKindLabel(emailKind),
    notificationType: item?.notificationType ?? item?.notification_type ?? "",
    templateId: item?.templateId ?? item?.template_id ?? "",
    recipientCount: Number(item?.recipientCount ?? item?.recipient_count ?? 0),
    attachmentCount: Number(item?.attachmentCount ?? item?.attachment_count ?? 0),
    inlineAssetCount: Number(item?.inlineAssetCount ?? item?.inline_asset_count ?? 0),
    to,
    cc,
    bcc: Array.isArray(item?.bcc) ? item.bcc : [],
    recipientsLabel: [...to, ...cc].slice(0, 3).join(", ") || "Sin destinatarios",
    attempt: Number(item?.attempt ?? 1),
    errorMessage: item?.errorMessage ?? item?.error_message ?? "",
    dateLabel: rawDate ? formatDateTimeLabel(rawDate) : "Sin fecha",
    dateInput: toInputDate(rawDate),
    dateTimestamp: parsedDate?.getTime?.() ?? 0,
    queuedAtLabel: queuedAt ? formatDateTimeLabel(queuedAt) : "Sin registro",
    queuedAtTimestamp: parsedQueuedAt?.getTime?.() ?? 0,
    sentAtLabel: sentAt ? formatDateTimeLabel(sentAt) : "Sin envío",
    sentAtTimestamp: parsedSentAt?.getTime?.() ?? 0,
    failedAtLabel: failedAt ? formatDateTimeLabel(failedAt) : "Sin fallo",
    failedAtTimestamp: parsedFailedAt?.getTime?.() ?? 0,
  };
};

const normalizeCommitmentItemRecord = (item, index) => {
  const rawDate = item?.date ?? null;
  const dueDate = item?.dueDate ?? item?.due_date ?? null;
  const parsedDate = parseFlexibleDate(rawDate);
  const parsedDueDate = parseFlexibleDate(dueDate);
  const itemType = item?.itemType ?? item?.item_type ?? "agreement";
  const status = getCommitmentStatusPresentation(item?.status);
  const priority = getRequirementPriorityPresentation(item?.priority);
  const isAgreement = itemType === "agreement";
  const isExpired = Boolean(
    isAgreement &&
    parsedDueDate &&
    parsedDueDate.getTime() < Date.now() &&
    !isClosedCommitmentStatus(status.key)
  );

  return {
    id: item?.id ?? `commitment-row-${index + 1}`,
    rawId: item?.recordId ?? item?.record_id ?? index + 1,
    recordVersionId: item?.recordVersionId ?? item?.record_version_id ?? null,
    itemType,
    itemTypeLabel: isAgreement ? "Acuerdo" : "Requerimiento",
    itemCode: item?.itemCode ?? item?.item_code ?? (isAgreement ? "AGR" : "REQ"),
    title: item?.title ?? item?.minuteTitle ?? item?.minute_title ?? "Sin título",
    body: item?.body ?? "",
    responsible: item?.responsible ?? "Sin responsable",
    status,
    statusKey: status.key,
    statusWeight: status.sortWeight,
    priority: priority.key,
    priorityLabel: isAgreement ? "—" : priority.label,
    priorityWeight: isAgreement ? 99 : priority.weight,
    dueDateLabel: dueDate ? formatDateLabel(dueDate) : "Sin fecha",
    dueDateInput: toInputDate(dueDate),
    dueDateTimestamp: parsedDueDate?.getTime?.() ?? 0,
    isExpired,
    entity: item?.entity ?? "",
    minuteTitle: item?.minuteTitle ?? item?.minute_title ?? "Minuta sin título",
    client: item?.client ?? "Sin cliente",
    project: item?.project ?? "Sin proyecto",
    dateLabel: rawDate ? formatDateLabel(rawDate) : "Sin fecha",
    dateInput: toInputDate(rawDate),
    dateTimestamp: parsedDate?.getTime?.() ?? 0,
  };
};

const buildSystemAlertsFromSnapshots = ({ queueSnapshot, maintenanceStatus }) => {
  const rows = [];
  const refreshedAt = queueSnapshot?.refreshedAt ?? queueSnapshot?.refreshed_at ?? new Date().toISOString();

  (Array.isArray(queueSnapshot?.queues) ? queueSnapshot.queues : []).forEach((queue, index) => {
    const normalized = normalizeQueueStatusRecord(queue, index, refreshedAt);
    if (!normalized.alertActive && !normalized.isWarning) return;
    rows.push({
      ...normalized,
      id: `alert-${normalized.queue}`,
      alertType: "Cola",
      title: `${normalized.label} en alerta`,
      message: `${normalized.queue} registra ${formatNumber(normalized.size)} job(s) con umbral ${formatNumber(normalized.warningThreshold)}.`,
    });
  });

  [
    ["session_cleanup", maintenanceStatus?.sessionCleanup ?? maintenanceStatus?.session_cleanup],
    ["temp_cleanup", maintenanceStatus?.tempCleanup ?? maintenanceStatus?.temp_cleanup],
  ].forEach(([scope, runtime], index) => {
    const normalized = normalizeMaintenanceRuntimeRecord(scope, runtime ?? {}, index);
    if (!["error", "warning"].includes(normalized.statusKey)) return;
    rows.push({
      ...normalized,
      id: `alert-${scope}`,
      alertType: "Rutina",
      title: `${normalized.label}: ${normalized.statusLabel}`,
      message: normalized.message,
    });
  });

  return rows;
};

const buildSummaryCard = (label, value, helper, icon, tone) => ({
  label,
  value: formatNumber(value),
  helper,
  icon,
  tone,
});

const buildChartOptionBase = () => ({
  animationDuration: 450,
  textStyle: {
    color: ECHART_TEXT,
    fontFamily: "inherit",
  },
  tooltip: {
    backgroundColor: ECHART_TOOLTIP_BG,
    borderColor: ECHART_BORDER,
    textStyle: { color: ECHART_TITLE },
    extraCssText:
      "box-shadow: 0 18px 42px rgba(15,23,42,0.28); border-radius: 14px;",
  },
});

const buildTrendChartOption = (points = []) => ({
  ...buildChartOptionBase(),
  color: [CHART_THEME.bar, CHART_THEME.line],
  grid: { left: 16, right: 16, top: 20, bottom: 20, containLabel: true },
  tooltip: {
    ...buildChartOptionBase().tooltip,
    trigger: "axis",
  },
  legend: {
    top: 0,
    textStyle: { color: ECHART_TEXT },
  },
  xAxis: {
    type: "category",
    data: points.map((point) => point.date),
    axisLabel: {
      color: ECHART_TEXT,
      formatter: (value) => {
        const [year, month, day] = String(value).split("-");
        return year && month && day ? `${day}/${month}` : value;
      },
    },
    axisLine: { lineStyle: { color: "rgba(148,163,184,0.18)" } },
    axisTick: { show: false },
  },
  yAxis: {
    type: "value",
    axisLabel: { color: ECHART_TEXT },
    splitLine: {
      lineStyle: { color: CHART_THEME.grid, type: "dashed" },
    },
  },
  series: [
    {
      name: "Minutas",
      type: "bar",
      barWidth: 22,
      data: points.map((point) => point.total),
      itemStyle: {
        color: CHART_THEME.bar,
        borderRadius: [8, 8, 0, 0],
      },
    },
    {
      name: "Completadas",
      type: "line",
      smooth: true,
      symbol: "circle",
      symbolSize: 7,
      data: points.map((point) => point.completed),
      lineStyle: { width: 3, color: CHART_THEME.line },
      itemStyle: { color: CHART_THEME.line },
    },
  ],
});

const buildStatusChartOption = (items = []) => {
  const total = items.reduce((sum, item) => sum + Number(item.count ?? 0), 0);

  return {
    ...buildChartOptionBase(),
    color: CHART_THEME.donut,
    tooltip: {
      ...buildChartOptionBase().tooltip,
      trigger: "item",
      formatter: ({ name, value }) =>
        `${name}<br/>${formatNumber(value)} registros (${formatPercent(
          total > 0 ? (value / total) * 100 : 0
        )})`,
    },
    legend: {
      bottom: 0,
      left: "center",
      textStyle: { color: ECHART_TEXT },
    },
    series: [
      {
        name: "Estados",
        type: "pie",
        radius: ["54%", "76%"],
        center: ["50%", "44%"],
        avoidLabelOverlap: true,
        itemStyle: {
          borderColor: "#0f172a",
          borderWidth: 2,
        },
        label: {
          color: ECHART_TITLE,
          formatter: ({ percent }) => `${Math.round(percent)}%`,
        },
        labelLine: {
          lineStyle: { color: ECHART_TEXT },
        },
        data: items.map((item) => ({
          name: item.label,
          value: item.count,
        })),
      },
    ],
  };
};

const buildHorizontalBarChartOption = (items = [], seriesName = "Registros") => ({
  ...buildChartOptionBase(),
  color: [CHART_THEME.bar],
  grid: { left: 18, right: 20, top: 12, bottom: 12, containLabel: true },
  tooltip: {
    ...buildChartOptionBase().tooltip,
    trigger: "axis",
    axisPointer: { type: "shadow" },
  },
  xAxis: {
    type: "value",
    axisLabel: { color: ECHART_TEXT },
    splitLine: {
      lineStyle: { color: CHART_THEME.grid, type: "dashed" },
    },
  },
  yAxis: {
    type: "category",
    data: items.map((item) => item.label),
    inverse: true,
    axisLabel: {
      color: ECHART_TEXT,
      width: 160,
      overflow: "truncate",
    },
    axisLine: { show: false },
    axisTick: { show: false },
  },
  series: [
    {
      name: seriesName,
      type: "bar",
      data: items.map((item) => item.count),
      barWidth: 18,
      label: {
        show: true,
        position: "right",
        color: ECHART_TITLE,
      },
      itemStyle: {
        color: CHART_THEME.bar,
        borderRadius: [0, 8, 8, 0],
      },
    },
  ],
});

const resolveChartInstance = (chartSource) => {
  const candidate = chartSource?.current ?? chartSource;
  if (!candidate) return null;

  if (typeof candidate.getDataURL === "function") {
    return candidate;
  }

  if (typeof candidate.getEchartsInstance === "function") {
    try {
      return candidate.getEchartsInstance();
    } catch {
      return null;
    }
  }

  return null;
};

const exportChartInstanceToPng = (chartSource, backgroundColor = CHART_EXPORT_BG) => {
  const chartInstance = resolveChartInstance(chartSource);
  if (!chartInstance || typeof chartInstance.getDataURL !== "function") return null;

  try {
    return chartInstance.getDataURL({
      type: "png",
      pixelRatio: 2,
      backgroundColor,
    });
  } catch {
    return null;
  }
};

const ChartPanel = ({ title, subtitle, children, footer }) => (
  <div className="rounded-[26px] border border-gray-200/80 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <div className="mb-4">
      <h3 className="text-base font-semibold text-gray-900 dark:text-white">
        {title}
      </h3>
      {subtitle ? (
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          {subtitle}
        </p>
      ) : null}
    </div>
    {children}
    {footer ? (
      <div className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
        {footer}
      </div>
    ) : null}
  </div>
);

const ReportTrendChart = ({ points = [], chartRef }) => {
  if (!points.length) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No hay datos suficientes para graficar la evolución del período.
      </p>
    );
  }

  return (
    <AsyncEChart
      ref={chartRef}
      option={buildTrendChartOption(points)}
      style={{ height: 280, width: "100%" }}
    />
  );
};

const ReportStatusChart = ({ items = [], chartRef }) => {
  if (!items.length) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No hay datos suficientes para construir la distribución por estado.
      </p>
    );
  }

  return (
    <AsyncEChart
      ref={chartRef}
      option={buildStatusChartOption(items)}
      style={{ height: 280, width: "100%" }}
    />
  );
};

const ReportBarChart = ({ items = [], chartRef, seriesName }) => {
  if (!items.length) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No hay datos suficientes para construir la comparación visual.
      </p>
    );
  }

  return (
    <AsyncEChart
      ref={chartRef}
      option={buildHorizontalBarChartOption(items, seriesName)}
      style={{ height: 280, width: "100%" }}
    />
  );
};

const renderChartByType = (chart, chartRef) => {
  if (chart.type === "trend") {
    return <ReportTrendChart points={chart.data} chartRef={chartRef} />;
  }

  if (chart.type === "status") {
    return <ReportStatusChart items={chart.data} chartRef={chartRef} />;
  }

  return (
    <ReportBarChart
      items={chart.data}
      chartRef={chartRef}
      seriesName={chart.seriesName}
    />
  );
};

const downloadTextFile = (filename, content, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
};

const getExportableColumns = (columns = []) =>
  columns.flatMap((column) => {
    if (Array.isArray(column.exportColumns) && column.exportColumns.length > 0) {
      return column.exportColumns;
    }
    return [column];
  });

const exportRowsToCsv = (filename, columns, rows) => {
  const exportableColumns = getExportableColumns(columns);
  const header = exportableColumns.map((column) => column.label);
  const lines = rows.map((row) =>
    exportableColumns.map((column) => {
      const rawValue = column.exportValue ? column.exportValue(row) : row?.[column.key];
      const cellValue = String(rawValue ?? "");
      return `"${cellValue.replace(/\"/g, "\"\"")}"`;
    })
  );

  const csv = [header, ...lines].map((line) => line.join(";")).join("\n");
  downloadTextFile(filename, `\ufeff${csv}`, "text/csv;charset=utf-8;");
};

const buildActivityDistribution = (rows = [], fieldName, limit = 6) => {
  const grouped = new Map();

  rows.forEach((row) => {
    const label = String(row?.[fieldName] ?? "").trim();
    if (!label) return;
    grouped.set(label, (grouped.get(label) ?? 0) + 1);
  });

  return [...grouped.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return compareByLabel(left.label, right.label);
    })
    .slice(0, limit);
};

const buildDailyTrend = (rows = []) => {
  const grouped = new Map();

  rows.forEach((row) => {
    const key = row.dateInput || row.dateLabel;
    if (!key) return;

    const current = grouped.get(key) ?? {
      date: key,
      total: 0,
      completed: 0,
    };

    current.total += 1;
    if (row.status.key === "completed") current.completed += 1;
    grouped.set(key, current);
  });

  return [...grouped.values()].sort((left, right) =>
    compareByLabel(left.date, right.date)
  );
};

const buildStatusDistribution = (rows = [], limit = null) => {
  const grouped = new Map();

  rows.forEach((row) => {
    const current = grouped.get(row.status.key) ?? {
      key: row.status.key,
      label: row.status.label,
      count: 0,
    };
    current.count += 1;
    grouped.set(row.status.key, current);
  });

  const ordered = [...grouped.values()].sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return compareByLabel(left.label, right.label);
  });

  return limit ? ordered.slice(0, limit) : ordered;
};

const buildReprocessReasonDistribution = (rows = []) => {
  const grouped = new Map();

  rows.forEach((row) => {
    const label = String(row.reprocessReasonLabel ?? "").trim() || "Señal operativa";
    grouped.set(label, (grouped.get(label) ?? 0) + 1);
  });

  return [...grouped.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return compareByLabel(left.label, right.label);
    });
};

const buildCycleDurationDistribution = (rows = [], limit = 8) =>
  [...rows]
    .filter((row) => Number(row.totalCycleDurationMs ?? 0) > 0)
    .sort((left, right) => (right.totalCycleDurationMs ?? 0) - (left.totalCycleDurationMs ?? 0))
    .slice(0, limit)
    .map((row) => ({
      label: row.title,
      count: Number(((row.totalCycleDurationMs ?? 0) / 3600000).toFixed(1)),
    }));

const buildCycleStageAverageDistribution = (rows = []) => {
  if (!rows.length) return [];

  const processingTotal = rows.reduce(
    (sum, row) => sum + Number(row.processingDurationMs ?? 0),
    0
  );
  const editingTotal = rows.reduce(
    (sum, row) => sum + Number(row.editingDurationMs ?? 0),
    0
  );
  const reviewTotal = rows.reduce(
    (sum, row) => sum + Number(row.reviewDurationMs ?? 0),
    0
  );

  const divisor = rows.length || 1;
  return [
    { label: "IA", count: Number(((processingTotal / divisor) / 3600000).toFixed(1)) },
    { label: "Edición", count: Number(((editingTotal / divisor) / 3600000).toFixed(1)) },
    { label: "Revisión", count: Number(((reviewTotal / divisor) / 3600000).toFixed(1)) },
  ];
};

const buildAggregateByField = (rows = [], fieldName) => {
  const grouped = new Map();

  rows.forEach((row) => {
    const label = String(row?.[fieldName] ?? "").trim() || "Sin dato";
    const current = grouped.get(label) ?? {
      id: `${fieldName}-${normalizeText(label) || "sin-dato"}`,
      label,
      [fieldName]: label,
      client: fieldName === "client" ? label : row.client,
      project: fieldName === "project" ? label : row.project,
      responsible: fieldName === "responsible" ? label : row.responsible,
      totalRecords: 0,
      completedRecords: 0,
      pendingRecords: 0,
      reviewRecords: 0,
      backlogRecords: 0,
      clientSet: new Set(),
      projectSet: new Set(),
      responsibleSet: new Set(),
      lastDateTimestamp: 0,
      lastDateInput: "",
      lastDateLabel: "Sin fecha",
    };

    current.totalRecords += 1;
    if (row.status.key === "completed") current.completedRecords += 1;
    if (row.status.key === "pending") current.pendingRecords += 1;
    if (row.status.key === "preview") current.reviewRecords += 1;
    if (isBacklogStatus(row.status.key)) current.backlogRecords += 1;

    if (row.client) current.clientSet.add(row.client);
    if (row.project) current.projectSet.add(row.project);
    if (row.responsible) current.responsibleSet.add(row.responsible);

    if (row.dateTimestamp > current.lastDateTimestamp) {
      current.lastDateTimestamp = row.dateTimestamp;
      current.lastDateInput = row.dateInput;
      current.lastDateLabel = row.dateLabel;
      if (fieldName !== "project") {
        current.project = row.project;
      }
      if (fieldName !== "client") {
        current.client = row.client;
      }
      if (fieldName !== "responsible") {
        current.responsible = row.responsible;
      }
    }

    grouped.set(label, current);
  });

  return [...grouped.values()]
    .map((item) => ({
      ...item,
      clientCount: item.clientSet.size,
      projectCount: item.projectSet.size,
      responsibleCount: item.responsibleSet.size,
    }))
    .map(({ clientSet, projectSet, responsibleSet, ...row }) => row)
    .sort((left, right) => {
      if (right.totalRecords !== left.totalRecords) {
        return right.totalRecords - left.totalRecords;
      }
      return compareByLabel(left.label, right.label);
    });
};

const createActivityAggregate = (label, extra = {}) => ({
  id: extra.id ?? `activity-${normalizeText(label) || "sin-dato"}`,
  label,
  totalRecords: 0,
  completedRecords: 0,
  pendingRecords: 0,
  reviewRecords: 0,
  backlogRecords: 0,
  totalTokens: 0,
  clientSet: new Set(),
  projectSet: new Set(),
  responsibleSet: new Set(),
  lastDateTimestamp: 0,
  lastDateInput: "",
  lastDateLabel: "Sin fecha",
  ...extra,
});

const addMinuteActivityToAggregate = (aggregate, row) => {
  aggregate.totalRecords += 1;
  if (row.status.key === "completed") aggregate.completedRecords += 1;
  if (row.status.key === "pending") aggregate.pendingRecords += 1;
  if (row.status.key === "preview") aggregate.reviewRecords += 1;
  if (isBacklogStatus(row.status.key)) aggregate.backlogRecords += 1;
  aggregate.totalTokens += Number(row.totalTokens ?? 0);

  if (row.client) aggregate.clientSet.add(row.client);
  if (row.project) aggregate.projectSet.add(row.project);
  if (row.responsible) aggregate.responsibleSet.add(row.responsible);

  if (row.dateTimestamp > aggregate.lastDateTimestamp) {
    aggregate.lastDateTimestamp = row.dateTimestamp;
    aggregate.lastDateInput = row.dateInput;
    aggregate.lastDateLabel = row.dateLabel;
  }
};

const finalizeActivityAggregate = (aggregate, referenceTimestamp = Date.now()) => {
  const projectCount = aggregate.projectSet?.size ?? aggregate.projectCount ?? 0;
  const clientCount = aggregate.clientSet?.size ?? aggregate.clientCount ?? 0;
  const responsibleCount = aggregate.responsibleSet?.size ?? aggregate.responsibleCount ?? 0;
  const daysWithoutActivity = buildDaysWithoutActivity(
    aggregate.lastDateTimestamp,
    referenceTimestamp
  );
  const documentLoadScore =
    aggregate.totalRecords +
    aggregate.backlogRecords +
    aggregate.reviewRecords * 2 +
    Math.ceil(Number(aggregate.totalTokens ?? 0) / 10000);

  const { clientSet, projectSet, responsibleSet, ...row } = aggregate;
  return {
    ...row,
    projectCount,
    clientCount,
    responsibleCount,
    daysWithoutActivity,
    daysWithoutActivityLabel:
      daysWithoutActivity == null ? "Sin actividad registrada" : `${formatNumber(daysWithoutActivity)} días`,
    documentLoadScore,
  };
};

const matchesTextFilter = (value, filterValue) => {
  const normalizedFilter = normalizeText(filterValue);
  if (!normalizedFilter) return true;
  return normalizeText(value) === normalizedFilter;
};

const getReferenceTimestamp = (filters = {}) => {
  const parsedDateTo = parseFlexibleDate(filters.dateTo);
  if (!parsedDateTo) return Date.now();
  parsedDateTo.setHours(23, 59, 59, 999);
  return parsedDateTo.getTime();
};

const buildActivityMap = (rows = [], fieldName) => {
  const grouped = new Map();

  rows.forEach((row) => {
    const label = String(row?.[fieldName] ?? "").trim() || "Sin dato";
    const current = grouped.get(label) ?? createActivityAggregate(label, {
      id: `${fieldName}-${normalizeText(label) || "sin-dato"}`,
      [fieldName]: label,
      client: fieldName === "client" ? label : row.client,
      project: fieldName === "project" ? label : row.project,
    });

    addMinuteActivityToAggregate(current, row);
    if (fieldName !== "client") current.client = row.client;
    if (fieldName !== "project") current.project = row.project;
    grouped.set(label, current);
  });

  return grouped;
};

const buildClientContextRows = ({
  clientRows = [],
  minuteRows = [],
  historyRows = minuteRows,
  filters = {},
  onlyInactive = false,
  onlyWithLoad = false,
}) => {
  const referenceTimestamp = getReferenceTimestamp(filters);
  const activityMap = buildActivityMap(minuteRows, "client");
  const historyMap = buildActivityMap(historyRows, "client");
  const baseClientRows = clientRows.length
    ? clientRows
    : [...new Set([...activityMap.keys(), ...historyMap.keys()])].map((client) => ({
        id: `client-derived-${normalizeText(client) || "sin-dato"}`,
        client,
        label: client,
        industry: "Sin dato",
        statusLabel: "Activo",
        priorityLabel: "Sin dato",
        isActive: true,
        isConfidential: false,
      }));

  return baseClientRows
    .filter((client) => matchesTextFilter(client.client, filters.client))
    .map((client) => {
      const aggregate = activityMap.get(client.client) ?? createActivityAggregate(client.client, {
        id: client.id,
        client: client.client,
        label: client.client,
      });
      const historyAggregate = historyMap.get(client.client);
      const lastDateTimestamp = historyAggregate?.lastDateTimestamp ?? aggregate.lastDateTimestamp;

      return finalizeActivityAggregate(
        {
          ...aggregate,
          id: client.id,
          client: client.client,
          label: client.client,
          industry: client.industry,
          statusLabel: client.statusLabel,
          priorityLabel: client.priorityLabel,
          isActive: client.isActive,
          isConfidential: client.isConfidential,
          createdAtLabel: client.createdAtLabel,
          createdAtTimestamp: client.createdAtTimestamp,
          lastDateTimestamp,
          lastDateInput: historyAggregate?.lastDateInput ?? aggregate.lastDateInput,
          lastDateLabel: historyAggregate?.lastDateLabel ?? aggregate.lastDateLabel,
        },
        referenceTimestamp
      );
    })
    .filter((row) => (onlyInactive ? row.totalRecords === 0 : true))
    .filter((row) => (onlyWithLoad ? row.totalRecords > 0 : true));
};

const buildProjectContextRows = ({
  projectRows = [],
  minuteRows = [],
  historyRows = minuteRows,
  filters = {},
  onlyInactive = false,
  onlyWithLoad = false,
}) => {
  const referenceTimestamp = getReferenceTimestamp(filters);
  const activityMap = buildActivityMap(minuteRows, "project");
  const historyMap = buildActivityMap(historyRows, "project");
  const baseProjectRows = projectRows.length
    ? projectRows
    : [...new Set([...activityMap.keys(), ...historyMap.keys()])].map((project) => ({
        id: `project-derived-${normalizeText(project) || "sin-dato"}`,
        project,
        label: project,
        client: activityMap.get(project)?.client ?? historyMap.get(project)?.client ?? "Sin cliente",
        code: "Sin código",
        statusLabel: "Activo",
        isActive: true,
        isConfidential: false,
        autoSendOnPreview: false,
        autoSendOnCompleted: false,
        autoSendCount: 0,
        automationLabel: "Sin automatización",
      }));

  return baseProjectRows
    .filter((project) => matchesTextFilter(project.client, filters.client))
    .filter((project) => matchesTextFilter(project.project, filters.project))
    .map((project) => {
      const aggregate = activityMap.get(project.project) ?? createActivityAggregate(project.project, {
        id: project.id,
        project: project.project,
        label: project.project,
        client: project.client,
      });
      const historyAggregate = historyMap.get(project.project);
      const lastDateTimestamp = historyAggregate?.lastDateTimestamp ?? aggregate.lastDateTimestamp;

      return finalizeActivityAggregate(
        {
          ...aggregate,
          id: project.id,
          project: project.project,
          label: project.project,
          client: project.client,
          code: project.code,
          statusLabel: project.statusLabel,
          isActive: project.isActive,
          isConfidential: project.isConfidential,
          autoSendOnPreview: project.autoSendOnPreview,
          autoSendOnCompleted: project.autoSendOnCompleted,
          autoSendCount: project.autoSendCount,
          automationLabel: project.automationLabel,
          createdAtLabel: project.createdAtLabel,
          createdAtTimestamp: project.createdAtTimestamp,
          lastDateTimestamp,
          lastDateInput: historyAggregate?.lastDateInput ?? aggregate.lastDateInput,
          lastDateLabel: historyAggregate?.lastDateLabel ?? aggregate.lastDateLabel,
        },
        referenceTimestamp
      );
    })
    .filter((row) => (onlyInactive ? row.totalRecords === 0 : true))
    .filter((row) => (onlyWithLoad ? row.totalRecords > 0 : true));
};

const buildConfidentialDistribution = (rows = []) => [
  {
    label: "Confidenciales",
    count: rows.filter((row) => row.isConfidential).length,
  },
  {
    label: "No confidenciales",
    count: rows.filter((row) => !row.isConfidential).length,
  },
].filter((item) => item.count > 0);

const buildCatalogStatusDistribution = (rows = []) => {
  const grouped = new Map();
  rows.forEach((row) => {
    const label = row.statusLabel || (row.isActive ? "Activo" : "Inactivo");
    grouped.set(label, (grouped.get(label) ?? 0) + 1);
  });
  return [...grouped.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return compareByLabel(left.label, right.label);
    });
};

const buildReportRowDistribution = (
  rows = [],
  labelField,
  countField = "totalRecords",
  limit = 6,
  { includeZero = false } = {}
) =>
  [...rows]
    .filter((row) => includeZero || Number(row?.[countField] ?? 0) > 0)
    .map((row) => ({
      label: row?.[labelField] ?? row?.label ?? "Sin dato",
      count: Number(row?.[countField] ?? 0),
    }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return compareByLabel(left.label, right.label);
    })
    .slice(0, limit);

const buildGroupedSumDistribution = (
  rows = [],
  labelField,
  countField = "totalRecords",
  limit = 8
) => {
  const grouped = new Map();

  rows.forEach((row) => {
    const label = row?.[labelField] ?? row?.label ?? "Sin dato";
    grouped.set(label, (grouped.get(label) ?? 0) + Number(row?.[countField] ?? 0));
  });

  return [...grouped.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return compareByLabel(left.label, right.label);
    })
    .slice(0, limit);
};

const buildStatusRows = (rows = []) => {
  const grouped = new Map();

  rows.forEach((row) => {
    const key = row.status.key;
    const current = grouped.get(key) ?? {
      id: `status-${key}`,
      label: row.status.label,
      statusKey: key,
      statusWeight: row.status.sortWeight,
      status: row.status,
      totalRecords: 0,
      reviewRecords: 0,
      clientSet: new Set(),
      projectSet: new Set(),
      lastDateTimestamp: 0,
      lastDateInput: "",
      lastDateLabel: "Sin fecha",
    };

    current.totalRecords += 1;
    if (row.status.key === "preview") current.reviewRecords += 1;
    if (row.client) current.clientSet.add(row.client);
    if (row.project) current.projectSet.add(row.project);

    if (row.dateTimestamp > current.lastDateTimestamp) {
      current.lastDateTimestamp = row.dateTimestamp;
      current.lastDateInput = row.dateInput;
      current.lastDateLabel = row.dateLabel;
    }

    grouped.set(key, current);
  });

  const totalRows = rows.length || 1;

  return [...grouped.values()]
    .map((item) => ({
      ...item,
      clientCount: item.clientSet.size,
      projectCount: item.projectSet.size,
      percentageRaw: item.totalRecords > 0 ? (item.totalRecords / totalRows) * 100 : 0,
      percentageLabel: formatPercent(
        item.totalRecords > 0 ? (item.totalRecords / totalRows) * 100 : 0
      ),
    }))
    .map(({ clientSet, projectSet, ...row }) => row)
    .sort((left, right) => {
      if (right.totalRecords !== left.totalRecords) {
        return right.totalRecords - left.totalRecords;
      }
      return left.statusWeight - right.statusWeight;
    });
};

const createCommitmentAggregate = (label, extra = {}) => ({
  id: `commitment-aggregate-${normalizeText(label) || "sin-dato"}`,
  label,
  totalRecords: 0,
  agreementCount: 0,
  requirementCount: 0,
  expiredCount: 0,
  pendingRecords: 0,
  completedRecords: 0,
  clientSet: new Set(),
  projectSet: new Set(),
  responsibleSet: new Set(),
  lastDateTimestamp: 0,
  lastDateLabel: "Sin fecha",
  lastDateInput: "",
  ...extra,
});

const addCommitmentToAggregate = (aggregate, row) => {
  aggregate.totalRecords += 1;
  if (row.itemType === "agreement") aggregate.agreementCount += 1;
  if (row.itemType === "requirement") aggregate.requirementCount += 1;
  if (row.isExpired) aggregate.expiredCount += 1;
  if (!isClosedCommitmentStatus(row.statusKey)) aggregate.pendingRecords += 1;
  if (isClosedCommitmentStatus(row.statusKey)) aggregate.completedRecords += 1;
  if (row.client) aggregate.clientSet.add(row.client);
  if (row.project) aggregate.projectSet.add(row.project);
  if (row.responsible) aggregate.responsibleSet.add(row.responsible);
  if ((row.dateTimestamp ?? 0) > (aggregate.lastDateTimestamp ?? 0)) {
    aggregate.lastDateTimestamp = row.dateTimestamp;
    aggregate.lastDateLabel = row.dateLabel;
    aggregate.lastDateInput = row.dateInput;
  }
};

const finalizeCommitmentAggregate = (aggregate) => {
  const { clientSet, projectSet, responsibleSet, ...row } = aggregate;
  return {
    ...row,
    clientCount: clientSet.size,
    projectCount: projectSet.size,
    responsibleCount: responsibleSet.size,
  };
};

const buildCommitmentAggregateRows = (rows = [], fieldName, labelFallback = "Sin dato") => {
  const grouped = new Map();
  rows.forEach((row) => {
    const label = String(row?.[fieldName] ?? "").trim() || labelFallback;
    const current = grouped.get(label) ?? createCommitmentAggregate(label, {
      [fieldName]: label,
    });
    addCommitmentToAggregate(current, row);
    grouped.set(label, current);
  });
  return [...grouped.values()].map(finalizeCommitmentAggregate);
};

const buildTokenBreakdownColumn = () => ({
  key: "tokenBreakdown",
  label: "Tokens",
  sortable: true,
  sortKey: "totalTokens",
  headerClassName: "min-w-[220px]",
  exportColumns: [
    {
      key: "inputTokens",
      label: "Tokens entrada",
      exportValue: (row) => formatNumber(row.inputTokens ?? 0),
    },
    {
      key: "outputTokens",
      label: "Tokens salida",
      exportValue: (row) => formatNumber(row.outputTokens ?? 0),
    },
    {
      key: "totalTokens",
      label: "Tokens total",
      exportValue: (row) => formatNumber(row.totalTokens ?? 0),
    },
  ],
  render: (row) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span>Entrada</span>
        <span className="font-medium text-gray-700 dark:text-gray-200">
          {formatNumber(row.inputTokens ?? 0)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span>Salida</span>
        <span className="font-medium text-gray-700 dark:text-gray-200">
          {formatNumber(row.outputTokens ?? 0)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-1 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-100">
        <span>Total</span>
        <span>{formatNumber(row.totalTokens ?? 0)}</span>
      </div>
    </div>
  ),
});

const buildDailyProductionRows = (rows = []) => {
  const grouped = new Map();

  rows.forEach((row) => {
    const key = row.dateInput || row.dateLabel;
    if (!key) return;

    const current = grouped.get(key) ?? {
      id: `production-${key}`,
      dateLabel: row.dateLabel,
      dateInput: row.dateInput,
      dateTimestamp: row.dateTimestamp,
      totalRecords: 0,
      completedRecords: 0,
      pendingRecords: 0,
      reviewRecords: 0,
      backlogRecords: 0,
    };

    current.totalRecords += 1;
    if (row.status.key === "completed") current.completedRecords += 1;
    if (row.status.key === "pending") current.pendingRecords += 1;
    if (row.status.key === "preview") current.reviewRecords += 1;
    if (isBacklogStatus(row.status.key)) current.backlogRecords += 1;

    grouped.set(key, current);
  });

  return [...grouped.values()].sort(
    (left, right) => right.dateTimestamp - left.dateTimestamp
  );
};

const buildReportRangeLabel = (rows = [], filters = {}) => {
  if (filters.dateFrom && filters.dateTo) return `${filters.dateFrom} al ${filters.dateTo}`;
  if (filters.dateFrom) return `Desde ${filters.dateFrom}`;
  if (filters.dateTo) return `Hasta ${filters.dateTo}`;

  const datedRows = rows.filter((row) => row.dateInput);
  if (!datedRows.length) return "Sin rango explícito";

  const orderedDates = datedRows
    .map((row) => row.dateInput)
    .sort((left, right) => compareByLabel(left, right));

  return `${orderedDates[0]} al ${orderedDates[orderedDates.length - 1]}`;
};

const buildReportPdfFilename = (reportSlug) => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `${reportSlug}-${yyyy}${mm}${dd}-${hh}${min}.pdf`;
};

const hasAnyFilterValue = (filters = {}) =>
  Object.values(filters).some((value) => String(value ?? "").trim() !== "");

const applyFilters = (rows, filters) => {
  const client = normalizeText(filters.client);
  const project = normalizeText(filters.project);
  const responsible = normalizeText(filters.responsible);
  const status = String(filters.status ?? "").trim();
  const dateField = filters.dateField ?? "dateInput";

  return rows.filter((row) => {
    const rowDateInput = row?.[dateField] ?? row.dateInput;

    if (filters.dateFrom && rowDateInput && rowDateInput < filters.dateFrom) {
      return false;
    }

    if (filters.dateTo && rowDateInput && rowDateInput > filters.dateTo) {
      return false;
    }

    if (filters.dateFrom && !rowDateInput) return false;
    if (filters.dateTo && !rowDateInput) return false;
    if (client && normalizeText(row.client) !== client) return false;
    if (project && normalizeText(row.project) !== project) return false;
    if (responsible && normalizeText(row.responsible) !== responsible) return false;
    if (status && row.status.key !== status) return false;

    return true;
  });
};

const applyNonDateFilters = (rows, filters) => {
  const client = normalizeText(filters.client);
  const project = normalizeText(filters.project);
  const responsible = normalizeText(filters.responsible);
  const status = String(filters.status ?? "").trim();

  return rows.filter((row) => {
    if (client && normalizeText(row.client) !== client) return false;
    if (project && normalizeText(row.project) !== project) return false;
    if (responsible && normalizeText(row.responsible) !== responsible) return false;
    if (status && row.status.key !== status) return false;
    return true;
  });
};

const buildAppliedFiltersForExport = (filters, statusOptions = STATUS_FILTER_OPTIONS) => [
  { label: "Fecha desde", value: filters.dateFrom || "Sin límite" },
  { label: "Fecha hasta", value: filters.dateTo || "Sin límite" },
  { label: "Cliente", value: filters.client || "Todos" },
  { label: "Proyecto", value: filters.project || "Todos" },
  { label: "Responsable", value: filters.responsible || "Todos" },
  {
    label: "Estado",
    value:
      statusOptions.find((option) => option.value === filters.status)?.label ||
      "Todos",
  },
];

const buildSummaryMetricsFromCards = (summaryCards = []) =>
  summaryCards.map((card) => ({
    label: card.label,
    value: String(card.value ?? "0"),
    helper: card.helper ?? "",
  }));

const buildChartDataPayload = (chartDefinitions = [], minuteRows = []) => {
  const trendChart = chartDefinitions.find((chart) => chart.type === "trend");
  const statusChart = chartDefinitions.find((chart) => chart.type === "status");
  const clientActivity =
    chartDefinitions.find(
      (chart) => chart.type === "bar" && String(chart.key).includes("client")
    )?.data ?? buildActivityDistribution(minuteRows, "client");
  const projectActivity =
    chartDefinitions.find(
      (chart) => chart.type === "bar" && String(chart.key).includes("project")
    )?.data ?? buildActivityDistribution(minuteRows, "project");

  return {
    period_trend:
      trendChart?.data?.map((point) => ({
        label: point.date,
        total: point.total,
        completed: point.completed,
      })) ?? [],
    status_distribution:
      statusChart?.data?.map((item) => ({
        label: item.label,
        count: item.count,
      })) ?? [],
    client_activity: clientActivity.slice(0, 6).map((item) => ({
      label: item.label,
      count: item.count,
    })),
    project_activity: projectActivity.slice(0, 6).map((item) => ({
      label: item.label,
      count: item.count,
    })),
  };
};

const filterFieldsFactory = (filterCatalogs, statusOptions = STATUS_FILTER_OPTIONS) => [
  { name: "dateFrom", label: "Fecha desde", type: "date" },
  { name: "dateTo", label: "Fecha hasta", type: "date" },
  {
    name: "client",
    label: "Cliente",
    type: "select",
    icon: "business",
    placeholder: "Todos los clientes",
    options: filterCatalogs.clients,
  },
  {
    name: "project",
    label: "Proyecto",
    type: "select",
    icon: "folder",
    placeholder: "Todos los proyectos",
    options: filterCatalogs.projects,
  },
  {
    name: "responsible",
    label: "Responsable",
    type: "select",
    icon: "users",
    placeholder: "Todos los responsables",
    options: filterCatalogs.responsibles,
  },
  {
    name: "status",
    label: "Estado",
    type: "select",
    icon: "filter",
    placeholder: "Todos los estados",
    options: statusOptions,
  },
];

const buildMinuteDetailColumns = () => [
  {
    key: "date",
    label: "Fecha",
    sortable: true,
    sortKey: "date",
    exportValue: (row) => row.dateLabel,
    render: (row) => row.dateLabel,
  },
  {
    key: "client",
    label: "Cliente",
    sortable: true,
    sortKey: "client",
    exportValue: (row) => row.client,
    render: (row) => row.client,
  },
  {
    key: "project",
    label: "Proyecto",
    sortable: true,
    sortKey: "project",
    exportValue: (row) => row.project,
    render: (row) => row.project,
  },
  {
    key: "responsible",
    label: "Responsable",
    sortable: true,
    sortKey: "responsible",
    exportValue: (row) => row.responsible,
    render: (row) => row.responsible,
  },
  {
    key: "status",
    label: "Estado",
    sortable: true,
    sortKey: "status",
    exportValue: (row) => row.status.label,
    render: (row) => (
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${row.status.className}`}
      >
        {row.status.label}
      </span>
    ),
  },
  {
    key: "title",
    label: "Minuta",
    sortable: true,
    sortKey: "title",
    exportValue: (row) => row.title,
    cellClassName: "min-w-[280px]",
    render: (row) => (
      <div className="min-w-[240px]">
        <p className="font-semibold text-gray-900 dark:text-white">{row.title}</p>
      </div>
    ),
  },
];

const buildReprocessColumns = () => [
  {
    key: "date",
    label: "Fecha",
    sortable: true,
    sortKey: "date",
    exportValue: (row) => row.dateLabel,
    render: (row) => row.dateLabel,
  },
  {
    key: "client",
    label: "Cliente",
    sortable: true,
    sortKey: "client",
    exportValue: (row) => row.client,
    render: (row) => row.client,
  },
  {
    key: "project",
    label: "Proyecto",
    sortable: true,
    sortKey: "project",
    exportValue: (row) => row.project,
    render: (row) => row.project,
  },
  {
    key: "title",
    label: "Minuta",
    sortable: true,
    sortKey: "title",
    exportValue: (row) => row.title,
    cellClassName: "min-w-[280px]",
    render: (row) => (
      <div className="min-w-[240px]">
        <p className="font-semibold text-gray-900 dark:text-white">{row.title}</p>
      </div>
    ),
  },
  {
    key: "responsible",
    label: "Responsable",
    sortable: true,
    sortKey: "responsible",
    exportValue: (row) => row.responsible,
    render: (row) => row.responsible,
  },
  {
    key: "status",
    label: "Estado",
    sortable: true,
    sortKey: "status",
    exportValue: (row) => row.status.label,
    render: (row) => (
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${row.status.className}`}
      >
        {row.status.label}
      </span>
    ),
  },
  {
    key: "reprocessReady",
    label: "Reprocesable",
    sortable: true,
    sortKey: "reprocessReady",
    exportValue: (row) => (row.canReprocess ? "Sí" : "No"),
    render: (row) => (
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
          row.canReprocess
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
        }`}
      >
        {row.canReprocess ? "Sí" : "No"}
      </span>
    ),
  },
  {
    key: "errorMessage",
    label: "Error visible",
    sortable: true,
    sortKey: "errorMessage",
    exportValue: (row) => row.errorMessage || "—",
    cellClassName: "min-w-[280px]",
    render: (row) => (
      <div className="min-w-[240px] text-sm text-gray-600 dark:text-gray-300">
        {row.errorMessage || "—"}
      </div>
    ),
  },
  {
    ...buildTokenBreakdownColumn(),
  },
];

const buildCycleColumns = () => [
  {
    key: "date",
    label: "Fecha",
    sortable: true,
    sortKey: "date",
    exportValue: (row) => row.dateLabel,
    render: (row) => row.dateLabel,
  },
  {
    key: "client",
    label: "Cliente",
    sortable: true,
    sortKey: "client",
    exportValue: (row) => row.client,
    render: (row) => row.client,
  },
  {
    key: "project",
    label: "Proyecto",
    sortable: true,
    sortKey: "project",
    exportValue: (row) => row.project,
    render: (row) => row.project,
  },
  {
    key: "title",
    label: "Minuta",
    sortable: true,
    sortKey: "title",
    exportValue: (row) => row.title,
    cellClassName: "min-w-[280px]",
    render: (row) => (
      <div className="min-w-[240px]">
        <p className="font-semibold text-gray-900 dark:text-white">{row.title}</p>
      </div>
    ),
  },
  {
    key: "responsible",
    label: "Responsable",
    sortable: true,
    sortKey: "responsible",
    exportValue: (row) => row.responsible,
    render: (row) => row.responsible,
  },
  {
    key: "status",
    label: "Estado",
    sortable: true,
    sortKey: "status",
    exportValue: (row) => row.status.label,
    render: (row) => (
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${row.status.className}`}
      >
        {row.status.label}
      </span>
    ),
  },
  {
    key: "cycleStartedAt",
    label: "Inicio ciclo",
    sortable: true,
    sortKey: "cycleStartedAt",
    exportValue: (row) => row.cycleStartedAtLabel,
    render: (row) => row.cycleStartedAtLabel,
  },
  {
    key: "lastActivity",
    label: "Último movimiento",
    sortable: true,
    sortKey: "lastTransitionAt",
    exportValue: (row) => row.lastTransitionAtLabel,
    render: (row) => row.lastTransitionAtLabel,
  },
  {
    key: "processingDuration",
    label: "Tiempo IA",
    sortable: true,
    sortKey: "processingDuration",
    exportValue: (row) => formatDurationMs(row.processingDurationMs),
    render: (row) => formatDurationMs(row.processingDurationMs),
  },
  {
    key: "editingDuration",
    label: "Tiempo edición",
    sortable: true,
    sortKey: "editingDuration",
    exportValue: (row) => formatDurationMs(row.editingDurationMs),
    render: (row) => formatDurationMs(row.editingDurationMs),
  },
  {
    key: "reviewDuration",
    label: "Tiempo revisión",
    sortable: true,
    sortKey: "reviewDuration",
    exportValue: (row) => formatDurationMs(row.reviewDurationMs),
    render: (row) => formatDurationMs(row.reviewDurationMs),
  },
  {
    key: "totalCycleDuration",
    label: "Ciclo total",
    sortable: true,
    sortKey: "totalCycleDuration",
    exportValue: (row) => formatDurationMs(row.totalCycleDurationMs),
    render: (row) => (
      <span className="font-semibold text-gray-900 dark:text-white">
        {formatDurationMs(row.totalCycleDurationMs)}
      </span>
    ),
  },
  {
    key: "returnToEditCount",
    label: "Devuelta a edición",
    sortable: true,
    sortKey: "returnToEditCount",
    exportValue: (row) => formatNumber(row.returnToEditCount ?? 0),
    render: (row) => formatNumber(row.returnToEditCount ?? 0),
  },
];

const buildExecutiveClientColumns = () => [
  {
    key: "client",
    label: "Cliente",
    sortable: true,
    sortKey: "client",
    exportValue: (row) => row.client,
    render: (row) => row.client,
  },
  {
    key: "totalRecords",
    label: "Registros",
    sortable: true,
    sortKey: "totalRecords",
    exportValue: (row) => formatNumber(row.totalRecords),
    render: (row) => formatNumber(row.totalRecords),
  },
  {
    key: "projectCount",
    label: "Proyectos activos",
    sortable: true,
    sortKey: "projectCount",
    exportValue: (row) => formatNumber(row.projectCount),
    render: (row) => formatNumber(row.projectCount),
  },
  {
    key: "responsibleCount",
    label: "Responsables",
    sortable: true,
    sortKey: "responsibleCount",
    exportValue: (row) => formatNumber(row.responsibleCount),
    render: (row) => formatNumber(row.responsibleCount),
  },
  {
    key: "completedRecords",
    label: "Completadas",
    sortable: true,
    sortKey: "completedRecords",
    exportValue: (row) => formatNumber(row.completedRecords),
    render: (row) => formatNumber(row.completedRecords),
  },
  {
    key: "backlogRecords",
    label: "Backlog",
    sortable: true,
    sortKey: "backlogRecords",
    exportValue: (row) => formatNumber(row.backlogRecords),
    render: (row) => formatNumber(row.backlogRecords),
  },
  {
    key: "lastDate",
    label: "Última actividad",
    sortable: true,
    sortKey: "lastDate",
    exportValue: (row) => row.lastDateLabel,
    render: (row) => row.lastDateLabel,
  },
];

const buildExecutiveProjectColumns = () => [
  {
    key: "project",
    label: "Proyecto",
    sortable: true,
    sortKey: "project",
    exportValue: (row) => row.project,
    render: (row) => row.project,
  },
  {
    key: "client",
    label: "Cliente",
    sortable: true,
    sortKey: "client",
    exportValue: (row) => row.client,
    render: (row) => row.client,
  },
  {
    key: "totalRecords",
    label: "Registros",
    sortable: true,
    sortKey: "totalRecords",
    exportValue: (row) => formatNumber(row.totalRecords),
    render: (row) => formatNumber(row.totalRecords),
  },
  {
    key: "responsibleCount",
    label: "Responsables",
    sortable: true,
    sortKey: "responsibleCount",
    exportValue: (row) => formatNumber(row.responsibleCount),
    render: (row) => formatNumber(row.responsibleCount),
  },
  {
    key: "completedRecords",
    label: "Completadas",
    sortable: true,
    sortKey: "completedRecords",
    exportValue: (row) => formatNumber(row.completedRecords),
    render: (row) => formatNumber(row.completedRecords),
  },
  {
    key: "backlogRecords",
    label: "Backlog",
    sortable: true,
    sortKey: "backlogRecords",
    exportValue: (row) => formatNumber(row.backlogRecords),
    render: (row) => formatNumber(row.backlogRecords),
  },
  {
    key: "lastDate",
    label: "Última actividad",
    sortable: true,
    sortKey: "lastDate",
    exportValue: (row) => row.lastDateLabel,
    render: (row) => row.lastDateLabel,
  },
];

const buildProductionColumns = () => [
  {
    key: "date",
    label: "Fecha",
    sortable: true,
    sortKey: "date",
    exportValue: (row) => row.dateLabel,
    render: (row) => row.dateLabel,
  },
  {
    key: "totalRecords",
    label: "Total minutas",
    sortable: true,
    sortKey: "totalRecords",
    exportValue: (row) => formatNumber(row.totalRecords),
    render: (row) => formatNumber(row.totalRecords),
  },
  {
    key: "completedRecords",
    label: "Completadas",
    sortable: true,
    sortKey: "completedRecords",
    exportValue: (row) => formatNumber(row.completedRecords),
    render: (row) => formatNumber(row.completedRecords),
  },
  {
    key: "pendingRecords",
    label: "Pendientes",
    sortable: true,
    sortKey: "pendingRecords",
    exportValue: (row) => formatNumber(row.pendingRecords),
    render: (row) => formatNumber(row.pendingRecords),
  },
  {
    key: "reviewRecords",
    label: "En revisión",
    sortable: true,
    sortKey: "reviewRecords",
    exportValue: (row) => formatNumber(row.reviewRecords),
    render: (row) => formatNumber(row.reviewRecords),
  },
  {
    key: "backlogRecords",
    label: "Backlog",
    sortable: true,
    sortKey: "backlogRecords",
    exportValue: (row) => formatNumber(row.backlogRecords),
    render: (row) => formatNumber(row.backlogRecords),
  },
];

const buildStatusColumns = () => [
  {
    key: "status",
    label: "Estado",
    sortable: true,
    sortKey: "status",
    exportValue: (row) => row.status.label,
    render: (row) => (
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${row.status.className}`}
      >
        {row.status.label}
      </span>
    ),
  },
  {
    key: "totalRecords",
    label: "Registros",
    sortable: true,
    sortKey: "totalRecords",
    exportValue: (row) => formatNumber(row.totalRecords),
    render: (row) => formatNumber(row.totalRecords),
  },
  {
    key: "percentage",
    label: "% período",
    sortable: true,
    sortKey: "percentage",
    exportValue: (row) => row.percentageLabel,
    render: (row) => row.percentageLabel,
  },
  {
    key: "clientCount",
    label: "Clientes",
    sortable: true,
    sortKey: "clientCount",
    exportValue: (row) => formatNumber(row.clientCount),
    render: (row) => formatNumber(row.clientCount),
  },
  {
    key: "projectCount",
    label: "Proyectos",
    sortable: true,
    sortKey: "projectCount",
    exportValue: (row) => formatNumber(row.projectCount),
    render: (row) => formatNumber(row.projectCount),
  },
  {
    key: "lastDate",
    label: "Última actividad",
    sortable: true,
    sortKey: "lastDate",
    exportValue: (row) => row.lastDateLabel,
    render: (row) => row.lastDateLabel,
  },
];

const buildResponsibleColumns = () => [
  {
    key: "responsible",
    label: "Responsable",
    sortable: true,
    sortKey: "responsible",
    exportValue: (row) => row.responsible,
    render: (row) => row.responsible,
  },
  {
    key: "totalRecords",
    label: "Registros",
    sortable: true,
    sortKey: "totalRecords",
    exportValue: (row) => formatNumber(row.totalRecords),
    render: (row) => formatNumber(row.totalRecords),
  },
  {
    key: "completedRecords",
    label: "Completadas",
    sortable: true,
    sortKey: "completedRecords",
    exportValue: (row) => formatNumber(row.completedRecords),
    render: (row) => formatNumber(row.completedRecords),
  },
  {
    key: "reviewRecords",
    label: "En revisión",
    sortable: true,
    sortKey: "reviewRecords",
    exportValue: (row) => formatNumber(row.reviewRecords),
    render: (row) => formatNumber(row.reviewRecords),
  },
  {
    key: "backlogRecords",
    label: "Backlog",
    sortable: true,
    sortKey: "backlogRecords",
    exportValue: (row) => formatNumber(row.backlogRecords),
    render: (row) => formatNumber(row.backlogRecords),
  },
  {
    key: "clientCount",
    label: "Clientes atendidos",
    sortable: true,
    sortKey: "clientCount",
    exportValue: (row) => formatNumber(row.clientCount),
    render: (row) => formatNumber(row.clientCount),
  },
  {
    key: "lastDate",
    label: "Última actividad",
    sortable: true,
    sortKey: "lastDate",
    exportValue: (row) => row.lastDateLabel,
    render: (row) => row.lastDateLabel,
  },
];

const buildClientColumns = () => [
  {
    key: "client",
    label: "Cliente",
    sortable: true,
    sortKey: "client",
    exportValue: (row) => row.client,
    render: (row) => row.client,
  },
  {
    key: "totalRecords",
    label: "Registros",
    sortable: true,
    sortKey: "totalRecords",
    exportValue: (row) => formatNumber(row.totalRecords),
    render: (row) => formatNumber(row.totalRecords),
  },
  {
    key: "projectCount",
    label: "Proyectos activos",
    sortable: true,
    sortKey: "projectCount",
    exportValue: (row) => formatNumber(row.projectCount),
    render: (row) => formatNumber(row.projectCount),
  },
  {
    key: "completedRecords",
    label: "Completadas",
    sortable: true,
    sortKey: "completedRecords",
    exportValue: (row) => formatNumber(row.completedRecords),
    render: (row) => formatNumber(row.completedRecords),
  },
  {
    key: "reviewRecords",
    label: "En revisión",
    sortable: true,
    sortKey: "reviewRecords",
    exportValue: (row) => formatNumber(row.reviewRecords),
    render: (row) => formatNumber(row.reviewRecords),
  },
  {
    key: "backlogRecords",
    label: "Backlog",
    sortable: true,
    sortKey: "backlogRecords",
    exportValue: (row) => formatNumber(row.backlogRecords),
    render: (row) => formatNumber(row.backlogRecords),
  },
  {
    key: "lastDate",
    label: "Última actividad",
    sortable: true,
    sortKey: "lastDate",
    exportValue: (row) => row.lastDateLabel,
    render: (row) => row.lastDateLabel,
  },
];

const buildProjectColumns = () => [
  {
    key: "project",
    label: "Proyecto",
    sortable: true,
    sortKey: "project",
    exportValue: (row) => row.project,
    render: (row) => row.project,
  },
  {
    key: "client",
    label: "Cliente",
    sortable: true,
    sortKey: "client",
    exportValue: (row) => row.client,
    render: (row) => row.client,
  },
  {
    key: "totalRecords",
    label: "Registros",
    sortable: true,
    sortKey: "totalRecords",
    exportValue: (row) => formatNumber(row.totalRecords),
    render: (row) => formatNumber(row.totalRecords),
  },
  {
    key: "completedRecords",
    label: "Completadas",
    sortable: true,
    sortKey: "completedRecords",
    exportValue: (row) => formatNumber(row.completedRecords),
    render: (row) => formatNumber(row.completedRecords),
  },
  {
    key: "reviewRecords",
    label: "En revisión",
    sortable: true,
    sortKey: "reviewRecords",
    exportValue: (row) => formatNumber(row.reviewRecords),
    render: (row) => formatNumber(row.reviewRecords),
  },
  {
    key: "backlogRecords",
    label: "Backlog",
    sortable: true,
    sortKey: "backlogRecords",
    exportValue: (row) => formatNumber(row.backlogRecords),
    render: (row) => formatNumber(row.backlogRecords),
  },
  {
    key: "lastDate",
    label: "Última actividad",
    sortable: true,
    sortKey: "lastDate",
    exportValue: (row) => row.lastDateLabel,
    render: (row) => row.lastDateLabel,
  },
];

const renderBooleanBadge = (value) => (
  <span
    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
      value
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
    }`}
  >
    {getBooleanLabel(value)}
  </span>
);

const buildClientPortfolioColumns = () => [
  {
    key: "client",
    label: "Cliente",
    sortable: true,
    sortKey: "client",
    exportValue: (row) => row.client,
    render: (row) => row.client,
  },
  {
    key: "statusLabel",
    label: "Estado",
    sortable: true,
    sortKey: "statusLabel",
    exportValue: (row) => row.statusLabel,
    render: (row) => row.statusLabel,
  },
  {
    key: "priorityLabel",
    label: "Prioridad",
    sortable: true,
    sortKey: "priorityLabel",
    exportValue: (row) => row.priorityLabel,
    render: (row) => row.priorityLabel,
  },
  {
    key: "isConfidential",
    label: "Confidencial",
    sortable: true,
    sortKey: "isConfidential",
    exportValue: (row) => getBooleanLabel(row.isConfidential),
    render: (row) => renderBooleanBadge(row.isConfidential),
  },
  {
    key: "industry",
    label: "Industria",
    sortable: true,
    sortKey: "industry",
    exportValue: (row) => row.industry,
    render: (row) => row.industry,
  },
  {
    key: "projectCount",
    label: "Proyectos con actividad",
    sortable: true,
    sortKey: "projectCount",
    exportValue: (row) => formatNumber(row.projectCount),
    render: (row) => formatNumber(row.projectCount),
  },
  {
    key: "totalRecords",
    label: "Minutas",
    sortable: true,
    sortKey: "totalRecords",
    exportValue: (row) => formatNumber(row.totalRecords),
    render: (row) => formatNumber(row.totalRecords),
  },
  {
    key: "lastDate",
    label: "Última actividad",
    sortable: true,
    sortKey: "lastDate",
    exportValue: (row) => row.lastDateLabel,
    render: (row) => row.lastDateLabel,
  },
];

const buildProjectPortfolioColumns = () => [
  {
    key: "project",
    label: "Proyecto",
    sortable: true,
    sortKey: "project",
    exportValue: (row) => row.project,
    render: (row) => row.project,
  },
  {
    key: "client",
    label: "Cliente",
    sortable: true,
    sortKey: "client",
    exportValue: (row) => row.client,
    render: (row) => row.client,
  },
  {
    key: "code",
    label: "Código",
    sortable: true,
    sortKey: "code",
    exportValue: (row) => row.code,
    render: (row) => row.code,
  },
  {
    key: "isConfidential",
    label: "Confidencial",
    sortable: true,
    sortKey: "isConfidential",
    exportValue: (row) => getBooleanLabel(row.isConfidential),
    render: (row) => renderBooleanBadge(row.isConfidential),
  },
  {
    key: "automationLabel",
    label: "Automatización",
    sortable: true,
    sortKey: "autoSendCount",
    exportValue: (row) => row.automationLabel,
    render: (row) => row.automationLabel,
  },
  {
    key: "totalRecords",
    label: "Minutas",
    sortable: true,
    sortKey: "totalRecords",
    exportValue: (row) => formatNumber(row.totalRecords),
    render: (row) => formatNumber(row.totalRecords),
  },
  {
    key: "lastDate",
    label: "Última actividad",
    sortable: true,
    sortKey: "lastDate",
    exportValue: (row) => row.lastDateLabel,
    render: (row) => row.lastDateLabel,
  },
];

const buildInactiveClientColumns = () => [
  ...buildClientPortfolioColumns().filter(
    (column) => !["projectCount", "totalRecords"].includes(column.key)
  ),
  {
    key: "daysWithoutActivity",
    label: "Sin actividad",
    sortable: true,
    sortKey: "daysWithoutActivity",
    exportValue: (row) => row.daysWithoutActivityLabel,
    render: (row) => row.daysWithoutActivityLabel,
  },
];

const buildInactiveProjectColumns = () => [
  ...buildProjectPortfolioColumns().filter(
    (column) => !["automationLabel", "totalRecords"].includes(column.key)
  ),
  {
    key: "daysWithoutActivity",
    label: "Sin actividad",
    sortable: true,
    sortKey: "daysWithoutActivity",
    exportValue: (row) => row.daysWithoutActivityLabel,
    render: (row) => row.daysWithoutActivityLabel,
  },
];

const buildClientLoadColumns = () => [
  {
    key: "client",
    label: "Cliente",
    sortable: true,
    sortKey: "client",
    exportValue: (row) => row.client,
    render: (row) => row.client,
  },
  {
    key: "documentLoadScore",
    label: "Carga documental",
    sortable: true,
    sortKey: "documentLoadScore",
    exportValue: (row) => formatNumber(row.documentLoadScore),
    render: (row) => formatNumber(row.documentLoadScore),
  },
  {
    key: "totalRecords",
    label: "Minutas",
    sortable: true,
    sortKey: "totalRecords",
    exportValue: (row) => formatNumber(row.totalRecords),
    render: (row) => formatNumber(row.totalRecords),
  },
  {
    key: "reviewRecords",
    label: "En revisión",
    sortable: true,
    sortKey: "reviewRecords",
    exportValue: (row) => formatNumber(row.reviewRecords),
    render: (row) => formatNumber(row.reviewRecords),
  },
  {
    key: "backlogRecords",
    label: "Backlog",
    sortable: true,
    sortKey: "backlogRecords",
    exportValue: (row) => formatNumber(row.backlogRecords),
    render: (row) => formatNumber(row.backlogRecords),
  },
  {
    key: "totalTokens",
    label: "Tokens IA",
    sortable: true,
    sortKey: "totalTokens",
    exportValue: (row) => formatNumber(row.totalTokens),
    render: (row) => formatNumber(row.totalTokens),
  },
  {
    key: "lastDate",
    label: "Última actividad",
    sortable: true,
    sortKey: "lastDate",
    exportValue: (row) => row.lastDateLabel,
    render: (row) => row.lastDateLabel,
  },
];

const buildProjectLoadColumns = () => [
  {
    key: "project",
    label: "Proyecto",
    sortable: true,
    sortKey: "project",
    exportValue: (row) => row.project,
    render: (row) => row.project,
  },
  {
    key: "client",
    label: "Cliente",
    sortable: true,
    sortKey: "client",
    exportValue: (row) => row.client,
    render: (row) => row.client,
  },
  ...buildClientLoadColumns().filter((column) => column.key !== "client"),
];

const buildQueueColumns = () => [
  {
    key: "queue",
    label: "Cola",
    sortable: true,
    sortKey: "queue",
    exportValue: (row) => row.queue,
    render: (row) => (
      <div className="min-w-[220px]">
        <p className="font-semibold text-gray-900 dark:text-white">{row.label}</p>
        <p className="mt-1 font-mono text-xs text-gray-500 dark:text-gray-400">{row.queue}</p>
      </div>
    ),
  },
  {
    key: "status",
    label: "Estado",
    sortable: true,
    sortKey: "status",
    exportValue: (row) => row.statusLabel,
    render: (row) => row.statusLabel,
  },
  {
    key: "size",
    label: "Backlog",
    sortable: true,
    sortKey: "size",
    exportValue: (row) => formatNumber(row.size),
    render: (row) => formatNumber(row.size),
  },
  {
    key: "warningThreshold",
    label: "Umbral",
    sortable: true,
    sortKey: "warningThreshold",
    exportValue: (row) => formatNumber(row.warningThreshold),
    render: (row) => formatNumber(row.warningThreshold),
  },
  {
    key: "loadPercent",
    label: "% carga",
    sortable: true,
    sortKey: "loadPercent",
    exportValue: (row) => formatPercent(row.loadPercent),
    render: (row) => formatPercent(row.loadPercent),
  },
  {
    key: "monitoringEnabled",
    label: "Monitoreo",
    sortable: true,
    sortKey: "monitoringEnabled",
    exportValue: (row) => getBooleanLabel(row.monitoringEnabled),
    render: (row) => renderBooleanBadge(row.monitoringEnabled),
  },
  {
    key: "consumer",
    label: "Consumidor",
    sortable: true,
    sortKey: "consumer",
    exportValue: (row) => row.consumer,
    render: (row) => row.consumer,
  },
  {
    key: "lastActivity",
    label: "Última actividad",
    sortable: true,
    sortKey: "date",
    exportValue: (row) => row.lastActivityLabel,
    render: (row) => row.lastActivityLabel,
  },
];

const buildProviderValidationColumns = () => [
  {
    key: "provider",
    label: "Provider",
    sortable: true,
    sortKey: "provider",
    exportValue: (row) => row.provider,
    render: (row) => row.provider,
  },
  {
    key: "providerType",
    label: "Tipo",
    sortable: true,
    sortKey: "providerType",
    exportValue: (row) => row.providerType,
    render: (row) => row.providerType,
  },
  {
    key: "model",
    label: "Modelo",
    sortable: true,
    sortKey: "model",
    exportValue: (row) => row.model,
    render: (row) => row.model,
  },
  {
    key: "status",
    label: "Validación",
    sortable: true,
    sortKey: "status",
    exportValue: (row) => row.statusLabel,
    render: (row) => row.statusLabel,
  },
  {
    key: "isActive",
    label: "Activo",
    sortable: true,
    sortKey: "isActive",
    exportValue: (row) => getBooleanLabel(row.isActive),
    render: (row) => renderBooleanBadge(row.isActive),
  },
  {
    key: "lastValidatedAt",
    label: "Última validación",
    sortable: true,
    sortKey: "lastValidatedAt",
    exportValue: (row) => row.lastValidatedAtLabel,
    render: (row) => row.lastValidatedAtLabel,
  },
  {
    key: "errorMessage",
    label: "Último error",
    sortable: true,
    sortKey: "errorMessage",
    exportValue: (row) => row.errorMessage || "—",
    cellClassName: "min-w-[280px]",
    render: (row) => row.errorMessage || "—",
  },
];

const buildSystemAlertColumns = () => [
  {
    key: "alertType",
    label: "Tipo",
    sortable: true,
    sortKey: "statusLabel",
    exportValue: (row) => row.alertType,
    render: (row) => row.alertType,
  },
  {
    key: "title",
    label: "Alerta",
    sortable: true,
    sortKey: "title",
    exportValue: (row) => row.title,
    render: (row) => row.title,
  },
  {
    key: "status",
    label: "Estado",
    sortable: true,
    sortKey: "status",
    exportValue: (row) => row.statusLabel,
    render: (row) => row.statusLabel,
  },
  {
    key: "date",
    label: "Fecha",
    sortable: true,
    sortKey: "date",
    exportValue: (row) => row.dateLabel,
    render: (row) => row.dateLabel,
  },
  {
    key: "message",
    label: "Detalle",
    sortable: true,
    sortKey: "errorMessage",
    exportValue: (row) => row.message,
    cellClassName: "min-w-[360px]",
    render: (row) => row.message,
  },
];

const buildTopicTagColumns = () => [
  {
    key: "tag",
    label: "Tag",
    sortable: true,
    sortKey: "tag",
    exportValue: (row) => row.tag,
    render: (row) => row.tag,
  },
  {
    key: "category",
    label: "Categoría",
    sortable: true,
    sortKey: "category",
    exportValue: (row) => row.category,
    render: (row) => row.category,
  },
  {
    key: "totalRecords",
    label: "Minutas",
    sortable: true,
    sortKey: "totalRecords",
    exportValue: (row) => formatNumber(row.totalRecords),
    render: (row) => formatNumber(row.totalRecords),
  },
  {
    key: "totalAssignments",
    label: "Asignaciones",
    sortable: true,
    sortKey: "totalAssignments",
    exportValue: (row) => formatNumber(row.totalAssignments),
    render: (row) => formatNumber(row.totalAssignments),
  },
  {
    key: "clientCount",
    label: "Clientes",
    sortable: true,
    sortKey: "clientCount",
    exportValue: (row) => formatNumber(row.clientCount),
    render: (row) => formatNumber(row.clientCount),
  },
  {
    key: "projectCount",
    label: "Proyectos",
    sortable: true,
    sortKey: "projectCount",
    exportValue: (row) => formatNumber(row.projectCount),
    render: (row) => formatNumber(row.projectCount),
  },
  {
    key: "lastDate",
    label: "Última actividad",
    sortable: true,
    sortKey: "lastDate",
    exportValue: (row) => row.lastDateLabel,
    render: (row) => row.lastDateLabel,
  },
];

const buildAiTagColumns = () => [
  {
    key: "aiTag",
    label: "AI tag",
    sortable: true,
    sortKey: "aiTag",
    exportValue: (row) => row.aiTag,
    render: (row) => row.aiTag,
  },
  {
    key: "detectedCount",
    label: "Detecciones",
    sortable: true,
    sortKey: "detectedCount",
    exportValue: (row) => formatNumber(row.detectedCount),
    render: (row) => formatNumber(row.detectedCount),
  },
  {
    key: "totalRecords",
    label: "Minutas",
    sortable: true,
    sortKey: "totalRecords",
    exportValue: (row) => formatNumber(row.totalRecords),
    render: (row) => formatNumber(row.totalRecords),
  },
  {
    key: "clientCount",
    label: "Clientes",
    sortable: true,
    sortKey: "clientCount",
    exportValue: (row) => formatNumber(row.clientCount),
    render: (row) => formatNumber(row.clientCount),
  },
  {
    key: "projectCount",
    label: "Proyectos",
    sortable: true,
    sortKey: "projectCount",
    exportValue: (row) => formatNumber(row.projectCount),
    render: (row) => formatNumber(row.projectCount),
  },
  {
    key: "status",
    label: "Estado",
    sortable: true,
    sortKey: "status",
    exportValue: (row) => row.status.label,
    render: (row) => (
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${row.status.className}`}
      >
        {row.status.label}
      </span>
    ),
  },
  {
    key: "lastDate",
    label: "Última actividad",
    sortable: true,
    sortKey: "lastDate",
    exportValue: (row) => row.lastDateLabel,
    render: (row) => row.lastDateLabel,
  },
];

const buildAiTagConversionColumns = () => [
  {
    key: "aiTag",
    label: "AI tag",
    sortable: true,
    sortKey: "aiTag",
    exportValue: (row) => row.aiTag,
    render: (row) => row.aiTag,
  },
  {
    key: "conversionTarget",
    label: "Tag operacional",
    sortable: true,
    sortKey: "conversionTarget",
    exportValue: (row) => row.conversionTarget,
    render: (row) => row.conversionTarget,
  },
  {
    key: "category",
    label: "Categoría",
    sortable: true,
    sortKey: "category",
    exportValue: (row) => row.category,
    render: (row) => row.category,
  },
  {
    key: "detectedCount",
    label: "Detecciones",
    sortable: true,
    sortKey: "detectedCount",
    exportValue: (row) => formatNumber(row.detectedCount),
    render: (row) => formatNumber(row.detectedCount),
  },
  {
    key: "conversionRate",
    label: "% conversión",
    sortable: true,
    sortKey: "conversionRate",
    exportValue: (row) => row.conversionRateLabel,
    render: (row) => row.conversionRateLabel,
  },
  {
    key: "status",
    label: "Estado",
    sortable: true,
    sortKey: "status",
    exportValue: (row) => row.status.label,
    render: (row) => (
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${row.status.className}`}
      >
        {row.status.label}
      </span>
    ),
  },
  {
    key: "lastDate",
    label: "Última actividad",
    sortable: true,
    sortKey: "lastDate",
    exportValue: (row) => row.lastDateLabel,
    render: (row) => row.lastDateLabel,
  },
];

const buildTopicTrendColumns = () => [
  {
    key: "period",
    label: "Período",
    sortable: true,
    sortKey: "period",
    exportValue: (row) => row.period,
    render: (row) => row.period,
  },
  ...buildTopicTagColumns().filter((column) => column.key !== "totalAssignments"),
];

const buildReviewObservationColumns = () => [
  {
    key: "date",
    label: "Fecha",
    sortable: true,
    sortKey: "date",
    exportValue: (row) => row.dateLabel,
    render: (row) => row.dateLabel,
  },
  {
    key: "title",
    label: "Minuta",
    sortable: true,
    sortKey: "title",
    exportValue: (row) => row.title,
    cellClassName: "min-w-[260px]",
    render: (row) => row.title,
  },
  {
    key: "client",
    label: "Cliente",
    sortable: true,
    sortKey: "client",
    exportValue: (row) => row.client,
    render: (row) => row.client,
  },
  {
    key: "project",
    label: "Proyecto",
    sortable: true,
    sortKey: "project",
    exportValue: (row) => row.project,
    render: (row) => row.project,
  },
  {
    key: "authorEmail",
    label: "Autor externo",
    sortable: true,
    sortKey: "authorEmail",
    exportValue: (row) => row.authorEmail,
    render: (row) => row.authorName || row.authorEmail,
  },
  {
    key: "status",
    label: "Estado",
    sortable: true,
    sortKey: "status",
    exportValue: (row) => row.status.label,
    render: (row) => (
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${row.status.className}`}
      >
        {row.status.label}
      </span>
    ),
  },
  {
    key: "body",
    label: "Observación",
    sortable: true,
    sortKey: "body",
    exportValue: (row) => row.body,
    cellClassName: "min-w-[340px]",
    render: (row) => row.body,
  },
];

const buildReviewResolutionColumns = () => [
  ...buildReviewObservationColumns().filter((column) => column.key !== "body"),
  {
    key: "resolutionType",
    label: "Resolución",
    sortable: true,
    sortKey: "resolutionType",
    exportValue: (row) => row.resolutionTypeLabel,
    render: (row) => row.resolutionTypeLabel,
  },
  {
    key: "resolvedAt",
    label: "Fecha resolución",
    sortable: true,
    sortKey: "resolvedAt",
    exportValue: (row) => row.resolvedAtLabel,
    render: (row) => row.resolvedAtLabel,
  },
  {
    key: "editorComment",
    label: "Comentario editor",
    sortable: true,
    sortKey: "editorComment",
    exportValue: (row) => row.editorComment || "—",
    cellClassName: "min-w-[320px]",
    render: (row) => row.editorComment || "—",
  },
];

const buildEmailDeliveryColumns = () => [
  {
    key: "date",
    label: "Fecha",
    sortable: true,
    sortKey: "date",
    exportValue: (row) => row.dateLabel,
    render: (row) => row.dateLabel,
  },
  {
    key: "emailKind",
    label: "Tipo",
    sortable: true,
    sortKey: "emailKind",
    exportValue: (row) => row.emailKindLabel,
    render: (row) => row.emailKindLabel,
  },
  {
    key: "status",
    label: "Estado",
    sortable: true,
    sortKey: "status",
    exportValue: (row) => row.status.label,
    render: (row) => (
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${row.status.className}`}
      >
        {row.status.label}
      </span>
    ),
  },
  {
    key: "subject",
    label: "Asunto",
    sortable: true,
    sortKey: "title",
    exportValue: (row) => row.subject,
    cellClassName: "min-w-[280px]",
    render: (row) => row.subject,
  },
  {
    key: "minuteTitle",
    label: "Minuta",
    sortable: true,
    sortKey: "title",
    exportValue: (row) => row.minuteTitle,
    cellClassName: "min-w-[240px]",
    render: (row) => row.minuteTitle,
  },
  {
    key: "client",
    label: "Cliente",
    sortable: true,
    sortKey: "client",
    exportValue: (row) => row.client,
    render: (row) => row.client,
  },
  {
    key: "project",
    label: "Proyecto",
    sortable: true,
    sortKey: "project",
    exportValue: (row) => row.project,
    render: (row) => row.project,
  },
  {
    key: "recipients",
    label: "Destinatarios",
    sortable: true,
    sortKey: "recipientCount",
    exportValue: (row) => row.recipientsLabel,
    cellClassName: "min-w-[240px]",
    render: (row) => row.recipientsLabel,
  },
  {
    key: "attachmentCount",
    label: "Adjuntos",
    sortable: true,
    sortKey: "attachmentCount",
    exportValue: (row) => row.attachmentCount,
    render: (row) => row.attachmentCount,
  },
  {
    key: "errorMessage",
    label: "Error",
    sortable: true,
    sortKey: "errorMessage",
    exportValue: (row) => row.errorMessage,
    cellClassName: "min-w-[260px]",
    render: (row) => row.errorMessage || "—",
  },
];

const buildReviewFrictionColumns = () => [
  ...buildCycleColumns().filter((column) =>
    ["title", "client", "project", "status", "transitionCount", "returnToEditCount", "reviewDuration", "totalCycleDuration"].includes(column.key)
  ),
];

const buildPublicationColumns = () => [
  {
    key: "completedAt",
    label: "Publicación",
    sortable: true,
    sortKey: "completedAt",
    exportValue: (row) => row.completedAtLabel,
    render: (row) => row.completedAtLabel,
  },
  ...buildMinuteDetailColumns().filter((column) =>
    ["client", "project", "responsible", "title"].includes(column.key)
  ),
  {
    key: "totalCycleDuration",
    label: "Ciclo total",
    sortable: true,
    sortKey: "totalCycleDuration",
    exportValue: (row) => formatDurationMs(row.totalCycleDurationMs),
    render: (row) => formatDurationMs(row.totalCycleDurationMs),
  },
];

const buildCommitmentDetailColumns = () => [
  {
    key: "date",
    label: "Fecha minuta",
    sortable: true,
    sortKey: "date",
    exportValue: (row) => row.dateLabel,
    render: (row) => row.dateLabel,
  },
  {
    key: "itemCode",
    label: "Código",
    sortable: true,
    sortKey: "itemCode",
    exportValue: (row) => row.itemCode,
    render: (row) => row.itemCode,
  },
  {
    key: "itemType",
    label: "Tipo",
    sortable: true,
    sortKey: "itemType",
    exportValue: (row) => row.itemTypeLabel,
    render: (row) => row.itemTypeLabel,
  },
  {
    key: "client",
    label: "Cliente",
    sortable: true,
    sortKey: "client",
    exportValue: (row) => row.client,
    render: (row) => row.client,
  },
  {
    key: "project",
    label: "Proyecto",
    sortable: true,
    sortKey: "project",
    exportValue: (row) => row.project,
    render: (row) => row.project,
  },
  {
    key: "responsible",
    label: "Responsable",
    sortable: true,
    sortKey: "responsible",
    exportValue: (row) => row.responsible,
    render: (row) => row.responsible,
  },
  {
    key: "status",
    label: "Estado",
    sortable: true,
    sortKey: "status",
    exportValue: (row) => row.status.label,
    render: (row) => (
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${row.status.className}`}
      >
        {row.status.label}
      </span>
    ),
  },
  {
    key: "dueDate",
    label: "Vencimiento",
    sortable: true,
    sortKey: "dueDate",
    exportValue: (row) => row.dueDateLabel,
    render: (row) => row.dueDateLabel,
  },
  {
    key: "body",
    label: "Detalle",
    sortable: true,
    sortKey: "body",
    exportValue: (row) => row.body,
    cellClassName: "min-w-[340px]",
    render: (row) => row.body,
  },
];

const buildRequirementDetailColumns = () => [
  ...buildCommitmentDetailColumns().filter((column) => column.key !== "dueDate"),
  {
    key: "priority",
    label: "Prioridad",
    sortable: true,
    sortKey: "priorityWeight",
    exportValue: (row) => row.priorityLabel,
    render: (row) => row.priorityLabel,
  },
  {
    key: "entity",
    label: "Entidad",
    sortable: true,
    sortKey: "title",
    exportValue: (row) => row.entity || "—",
    render: (row) => row.entity || "—",
  },
];

const buildCommitmentAggregateColumns = (labelKey, labelText) => [
  {
    key: labelKey,
    label: labelText,
    sortable: true,
    sortKey: labelKey,
    exportValue: (row) => row[labelKey] ?? row.label,
    render: (row) => row[labelKey] ?? row.label,
  },
  {
    key: "totalRecords",
    label: "Total",
    sortable: true,
    sortKey: "totalRecords",
    exportValue: (row) => formatNumber(row.totalRecords),
    render: (row) => formatNumber(row.totalRecords),
  },
  {
    key: "agreementCount",
    label: "Acuerdos",
    sortable: true,
    sortKey: "agreementCount",
    exportValue: (row) => formatNumber(row.agreementCount),
    render: (row) => formatNumber(row.agreementCount),
  },
  {
    key: "requirementCount",
    label: "Requerimientos",
    sortable: true,
    sortKey: "requirementCount",
    exportValue: (row) => formatNumber(row.requirementCount),
    render: (row) => formatNumber(row.requirementCount),
  },
  {
    key: "pendingRecords",
    label: "Pendientes",
    sortable: true,
    sortKey: "pendingRecords",
    exportValue: (row) => formatNumber(row.pendingRecords),
    render: (row) => formatNumber(row.pendingRecords),
  },
  {
    key: "expiredCount",
    label: "Vencidos",
    sortable: true,
    sortKey: "expiredCount",
    exportValue: (row) => formatNumber(row.expiredCount),
    render: (row) => formatNumber(row.expiredCount),
  },
  {
    key: "lastDate",
    label: "Última actividad",
    sortable: true,
    sortKey: "lastDate",
    exportValue: (row) => row.lastDateLabel,
    render: (row) => row.lastDateLabel,
  },
];

const defaultMinuteOrder = (rows = []) =>
  [...rows].sort((left, right) => {
    if (left.dateTimestamp !== right.dateTimestamp) {
      return right.dateTimestamp - left.dateTimestamp;
    }

    return compareByLabel(left.rawId, right.rawId);
  });

const defaultAggregateOrder = (rows = []) =>
  [...rows].sort((left, right) => {
    if (right.totalRecords !== left.totalRecords) {
      return right.totalRecords - left.totalRecords;
    }

    return compareByLabel(
      left.label ?? left.client ?? left.project ?? left.responsible,
      right.label ?? right.client ?? right.project ?? right.responsible
    );
  });

const defaultCatalogOrder = (rows = []) =>
  [...rows].sort((left, right) =>
    compareByLabel(left.label ?? left.client ?? left.project, right.label ?? right.client ?? right.project)
  );

const defaultInactiveOrder = (rows = []) =>
  [...rows].sort((left, right) => {
    const leftDays = left.daysWithoutActivity ?? Number.MAX_SAFE_INTEGER;
    const rightDays = right.daysWithoutActivity ?? Number.MAX_SAFE_INTEGER;
    if (rightDays !== leftDays) return rightDays - leftDays;
    return compareByLabel(left.label ?? left.client ?? left.project, right.label ?? right.client ?? right.project);
  });

const defaultDocumentLoadOrder = (rows = []) =>
  [...rows].sort((left, right) => {
    if ((right.documentLoadScore ?? 0) !== (left.documentLoadScore ?? 0)) {
      return (right.documentLoadScore ?? 0) - (left.documentLoadScore ?? 0);
    }
    if ((right.totalRecords ?? 0) !== (left.totalRecords ?? 0)) {
      return (right.totalRecords ?? 0) - (left.totalRecords ?? 0);
    }
    return compareByLabel(left.label ?? left.client ?? left.project, right.label ?? right.client ?? right.project);
  });

const buildGeneralSummaryCards = ({ minuteRows, catalogTotals }) => [
  buildSummaryCard(
    "Minutas del período",
    minuteRows.length,
    `${formatNumber(
      minuteRows.filter((row) => row.status.key === "completed").length
    )} publicadas`,
    "fileLines",
    "sky"
  ),
  buildSummaryCard(
    "Clientes con actividad",
    new Set(minuteRows.map((row) => row.client).filter(Boolean)).size,
    catalogTotals.clients
      ? `${formatNumber(catalogTotals.clients)} activos en catálogo`
      : "Con registros visibles en el reporte",
    "business",
    "emerald"
  ),
  buildSummaryCard(
    "Proyectos con actividad",
    new Set(minuteRows.map((row) => row.project).filter(Boolean)).size,
    catalogTotals.projects
      ? `${formatNumber(catalogTotals.projects)} activos en catálogo`
      : "Con movimiento documental filtrado",
    "diagramProject",
    "amber"
  ),
  buildSummaryCard(
    "Backlog pendiente",
    minuteRows.filter((row) => isBacklogStatus(row.status.key)).length,
    "Incluye procesamiento, edición y revisión",
    "clock",
    "rose"
  ),
];

const buildClientExecutiveSummaryCards = ({ minuteRows, reportRows }) => [
  buildSummaryCard(
    "Clientes visibles",
    reportRows.length,
    "Clientes con actividad dentro del filtro actual",
    "business",
    "sky"
  ),
  buildSummaryCard(
    "Registros del período",
    minuteRows.length,
    "Base documental consolidada para el resumen",
    "fileLines",
    "emerald"
  ),
  buildSummaryCard(
    "Proyectos con actividad",
    new Set(minuteRows.map((row) => row.project).filter(Boolean)).size,
    "Proyectos vinculados a clientes con movimiento",
    "diagramProject",
    "amber"
  ),
  buildSummaryCard(
    "Backlog pendiente",
    minuteRows.filter((row) => isBacklogStatus(row.status.key)).length,
    "Registros aún abiertos o en tránsito",
    "clock",
    "rose"
  ),
];

const buildProjectExecutiveSummaryCards = ({ minuteRows, reportRows }) => [
  buildSummaryCard(
    "Proyectos visibles",
    reportRows.length,
    "Proyectos con actividad dentro del filtro actual",
    "diagramProject",
    "sky"
  ),
  buildSummaryCard(
    "Registros del período",
    minuteRows.length,
    "Base documental consolidada para el resumen",
    "fileLines",
    "emerald"
  ),
  buildSummaryCard(
    "Clientes involucrados",
    new Set(minuteRows.map((row) => row.client).filter(Boolean)).size,
    "Clientes asociados a proyectos con movimiento",
    "business",
    "amber"
  ),
  buildSummaryCard(
    "Backlog pendiente",
    minuteRows.filter((row) => isBacklogStatus(row.status.key)).length,
    "Registros aún abiertos o en tránsito",
    "clock",
    "rose"
  ),
];

const buildProductionSummaryCards = ({ minuteRows, reportRows }) => [
  buildSummaryCard(
    "Días con movimiento",
    reportRows.length,
    "Fechas con minutas visibles en el período",
    "calendar",
    "sky"
  ),
  buildSummaryCard(
    "Minutas del período",
    minuteRows.length,
    "Registros documentales dentro del rango consultado",
    "fileLines",
    "emerald"
  ),
  buildSummaryCard(
    "Completadas",
    minuteRows.filter((row) => row.status.key === "completed").length,
    "Minutas cerradas o publicadas",
    "clipboardCheck",
    "amber"
  ),
  buildSummaryCard(
    "Backlog pendiente",
    minuteRows.filter((row) => isBacklogStatus(row.status.key)).length,
    "Volumen todavía no resuelto",
    "clock",
    "rose"
  ),
];

const buildStatusSummaryCards = ({ minuteRows, reportRows }) => [
  buildSummaryCard(
    "Estados visibles",
    reportRows.length,
    "Estados con presencia en el período consultado",
    "clipboardList",
    "sky"
  ),
  buildSummaryCard(
    "Minutas del período",
    minuteRows.length,
    "Base usada para la distribución operacional",
    "fileLines",
    "emerald"
  ),
  buildSummaryCard(
    "Clientes impactados",
    new Set(minuteRows.map((row) => row.client).filter(Boolean)).size,
    "Clientes representados en la distribución",
    "business",
    "amber"
  ),
  buildSummaryCard(
    "Estados abiertos",
    reportRows.filter((row) => isBacklogStatus(row.statusKey)).length,
    "Estados distintos de completado, cancelado o eliminado",
    "filter",
    "rose"
  ),
];

const buildResponsibleSummaryCards = ({ minuteRows, reportRows }) => [
  buildSummaryCard(
    "Responsables visibles",
    reportRows.length,
    "Responsables con actividad dentro del filtro",
    "users",
    "sky"
  ),
  buildSummaryCard(
    "Minutas del período",
    minuteRows.length,
    "Carga documental distribuida por responsable",
    "fileLines",
    "emerald"
  ),
  buildSummaryCard(
    "Clientes atendidos",
    new Set(minuteRows.map((row) => row.client).filter(Boolean)).size,
    "Clientes cubiertos por responsables activos",
    "business",
    "amber"
  ),
  buildSummaryCard(
    "Completadas",
    minuteRows.filter((row) => row.status.key === "completed").length,
    "Minutas ya cerradas o publicadas",
    "clipboardCheck",
    "rose"
  ),
];

const buildClientSummaryCards = ({ minuteRows, reportRows }) => [
  buildSummaryCard(
    "Clientes visibles",
    reportRows.length,
    "Clientes con minutas dentro del filtro",
    "business",
    "sky"
  ),
  buildSummaryCard(
    "Minutas del período",
    minuteRows.length,
    "Base documental agrupada por cliente",
    "fileLines",
    "emerald"
  ),
  buildSummaryCard(
    "En revisión",
    minuteRows.filter((row) => row.status.key === "preview").length,
    "Minutas que siguen en etapa editorial",
    "clipboardCheck",
    "amber"
  ),
  buildSummaryCard(
    "Backlog pendiente",
    minuteRows.filter((row) => isBacklogStatus(row.status.key)).length,
    "Registros aún no completados",
    "clock",
    "rose"
  ),
];

const buildProjectSummaryCards = ({ minuteRows, reportRows }) => [
  buildSummaryCard(
    "Proyectos visibles",
    reportRows.length,
    "Proyectos con minutas dentro del filtro",
    "diagramProject",
    "sky"
  ),
  buildSummaryCard(
    "Minutas del período",
    minuteRows.length,
    "Base documental agrupada por proyecto",
    "fileLines",
    "emerald"
  ),
  buildSummaryCard(
    "En revisión",
    minuteRows.filter((row) => row.status.key === "preview").length,
    "Minutas que siguen en etapa editorial",
    "clipboardCheck",
    "amber"
  ),
  buildSummaryCard(
    "Backlog pendiente",
    minuteRows.filter((row) => isBacklogStatus(row.status.key)).length,
    "Registros aún no completados",
    "clock",
    "rose"
  ),
];

const buildReviewSummaryCards = ({ minuteRows }) => [
  buildSummaryCard(
    "Minutas en revisión",
    minuteRows.length,
    "Registros actualmente en etapa editorial",
    "clipboardCheck",
    "sky"
  ),
  buildSummaryCard(
    "Clientes con revisión",
    new Set(minuteRows.map((row) => row.client).filter(Boolean)).size,
    "Clientes con minutas aún en revisión",
    "business",
    "emerald"
  ),
  buildSummaryCard(
    "Proyectos con revisión",
    new Set(minuteRows.map((row) => row.project).filter(Boolean)).size,
    "Proyectos que siguen abiertos editorialmente",
    "diagramProject",
    "amber"
  ),
  buildSummaryCard(
    "Responsables involucrados",
    new Set(minuteRows.map((row) => row.responsible).filter(Boolean)).size,
    "Personas con registros en revisión",
    "users",
    "rose"
  ),
];

const buildReprocessSummaryCards = ({ minuteRows }) => [
  buildSummaryCard(
    "Reprocesos listados",
    minuteRows.length,
    "Cada fila representa un reproceso historico independiente",
    "arrowsRotate",
    "sky"
  ),
  buildSummaryCard(
    "Minutas afectadas",
    new Set(minuteRows.map((row) => row.rawId).filter(Boolean)).size,
    "Cantidad unica de minutas que registran al menos un reproceso",
    "fileLines",
    "emerald"
  ),
  buildSummaryCard(
    "Intentos exitosos",
    minuteRows.filter((row) => row.status.key === "completed").length,
    "Reprocesos que se recuperaron y siguieron flujo",
    "checkCircle",
    "amber"
  ),
  buildSummaryCard(
    "Tokens de reproceso",
    minuteRows.reduce((sum, row) => sum + Number(row.totalTokens ?? 0), 0),
    "Suma de entrada y salida consumida por todos los reprocesos visibles",
    "fileLines",
    "rose"
  ),
];

const buildCycleSummaryCards = ({ minuteRows }) => {
  const totalCycleDuration = minuteRows.reduce(
    (sum, row) => sum + Number(row.totalCycleDurationMs ?? 0),
    0
  );
  const averageCycleDuration = minuteRows.length
    ? Math.round(totalCycleDuration / minuteRows.length)
    : 0;

  return [
    buildSummaryCard(
      "Minutas trazadas",
      minuteRows.length,
      "Solo considera minutas con historia explícita de transiciones",
      "clock",
      "sky"
    ),
    {
      label: "Ciclo promedio",
      value: formatDurationMs(averageCycleDuration),
      helper: "Promedio visible del ciclo total entre minutas trazadas",
      icon: "chartLine",
      tone: "emerald",
    },
    buildSummaryCard(
      "Ciclos cerrados",
      minuteRows.filter((row) => row.cycleClosed).length,
      "Minutas que ya llegaron a un estado terminal registrado",
      "clipboardCheck",
      "amber"
    ),
    buildSummaryCard(
      "Vueltas a edición",
      minuteRows.reduce((sum, row) => sum + Number(row.returnToEditCount ?? 0), 0),
      "Cantidad total de regresiones desde revisión hacia edición",
      "arrowsRotate",
      "rose"
    ),
  ];
};

const buildClientPortfolioSummaryCards = ({ minuteRows, reportRows }) => [
  buildSummaryCard(
    "Clientes en cartera",
    reportRows.length,
    "Clientes activos visibles bajo los filtros aplicados",
    "business",
    "sky"
  ),
  buildSummaryCard(
    "Clientes con actividad",
    reportRows.filter((row) => row.totalRecords > 0).length,
    "Con al menos una minuta dentro del período filtrado",
    "fileLines",
    "emerald"
  ),
  buildSummaryCard(
    "Confidenciales",
    reportRows.filter((row) => row.isConfidential).length,
    "Clientes marcados como confidenciales",
    "shield",
    "amber"
  ),
  buildSummaryCard(
    "Minutas asociadas",
    minuteRows.length,
    "Actividad documental usada para calcular la cartera",
    "clipboardList",
    "rose"
  ),
];

const buildProjectPortfolioSummaryCards = ({ minuteRows, reportRows }) => [
  buildSummaryCard(
    "Proyectos en cartera",
    reportRows.length,
    "Proyectos activos visibles bajo los filtros aplicados",
    "diagramProject",
    "sky"
  ),
  buildSummaryCard(
    "Proyectos con actividad",
    reportRows.filter((row) => row.totalRecords > 0).length,
    "Con al menos una minuta dentro del período filtrado",
    "fileLines",
    "emerald"
  ),
  buildSummaryCard(
    "Con automatización",
    reportRows.filter((row) => row.autoSendCount > 0).length,
    "Proyectos con envío automático configurado",
    "arrowsRotate",
    "amber"
  ),
  buildSummaryCard(
    "Confidenciales",
    reportRows.filter((row) => row.isConfidential).length,
    "Proyectos marcados como confidenciales",
    "shield",
    "rose"
  ),
];

const buildInactiveClientSummaryCards = ({ reportRows }) => [
  buildSummaryCard(
    "Clientes sin actividad",
    reportRows.length,
    "Sin minutas dentro del período filtrado",
    "clock",
    "sky"
  ),
  buildSummaryCard(
    "Confidenciales",
    reportRows.filter((row) => row.isConfidential).length,
    "Cuentas sensibles sin movimiento documental reciente",
    "shield",
    "amber"
  ),
  buildSummaryCard(
    "Prioridad alta",
    reportRows.filter((row) => normalizeText(row.priorityLabel).includes("alta")).length,
    "Clientes priorizados sin actividad en el período",
    "filter",
    "rose"
  ),
  buildSummaryCard(
    "Sin historial visible",
    reportRows.filter((row) => !row.lastDateTimestamp).length,
    "Sin actividad documental registrada en la fuente cargada",
    "clipboardList",
    "emerald"
  ),
];

const buildInactiveProjectSummaryCards = ({ reportRows }) => [
  buildSummaryCard(
    "Proyectos sin actividad",
    reportRows.length,
    "Sin minutas dentro del período filtrado",
    "clock",
    "sky"
  ),
  buildSummaryCard(
    "Clientes involucrados",
    new Set(reportRows.map((row) => row.client).filter(Boolean)).size,
    "Clientes con proyectos sin movimiento reciente",
    "business",
    "emerald"
  ),
  buildSummaryCard(
    "Confidenciales",
    reportRows.filter((row) => row.isConfidential).length,
    "Proyectos sensibles sin actividad en el período",
    "shield",
    "amber"
  ),
  buildSummaryCard(
    "Sin historial visible",
    reportRows.filter((row) => !row.lastDateTimestamp).length,
    "Sin actividad documental registrada en la fuente cargada",
    "clipboardList",
    "rose"
  ),
];

const buildClientLoadSummaryCards = ({ minuteRows, reportRows }) => [
  buildSummaryCard(
    "Clientes con carga",
    reportRows.length,
    "Clientes con actividad documental dentro del filtro",
    "business",
    "sky"
  ),
  buildSummaryCard(
    "Minutas consideradas",
    minuteRows.length,
    "Base usada para calcular la carga documental",
    "fileLines",
    "emerald"
  ),
  buildSummaryCard(
    "En revisión",
    minuteRows.filter((row) => row.status.key === "preview").length,
    "Actividad editorial que aumenta la carga visible",
    "clipboardCheck",
    "amber"
  ),
  buildSummaryCard(
    "Backlog",
    minuteRows.filter((row) => isBacklogStatus(row.status.key)).length,
    "Registros abiertos considerados en el puntaje",
    "clock",
    "rose"
  ),
];

const buildProjectLoadSummaryCards = ({ minuteRows, reportRows }) => [
  buildSummaryCard(
    "Proyectos con carga",
    reportRows.length,
    "Proyectos con actividad documental dentro del filtro",
    "diagramProject",
    "sky"
  ),
  buildSummaryCard(
    "Minutas consideradas",
    minuteRows.length,
    "Base usada para calcular la carga documental",
    "fileLines",
    "emerald"
  ),
  buildSummaryCard(
    "En revisión",
    minuteRows.filter((row) => row.status.key === "preview").length,
    "Actividad editorial que aumenta la carga visible",
    "clipboardCheck",
    "amber"
  ),
  buildSummaryCard(
    "Backlog",
    minuteRows.filter((row) => isBacklogStatus(row.status.key)).length,
    "Registros abiertos considerados en el puntaje",
    "clock",
    "rose"
  ),
];

const buildQueueStatusSummaryCards = ({ reportRows }) => [
  buildSummaryCard(
    "Colas monitoreadas",
    reportRows.length,
    "Colas operativas incluidas en la lectura actual",
    "clipboardList",
    "sky"
  ),
  buildSummaryCard(
    "Backlog total",
    reportRows.reduce((sum, row) => sum + Number(row.size ?? 0), 0),
    "Suma de jobs pendientes en todas las colas",
    "clock",
    "emerald"
  ),
  buildSummaryCard(
    "Alertas activas",
    reportRows.filter((row) => row.alertActive || row.isWarning).length,
    "Colas que superan umbral o requieren revisión",
    "filter",
    "amber"
  ),
  buildSummaryCard(
    "DLQ pendiente",
    reportRows.find((row) => row.queue === "queue:dlq")?.size ?? 0,
    "Jobs fallidos apartados para revisión manual",
    "bug",
    "rose"
  ),
];

const buildProcessingFailureSummaryCards = ({ minuteRows }) => [
  buildSummaryCard(
    "Fallos visibles",
    minuteRows.length,
    "Minutas en estado de error dentro del filtro",
    "bug",
    "sky"
  ),
  buildSummaryCard(
    "Fallo IA",
    minuteRows.filter((row) => row.status.key === "llm-failed").length,
    "Errores asociados al procesamiento IA",
    "brain",
    "amber"
  ),
  buildSummaryCard(
    "Error de proceso",
    minuteRows.filter((row) => row.status.key === "processing-error").length,
    "Errores técnicos del flujo operacional",
    "filter",
    "rose"
  ),
  buildSummaryCard(
    "Reprocesables",
    minuteRows.filter((row) => row.canReprocess).length,
    "Registros con reproceso disponible",
    "arrowsRotate",
    "emerald"
  ),
];

const buildRecoverySummaryCards = ({ minuteRows }) => [
  buildSummaryCard(
    "Reprocesos",
    minuteRows.length,
    "Intentos históricos visibles en el filtro",
    "arrowsRotate",
    "sky"
  ),
  buildSummaryCard(
    "Recuperados",
    minuteRows.filter((row) => row.status.key === "completed").length,
    "Intentos que cerraron correctamente",
    "checkCircle",
    "emerald"
  ),
  buildSummaryCard(
    "Con error",
    minuteRows.filter((row) => ["llm-failed", "processing-error"].includes(row.status.key)).length,
    "Intentos que terminaron con falla",
    "bug",
    "rose"
  ),
  buildSummaryCard(
    "Minutas afectadas",
    new Set(minuteRows.map((row) => row.rawId).filter(Boolean)).size,
    "Minutas únicas con historial de reproceso",
    "fileLines",
    "amber"
  ),
];

const buildProviderValidationSummaryCards = ({ reportRows }) => [
  buildSummaryCard(
    "Providers",
    reportRows.length,
    "Configuraciones IA visibles",
    "database",
    "sky"
  ),
  buildSummaryCard(
    "Válidos",
    reportRows.filter((row) => row.statusKey === "valid").length,
    "Providers validados correctamente",
    "checkCircle",
    "emerald"
  ),
  buildSummaryCard(
    "Con error",
    reportRows.filter((row) => !["valid", "unvalidated"].includes(row.statusKey)).length,
    "Providers con error o validación fallida",
    "bug",
    "rose"
  ),
  buildSummaryCard(
    "Sin validar",
    reportRows.filter((row) => row.statusKey === "unvalidated").length,
    "Configuraciones pendientes de validación",
    "clock",
    "amber"
  ),
];

const buildSystemAlertSummaryCards = ({ reportRows }) => [
  buildSummaryCard(
    "Alertas",
    reportRows.length,
    "Eventos operativos activos o últimos errores relevantes",
    "filter",
    "sky"
  ),
  buildSummaryCard(
    "Colas",
    reportRows.filter((row) => row.alertType === "Cola").length,
    "Alertas provenientes de monitoreo de colas",
    "clipboardList",
    "amber"
  ),
  buildSummaryCard(
    "Rutinas",
    reportRows.filter((row) => row.alertType === "Rutina").length,
    "Alertas provenientes de rutinas de mantenimiento",
    "arrowsRotate",
    "rose"
  ),
  buildSummaryCard(
    "Críticas",
    reportRows.filter((row) => row.statusKey === "critical" || row.statusKey === "error").length,
    "Alertas con estado crítico o error",
    "bug",
    "emerald"
  ),
];

const buildTopicTagSummaryCards = ({ reportRows }) => [
  buildSummaryCard(
    "Tags visibles",
    reportRows.length,
    "Etiquetas operacionales con actividad documental",
    "tags",
    "sky"
  ),
  buildSummaryCard(
    "Minutas asociadas",
    reportRows.reduce((sum, row) => sum + Number(row.totalRecords ?? 0), 0),
    "Suma de minutas vinculadas a tags visibles",
    "fileLines",
    "emerald"
  ),
  buildSummaryCard(
    "Categorías",
    new Set(reportRows.map((row) => row.category).filter(Boolean)).size,
    "Categorías funcionales representadas",
    "filter",
    "amber"
  ),
  buildSummaryCard(
    "Clientes cubiertos",
    reportRows.reduce((sum, row) => sum + Number(row.clientCount ?? 0), 0),
    "Cobertura acumulada por etiqueta",
    "business",
    "rose"
  ),
];

const buildAiTagSummaryCards = ({ reportRows }) => [
  buildSummaryCard(
    "AI tags visibles",
    reportRows.length,
    "Etiquetas sugeridas por IA con detecciones",
    "brain",
    "sky"
  ),
  buildSummaryCard(
    "Detecciones",
    reportRows.reduce((sum, row) => sum + Number(row.detectedCount ?? 0), 0),
    "Eventos de detección IA en versiones de minuta",
    "clipboardList",
    "emerald"
  ),
  buildSummaryCard(
    "Minutas impactadas",
    reportRows.reduce((sum, row) => sum + Number(row.totalRecords ?? 0), 0),
    "Minutas con presencia de AI tags",
    "fileLines",
    "amber"
  ),
  buildSummaryCard(
    "AI tags activos",
    reportRows.filter((row) => row.statusKey === "active").length,
    "Tags IA actualmente activos en catálogo",
    "checkCircle",
    "rose"
  ),
];

const buildAiTagConversionSummaryCards = ({ reportRows }) => [
  buildSummaryCard(
    "Mapeos visibles",
    reportRows.length,
    "Relaciones entre AI tags y tags operacionales",
    "tags",
    "sky"
  ),
  buildSummaryCard(
    "Convertidos",
    reportRows.filter((row) => row.statusKey === "converted").length,
    "AI tags con destino operacional definido",
    "checkCircle",
    "emerald"
  ),
  buildSummaryCard(
    "Sin conversión",
    reportRows.filter((row) => row.statusKey === "unconverted").length,
    "AI tags detectados sin mapeo operacional",
    "filter",
    "amber"
  ),
  buildSummaryCard(
    "Detecciones",
    reportRows.reduce((sum, row) => sum + Number(row.detectedCount ?? 0), 0),
    "Volumen de detección detrás de los mapeos",
    "brain",
    "rose"
  ),
];

const buildTopicTrendSummaryCards = ({ reportRows }) => [
  buildSummaryCard(
    "Puntos de tendencia",
    reportRows.length,
    "Combinaciones de período y tag con actividad",
    "chartLine",
    "sky"
  ),
  buildSummaryCard(
    "Períodos",
    new Set(reportRows.map((row) => row.period).filter(Boolean)).size,
    "Meses representados en el resultado",
    "calendar",
    "emerald"
  ),
  buildSummaryCard(
    "Tags en tendencia",
    new Set(reportRows.map((row) => row.tag).filter(Boolean)).size,
    "Temas operacionales con movimiento",
    "tags",
    "amber"
  ),
  buildSummaryCard(
    "Minutas asociadas",
    reportRows.reduce((sum, row) => sum + Number(row.totalRecords ?? 0), 0),
    "Volumen documental agregado por período",
    "fileLines",
    "rose"
  ),
];

const buildReviewObservationSummaryCards = ({ reportRows }) => [
  buildSummaryCard(
    "Observaciones",
    reportRows.length,
    "Comentarios externos recibidos en versiones de minuta",
    "clipboardList",
    "sky"
  ),
  buildSummaryCard(
    "Pendientes",
    reportRows.filter((row) => row.statusKey === "new").length,
    "Observaciones aún sin resolución editorial",
    "clock",
    "amber"
  ),
  buildSummaryCard(
    "Autores externos",
    new Set(reportRows.map((row) => row.authorEmail).filter(Boolean)).size,
    "Participantes externos que dejaron comentarios",
    "users",
    "emerald"
  ),
  buildSummaryCard(
    "Minutas afectadas",
    new Set(reportRows.map((row) => row.rawId).filter(Boolean)).size,
    "Minutas con observaciones registradas",
    "fileLines",
    "rose"
  ),
];

const buildReviewResolutionSummaryCards = ({ reportRows }) => [
  buildSummaryCard(
    "Observaciones resueltas",
    reportRows.filter((row) => row.statusKey !== "new").length,
    "Observaciones con decisión editorial",
    "clipboardCheck",
    "sky"
  ),
  buildSummaryCard(
    "Insertadas",
    reportRows.filter((row) => row.statusKey === "inserted").length,
    "Observaciones incorporadas directamente",
    "checkCircle",
    "emerald"
  ),
  buildSummaryCard(
    "Aprobadas",
    reportRows.filter((row) => row.statusKey === "approved").length,
    "Observaciones aprobadas para actualización manual",
    "filter",
    "amber"
  ),
  buildSummaryCard(
    "Rechazadas",
    reportRows.filter((row) => row.statusKey === "rejected").length,
    "Observaciones descartadas por edición",
    "bug",
    "rose"
  ),
];

const buildReviewFrictionSummaryCards = ({ reportRows }) => [
  buildSummaryCard(
    "Minutas con fricción",
    reportRows.length,
    "Minutas con vueltas a edición o alta interacción de estados",
    "filter",
    "sky"
  ),
  buildSummaryCard(
    "Vueltas a edición",
    reportRows.reduce((sum, row) => sum + Number(row.returnToEditCount ?? 0), 0),
    "Regresiones acumuladas desde revisión",
    "arrowsRotate",
    "amber"
  ),
  buildSummaryCard(
    "Ciclos cerrados",
    reportRows.filter((row) => row.cycleClosed).length,
    "Minutas con ciclo terminal registrado",
    "clipboardCheck",
    "emerald"
  ),
  buildSummaryCard(
    "Clientes impactados",
    new Set(reportRows.map((row) => row.client).filter(Boolean)).size,
    "Clientes representados en el reporte",
    "business",
    "rose"
  ),
];

const buildPublicationSummaryCards = ({ reportRows }) => [
  buildSummaryCard(
    "Publicaciones",
    reportRows.length,
    "Minutas que alcanzaron publicación final",
    "clipboardCheck",
    "sky"
  ),
  buildSummaryCard(
    "Clientes",
    new Set(reportRows.map((row) => row.client).filter(Boolean)).size,
    "Clientes con publicaciones finalizadas",
    "business",
    "emerald"
  ),
  buildSummaryCard(
    "Proyectos",
    new Set(reportRows.map((row) => row.project).filter(Boolean)).size,
    "Proyectos con publicaciones finalizadas",
    "diagramProject",
    "amber"
  ),
  buildSummaryCard(
    "Con ciclo trazado",
    reportRows.filter((row) => Number(row.totalCycleDurationMs ?? 0) > 0).length,
    "Publicaciones con duración de ciclo disponible",
    "clock",
    "rose"
  ),
];

const buildEmailDeliverySummaryCards = ({ reportRows }) => [
  buildSummaryCard(
    "Correos",
    reportRows.length,
    "Eventos de correo asociados al flujo editorial",
    "envelope",
    "sky"
  ),
  buildSummaryCard(
    "Enviados",
    reportRows.filter((row) => row.statusKey === "sent").length,
    "Correos confirmados por el worker SMTP",
    "clipboardCheck",
    "emerald"
  ),
  buildSummaryCard(
    "Fallidos",
    reportRows.filter((row) => row.statusKey === "failed").length,
    "Intentos con error registrado",
    "bug",
    "rose"
  ),
  buildSummaryCard(
    "Destinatarios",
    reportRows.reduce((sum, row) => sum + Number(row.recipientCount ?? 0), 0),
    "Total de destinatarios principales y copias",
    "users",
    "amber"
  ),
];

const buildCommitmentSummaryCards = ({ reportRows }) => [
  buildSummaryCard(
    "Acuerdos",
    reportRows.filter((row) => row.itemType === "agreement").length,
    "Compromisos declarados en minutas visibles",
    "clipboardList",
    "sky"
  ),
  buildSummaryCard(
    "Pendientes",
    reportRows.filter((row) => row.itemType === "agreement" && !isClosedCommitmentStatus(row.statusKey)).length,
    "Acuerdos aún abiertos documentalmente",
    "clock",
    "amber"
  ),
  buildSummaryCard(
    "Vencidos",
    reportRows.filter((row) => row.isExpired).length,
    "Acuerdos con fecha expirada y estado abierto",
    "bug",
    "rose"
  ),
  buildSummaryCard(
    "Responsables",
    new Set(reportRows.map((row) => row.responsible).filter(Boolean)).size,
    "Personas mencionadas como responsables",
    "users",
    "emerald"
  ),
];

const buildRequirementSummaryCards = ({ reportRows }) => [
  buildSummaryCard(
    "Requerimientos",
    reportRows.filter((row) => row.itemType === "requirement").length,
    "Requerimientos documentados en minutas visibles",
    "clipboardList",
    "sky"
  ),
  buildSummaryCard(
    "Alta prioridad",
    reportRows.filter((row) => row.priority === "high" || row.priority === "critical").length,
    "Requerimientos críticos o altos",
    "filter",
    "amber"
  ),
  buildSummaryCard(
    "Pendientes",
    reportRows.filter((row) => !isClosedCommitmentStatus(row.statusKey)).length,
    "Requerimientos aún abiertos documentalmente",
    "clock",
    "rose"
  ),
  buildSummaryCard(
    "Responsables",
    new Set(reportRows.map((row) => row.responsible).filter(Boolean)).size,
    "Personas mencionadas como responsables",
    "users",
    "emerald"
  ),
];

const buildCommitmentContextSummaryCards = ({ reportRows }) => [
  buildSummaryCard(
    "Agrupaciones",
    reportRows.length,
    "Clientes o proyectos con seguimiento documental",
    "business",
    "sky"
  ),
  buildSummaryCard(
    "Acuerdos",
    reportRows.reduce((sum, row) => sum + Number(row.agreementCount ?? 0), 0),
    "Acuerdos consolidados en el resultado",
    "clipboardCheck",
    "emerald"
  ),
  buildSummaryCard(
    "Requerimientos",
    reportRows.reduce((sum, row) => sum + Number(row.requirementCount ?? 0), 0),
    "Requerimientos consolidados en el resultado",
    "clipboardList",
    "amber"
  ),
  buildSummaryCard(
    "Vencidos",
    reportRows.reduce((sum, row) => sum + Number(row.expiredCount ?? 0), 0),
    "Acuerdos vencidos dentro del consolidado",
    "bug",
    "rose"
  ),
];

const REPORT_DEFINITIONS = [
  {
    id: "gestion-executive-general",
    path: "/reports/management/executive-summary-general",
    title: "Resumen Ejecutivo General",
    description:
      "Reporte consolidado de movimientos operacionales asociados a clientes, proyectos y responsables internos.",
    pdfSlug: "resumen-ejecutivo-general",
    pdfReportKey: "gestion-resumen-ejecutivo-general",
    pdfDescription:
      "Vista consolidada de actividad documental, clientes, proyectos y estado operacional del período seleccionado.",
    tableDescription:
      "Detalle tabular completo del mismo conjunto de registros visible al momento de generar el reporte.",
    buildRows: ({ minuteRows }) => minuteRows,
    buildDefaultRowsOrder: defaultMinuteOrder,
    buildSummaryCards: buildGeneralSummaryCards,
    buildCharts: ({ minuteRows }) => [
      {
        key: "trend",
        type: "trend",
        title: "Evolución del período",
        subtitle:
          "Compara cuántas minutas aparecen por fecha y cuántas de ellas ya están completadas.",
        footer: "Se calcula sobre el mismo universo filtrado que alimenta la tabla.",
        data: buildDailyTrend(minuteRows),
      },
      {
        key: "status",
        type: "status",
        title: "Distribución por estado",
        subtitle:
          "Muestra la proporción operacional entre procesamiento, edición, revisión, publicación y otros estados visibles.",
        footer:
          "Cada segmento refleja exactamente las filas actualmente visibles en el reporte filtrado.",
        data: buildStatusDistribution(minuteRows),
      },
    ],
    columns: buildMinuteDetailColumns(),
  },
  {
    id: "gestion-executive-client",
    path: "/reports/management/executive-summary-client",
    title: "Resumen Ejecutivo por Cliente",
    description:
      "Resume la actividad documental consolidando volumen, cobertura y backlog visible por cliente.",
    pdfSlug: "resumen-ejecutivo-cliente",
    pdfReportKey: "gestion-resumen-ejecutivo-cliente",
    pdfDescription:
      "Salida ejecutiva del movimiento operacional agrupado por cliente según los filtros aplicados.",
    tableDescription:
      "Detalle consolidado por cliente usando el mismo universo filtrado que alimenta el reporte.",
    buildRows: ({ minuteRows }) => buildAggregateByField(minuteRows, "client"),
    buildDefaultRowsOrder: defaultAggregateOrder,
    buildSummaryCards: buildClientExecutiveSummaryCards,
    buildCharts: ({ minuteRows }) => [
      {
        key: "client-activity",
        type: "bar",
        title: "Actividad por cliente",
        subtitle: "Ordena los clientes con mayor concentración documental dentro del período.",
        footer: "La barra compara el total de registros visibles por cliente.",
        data: buildActivityDistribution(minuteRows, "client"),
        seriesName: "Registros",
      },
      {
        key: "status",
        type: "status",
        title: "Distribución por estado",
        subtitle:
          "Entrega el balance operacional del universo consolidado por cliente.",
        footer:
          "La proporción se calcula sobre las mismas minutas filtradas usadas en la consolidación.",
        data: buildStatusDistribution(minuteRows),
      },
    ],
    columns: buildExecutiveClientColumns(),
  },
  {
    id: "gestion-executive-project",
    path: "/reports/management/executive-summary-project",
    title: "Resumen Ejecutivo por Proyecto",
    description:
      "Muestra la actividad documental y operativa agrupada por proyecto, destacando cobertura y backlog.",
    pdfSlug: "resumen-ejecutivo-proyecto",
    pdfReportKey: "gestion-resumen-ejecutivo-proyecto",
    pdfDescription:
      "Salida ejecutiva del movimiento operacional agrupado por proyecto según los filtros aplicados.",
    tableDescription:
      "Detalle consolidado por proyecto usando el mismo universo filtrado que alimenta el reporte.",
    buildRows: ({ minuteRows }) => buildAggregateByField(minuteRows, "project"),
    buildDefaultRowsOrder: defaultAggregateOrder,
    buildSummaryCards: buildProjectExecutiveSummaryCards,
    buildCharts: ({ minuteRows }) => [
      {
        key: "project-activity",
        type: "bar",
        title: "Actividad por proyecto",
        subtitle: "Ordena los proyectos con mayor concentración documental dentro del período.",
        footer: "La barra compara el total de registros visibles por proyecto.",
        data: buildActivityDistribution(minuteRows, "project"),
        seriesName: "Registros",
      },
      {
        key: "status",
        type: "status",
        title: "Distribución por estado",
        subtitle:
          "Entrega el balance operacional del universo consolidado por proyecto.",
        footer:
          "La proporción se calcula sobre las mismas minutas filtradas usadas en la consolidación.",
        data: buildStatusDistribution(minuteRows),
      },
    ],
    columns: buildExecutiveProjectColumns(),
  },
  {
    id: "gestion-minute-production",
    path: "/reports/management/minute-production",
    title: "Producción de Minutas",
    description:
      "Mide cuántas minutas ingresan, avanzan y se completan dentro del período consultado.",
    pdfSlug: "produccion-minutas",
    pdfReportKey: "gestion-produccion-minutas",
    pdfDescription:
      "Salida operacional del flujo documental diario de minutas según los filtros aplicados.",
    tableDescription:
      "Detalle consolidado por fecha para visualizar la producción diaria del período exportado.",
    buildRows: ({ minuteRows }) => buildDailyProductionRows(minuteRows),
    buildDefaultRowsOrder: (rows) => [...rows].sort((left, right) => right.dateTimestamp - left.dateTimestamp),
    buildSummaryCards: buildProductionSummaryCards,
    buildCharts: ({ minuteRows }) => [
      {
        key: "trend",
        type: "trend",
        title: "Evolución del período",
        subtitle:
          "Compara la carga diaria de minutas y cuántas de ellas ya quedaron completadas.",
        footer: "El gráfico usa exactamente las minutas visibles del período consultado.",
        data: buildDailyTrend(minuteRows),
      },
      {
        key: "status",
        type: "status",
        title: "Distribución por estado",
        subtitle:
          "Permite identificar cómo se reparte la producción entre estados abiertos y cerrados.",
        footer: "Cada segmento refleja el mismo universo que alimenta la tabla diaria.",
        data: buildStatusDistribution(minuteRows),
      },
    ],
    columns: buildProductionColumns(),
  },
  {
    id: "gestion-minute-status",
    path: "/reports/management/minutes-by-status",
    title: "Minutas por Estado",
    description:
      "Distribuye las minutas según su estado actual dentro del proceso operacional.",
    pdfSlug: "minutas-estado",
    pdfReportKey: "gestion-minutas-estado",
    pdfDescription:
      "Salida operacional que concentra el volumen documental según el estado actual de las minutas filtradas.",
    tableDescription:
      "Detalle consolidado por estado del mismo conjunto de minutas visibles al exportar el reporte.",
    buildRows: ({ minuteRows }) => buildStatusRows(minuteRows),
    buildDefaultRowsOrder: defaultAggregateOrder,
    buildSummaryCards: buildStatusSummaryCards,
    buildCharts: ({ minuteRows, reportRows }) => [
      {
        key: "status-bar",
        type: "bar",
        title: "Volumen por estado",
        subtitle: "Compara cuántos registros concentra cada estado del flujo operacional.",
        footer: "La comparación usa la misma base filtrada visible en la tabla.",
        data: reportRows.map((row) => ({ label: row.label, count: row.totalRecords })),
        seriesName: "Registros",
      },
      {
        key: "trend",
        type: "trend",
        title: "Evolución del período",
        subtitle:
          "Entrega contexto temporal para entender cuándo se concentró la actividad documental.",
        footer: "El gráfico permite contrastar volumen diario con minutas completadas.",
        data: buildDailyTrend(minuteRows),
      },
    ],
    columns: buildStatusColumns(),
  },
  {
    id: "gestion-minute-author",
    path: "/reports/management/minutes-by-author",
    title: "Minutas por Elaborador",
    description:
      "Compara la carga documental y la producción visible por responsable interno.",
    pdfSlug: "minutas-elaborador",
    pdfReportKey: "gestion-minutas-elaborador",
    pdfDescription:
      "Salida operacional que consolida la producción documental agrupada por responsable según el filtro aplicado.",
    tableDescription:
      "Detalle consolidado por responsable usando la misma base documental visible al exportar el reporte.",
    buildRows: ({ minuteRows }) => buildAggregateByField(minuteRows, "responsible"),
    buildDefaultRowsOrder: defaultAggregateOrder,
    buildSummaryCards: buildResponsibleSummaryCards,
    buildCharts: ({ minuteRows }) => [
      {
        key: "responsible-activity",
        type: "bar",
        title: "Producción por responsable",
        subtitle: "Ordena a los responsables con mayor concentración documental visible.",
        footer: "La barra compara el total de registros filtrados por responsable.",
        data: buildActivityDistribution(minuteRows, "responsible"),
        seriesName: "Registros",
      },
      {
        key: "status",
        type: "status",
        title: "Distribución por estado",
        subtitle:
          "Muestra si la carga por responsable está más concentrada en backlog o en cierre.",
        footer: "La proporción representa el mismo universo base del reporte.",
        data: buildStatusDistribution(minuteRows),
      },
    ],
    columns: buildResponsibleColumns(),
  },
  {
    id: "gestion-minute-client",
    path: "/reports/management/minutes-by-client",
    title: "Minutas por Cliente",
    description:
      "Identifica qué clientes concentran mayor volumen documental y revisión activa.",
    pdfSlug: "minutas-cliente",
    pdfReportKey: "gestion-minutas-cliente",
    pdfDescription:
      "Salida operacional que consolida el volumen de minutas agrupado por cliente según los filtros aplicados.",
    tableDescription:
      "Detalle consolidado por cliente usando el mismo universo visible al momento de la exportación.",
    buildRows: ({ minuteRows }) => buildAggregateByField(minuteRows, "client"),
    buildDefaultRowsOrder: defaultAggregateOrder,
    buildSummaryCards: buildClientSummaryCards,
    buildCharts: ({ minuteRows }) => [
      {
        key: "client-activity",
        type: "bar",
        title: "Minutas por cliente",
        subtitle: "Compara el volumen documental visible entre clientes del período.",
        footer: "La barra utiliza exactamente las minutas visibles bajo el filtro activo.",
        data: buildActivityDistribution(minuteRows, "client"),
        seriesName: "Minutas",
      },
      {
        key: "status",
        type: "status",
        title: "Distribución por estado",
        subtitle:
          "Permite revisar si la carga por cliente está más cerca del cierre o del backlog.",
        footer: "Cada segmento se calcula sobre el mismo universo tabular exportado.",
        data: buildStatusDistribution(minuteRows),
      },
    ],
    columns: buildClientColumns(),
  },
  {
    id: "gestion-minute-project",
    path: "/reports/management/minutes-by-project",
    title: "Minutas por Proyecto",
    description:
      "Agrupa el volumen documental por proyecto destacando backlog y avance editorial.",
    pdfSlug: "minutas-proyecto",
    pdfReportKey: "gestion-minutas-proyecto",
    pdfDescription:
      "Salida operacional que consolida el volumen de minutas agrupado por proyecto según los filtros aplicados.",
    tableDescription:
      "Detalle consolidado por proyecto usando el mismo universo visible al momento de la exportación.",
    buildRows: ({ minuteRows }) => buildAggregateByField(minuteRows, "project"),
    buildDefaultRowsOrder: defaultAggregateOrder,
    buildSummaryCards: buildProjectSummaryCards,
    buildCharts: ({ minuteRows }) => [
      {
        key: "project-activity",
        type: "bar",
        title: "Minutas por proyecto",
        subtitle: "Compara el volumen documental visible entre proyectos del período.",
        footer: "La barra utiliza exactamente las minutas visibles bajo el filtro activo.",
        data: buildActivityDistribution(minuteRows, "project"),
        seriesName: "Minutas",
      },
      {
        key: "status",
        type: "status",
        title: "Distribución por estado",
        subtitle:
          "Permite revisar si la carga por proyecto está más cerca del cierre o del backlog.",
        footer: "Cada segmento se calcula sobre el mismo universo tabular exportado.",
        data: buildStatusDistribution(minuteRows),
      },
    ],
    columns: buildProjectColumns(),
  },
  {
    id: "gestion-minute-cycle",
    path: "/reports/management/minute-cycle-times",
    title: "Tiempos de Ciclo de Minutas",
    description:
      "Analiza cuánto tarda cada minuta en recorrer procesamiento IA, edición, revisión y cierre usando transiciones explícitas.",
    pdfSlug: "tiempos-ciclo-minutas",
    pdfReportKey: "gestion-tiempos-ciclo-minutas",
    pdfDescription:
      "Salida operacional orientada a medir tiempos de ciclo por minuta usando la historia explícita de cambios de estado registrada por el sistema.",
    tableDescription:
      "Detalle por minuta con inicio de ciclo, último movimiento, tiempos por etapa y total acumulado del ciclo.",
    dataSource: "cycle-times",
    buildRows: ({ minuteRows }) => minuteRows,
    buildDefaultRowsOrder: defaultMinuteOrder,
    buildSummaryCards: buildCycleSummaryCards,
    buildCharts: ({ minuteRows }) => [
      {
        key: "cycle-total-duration",
        type: "bar",
        title: "Ciclo total por minuta",
        subtitle:
          "Destaca las minutas con mayor duración total visible, expresada en horas acumuladas de ciclo.",
        footer:
          "La comparación usa solo minutas que ya poseen transiciones explícitas registradas.",
        data: buildCycleDurationDistribution(minuteRows),
        seriesName: "Horas de ciclo",
      },
      {
        key: "cycle-stage-average",
        type: "bar",
        title: "Promedio por etapa",
        subtitle:
          "Compara el tiempo promedio invertido en procesamiento IA, edición y revisión sobre el universo visible.",
        footer:
          "Los promedios se calculan en horas usando la historia explícita de transiciones registrada.",
        data: buildCycleStageAverageDistribution(minuteRows),
        seriesName: "Horas promedio",
      },
    ],
    columns: buildCycleColumns(),
  },
  {
    id: "gestion-minute-reprocess",
    path: "/reports/management/minutes-with-reprocess",
    title: "Minutas con Reproceso",
    description:
      "Lista historicamente cada reproceso ejecutado sobre minutas, incluyendo resultado y consumo de tokens por intento.",
    pdfSlug: "minutas-reproceso",
    pdfReportKey: "gestion-minutas-reproceso",
    pdfDescription:
      "Salida operacional orientada a trazar historicamente cada reproceso ejecutado sobre minutas dentro del universo filtrado.",
    tableDescription:
      "Detalle historico de reprocesos con una fila por intento, incluyendo estado y gasto de tokens asociado.",
    dataSource: "reprocess-history",
    statusFilterOptions: REPROCESS_STATUS_FILTER_OPTIONS,
    buildRows: ({ minuteRows }) => minuteRows,
    buildDefaultRowsOrder: defaultMinuteOrder,
    buildSummaryCards: buildReprocessSummaryCards,
    buildCharts: ({ minuteRows }) => [
      {
        key: "reprocess-reasons",
        type: "bar",
        title: "Señales de reproceso",
        subtitle:
          "Agrupa las causas operativas que hoy explican por qué una minuta requiere atención o reproceso.",
        footer:
          "La comparación se calcula solo sobre minutas que presentan una señal activa de reproceso.",
        data: buildReprocessReasonDistribution(minuteRows),
        seriesName: "Minutas",
      },
      {
        key: "reprocess-status",
        type: "status",
        title: "Distribución por estado",
        subtitle:
          "Permite ver en qué estados se concentran hoy las minutas con señal de reproceso.",
        footer:
          "Cada segmento se calcula sobre el mismo subconjunto operativo visible en la tabla.",
        data: buildStatusDistribution(minuteRows),
      },
    ],
    columns: buildReprocessColumns(),
  },
  {
    id: "gestion-review-minutes",
    path: "/reports/management/minutes-in-review",
    title: "Minutas en Revisión",
    description:
      "Muestra las minutas que hoy permanecen en etapa de revisión y su distribución operacional.",
    pdfSlug: "minutas-revision",
    pdfReportKey: "gestion-minutas-revision",
    pdfDescription:
      "Salida operacional enfocada exclusivamente en las minutas actualmente en revisión según el filtro aplicado.",
    tableDescription:
      "Detalle completo de las minutas que hoy siguen en revisión dentro del universo filtrado.",
    filterMinuteRows: (rows) => rows.filter((row) => row.status.key === "preview"),
    buildRows: ({ minuteRows }) => minuteRows,
    buildDefaultRowsOrder: defaultMinuteOrder,
    buildSummaryCards: buildReviewSummaryCards,
    buildCharts: ({ minuteRows }) => [
      {
        key: "review-clients",
        type: "bar",
        title: "Revisión por cliente",
        subtitle: "Clientes que hoy concentran más minutas en etapa de revisión.",
        footer: "La barra refleja solo registros actualmente en revisión.",
        data: buildActivityDistribution(minuteRows, "client"),
        seriesName: "Minutas en revisión",
      },
      {
        key: "review-projects",
        type: "bar",
        title: "Revisión por proyecto",
        subtitle: "Proyectos que concentran más minutas abiertas editorialmente.",
        footer: "La comparación usa exclusivamente el subconjunto en revisión.",
        data: buildActivityDistribution(minuteRows, "project"),
        seriesName: "Minutas en revisión",
      },
    ],
    columns: buildMinuteDetailColumns(),
  },
  {
    id: "gestion-agreements-followup",
    path: "/reports/management/agreements-document-followup",
    title: "Seguimiento Documental de Acuerdos",
    description:
      "Lista acuerdos declarados en minutas y su estado documental registrado.",
    pdfSlug: "seguimiento-documental-acuerdos",
    pdfReportKey: "gestion-seguimiento-documental-acuerdos",
    pdfDescription:
      "Salida documental de acuerdos declarados, responsables, vencimientos y estado dentro del rango filtrado.",
    tableDescription:
      "Detalle de acuerdos extraídos del JSON activo de cada minuta visible.",
    dataSource: "commitment-items",
    defaultVisibleFilters: {
      ...DEFAULT_VISIBLE_FILTERS,
      status: true,
    },
    statusFilterOptions: COMMITMENT_STATUS_OPTIONS,
    filterMinuteRows: (rows) => rows.filter((row) => row.itemType === "agreement"),
    buildRows: ({ minuteRows }) => minuteRows,
    buildDefaultRowsOrder: defaultMinuteOrder,
    buildSummaryCards: buildCommitmentSummaryCards,
    buildCharts: ({ reportRows }) => [
      {
        key: "agreements-status",
        type: "status",
        title: "Acuerdos por estado",
        subtitle: "Distribuye acuerdos declarados según estado documental.",
        footer: "La información proviene del contenido versionado de las minutas.",
        data: buildStatusDistribution(reportRows),
      },
      {
        key: "agreements-owner",
        type: "bar",
        title: "Acuerdos por responsable",
        subtitle: "Responsables con mayor volumen de acuerdos documentados.",
        footer: "Permite detectar concentración documental de compromisos.",
        data: buildActivityDistribution(reportRows, "responsible"),
        seriesName: "Acuerdos",
      },
    ],
    columns: buildCommitmentDetailColumns(),
  },
  {
    id: "gestion-commitments-expired",
    path: "/reports/management/expired-commitments",
    title: "Compromisos con Fecha Expirada",
    description:
      "Resalta compromisos cuya fecha declarada ya venció y siguen abiertos en el registro documental.",
    pdfSlug: "compromisos-fecha-expirada",
    pdfReportKey: "gestion-compromisos-fecha-expirada",
    pdfDescription:
      "Salida de acuerdos vencidos según fecha declarada y estado documental abierto.",
    tableDescription:
      "Detalle de acuerdos con vencimiento anterior a la fecha actual y estado no cerrado.",
    dataSource: "commitment-items",
    defaultVisibleFilters: {
      ...DEFAULT_VISIBLE_FILTERS,
      status: false,
    },
    filterMinuteRows: (rows) => rows.filter((row) => row.itemType === "agreement" && row.isExpired),
    buildRows: ({ minuteRows }) => minuteRows,
    buildDefaultRowsOrder: (rows) =>
      [...rows].sort((left, right) => {
        if ((left.dueDateTimestamp ?? 0) !== (right.dueDateTimestamp ?? 0)) {
          return (left.dueDateTimestamp ?? 0) - (right.dueDateTimestamp ?? 0);
        }
        return compareByLabel(left.responsible, right.responsible);
      }),
    buildSummaryCards: buildCommitmentSummaryCards,
    buildCharts: ({ reportRows }) => [
      {
        key: "expired-owner",
        type: "bar",
        title: "Vencidos por responsable",
        subtitle: "Responsables con más compromisos documentales vencidos.",
        footer: "Solo incluye acuerdos abiertos con fecha expirada.",
        data: buildActivityDistribution(reportRows, "responsible"),
        seriesName: "Vencidos",
      },
      {
        key: "expired-client",
        type: "bar",
        title: "Vencidos por cliente",
        subtitle: "Clientes con mayor concentración de compromisos vencidos.",
        footer: "Ayuda a priorizar seguimiento documental.",
        data: buildActivityDistribution(reportRows, "client"),
        seriesName: "Vencidos",
      },
    ],
    columns: buildCommitmentDetailColumns(),
  },
  {
    id: "gestion-commitments-owner",
    path: "/reports/management/commitments-by-owner",
    title: "Compromisos por Responsable",
    description:
      "Agrupa compromisos declarados según la persona asignada en las minutas.",
    pdfSlug: "compromisos-por-responsable",
    pdfReportKey: "gestion-compromisos-por-responsable",
    pdfDescription:
      "Salida agregada de acuerdos documentales por responsable declarado.",
    tableDescription:
      "Consolidado por responsable con acuerdos, pendientes, vencidos y última actividad.",
    dataSource: "commitment-items",
    defaultVisibleFilters: {
      ...DEFAULT_VISIBLE_FILTERS,
      responsible: true,
      status: false,
    },
    filterMinuteRows: (rows) => rows.filter((row) => row.itemType === "agreement"),
    buildRows: ({ minuteRows }) => buildCommitmentAggregateRows(minuteRows, "responsible", "Sin responsable"),
    buildDefaultRowsOrder: defaultAggregateOrder,
    buildSummaryCards: buildCommitmentContextSummaryCards,
    buildCharts: ({ reportRows }) => [
      {
        key: "owner-agreements",
        type: "bar",
        title: "Acuerdos por responsable",
        subtitle: "Ordena responsables por volumen de acuerdos documentados.",
        footer: "Cada barra representa acuerdos asociados al responsable declarado.",
        data: buildReportRowDistribution(reportRows, "responsible", "agreementCount", 8),
        seriesName: "Acuerdos",
      },
      {
        key: "owner-expired",
        type: "bar",
        title: "Vencidos por responsable",
        subtitle: "Compara compromisos vencidos dentro de cada responsable.",
        footer: "Solo cuenta acuerdos con fecha expirada y estado abierto.",
        data: buildReportRowDistribution(reportRows, "responsible", "expiredCount", 8),
        seriesName: "Vencidos",
      },
    ],
    columns: buildCommitmentAggregateColumns("responsible", "Responsable"),
  },
  {
    id: "gestion-requirements-priority",
    path: "/reports/management/requirements-by-priority",
    title: "Requerimientos por Prioridad",
    description:
      "Ordena requerimientos según prioridad y estado registrado en las minutas.",
    pdfSlug: "requerimientos-prioridad",
    pdfReportKey: "gestion-requerimientos-prioridad",
    pdfDescription:
      "Salida documental de requerimientos agrupados por prioridad y estado.",
    tableDescription:
      "Detalle de requerimientos extraídos del JSON activo de cada minuta visible.",
    dataSource: "commitment-items",
    defaultVisibleFilters: {
      ...DEFAULT_VISIBLE_FILTERS,
      status: true,
    },
    statusFilterOptions: COMMITMENT_STATUS_OPTIONS,
    filterMinuteRows: (rows) => rows.filter((row) => row.itemType === "requirement"),
    buildRows: ({ minuteRows }) => minuteRows,
    buildDefaultRowsOrder: (rows) =>
      [...rows].sort((left, right) => {
        if ((left.priorityWeight ?? 99) !== (right.priorityWeight ?? 99)) {
          return (left.priorityWeight ?? 99) - (right.priorityWeight ?? 99);
        }
        return compareByLabel(left.client, right.client);
      }),
    buildSummaryCards: buildRequirementSummaryCards,
    buildCharts: ({ reportRows }) => [
      {
        key: "requirements-priority",
        type: "bar",
        title: "Requerimientos por prioridad",
        subtitle: "Compara el volumen por prioridad declarada.",
        footer: "La prioridad proviene del contenido documental de la minuta.",
        data: buildActivityDistribution(reportRows, "priorityLabel"),
        seriesName: "Requerimientos",
      },
      {
        key: "requirements-status",
        type: "status",
        title: "Estado de requerimientos",
        subtitle: "Distribuye requerimientos según estado documental.",
        footer: "Ayuda a distinguir abiertos, cerrados o cancelados.",
        data: buildStatusDistribution(reportRows),
      },
    ],
    columns: buildRequirementDetailColumns(),
  },
  {
    id: "gestion-requirements-client",
    path: "/reports/management/requirements-commitments-by-client",
    title: "Requerimientos y Compromisos por Cliente",
    description:
      "Resume seguimiento documental de acuerdos y requerimientos agrupado por cliente.",
    pdfSlug: "requerimientos-compromisos-cliente",
    pdfReportKey: "gestion-requerimientos-compromisos-cliente",
    pdfDescription:
      "Salida agregada de acuerdos y requerimientos documentales por cliente.",
    tableDescription:
      "Consolidado por cliente con acuerdos, requerimientos, pendientes y vencidos.",
    dataSource: "commitment-items",
    buildRows: ({ minuteRows }) => buildCommitmentAggregateRows(minuteRows, "client", "Sin cliente"),
    buildDefaultRowsOrder: defaultAggregateOrder,
    buildSummaryCards: buildCommitmentContextSummaryCards,
    buildCharts: ({ reportRows }) => [
      {
        key: "client-total",
        type: "bar",
        title: "Seguimiento por cliente",
        subtitle: "Clientes con más acuerdos y requerimientos documentales.",
        footer: "Incluye ambos tipos de ítems documentados en minutas.",
        data: buildReportRowDistribution(reportRows, "client", "totalRecords", 8),
        seriesName: "Ítems",
      },
      {
        key: "client-expired",
        type: "bar",
        title: "Vencidos por cliente",
        subtitle: "Compromisos vencidos agrupados por cliente.",
        footer: "Solo considera acuerdos con fecha expirada y estado abierto.",
        data: buildReportRowDistribution(reportRows, "client", "expiredCount", 8),
        seriesName: "Vencidos",
      },
    ],
    columns: buildCommitmentAggregateColumns("client", "Cliente"),
  },
  {
    id: "gestion-requirements-project",
    path: "/reports/management/requirements-commitments-by-project",
    title: "Requerimientos y Compromisos por Proyecto",
    description:
      "Resume seguimiento documental de acuerdos y requerimientos agrupado por proyecto.",
    pdfSlug: "requerimientos-compromisos-proyecto",
    pdfReportKey: "gestion-requerimientos-compromisos-proyecto",
    pdfDescription:
      "Salida agregada de acuerdos y requerimientos documentales por proyecto.",
    tableDescription:
      "Consolidado por proyecto con acuerdos, requerimientos, pendientes y vencidos.",
    dataSource: "commitment-items",
    buildRows: ({ minuteRows }) => buildCommitmentAggregateRows(minuteRows, "project", "Sin proyecto"),
    buildDefaultRowsOrder: defaultAggregateOrder,
    buildSummaryCards: buildCommitmentContextSummaryCards,
    buildCharts: ({ reportRows }) => [
      {
        key: "project-total",
        type: "bar",
        title: "Seguimiento por proyecto",
        subtitle: "Proyectos con más acuerdos y requerimientos documentales.",
        footer: "Incluye ambos tipos de ítems documentados en minutas.",
        data: buildReportRowDistribution(reportRows, "project", "totalRecords", 8),
        seriesName: "Ítems",
      },
      {
        key: "project-expired",
        type: "bar",
        title: "Vencidos por proyecto",
        subtitle: "Compromisos vencidos agrupados por proyecto.",
        footer: "Solo considera acuerdos con fecha expirada y estado abierto.",
        data: buildReportRowDistribution(reportRows, "project", "expiredCount", 8),
        seriesName: "Vencidos",
      },
    ],
    columns: buildCommitmentAggregateColumns("project", "Proyecto"),
  },
  {
    id: "gestion-review-observations",
    path: "/reports/management/external-observations-received",
    title: "Observaciones Externas Recibidas",
    description:
      "Centraliza observaciones ingresadas por participantes externos sobre versiones de minutas en revisión.",
    pdfSlug: "observaciones-externas-recibidas",
    pdfReportKey: "gestion-observaciones-externas-recibidas",
    pdfDescription:
      "Salida editorial de observaciones externas recibidas dentro del rango y filtros aplicados.",
    tableDescription:
      "Detalle de observaciones externas con minuta, versión, autor, estado y texto recibido.",
    dataSource: "review-observations",
    defaultVisibleFilters: {
      ...TOPIC_REPORT_VISIBLE_FILTERS,
      status: true,
    },
    statusFilterOptions: REVIEW_OBSERVATION_STATUS_OPTIONS,
    buildRows: ({ minuteRows }) => minuteRows,
    buildDefaultRowsOrder: defaultMinuteOrder,
    buildSummaryCards: buildReviewObservationSummaryCards,
    buildCharts: ({ reportRows }) => [
      {
        key: "review-observation-status",
        type: "status",
        title: "Estado de observaciones",
        subtitle: "Separa observaciones nuevas, aprobadas, insertadas y rechazadas.",
        footer: "La distribución proviene del registro editorial de observaciones externas.",
        data: buildStatusDistribution(reportRows),
      },
      {
        key: "review-observation-clients",
        type: "bar",
        title: "Observaciones por cliente",
        subtitle: "Clientes con mayor volumen de comentarios externos.",
        footer: "La comparación usa las observaciones visibles bajo los filtros aplicados.",
        data: buildActivityDistribution(reportRows, "client"),
        seriesName: "Observaciones",
      },
    ],
    columns: buildReviewObservationColumns(),
  },
  {
    id: "gestion-review-resolution",
    path: "/reports/management/observation-resolution",
    title: "Resolución de Observaciones",
    description:
      "Resume cómo se están resolviendo las observaciones editoriales recibidas desde participantes externos.",
    pdfSlug: "resolucion-observaciones",
    pdfReportKey: "gestion-resolucion-observaciones",
    pdfDescription:
      "Salida editorial de resolución de observaciones, con estados y tipos de decisión aplicados.",
    tableDescription:
      "Detalle de observaciones con decisión editorial, tipo de resolución, fecha y comentario del editor.",
    dataSource: "review-observations",
    defaultVisibleFilters: {
      ...TOPIC_REPORT_VISIBLE_FILTERS,
      status: true,
    },
    statusFilterOptions: REVIEW_OBSERVATION_STATUS_OPTIONS,
    buildRows: ({ minuteRows }) => minuteRows,
    buildDefaultRowsOrder: defaultMinuteOrder,
    buildSummaryCards: buildReviewResolutionSummaryCards,
    buildCharts: ({ reportRows }) => [
      {
        key: "review-resolution-status",
        type: "status",
        title: "Resolución por estado",
        subtitle: "Distribuye observaciones según decisión editorial registrada.",
        footer: "Las observaciones nuevas se mantienen visibles para dimensionar pendiente.",
        data: buildStatusDistribution(reportRows),
      },
      {
        key: "review-resolution-type",
        type: "bar",
        title: "Tipo de resolución",
        subtitle: "Compara inserciones directas, actualizaciones manuales y casos sin resolución.",
        footer: "El tipo proviene del campo de resolución editorial.",
        data: buildActivityDistribution(reportRows, "resolutionTypeLabel"),
        seriesName: "Observaciones",
      },
    ],
    columns: buildReviewResolutionColumns(),
  },
  {
    id: "gestion-review-friction",
    path: "/reports/management/minutes-review-friction",
    title: "Minutas con Mayor Fricción de Revisión",
    description:
      "Detecta minutas con más regresiones a edición, movimientos de estado o duración editorial antes de publicarse.",
    pdfSlug: "minutas-friccion-revision",
    pdfReportKey: "gestion-minutas-friccion-revision",
    pdfDescription:
      "Salida operacional que prioriza minutas con señales de fricción dentro del ciclo editorial.",
    tableDescription:
      "Detalle de minutas con vueltas a edición, tiempo de revisión, ciclo total y estado actual.",
    dataSource: "cycle-times",
    defaultVisibleFilters: {
      ...DEFAULT_VISIBLE_FILTERS,
      status: true,
    },
    filterMinuteRows: (rows) =>
      rows.filter((row) =>
        Number(row.returnToEditCount ?? 0) > 0 ||
        Number(row.transitionCount ?? 0) >= 4 ||
        Number(row.reviewDurationMs ?? 0) > 0
      ),
    buildRows: ({ minuteRows }) => minuteRows,
    buildDefaultRowsOrder: (rows) =>
      [...rows].sort((left, right) => {
        if ((right.returnToEditCount ?? 0) !== (left.returnToEditCount ?? 0)) {
          return (right.returnToEditCount ?? 0) - (left.returnToEditCount ?? 0);
        }
        if ((right.reviewDurationMs ?? 0) !== (left.reviewDurationMs ?? 0)) {
          return (right.reviewDurationMs ?? 0) - (left.reviewDurationMs ?? 0);
        }
        return (right.transitionCount ?? 0) - (left.transitionCount ?? 0);
      }),
    buildSummaryCards: buildReviewFrictionSummaryCards,
    buildCharts: ({ reportRows }) => [
      {
        key: "review-friction-return",
        type: "bar",
        title: "Vueltas a edición",
        subtitle: "Minutas con mayor cantidad de regresiones desde revisión.",
        footer: "Las vueltas a edición son una señal directa de fricción editorial.",
        data: buildReportRowDistribution(reportRows, "title", "returnToEditCount", 8),
        seriesName: "Vueltas",
      },
      {
        key: "review-friction-duration",
        type: "bar",
        title: "Tiempo de revisión",
        subtitle: "Minutas con mayor duración acumulada en etapa de revisión.",
        footer: "El tiempo se expresa en horas para comparar ciclos editoriales.",
        data: buildCycleDurationDistribution(
          reportRows.map((row) => ({
            ...row,
            totalCycleDurationMs: row.reviewDurationMs,
          }))
        ),
        seriesName: "Horas",
      },
    ],
    columns: buildReviewFrictionColumns(),
  },
  {
    id: "gestion-publications-finished",
    path: "/reports/management/completed-publications",
    title: "Publicaciones Finalizadas",
    description:
      "Lista minutas que alcanzaron publicación final y permite revisar su fecha asociada y ciclo de cierre.",
    pdfSlug: "publicaciones-finalizadas",
    pdfReportKey: "gestion-publicaciones-finalizadas",
    pdfDescription:
      "Salida editorial de minutas publicadas oficialmente dentro del rango consultado.",
    tableDescription:
      "Detalle de publicaciones finalizadas con cliente, proyecto, responsable y duración de ciclo.",
    dataSource: "cycle-times",
    filterDateField: "completedAtInput",
    defaultVisibleFilters: {
      ...DEFAULT_VISIBLE_FILTERS,
      status: false,
    },
    filterMinuteRows: (rows) => rows.filter((row) => row.status.key === "completed"),
    buildRows: ({ minuteRows }) => minuteRows,
    buildDefaultRowsOrder: (rows) =>
      [...rows].sort((left, right) => (right.completedAtTimestamp ?? 0) - (left.completedAtTimestamp ?? 0)),
    buildSummaryCards: buildPublicationSummaryCards,
    buildCharts: ({ reportRows }) => [
      {
        key: "publication-clients",
        type: "bar",
        title: "Publicaciones por cliente",
        subtitle: "Clientes con más minutas publicadas dentro del rango.",
        footer: "La comparación usa minutas cuyo ciclo llegó a completado.",
        data: buildActivityDistribution(reportRows, "client"),
        seriesName: "Publicaciones",
      },
      {
        key: "publication-projects",
        type: "bar",
        title: "Publicaciones por proyecto",
        subtitle: "Proyectos que concentran cierres editoriales.",
        footer: "Solo considera publicaciones finalizadas visibles.",
        data: buildActivityDistribution(reportRows, "project"),
        seriesName: "Publicaciones",
      },
    ],
    columns: buildPublicationColumns(),
  },
  {
    id: "gestion-review-mails",
    path: "/reports/management/review-publication-emails",
    title: "Correos de Revisión y Publicación",
    description:
      "Monitorea correos asociados al flujo editorial de revisión, publicación y oficialización de minutas.",
    pdfSlug: "correos-revision-publicacion",
    pdfReportKey: "gestion-correos-revision-publicacion",
    pdfDescription:
      "Salida editorial de eventos de correo persistidos en BD para revisión, publicación y oficialización.",
    tableDescription:
      "Detalle histórico de correos con estado, destinatarios, asunto, minuta, adjuntos y errores registrados.",
    dataSource: "email-deliveries",
    defaultVisibleFilters: {
      ...TOPIC_REPORT_VISIBLE_FILTERS,
      status: true,
    },
    statusFilterOptions: EMAIL_DELIVERY_STATUS_OPTIONS,
    emailKinds: ["minute_review", "minute_publication", "minute_officialized"],
    buildRows: ({ minuteRows }) => minuteRows,
    buildDefaultRowsOrder: (rows) =>
      [...rows].sort((left, right) => (right.dateTimestamp ?? 0) - (left.dateTimestamp ?? 0)),
    buildSummaryCards: buildEmailDeliverySummaryCards,
    buildCharts: ({ reportRows }) => [
      {
        key: "email-status",
        type: "status",
        title: "Estado de correos",
        subtitle: "Separa correos enviados, fallidos y aún en cola.",
        footer: "La fuente es la tabla histórica de eventos de entrega de correo.",
        data: buildStatusDistribution(reportRows),
      },
      {
        key: "email-kind",
        type: "bar",
        title: "Correos por tipo editorial",
        subtitle: "Compara revisión, publicación y oficialización.",
        footer: "Cada barra corresponde al tipo funcional persistido para el correo.",
        data: buildActivityDistribution(reportRows, "emailKindLabel"),
        seriesName: "Correos",
      },
    ],
    columns: buildEmailDeliveryColumns(),
  },
  {
    id: "gestion-client-portfolio",
    path: "/reports/management/client-portfolio",
    title: "Cartera de Clientes",
    description:
      "Reporte administrativo de clientes activos, clasificación, confidencialidad y actividad documental asociada.",
    pdfSlug: "cartera-clientes",
    pdfReportKey: "gestion-cartera-clientes",
    pdfDescription:
      "Salida administrativa de cartera de clientes con clasificación y actividad documental del período filtrado.",
    tableDescription:
      "Detalle de clientes visibles con atributos administrativos y volumen documental asociado al filtro aplicado.",
    buildRows: ({ clientRows, minuteRows, appliedFilters }) =>
      buildClientContextRows({ clientRows, minuteRows, filters: appliedFilters }),
    buildDefaultRowsOrder: defaultCatalogOrder,
    buildSummaryCards: buildClientPortfolioSummaryCards,
    buildCharts: ({ reportRows }) => [
      {
        key: "client-portfolio-activity",
        type: "bar",
        title: "Clientes por actividad documental",
        subtitle: "Ordena la cartera según el volumen de minutas asociadas al período filtrado.",
        footer: "La comparación usa los mismos clientes visibles en la tabla; los sin actividad aparecen con valor 0.",
        data: buildReportRowDistribution(reportRows, "client", "totalRecords", 6, {
          includeZero: true,
        }),
        seriesName: "Minutas",
      },
      {
        key: "client-portfolio-confidential",
        type: "status",
        title: "Confidencialidad de cartera",
        subtitle: "Distribuye los clientes visibles según su marca de confidencialidad.",
        footer: "La clasificación proviene del catálogo administrativo de clientes.",
        data: buildConfidentialDistribution(reportRows),
      },
    ],
    columns: buildClientPortfolioColumns(),
  },
  {
    id: "gestion-project-portfolio",
    path: "/reports/management/project-portfolio",
    title: "Cartera de Proyectos",
    description:
      "Reporte consolidado de proyectos activos, confidencialidad, automatizaciones de envío y actividad documental.",
    pdfSlug: "cartera-proyectos",
    pdfReportKey: "gestion-cartera-proyectos",
    pdfDescription:
      "Salida administrativa de cartera de proyectos con cliente asociado, automatizaciones y actividad documental.",
    tableDescription:
      "Detalle de proyectos visibles con atributos administrativos y volumen documental asociado al filtro aplicado.",
    buildRows: ({ projectRows, minuteRows, appliedFilters }) =>
      buildProjectContextRows({ projectRows, minuteRows, filters: appliedFilters }),
    buildDefaultRowsOrder: defaultCatalogOrder,
    buildSummaryCards: buildProjectPortfolioSummaryCards,
    buildCharts: ({ reportRows }) => [
      {
        key: "project-portfolio-activity",
        type: "bar",
        title: "Proyectos por actividad documental",
        subtitle: "Ordena la cartera según el volumen de minutas asociadas al período filtrado.",
        footer: "La comparación usa los mismos proyectos visibles en la tabla; los sin actividad aparecen con valor 0.",
        data: buildReportRowDistribution(reportRows, "project", "totalRecords", 6, {
          includeZero: true,
        }),
        seriesName: "Minutas",
      },
      {
        key: "project-portfolio-status",
        type: "status",
        title: "Estado administrativo",
        subtitle: "Distribuye los proyectos visibles según su estado de catálogo.",
        footer: "La clasificación proviene del catálogo administrativo de proyectos.",
        data: buildCatalogStatusDistribution(reportRows),
      },
    ],
    columns: buildProjectPortfolioColumns(),
  },
  {
    id: "gestion-client-inactive",
    path: "/reports/management/clients-without-recent-document-activity",
    title: "Clientes sin Actividad Documental Reciente",
    description:
      "Identifica clientes activos sin minutas dentro del período filtrado para seguimiento operativo o comercial.",
    pdfSlug: "clientes-sin-actividad-documental",
    pdfReportKey: "gestion-clientes-sin-actividad-documental",
    pdfDescription:
      "Salida operacional de clientes sin actividad documental reciente según el rango consultado.",
    tableDescription:
      "Detalle de clientes activos sin minutas visibles dentro del período filtrado.",
    buildRows: ({ clientRows, minuteRows, historyRows, appliedFilters }) =>
      buildClientContextRows({
        clientRows,
        minuteRows,
        historyRows,
        filters: appliedFilters,
        onlyInactive: true,
      }),
    buildDefaultRowsOrder: defaultInactiveOrder,
    buildSummaryCards: buildInactiveClientSummaryCards,
    buildCharts: ({ reportRows }) => [
      {
        key: "inactive-client-days",
        type: "bar",
        title: "Clientes por días sin actividad",
        subtitle: "Prioriza cuentas con más tiempo desde su último movimiento documental visible.",
        footer: "Cuando no existe historial visible, el cliente se informa como sin actividad registrada.",
        data: buildReportRowDistribution(reportRows, "client", "daysWithoutActivity"),
        seriesName: "Días",
      },
      {
        key: "inactive-client-confidential",
        type: "status",
        title: "Confidencialidad",
        subtitle: "Distribuye los clientes sin actividad según su marca de confidencialidad.",
        footer: "Permite distinguir cuentas sensibles dentro del seguimiento operativo.",
        data: buildConfidentialDistribution(reportRows),
      },
    ],
    columns: buildInactiveClientColumns(),
  },
  {
    id: "gestion-project-inactive",
    path: "/reports/management/projects-without-recent-document-activity",
    title: "Proyectos sin Actividad Documental Reciente",
    description:
      "Identifica proyectos activos sin minutas dentro del período filtrado.",
    pdfSlug: "proyectos-sin-actividad-documental",
    pdfReportKey: "gestion-proyectos-sin-actividad-documental",
    pdfDescription:
      "Salida operacional de proyectos sin actividad documental reciente según el rango consultado.",
    tableDescription:
      "Detalle de proyectos activos sin minutas visibles dentro del período filtrado.",
    buildRows: ({ projectRows, minuteRows, historyRows, appliedFilters }) =>
      buildProjectContextRows({
        projectRows,
        minuteRows,
        historyRows,
        filters: appliedFilters,
        onlyInactive: true,
      }),
    buildDefaultRowsOrder: defaultInactiveOrder,
    buildSummaryCards: buildInactiveProjectSummaryCards,
    buildCharts: ({ reportRows }) => [
      {
        key: "inactive-project-days",
        type: "bar",
        title: "Proyectos por días sin actividad",
        subtitle: "Prioriza proyectos con más tiempo desde su último movimiento documental visible.",
        footer: "Cuando no existe historial visible, el proyecto se informa como sin actividad registrada.",
        data: buildReportRowDistribution(reportRows, "project", "daysWithoutActivity"),
        seriesName: "Días",
      },
      {
        key: "inactive-project-confidential",
        type: "status",
        title: "Confidencialidad",
        subtitle: "Distribuye los proyectos sin actividad según su marca de confidencialidad.",
        footer: "Permite distinguir proyectos sensibles dentro del seguimiento operativo.",
        data: buildConfidentialDistribution(reportRows),
      },
    ],
    columns: buildInactiveProjectColumns(),
  },
  {
    id: "gestion-client-load",
    path: "/reports/management/clients-with-highest-document-load",
    title: "Clientes con Mayor Carga Documental",
    description:
      "Prioriza clientes que concentran más minutas, revisión, backlog y consumo documental de IA.",
    pdfSlug: "clientes-mayor-carga-documental",
    pdfReportKey: "gestion-clientes-mayor-carga-documental",
    pdfDescription:
      "Salida operacional que ordena clientes por intensidad documental dentro del período filtrado.",
    tableDescription:
      "Detalle de clientes con actividad, puntaje de carga, minutas, revisión, backlog y tokens asociados.",
    buildRows: ({ clientRows, minuteRows, appliedFilters }) =>
      buildClientContextRows({
        clientRows,
        minuteRows,
        filters: appliedFilters,
        onlyWithLoad: true,
      }),
    buildDefaultRowsOrder: defaultDocumentLoadOrder,
    buildSummaryCards: buildClientLoadSummaryCards,
    buildCharts: ({ reportRows }) => [
      {
        key: "client-load-score",
        type: "bar",
        title: "Clientes por carga documental",
        subtitle: "Ordena clientes por un puntaje que pondera minutas, revisión, backlog y tokens.",
        footer: "El puntaje es operativo y sirve para priorizar seguimiento dentro del período filtrado.",
        data: buildReportRowDistribution(reportRows, "client", "documentLoadScore"),
        seriesName: "Carga",
      },
      {
        key: "client-load-backlog",
        type: "bar",
        title: "Backlog por cliente",
        subtitle: "Muestra dónde se concentra el volumen documental aún abierto.",
        footer: "Incluye estados distintos de completado, cancelado y eliminado.",
        data: buildReportRowDistribution(reportRows, "client", "backlogRecords"),
        seriesName: "Backlog",
      },
    ],
    columns: buildClientLoadColumns(),
  },
  {
    id: "gestion-project-load",
    path: "/reports/management/projects-with-highest-document-load",
    title: "Proyectos con Mayor Carga Documental",
    description:
      "Prioriza proyectos con mayor intensidad documental, revisión, backlog y uso operativo de plataforma.",
    pdfSlug: "proyectos-mayor-carga-documental",
    pdfReportKey: "gestion-proyectos-mayor-carga-documental",
    pdfDescription:
      "Salida operacional que ordena proyectos por intensidad documental dentro del período filtrado.",
    tableDescription:
      "Detalle de proyectos con actividad, puntaje de carga, minutas, revisión, backlog y tokens asociados.",
    buildRows: ({ projectRows, minuteRows, appliedFilters }) =>
      buildProjectContextRows({
        projectRows,
        minuteRows,
        filters: appliedFilters,
        onlyWithLoad: true,
      }),
    buildDefaultRowsOrder: defaultDocumentLoadOrder,
    buildSummaryCards: buildProjectLoadSummaryCards,
    buildCharts: ({ reportRows }) => [
      {
        key: "project-load-score",
        type: "bar",
        title: "Proyectos por carga documental",
        subtitle: "Ordena proyectos por un puntaje que pondera minutas, revisión, backlog y tokens.",
        footer: "El puntaje es operativo y sirve para priorizar seguimiento dentro del período filtrado.",
        data: buildReportRowDistribution(reportRows, "project", "documentLoadScore"),
        seriesName: "Carga",
      },
      {
        key: "project-load-backlog",
        type: "bar",
        title: "Backlog por proyecto",
        subtitle: "Muestra dónde se concentra el volumen documental aún abierto.",
        footer: "Incluye estados distintos de completado, cancelado y eliminado.",
        data: buildReportRowDistribution(reportRows, "project", "backlogRecords"),
        seriesName: "Backlog",
      },
    ],
    columns: buildProjectLoadColumns(),
  },
  {
    id: "gestion-queue-status",
    path: "/reports/management/queue-status",
    title: "Estado de Colas",
    description:
      "Muestra carga, umbrales, alertas y actividad reciente de las colas operativas del sistema.",
    pdfSlug: "estado-colas",
    pdfReportKey: "gestion-estado-colas",
    pdfDescription:
      "Salida operacional del estado de colas Redis, umbrales configurados y señales de alerta.",
    tableDescription:
      "Detalle por cola con backlog, umbral, porcentaje de carga, monitoreo y última actividad registrada.",
    dataSource: "system-queues",
    defaultVisibleFilters: SYSTEM_REPORT_VISIBLE_FILTERS,
    statusFilterOptions: QUEUE_STATUS_FILTER_OPTIONS,
    buildRows: ({ minuteRows }) => minuteRows,
    buildDefaultRowsOrder: (rows) => [...rows].sort((left, right) => (right.size ?? 0) - (left.size ?? 0)),
    buildSummaryCards: buildQueueStatusSummaryCards,
    buildCharts: ({ reportRows }) => [
      {
        key: "queue-backlog",
        type: "bar",
        title: "Backlog por cola",
        subtitle: "Compara cuántos jobs pendientes registra cada cola operacional.",
        footer: "La lectura proviene del endpoint de estado de colas del sistema.",
        data: buildReportRowDistribution(reportRows, "label", "size", 8, { includeZero: true }),
        seriesName: "Jobs",
      },
      {
        key: "queue-status",
        type: "status",
        title: "Distribución por estado",
        subtitle: "Agrupa las colas según su estado operativo actual.",
        footer: "El estado considera tamaño, umbral y reglas especiales para DLQ.",
        data: buildStatusDistribution(reportRows),
      },
    ],
    columns: buildQueueColumns(),
  },
  {
    id: "gestion-backlog",
    path: "/reports/management/operational-backlog",
    title: "Backlog Operacional",
    description:
      "Resume la acumulación de trabajo pendiente y el riesgo de demora por cola.",
    pdfSlug: "backlog-operacional",
    pdfReportKey: "gestion-backlog-operacional",
    pdfDescription:
      "Salida ejecutiva sobre acumulación de jobs pendientes por cola y relación con umbrales operativos.",
    tableDescription:
      "Detalle de colas con backlog pendiente, porcentaje de carga y señales de alerta.",
    dataSource: "system-queues",
    defaultVisibleFilters: SYSTEM_REPORT_VISIBLE_FILTERS,
    statusFilterOptions: QUEUE_STATUS_FILTER_OPTIONS,
    filterMinuteRows: (rows) => rows.filter((row) => Number(row.size ?? 0) > 0),
    buildRows: ({ minuteRows }) => minuteRows,
    buildDefaultRowsOrder: (rows) => [...rows].sort((left, right) => (right.loadPercent ?? 0) - (left.loadPercent ?? 0)),
    buildSummaryCards: buildQueueStatusSummaryCards,
    buildCharts: ({ reportRows }) => [
      {
        key: "backlog-load",
        type: "bar",
        title: "Carga relativa por cola",
        subtitle: "Ordena colas con backlog por porcentaje respecto de su umbral.",
        footer: "El porcentaje permite comparar colas con umbrales distintos.",
        data: buildReportRowDistribution(reportRows, "label", "loadPercent", 8),
        seriesName: "% carga",
      },
      {
        key: "backlog-size",
        type: "bar",
        title: "Backlog absoluto",
        subtitle: "Muestra el volumen de jobs pendientes por cola.",
        footer: "La comparación usa solo colas con trabajos pendientes.",
        data: buildReportRowDistribution(reportRows, "label", "size", 8),
        seriesName: "Jobs",
      },
    ],
    columns: buildQueueColumns(),
  },
  {
    id: "gestion-processing-failures",
    path: "/reports/management/processing-failures",
    title: "Fallos de Procesamiento",
    description:
      "Identifica minutas en estado de error y señales operativas de reproceso.",
    pdfSlug: "fallos-procesamiento",
    pdfReportKey: "gestion-fallos-procesamiento",
    pdfDescription:
      "Salida operacional de minutas con error de IA o error técnico de procesamiento.",
    tableDescription:
      "Detalle de minutas fallidas con cliente, proyecto, responsable, estado, error visible y tokens.",
    filterMinuteRows: (rows) =>
      rows.filter((row) => ["llm-failed", "processing-error"].includes(row.status.key)),
    defaultVisibleFilters: {
      ...DEFAULT_VISIBLE_FILTERS,
      status: true,
    },
    statusFilterOptions: [
      { value: "llm-failed", label: "Fallo IA" },
      { value: "processing-error", label: "Error de proceso" },
    ],
    buildRows: ({ minuteRows }) => minuteRows,
    buildDefaultRowsOrder: defaultMinuteOrder,
    buildSummaryCards: buildProcessingFailureSummaryCards,
    buildCharts: ({ minuteRows }) => [
      {
        key: "failure-status",
        type: "status",
        title: "Fallos por estado",
        subtitle: "Distingue errores IA de errores técnicos de procesamiento.",
        footer: "La distribución usa el universo filtrado del reporte.",
        data: buildStatusDistribution(minuteRows),
      },
      {
        key: "failure-clients",
        type: "bar",
        title: "Fallos por cliente",
        subtitle: "Clientes donde se concentran minutas con error.",
        footer: "La barra ayuda a priorizar revisión operacional.",
        data: buildActivityDistribution(minuteRows, "client"),
        seriesName: "Fallos",
      },
    ],
    columns: buildReprocessColumns(),
  },
  {
    id: "gestion-recovery",
    path: "/reports/management/reprocess-and-recovery",
    title: "Reprocesos y Recuperación",
    description:
      "Revisa intentos de reproceso, resultados y recuperación de flujos fallidos.",
    pdfSlug: "reprocesos-recuperacion",
    pdfReportKey: "gestion-reprocesos-recuperacion",
    pdfDescription:
      "Salida operacional del historial de reprocesos, con foco en recuperación y fallos persistentes.",
    tableDescription:
      "Detalle histórico de reprocesos con resultado, error visible y consumo de tokens asociado.",
    dataSource: "reprocess-history",
    defaultVisibleFilters: {
      ...SYSTEM_REPORT_VISIBLE_FILTERS,
      client: true,
      project: true,
    },
    statusFilterOptions: REPROCESS_STATUS_FILTER_OPTIONS,
    buildRows: ({ minuteRows }) => minuteRows,
    buildDefaultRowsOrder: defaultMinuteOrder,
    buildSummaryCards: buildRecoverySummaryCards,
    buildCharts: ({ minuteRows }) => [
      {
        key: "recovery-status",
        type: "status",
        title: "Resultado de reprocesos",
        subtitle: "Distribuye intentos recuperados, fallidos o aún en tránsito.",
        footer: "Cada fila representa un intento histórico de reproceso.",
        data: buildStatusDistribution(minuteRows),
      },
      {
        key: "recovery-reasons",
        type: "bar",
        title: "Señales de reproceso",
        subtitle: "Agrupa las causas o señales registradas para reprocesar.",
        footer: "La causa proviene del historial operativo disponible.",
        data: buildReprocessReasonDistribution(minuteRows),
        seriesName: "Intentos",
      },
    ],
    columns: buildReprocessColumns(),
  },
  {
    id: "gestion-provider-validation",
    path: "/reports/management/ai-provider-validation",
    title: "Validación de Providers IA",
    description:
      "Controla el estado de validación de providers IA y sus últimos errores registrados.",
    pdfSlug: "validacion-providers-ia",
    pdfReportKey: "gestion-validacion-providers-ia",
    pdfDescription:
      "Salida administrativa del estado de validación de providers y modelos IA configurados.",
    tableDescription:
      "Detalle de providers IA con estado de validación, modelo asociado, fecha de validación y último error.",
    dataSource: "provider-validation",
    defaultVisibleFilters: SYSTEM_REPORT_VISIBLE_FILTERS,
    statusFilterOptions: PROVIDER_VALIDATION_STATUS_OPTIONS,
    buildRows: ({ minuteRows }) => minuteRows,
    buildDefaultRowsOrder: (rows) => [...rows].sort((left, right) => compareByLabel(left.provider, right.provider)),
    buildSummaryCards: buildProviderValidationSummaryCards,
    buildCharts: ({ reportRows }) => [
      {
        key: "provider-validation-status",
        type: "status",
        title: "Estado de validación",
        subtitle: "Distribuye providers por resultado de validación.",
        footer: "El estado proviene del catálogo de configuración IA.",
        data: buildStatusDistribution(reportRows),
      },
      {
        key: "provider-types",
        type: "bar",
        title: "Providers por tipo",
        subtitle: "Agrupa configuraciones IA por proveedor/adaptador.",
        footer: "Permite revisar concentración por tecnología.",
        data: buildActivityDistribution(reportRows, "providerType"),
        seriesName: "Providers",
      },
    ],
    columns: buildProviderValidationColumns(),
  },
  {
    id: "gestion-system-alerts",
    path: "/reports/management/system-alerts",
    title: "Alertas del Sistema",
    description:
      "Consolida alertas operativas relevantes desde colas y rutinas de mantenimiento.",
    pdfSlug: "alertas-sistema",
    pdfReportKey: "gestion-alertas-sistema",
    pdfDescription:
      "Salida operacional de alertas activas o últimos errores relevantes detectados por el sistema.",
    tableDescription:
      "Detalle de alertas de colas y rutinas con estado, fecha y descripción operacional.",
    dataSource: "system-alerts",
    defaultVisibleFilters: SYSTEM_REPORT_VISIBLE_FILTERS,
    statusFilterOptions: [
      ...QUEUE_STATUS_FILTER_OPTIONS,
      ...MAINTENANCE_RUNTIME_STATUS_OPTIONS,
    ],
    buildRows: ({ minuteRows }) => minuteRows,
    buildDefaultRowsOrder: defaultMinuteOrder,
    buildSummaryCards: buildSystemAlertSummaryCards,
    buildCharts: ({ reportRows }) => [
      {
        key: "alerts-type",
        type: "bar",
        title: "Alertas por tipo",
        subtitle: "Separa alertas de colas y rutinas de mantenimiento.",
        footer: "La vista contiene alertas activas y errores operativos relevantes.",
        data: buildActivityDistribution(reportRows, "alertType"),
        seriesName: "Alertas",
      },
      {
        key: "alerts-status",
        type: "status",
        title: "Alertas por estado",
        subtitle: "Agrupa las alertas visibles por su estado operativo.",
        footer: "Permite distinguir advertencias de estados críticos o errores.",
        data: buildStatusDistribution(reportRows),
      },
    ],
    columns: buildSystemAlertColumns(),
  },
  {
    id: "gestion-minute-tags",
    path: "/reports/management/minutes-by-tag",
    title: "Minutas por Tag",
    description:
      "Distribuye minutas según etiquetas funcionales u operacionales asociadas a sus versiones publicadas.",
    pdfSlug: "minutas-por-tag",
    pdfReportKey: "gestion-minutas-por-tag",
    pdfDescription:
      "Salida temática que agrupa minutas por tags operacionales dentro del período filtrado.",
    tableDescription:
      "Detalle por tag operacional con minutas asociadas, asignaciones, clientes, proyectos y última actividad.",
    dataSource: "topic-analytics",
    topicReportType: "minutes-by-tag",
    defaultVisibleFilters: TOPIC_REPORT_VISIBLE_FILTERS,
    buildRows: ({ minuteRows }) => minuteRows,
    buildDefaultRowsOrder: defaultAggregateOrder,
    buildSummaryCards: buildTopicTagSummaryCards,
    buildCharts: ({ reportRows }) => [
      {
        key: "topic-tags-volume",
        type: "bar",
        title: "Minutas por tag",
        subtitle: "Ordena las etiquetas operacionales por volumen documental asociado.",
        footer: "La agregación proviene de versiones de minuta etiquetadas en el período.",
        data: buildReportRowDistribution(reportRows, "tag", "totalRecords", 8),
        seriesName: "Minutas",
      },
      {
        key: "topic-tags-category",
        type: "bar",
        title: "Tags por categoría",
        subtitle: "Agrupa la presencia temática según categoría funcional.",
        footer: "Cada barra suma minutas asociadas a tags de la misma categoría.",
        data: buildGroupedSumDistribution(reportRows, "category", "totalRecords", 8),
        seriesName: "Minutas",
      },
    ],
    columns: buildTopicTagColumns(),
  },
  {
    id: "gestion-ai-tags",
    path: "/reports/management/detected-ai-tags",
    title: "Tags AI Detectados",
    description:
      "Muestra las etiquetas sugeridas por IA con mayor presencia en versiones de minutas.",
    pdfSlug: "tags-ai-detectados",
    pdfReportKey: "gestion-tags-ai-detectados",
    pdfDescription:
      "Salida temática sobre tags IA detectados, frecuencia y cobertura documental.",
    tableDescription:
      "Detalle por AI tag con detecciones, minutas asociadas, cobertura y última actividad.",
    dataSource: "topic-analytics",
    topicReportType: "detected-ai-tags",
    defaultVisibleFilters: TOPIC_REPORT_VISIBLE_FILTERS,
    buildRows: ({ minuteRows }) => minuteRows,
    buildDefaultRowsOrder: defaultAggregateOrder,
    buildSummaryCards: buildAiTagSummaryCards,
    buildCharts: ({ reportRows }) => [
      {
        key: "ai-tags-detected",
        type: "bar",
        title: "AI tags por detección",
        subtitle: "Ordena los tags IA por cantidad de detecciones visibles.",
        footer: "La lectura usa relaciones explícitas entre versiones de minuta y AI tags.",
        data: buildReportRowDistribution(reportRows, "aiTag", "detectedCount", 8),
        seriesName: "Detecciones",
      },
      {
        key: "ai-tags-status",
        type: "status",
        title: "Estado del catálogo IA",
        subtitle: "Distribuye los AI tags detectados según su estado vigente.",
        footer: "El estado proviene del catálogo administrativo de AI tags.",
        data: buildStatusDistribution(reportRows),
      },
    ],
    columns: buildAiTagColumns(),
  },
  {
    id: "gestion-ai-tag-conversion",
    path: "/reports/management/ai-tag-to-operational-tag-conversion",
    title: "Conversión AI Tag -> Tag Operacional",
    description:
      "Evalúa cómo se transforman tags sugeridos por IA en etiquetas operacionales del catálogo.",
    pdfSlug: "conversion-ai-tag-operacional",
    pdfReportKey: "gestion-conversion-ai-tag-operacional",
    pdfDescription:
      "Salida temática sobre utilidad del etiquetado IA y su mapeo hacia tags operacionales.",
    tableDescription:
      "Detalle por AI tag y destino operacional, con detecciones, estado de conversión y última actividad.",
    dataSource: "topic-analytics",
    topicReportType: "ai-tag-conversions",
    defaultVisibleFilters: TOPIC_REPORT_VISIBLE_FILTERS,
    buildRows: ({ minuteRows }) => minuteRows,
    buildDefaultRowsOrder: defaultAggregateOrder,
    buildSummaryCards: buildAiTagConversionSummaryCards,
    buildCharts: ({ reportRows }) => [
      {
        key: "ai-conversion-detected",
        type: "bar",
        title: "Detecciones por mapeo",
        subtitle: "Muestra qué AI tags tienen mayor volumen detrás de su conversión.",
        footer: "Los AI tags sin destino operacional quedan visibles para priorizar normalización.",
        data: buildGroupedSumDistribution(reportRows, "aiTag", "detectedCount", 8),
        seriesName: "Detecciones",
      },
      {
        key: "ai-conversion-status",
        type: "status",
        title: "Estado de conversión",
        subtitle: "Separa AI tags convertidos y AI tags aún sin destino operacional.",
        footer: "El estado se deriva de la existencia de un mapeo en el catálogo de conversiones.",
        data: buildStatusDistribution(reportRows),
      },
    ],
    columns: buildAiTagConversionColumns(),
  },
  {
    id: "gestion-topic-trends",
    path: "/reports/management/topic-trends",
    title: "Tendencias Temáticas",
    description:
      "Detecta concentración temporal de temas tratados en minutas mediante tags operacionales.",
    pdfSlug: "tendencias-tematicas",
    pdfReportKey: "gestion-tendencias-tematicas",
    pdfDescription:
      "Salida temática con evolución mensual de tags operacionales en el universo filtrado.",
    tableDescription:
      "Detalle por período y tag, con volumen documental, cobertura y última actividad.",
    dataSource: "topic-analytics",
    topicReportType: "topic-trends",
    defaultVisibleFilters: TOPIC_REPORT_VISIBLE_FILTERS,
    buildRows: ({ minuteRows }) => minuteRows,
    buildDefaultRowsOrder: (rows) =>
      [...rows].sort((left, right) => {
        const periodOrder = compareByLabel(right.period, left.period);
        if (periodOrder !== 0) return periodOrder;
        if ((right.totalRecords ?? 0) !== (left.totalRecords ?? 0)) {
          return (right.totalRecords ?? 0) - (left.totalRecords ?? 0);
        }
        return compareByLabel(left.tag, right.tag);
      }),
    buildSummaryCards: buildTopicTrendSummaryCards,
    buildCharts: ({ reportRows }) => [
      {
        key: "topic-trend-period",
        type: "bar",
        title: "Volumen por período",
        subtitle: "Compara la actividad temática acumulada por mes.",
        footer: "Cada barra suma los puntos temáticos visibles del período.",
        data: buildGroupedSumDistribution(reportRows, "period", "totalRecords", 8),
        seriesName: "Registros",
      },
      {
        key: "topic-trend-tags",
        type: "bar",
        title: "Tags en tendencia",
        subtitle: "Ordena los temas con mayor volumen dentro del rango consultado.",
        footer: "La comparación usa tags operacionales asociados a versiones publicadas.",
        data: buildReportRowDistribution(reportRows, "tag", "totalRecords", 8),
        seriesName: "Minutas",
      },
    ],
    columns: buildTopicTrendColumns(),
  },
];

const REPORT_CONFIG_BY_PATH = Object.fromEntries(
  REPORT_DEFINITIONS.map((report) => [report.path, report])
);

const MissingReportPage = () => (
  <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-100">
    La ruta solicitada no corresponde a un reporte activo de esta pasada.
  </div>
);

const ManagementOperationalReportPage = () => {
  const location = useLocation();
  const reportConfig = REPORT_CONFIG_BY_PATH[location.pathname];

  useDocumentTitle(reportConfig?.title ?? "Reportes de Gestión");

  const requestScope = useAbortableRequestScope();
  const [isLoading, setIsLoading] = useState(false);
  const [hasExecutedSearch, setHasExecutedSearch] = useState(false);
  const [draftFilters, setDraftFilters] = useState(() => buildDefaultFilters());
  const [appliedFilters, setAppliedFilters] = useState(() => buildDefaultFilters());
  const [rawRows, setRawRows] = useState([]);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const chartRefs = useRef({});
  const [filterCatalogs, setFilterCatalogs] = useState({
    clients: [],
    projects: [],
    responsibles: [],
  });
  const [catalogRows, setCatalogRows] = useState({
    clients: [],
    projects: [],
  });
  const [catalogTotals, setCatalogTotals] = useState({
    clients: 0,
    projects: 0,
  });
  const [page, setPage] = useState(1);

  const statusFilterOptions = reportConfig?.statusFilterOptions ?? STATUS_FILTER_OPTIONS;

  const filterFields = useMemo(
    () => filterFieldsFactory(filterCatalogs, statusFilterOptions),
    [filterCatalogs, statusFilterOptions]
  );

  useEffect(() => {
    const defaults = buildDefaultFilters();
    chartRefs.current = {};
    setDraftFilters(defaults);
    setAppliedFilters(defaults);
    setHasExecutedSearch(false);
    setPage(1);
  }, [location.pathname]);

  useEffect(() => {
    if (!reportConfig) return undefined;

    let isMounted = true;
    const requestConfig = requestScope.createRequestConfig();

    const loadFilterCatalogs = async () => {
      try {
        const visibleFilters = reportConfig.defaultVisibleFilters ?? DEFAULT_VISIBLE_FILTERS;
        const [clientsResult, projectsResult, teamsResult] = await Promise.all([
          visibleFilters.client
            ? clientService.list({ isActive: true, limit: 200 }, requestConfig)
            : Promise.resolve({ items: [] }),
          visibleFilters.project
            ? projectService.list({ isActive: true, limit: 200 }, requestConfig)
            : Promise.resolve({ items: [] }),
          visibleFilters.responsible
            ? teamsService.list({ skip: 0, limit: 200, filters: { status: "active" } })
            : Promise.resolve({ teams: [] }),
        ]);

        if (!isMounted || requestScope.wasAborted(requestConfig.signal)) return;

        const clientOptions = Array.from(
          new Set(
            (Array.isArray(clientsResult?.items) ? clientsResult.items : [])
              .map((item) => getClientLabel(item))
              .filter(Boolean)
          )
        )
          .sort(compareByLabel)
          .map((label) => ({ value: label, label }));

        const nextClientRows = (Array.isArray(clientsResult?.items) ? clientsResult.items : [])
          .map(normalizeClientCatalogRecord)
          .sort((left, right) => compareByLabel(left.client, right.client));

        const projectOptions = Array.from(
          new Set(
            (Array.isArray(projectsResult?.items) ? projectsResult.items : [])
              .map((item) => getProjectLabel(item))
              .filter(Boolean)
          )
        )
          .sort(compareByLabel)
          .map((label) => ({ value: label, label }));

        const nextProjectRows = (Array.isArray(projectsResult?.items) ? projectsResult.items : [])
          .map(normalizeProjectCatalogRecord)
          .sort((left, right) => compareByLabel(left.project, right.project));

        const responsibleOptions = Array.from(
          new Set(
            (Array.isArray(teamsResult?.teams) ? teamsResult.teams : [])
              .map((team) => team?.name || team?.username || "")
              .filter(Boolean)
          )
        )
          .sort(compareByLabel)
          .map((label) => ({ value: label, label }));

        setFilterCatalogs({
          clients: clientOptions,
          projects: projectOptions,
          responsibles: responsibleOptions,
        });
        setCatalogRows({
          clients: nextClientRows,
          projects: nextProjectRows,
        });
        setCatalogTotals({
          clients: clientOptions.length,
          projects: projectOptions.length,
        });
      } catch (error) {
        if (!isMounted || requestScope.wasAborted(requestConfig.signal)) return;
        reportLog.warn("No se pudieron cargar los catálogos de filtros del reporte.", error);
        setFilterCatalogs({ clients: [], projects: [], responsibles: [] });
        setCatalogRows({ clients: [], projects: [] });
        setCatalogTotals({ clients: 0, projects: 0 });
      }
    };

    loadFilterCatalogs();

    return () => {
      isMounted = false;
    };
  }, [reportConfig, requestScope]);

  const loadReportData = useCallback(
    async (nextAppliedFilters) => {
      setIsLoading(true);
      const requestConfig = requestScope.createRequestConfig();

      try {
        let rowsResult;
        if (reportConfig?.dataSource === "reprocess-history") {
          rowsResult = await listMinuteReprocessHistory({ skip: 0, limit: 1000 }, requestConfig);
        } else if (reportConfig?.dataSource === "cycle-times") {
          rowsResult = await listMinuteCycleTimes({ skip: 0, limit: 1000 }, requestConfig);
        } else if (reportConfig?.dataSource === "system-queues") {
          rowsResult = await systemQueueService.getStatus();
        } else if (reportConfig?.dataSource === "provider-validation") {
          rowsResult = await aiProviderConfigService.list({ skip: 0, limit: 200, isActive: null }, requestConfig);
        } else if (reportConfig?.dataSource === "system-alerts") {
          const [queueSnapshot, maintenanceStatus] = await Promise.all([
            systemQueueService.getStatus(),
            systemMaintenanceService.getStatus(),
          ]);
          rowsResult = { queueSnapshot, maintenanceStatus };
        } else if (reportConfig?.dataSource === "topic-analytics") {
          rowsResult = await listManagementTopicAnalytics(
            {
              reportType: reportConfig.topicReportType,
              dateFrom: nextAppliedFilters.dateFrom,
              dateTo: nextAppliedFilters.dateTo,
              client: nextAppliedFilters.client,
              project: nextAppliedFilters.project,
              limit: 500,
            },
            requestConfig
          );
        } else if (reportConfig?.dataSource === "review-observations") {
          rowsResult = await listManagementReviewObservations(
            {
              dateFrom: nextAppliedFilters.dateFrom,
              dateTo: nextAppliedFilters.dateTo,
              client: nextAppliedFilters.client,
              project: nextAppliedFilters.project,
              status: nextAppliedFilters.status,
              limit: 500,
            },
            requestConfig
          );
        } else if (reportConfig?.dataSource === "commitment-items") {
          rowsResult = await listManagementCommitmentItems(
            {
              dateFrom: nextAppliedFilters.dateFrom,
              dateTo: nextAppliedFilters.dateTo,
              client: nextAppliedFilters.client,
              project: nextAppliedFilters.project,
              limit: 300,
            },
            requestConfig
          );
        } else if (reportConfig?.dataSource === "email-deliveries") {
          rowsResult = await listManagementEmailDeliveries(
            {
              dateFrom: nextAppliedFilters.dateFrom,
              dateTo: nextAppliedFilters.dateTo,
              client: nextAppliedFilters.client,
              project: nextAppliedFilters.project,
              status: nextAppliedFilters.status,
              emailKinds: reportConfig.emailKinds,
              limit: 500,
            },
            requestConfig
          );
        } else {
          rowsResult = await listMinutes({ skip: 0, limit: 300 }, requestConfig);
        }

        if (requestScope.wasAborted(requestConfig.signal)) return;

        let nextRows;
        if (reportConfig?.dataSource === "reprocess-history") {
          nextRows = (Array.isArray(rowsResult?.items) ? rowsResult.items : []).map(
            normalizeReprocessAttemptRecord
          );
        } else if (reportConfig?.dataSource === "cycle-times") {
          nextRows = (Array.isArray(rowsResult?.items) ? rowsResult.items : []).map(
            normalizeCycleTimeRecord
          );
        } else if (reportConfig?.dataSource === "system-queues") {
          const refreshedAt = rowsResult?.refreshedAt ?? rowsResult?.refreshed_at ?? new Date().toISOString();
          nextRows = (Array.isArray(rowsResult?.queues) ? rowsResult.queues : []).map((item, index) =>
            normalizeQueueStatusRecord(item, index, refreshedAt)
          );
        } else if (reportConfig?.dataSource === "provider-validation") {
          nextRows = (Array.isArray(rowsResult?.items) ? rowsResult.items : []).map(
            normalizeProviderValidationRecord
          );
        } else if (reportConfig?.dataSource === "system-alerts") {
          nextRows = buildSystemAlertsFromSnapshots(rowsResult);
        } else if (reportConfig?.dataSource === "topic-analytics") {
          nextRows = (Array.isArray(rowsResult?.items) ? rowsResult.items : []).map(
            normalizeTopicAnalyticsRecord
          );
        } else if (reportConfig?.dataSource === "review-observations") {
          nextRows = (Array.isArray(rowsResult?.items) ? rowsResult.items : []).map(
            normalizeReviewObservationRecord
          );
        } else if (reportConfig?.dataSource === "commitment-items") {
          nextRows = (Array.isArray(rowsResult?.items) ? rowsResult.items : []).map(
            normalizeCommitmentItemRecord
          );
        } else if (reportConfig?.dataSource === "email-deliveries") {
          nextRows = (Array.isArray(rowsResult?.items) ? rowsResult.items : []).map(
            normalizeEmailDeliveryRecord
          );
        } else {
          nextRows = (Array.isArray(rowsResult?.minutes) ? rowsResult.minutes : []).map(
            normalizeMinuteRecord
          );
        }

        setRawRows(nextRows);
      } catch (error) {
        if (requestScope.wasAborted(requestConfig.signal)) return;
        reportLog.error(
          `No se pudo cargar el reporte ${reportConfig?.id ?? "gestion"} desde API.`,
          error
        );
        setRawRows([]);
      } finally {
        if (!requestScope.wasAborted(requestConfig.signal)) {
          startTransition(() => {
            setAppliedFilters(nextAppliedFilters);
            setPage(1);
            setHasExecutedSearch(true);
          });
          setIsLoading(false);
        }
      }
    },
    [reportConfig?.id, requestScope]
  );

  const filteredMinuteRows = useMemo(() => {
    if (!hasExecutedSearch || !reportConfig) return [];

    const baseRows = applyFilters(rawRows, {
      ...appliedFilters,
      dateField: reportConfig.filterDateField,
    });
    return reportConfig.filterMinuteRows
      ? reportConfig.filterMinuteRows(baseRows)
      : baseRows;
  }, [appliedFilters, hasExecutedSearch, rawRows, reportConfig]);

  const reportRows = useMemo(() => {
    if (!reportConfig || !hasExecutedSearch) return [];
    return reportConfig.buildRows({
      minuteRows: filteredMinuteRows,
      historyRows: applyNonDateFilters(rawRows, appliedFilters),
      clientRows: catalogRows.clients,
      projectRows: catalogRows.projects,
      appliedFilters,
    });
  }, [appliedFilters, catalogRows.clients, catalogRows.projects, filteredMinuteRows, hasExecutedSearch, rawRows, reportConfig]);

  const defaultOrderedRows = useMemo(() => {
    if (!reportConfig) return [];
    return reportConfig.buildDefaultRowsOrder(reportRows);
  }, [reportConfig, reportRows]);

  const { sortedItems, sortConfig, toggleSort } = useTableSorting(
    defaultOrderedRows,
    SORTERS
  );

  useEffect(() => {
    startTransition(() => {
      setPage(1);
    });
  }, [appliedFilters, rawRows, location.pathname]);

  const totalItems = sortedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return sortedItems.slice(start, start + ITEMS_PER_PAGE);
  }, [safePage, sortedItems]);

  const summaryCards = useMemo(() => {
    if (!reportConfig || !hasExecutedSearch) return [];
    return reportConfig.buildSummaryCards({
      minuteRows: filteredMinuteRows,
      reportRows: sortedItems,
      catalogTotals,
    });
  }, [catalogTotals, filteredMinuteRows, hasExecutedSearch, reportConfig, sortedItems]);

  const chartDefinitions = useMemo(() => {
    if (!reportConfig || !hasExecutedSearch || !sortedItems.length) return [];
    return reportConfig.buildCharts({
      minuteRows: filteredMinuteRows,
      reportRows: sortedItems,
    });
  }, [filteredMinuteRows, hasExecutedSearch, reportConfig, sortedItems]);

  const columns = reportConfig?.columns ?? [];

  const handleFilterChange = useCallback((name, value) => {
    setDraftFilters((current) => ({
      ...current,
      [name]: value,
    }));
  }, []);

  const handleApplyFilters = useCallback(() => {
    if (!hasAnyFilterValue(draftFilters)) {
      ModalManager.warning?.({
        title: "Filtros requeridos",
        message:
          "Indica al menos un parámetro de búsqueda antes de ejecutar el reporte.",
      });
      return;
    }

    loadReportData({ ...draftFilters });
  }, [draftFilters, loadReportData]);

  const handlePageChange = useCallback(
    (nextPage) => {
      if (nextPage < 1 || nextPage > totalPages) return;
      startTransition(() => {
        setPage(nextPage);
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [totalPages]
  );

  const handleExportCsv = useCallback(() => {
    if (!reportConfig) return;
    exportRowsToCsv(`${reportConfig.pdfSlug}.csv`, columns, sortedItems);
  }, [columns, reportConfig, sortedItems]);

  const handleExportPdf = useCallback(async () => {
    if (!reportConfig || !sortedItems.length || isGeneratingPdf) return;

    let loadingModalId = null;

    try {
      setIsGeneratingPdf(true);
      loadingModalId = ModalManager.loading({
        title: "Generando reporte PDF",
        message:
          "Estamos preparando la portada, los gráficos y la vista previa del documento.",
        showProgress: true,
        indeterminate: true,
        showCancel: false,
      });

      const chartImages = (
        await Promise.all(
          chartDefinitions.slice(0, 2).map(async (chart) => {
            const imageDataUrl = await Promise.resolve(
              exportChartInstanceToPng(chartRefs.current[chart.key])
            );

            return imageDataUrl
              ? {
                  title: chart.title,
                  subtitle: chart.subtitle,
                  image_data_url: imageDataUrl,
                }
              : null;
          })
        )
      ).filter(Boolean);

      if (chartDefinitions.length && chartImages.length !== chartDefinitions.slice(0, 2).length) {
        reportLog.warn("No fue posible capturar uno o más gráficos ECharts para el PDF.", {
          reportId: reportConfig.id,
          requestedCharts: chartDefinitions.slice(0, 2).length,
          exportedCharts: chartImages.length,
        });
      }

      const payload = {
        template_key: "executive_summary_general",
        report_key: reportConfig.pdfReportKey,
        report_type: "Reporte de Gestión",
        report_title: reportConfig.title,
        report_description: reportConfig.pdfDescription,
        report_objective: `Entregar una salida ejecutiva y trazable de ${reportConfig.title.toLowerCase()} respetando los filtros aplicados por el usuario al momento de exportar.`,
        source_module: "Módulo de Reportes",
        orientation: "landscape",
        paper_size: "A4",
        applied_filters: buildAppliedFiltersForExport(
          appliedFilters,
          reportConfig?.statusFilterOptions ?? STATUS_FILTER_OPTIONS
        ),
        summary_metrics: buildSummaryMetricsFromCards(summaryCards),
        chart_data: buildChartDataPayload(chartDefinitions, filteredMinuteRows),
        chart_images: chartImages,
        table_title: "Detalle de resultados exportados",
        table_description: reportConfig.tableDescription,
        table_range_label: buildReportRangeLabel(filteredMinuteRows, appliedFilters),
        table_columns: columns.map((column) => ({
          key: column.key,
          label: column.label,
        })),
        table_rows: sortedItems.map((row) =>
          columns.reduce((accumulator, column) => {
            accumulator[column.key] = column.exportValue
              ? column.exportValue(row)
              : row?.[column.key] ?? "—";
            return accumulator;
          }, {})
        ),
      };

      const pdfBlob = await previewReportPdfBlob(payload);

      ModalManager.close?.(loadingModalId);
      loadingModalId = null;

      openPdfViewer({
        title: `PDF - ${reportConfig.title}`,
        filename: buildReportPdfFilename(reportConfig.pdfSlug),
        blob: pdfBlob,
      });
    } catch (error) {
      reportLog.error(`No se pudo generar el PDF del reporte ${reportConfig?.id}.`, error);
      if (loadingModalId) {
        ModalManager.close?.(loadingModalId);
      }
      ModalManager.error?.({
        title: "Error al generar PDF",
        message:
          "No fue posible generar la vista previa del reporte. Intenta nuevamente en unos segundos.",
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [
    appliedFilters,
    chartDefinitions,
    columns,
    filteredMinuteRows,
    isGeneratingPdf,
    reportConfig,
    sortedItems,
    summaryCards,
  ]);

  const reportCharts = useMemo(() => {
    if (!chartDefinitions.length) return null;

    return (
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {chartDefinitions.slice(0, 2).map((chart) => (
          <ChartPanel
            key={chart.key}
            title={chart.title}
            subtitle={chart.subtitle}
            footer={chart.footer}
          >
            {renderChartByType(chart, (instance) => {
              chartRefs.current[chart.key] = instance;
            })}
          </ChartPanel>
        ))}
      </section>
    );
  }, [chartDefinitions]);

  if (!reportConfig) {
    return <MissingReportPage />;
  }

  return (
    <ReportModulePage
      icon="gauge"
      title={reportConfig.title}
      description={reportConfig.description}
      filterFields={filterFields}
      defaultVisibleFilters={reportConfig.defaultVisibleFilters ?? DEFAULT_VISIBLE_FILTERS}
      filterValues={draftFilters}
      onFilterChange={handleFilterChange}
      onApplyFilters={handleApplyFilters}
      isApplyDisabled={isLoading}
      applyLabel={isLoading ? "Cargando reporte..." : "Filtrar / Ejecutar"}
      resultsTitle="Resultados del reporte"
      onExportPdf={handleExportPdf}
      onExportSpreadsheet={handleExportCsv}
      isExportDisabled={sortedItems.length === 0 || isGeneratingPdf || isLoading}
      summaryCards={summaryCards}
      afterSummaryContent={reportCharts}
      columns={columns}
      rows={paginatedRows}
      getRowKey={(row) => row.id}
      sortConfig={sortConfig}
      onSort={toggleSort}
      page={safePage}
      totalPages={totalPages}
      totalItems={totalItems}
      itemsPerPage={ITEMS_PER_PAGE}
      onPageChange={handlePageChange}
      emptyTitle={
        hasExecutedSearch
          ? "No hay movimientos para el período filtrado"
          : "Aún no se ha ejecutado el reporte"
      }
      emptyMessage={
        hasExecutedSearch
          ? "Prueba ampliando el rango de fechas o usando otros parámetros de filtro."
          : 'Define los parámetros de búsqueda y luego pulsa "Filtrar / Ejecutar" para consultar la información operacional.'
      }
    >
    </ReportModulePage>
  );
};

export default ManagementOperationalReportPage;
