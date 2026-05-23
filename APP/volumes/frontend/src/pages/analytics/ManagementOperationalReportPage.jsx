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
import fallbackReportData from "@/data/minutes.json";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import useAbortableRequestScope from "@/hooks/useAbortableRequestScope";
import useTableSorting from "@/hooks/useTableSorting";
import ReportModulePage from "@/pages/analytics/reports/components/ReportModulePage";
import { STATUS_CONFIG } from "@/pages/minutes/MinuteCard";
import clientService from "@/services/clientService";
import { listMinutes } from "@/services/minutesService";
import projectService from "@/services/projectService";
import { previewReportPdfBlob } from "@/services/reportsService";
import teamsService from "@/services/teamsService";
import { formatNumber } from "@/utils/formats";
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

const DATE_FORMATTER = new Intl.DateTimeFormat("es-CL", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const PERCENT_FORMATTER = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const SORTERS = {
  date: (row) => row.dateTimestamp ?? 0,
  lastActivity: (row) => row.lastDateTimestamp ?? 0,
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
  percentage: (row) => row.percentageRaw ?? 0,
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

const formatDateForInput = (date) => {
  const normalized = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return normalized.toISOString().slice(0, 10);
};

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

const parseFlexibleDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const raw = String(value).trim();
  if (!raw) return null;

  const directDate = new Date(raw);
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
  return DATE_FORMATTER.format(parsedDate);
};

const toInputDate = (value) => {
  const parsedDate = parseFlexibleDate(value);
  if (!parsedDate) return "";

  const normalized = new Date(
    parsedDate.getTime() - parsedDate.getTimezoneOffset() * 60000
  );
  return normalized.toISOString().slice(0, 10);
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

const getClientLabel = (client) =>
  client?.company ?? client?.name ?? client?.client ?? "Sin cliente";

const getProjectLabel = (project) =>
  project?.name ?? project?.projectName ?? project?.project ?? "Sin proyecto";

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
    title:
      minute?.title ??
      minute?.subject ??
      minute?.minuteTitle ??
      "Minuta sin título",
  };
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

const exportRowsToCsv = (filename, columns, rows) => {
  const header = columns.map((column) => column.label);
  const lines = rows.map((row) =>
    columns.map((column) => {
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

  return rows.filter((row) => {
    if (filters.dateFrom && row.dateInput && row.dateInput < filters.dateFrom) {
      return false;
    }

    if (filters.dateTo && row.dateInput && row.dateInput > filters.dateTo) {
      return false;
    }

    if (filters.dateFrom && !row.dateInput) return false;
    if (filters.dateTo && !row.dateInput) return false;
    if (client && normalizeText(row.client) !== client) return false;
    if (project && normalizeText(row.project) !== project) return false;
    if (responsible && normalizeText(row.responsible) !== responsible) return false;
    if (status && row.status.key !== status) return false;

    return true;
  });
};

const buildAppliedFiltersForExport = (filters) => [
  { label: "Fecha desde", value: filters.dateFrom || "Sin límite" },
  { label: "Fecha hasta", value: filters.dateTo || "Sin límite" },
  { label: "Cliente", value: filters.client || "Todos" },
  { label: "Proyecto", value: filters.project || "Todos" },
  { label: "Responsable", value: filters.responsible || "Todos" },
  {
    label: "Estado",
    value:
      STATUS_FILTER_OPTIONS.find((option) => option.value === filters.status)?.label ||
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

const filterFieldsFactory = (filterCatalogs) => [
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
    options: STATUS_FILTER_OPTIONS,
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
    sortKey: "lastActivity",
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
    sortKey: "lastActivity",
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
    sortKey: "lastActivity",
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
    sortKey: "lastActivity",
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
    sortKey: "lastActivity",
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
    sortKey: "lastActivity",
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
  const [catalogTotals, setCatalogTotals] = useState({
    clients: 0,
    projects: 0,
  });
  const [usingFallbackData, setUsingFallbackData] = useState(false);
  const [page, setPage] = useState(1);

  const filterFields = useMemo(
    () => filterFieldsFactory(filterCatalogs),
    [filterCatalogs]
  );

  useEffect(() => {
    const defaults = buildDefaultFilters();
    chartRefs.current = {};
    setDraftFilters(defaults);
    setAppliedFilters(defaults);
    setHasExecutedSearch(false);
    setUsingFallbackData(false);
    setPage(1);
  }, [location.pathname]);

  const loadFallbackData = useCallback(() => {
    const fallbackRows = Array.isArray(fallbackReportData?.minutes)
      ? fallbackReportData.minutes.map(normalizeMinuteRecord)
      : [];
    const fallbackClientOptions = Array.from(
      new Set(fallbackRows.map((row) => row.client).filter(Boolean))
    )
      .sort(compareByLabel)
      .map((label) => ({ value: label, label }));
    const fallbackProjectOptions = Array.from(
      new Set(fallbackRows.map((row) => row.project).filter(Boolean))
    )
      .sort(compareByLabel)
      .map((label) => ({ value: label, label }));
    const fallbackResponsibleOptions = Array.from(
      new Set(fallbackRows.map((row) => row.responsible).filter(Boolean))
    )
      .sort(compareByLabel)
      .map((label) => ({ value: label, label }));

    setRawRows(fallbackRows);
    setFilterCatalogs({
      clients: fallbackClientOptions,
      projects: fallbackProjectOptions,
      responsibles: fallbackResponsibleOptions,
    });
    setCatalogTotals({
      clients: fallbackClientOptions.length,
      projects: fallbackProjectOptions.length,
    });
    setUsingFallbackData(true);
  }, []);

  useEffect(() => {
    if (!reportConfig) return undefined;

    let isMounted = true;
    const requestConfig = requestScope.createRequestConfig();

    const loadFilterCatalogs = async () => {
      try {
        const [clientsResult, projectsResult, teamsResult] = await Promise.all([
          clientService.list({ isActive: true, limit: 200 }, requestConfig),
          projectService.list({ isActive: true, limit: 200 }, requestConfig),
          teamsService.list({ skip: 0, limit: 200, filters: { status: "active" } }),
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

        const projectOptions = Array.from(
          new Set(
            (Array.isArray(projectsResult?.items) ? projectsResult.items : [])
              .map((item) => getProjectLabel(item))
              .filter(Boolean)
          )
        )
          .sort(compareByLabel)
          .map((label) => ({ value: label, label }));

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
        setCatalogTotals({
          clients: clientOptions.length,
          projects: projectOptions.length,
        });
      } catch (error) {
        if (!isMounted || requestScope.wasAborted(requestConfig.signal)) return;
        reportLog.warn("No se pudieron cargar los catálogos de filtros del reporte.", error);
        loadFallbackData();
      }
    };

    loadFilterCatalogs();

    return () => {
      isMounted = false;
    };
  }, [loadFallbackData, reportConfig, requestScope]);

  const loadReportData = useCallback(
    async (nextAppliedFilters) => {
      setIsLoading(true);
      const requestConfig = requestScope.createRequestConfig();

      try {
        const minutesResult = await listMinutes({ skip: 0, limit: 300 }, requestConfig);

        if (requestScope.wasAborted(requestConfig.signal)) return;

        const nextRows = Array.isArray(minutesResult?.minutes)
          ? minutesResult.minutes.map(normalizeMinuteRecord)
          : [];

        setRawRows(nextRows);
        setUsingFallbackData(false);
      } catch (error) {
        if (requestScope.wasAborted(requestConfig.signal)) return;
        reportLog.error(
          `No se pudo cargar el reporte ${reportConfig?.id ?? "gestion"} desde API.`,
          error
        );
        loadFallbackData();
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
    [loadFallbackData, reportConfig?.id, requestScope]
  );

  const filteredMinuteRows = useMemo(() => {
    if (!hasExecutedSearch || !reportConfig) return [];

    const baseRows = applyFilters(rawRows, appliedFilters);
    return reportConfig.filterMinuteRows
      ? reportConfig.filterMinuteRows(baseRows)
      : baseRows;
  }, [appliedFilters, hasExecutedSearch, rawRows, reportConfig]);

  const reportRows = useMemo(() => {
    if (!reportConfig) return [];
    return reportConfig.buildRows({ minuteRows: filteredMinuteRows });
  }, [filteredMinuteRows, reportConfig]);

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
        applied_filters: buildAppliedFiltersForExport(appliedFilters),
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
      defaultVisibleFilters={DEFAULT_VISIBLE_FILTERS}
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
      {hasExecutedSearch && usingFallbackData ? (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-100">
          La vista está usando un dataset de referencia porque la API de reportes aún no entrega todos los datos necesarios. La estructura, filtros, ordenamiento y exportación ya quedan listas para reutilizarse en los siguientes reportes.
        </div>
      ) : null}
    </ReportModulePage>
  );
};

export default ManagementOperationalReportPage;
