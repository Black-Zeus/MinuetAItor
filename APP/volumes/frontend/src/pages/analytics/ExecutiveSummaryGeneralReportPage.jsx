import React, {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import fallbackReportData from "@/data/minutes.json";
import AsyncEChart from "@/components/charts/AsyncEChart";
import ModalManager from "@/components/ui/modal";
import { openPdfViewer } from "@/components/ui/pdf/PdfViewerModal";
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

const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("es");

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

const getStatusPresentation = (status, explicitLabel = null) => {
  const key = String(status ?? "processing-error");
  const config = STATUS_CONFIG[key] ?? STATUS_CONFIG["processing-error"];

  return {
    key,
    label: explicitLabel ?? config.label ?? "Sin estado",
    className: config.className,
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
    title:
      minute?.title ??
      minute?.subject ??
      minute?.minuteTitle ??
      "Minuta sin título",
  };
};

const buildSummaryCards = (rows = []) => {
  const completedCount = rows.filter((row) => row.status.key === "completed").length;
  const backlogCount = rows.filter((row) =>
    !["completed", "cancelled", "deleted"].includes(row.status.key)
  ).length;
  const uniqueClients = new Set(rows.map((row) => row.client).filter(Boolean));
  const uniqueProjects = new Set(rows.map((row) => row.project).filter(Boolean));

  return [
    {
      label: "Minutas del período",
      value: formatNumber(rows.length),
      helper: `${formatNumber(completedCount)} publicadas`,
      icon: "fileLines",
      tone: "sky",
    },
    {
      label: "Clientes con actividad",
      value: formatNumber(uniqueClients.size),
      helper: "Con registros visibles en el reporte",
      icon: "business",
      tone: "emerald",
    },
    {
      label: "Proyectos con actividad",
      value: formatNumber(uniqueProjects.size),
      helper: "Con movimiento documental filtrado",
      icon: "diagramProject",
      tone: "amber",
    },
    {
      label: "Backlog pendiente",
      value: formatNumber(backlogCount),
      helper: "Incluye procesamiento, edición y revisión",
      icon: "clock",
      tone: "rose",
    },
  ];
};

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
        `${name}<br/>${formatNumber(value)} minutas (${formatPercent(total > 0 ? (value / total) * 100 : 0)})`,
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

const formatPercent = (value) =>
  `${PERCENT_FORMATTER.format(Number(value ?? 0))}%`;

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
    String(left.date).localeCompare(String(right.date), "es")
  );
};

const buildStatusDistribution = (rows = []) => {
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

  return [...grouped.values()].sort((left, right) => right.count - left.count);
};

const ReportTrendChart = ({ points = [], chartRef, onChartReady }) => {
  if (!points.length) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No hay datos suficientes para graficar la evolución del período.
      </p>
    );
  }

  const option = buildTrendChartOption(points);

  return (
    <AsyncEChart
      ref={chartRef}
      option={option}
      style={{ height: 280, width: "100%" }}
      onChartReady={onChartReady}
    />
  );
};

const ReportStatusChart = ({ items = [], chartRef, onChartReady }) => {
  if (!items.length) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No hay datos suficientes para construir la distribución por estado.
      </p>
    );
  }

  const option = buildStatusChartOption(items);

  return (
    <AsyncEChart
      ref={chartRef}
      option={option}
      style={{ height: 280, width: "100%" }}
      onChartReady={onChartReady}
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

const buildActivityDistribution = (rows = [], fieldName) => {
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
      return String(left.label).localeCompare(String(right.label), "es");
    });
};

const buildReportSummaryMetrics = (rows = [], catalogTotals = {}) => {
  const completedCount = rows.filter((row) => row.status.key === "completed").length;
  const pendingCount = rows.filter((row) => row.status.key === "pending").length;
  const backlogCount = rows.filter((row) =>
    !["completed", "cancelled", "deleted"].includes(row.status.key)
  ).length;
  const clientsWithActivity = new Set(rows.map((row) => row.client).filter(Boolean)).size;
  const projectsWithActivity = new Set(rows.map((row) => row.project).filter(Boolean)).size;

  return [
    {
      label: "Total de registros",
      value: formatNumber(rows.length),
      helper: "Total visible en el reporte exportado",
    },
    {
      label: "Registros completados",
      value: formatNumber(completedCount),
      helper: "Minutas cerradas o publicadas",
    },
    {
      label: "Registros pendientes",
      value: formatNumber(pendingCount),
      helper: "Pendientes explícitos dentro del período",
    },
    {
      label: "Clientes con actividad",
      value: formatNumber(clientsWithActivity),
      helper: catalogTotals.clients
        ? `${formatNumber(catalogTotals.clients)} activos en catálogo`
        : "Clientes visibles en el universo filtrado",
    },
    {
      label: "Proyectos con actividad",
      value: formatNumber(projectsWithActivity),
      helper: catalogTotals.projects
        ? `${formatNumber(catalogTotals.projects)} activos en catálogo`
        : "Proyectos visibles en el universo filtrado",
    },
    {
      label: "Backlog pendiente",
      value: formatNumber(backlogCount),
      helper: "Incluye procesamiento, edición y revisión",
    },
  ];
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

const buildReportRangeLabel = (rows = [], filters = {}) => {
  if (filters.dateFrom && filters.dateTo) return `${filters.dateFrom} al ${filters.dateTo}`;
  if (filters.dateFrom) return `Desde ${filters.dateFrom}`;
  if (filters.dateTo) return `Hasta ${filters.dateTo}`;

  const datedRows = rows.filter((row) => row.dateInput);
  if (!datedRows.length) return "Sin rango explícito";

  const orderedDates = datedRows
    .map((row) => row.dateInput)
    .sort((left, right) => String(left).localeCompare(String(right), "es"));

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

const ExecutiveSummaryGeneralReportPage = () => {
  useDocumentTitle("Resumen Ejecutivo General");

  const requestScope = useAbortableRequestScope();
  const [isLoading, setIsLoading] = useState(false);
  const [hasExecutedSearch, setHasExecutedSearch] = useState(false);
  const [draftFilters, setDraftFilters] = useState(() => buildDefaultFilters());
  const [appliedFilters, setAppliedFilters] = useState(() => buildDefaultFilters());
  const [rawRows, setRawRows] = useState([]);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const trendChartRef = useRef(null);
  const statusChartRef = useRef(null);
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

  const filterFields = useMemo(
    () => [
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
    ],
    [filterCatalogs.clients, filterCatalogs.projects, filterCatalogs.responsibles]
  );

  const loadFallbackData = useCallback(() => {
    const fallbackRows = Array.isArray(fallbackReportData?.minutes)
      ? fallbackReportData.minutes.map(normalizeMinuteRecord)
      : [];
    const fallbackClientOptions = Array.from(
      new Set(fallbackRows.map((row) => row.client).filter(Boolean))
    ).map((label) => ({ value: label, label }));
    const fallbackProjectOptions = Array.from(
      new Set(fallbackRows.map((row) => row.project).filter(Boolean))
    ).map((label) => ({ value: label, label }));
    const fallbackResponsibleOptions = Array.from(
      new Set(fallbackRows.map((row) => row.responsible).filter(Boolean))
    ).map((label) => ({ value: label, label }));

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
          .sort((left, right) => String(left).localeCompare(String(right), "es"))
          .map((label) => ({ value: label, label }));

        const projectOptions = Array.from(
          new Set(
            (Array.isArray(projectsResult?.items) ? projectsResult.items : [])
              .map((item) => getProjectLabel(item))
              .filter(Boolean)
          )
        )
          .sort((left, right) => String(left).localeCompare(String(right), "es"))
          .map((label) => ({ value: label, label }));

        const responsibleOptions = Array.from(
          new Set(
            (Array.isArray(teamsResult?.teams) ? teamsResult.teams : [])
              .map((team) => team?.name || team?.username || "")
              .filter(Boolean)
          )
        )
          .sort((left, right) => String(left).localeCompare(String(right), "es"))
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
  }, [loadFallbackData, requestScope]);

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
        reportLog.error("No se pudo cargar el reporte ejecutivo general desde API.", error);
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
    [loadFallbackData, requestScope]
  );

  const filteredRows = useMemo(
    () => (hasExecutedSearch ? applyFilters(rawRows, appliedFilters) : []),
    [appliedFilters, hasExecutedSearch, rawRows]
  );

  const defaultOrderedRows = useMemo(
    () =>
      [...filteredRows].sort((left, right) => {
        if (left.dateTimestamp !== right.dateTimestamp) {
          return right.dateTimestamp - left.dateTimestamp;
        }
        return String(left.rawId).localeCompare(String(right.rawId), "es", {
          numeric: true,
          sensitivity: "base",
        });
      }),
    [filteredRows]
  );

  const sorters = useMemo(
    () => ({
      id: (row) => row.rawId,
      date: (row) => row.dateTimestamp,
      client: (row) => row.client,
      project: (row) => row.project,
      responsible: (row) => row.responsible,
      status: (row) => STATUS_SORT_WEIGHT[row.status.key] ?? 999,
      title: (row) => row.title,
    }),
    []
  );

  const { sortedItems, sortConfig, toggleSort } = useTableSorting(
    defaultOrderedRows,
    sorters
  );

  const [page, setPage] = useState(1);

  useEffect(() => {
    startTransition(() => {
      setPage(1);
    });
  }, [appliedFilters, rawRows]);

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
    const baseCards = buildSummaryCards(sortedItems);
    if (catalogTotals.clients || catalogTotals.projects) {
      return baseCards.map((card) => {
        if (card.label === "Clientes con actividad") {
          return {
            ...card,
            helper: `${card.helper} · ${formatNumber(catalogTotals.clients)} activos en catálogo`,
          };
        }

        if (card.label === "Proyectos con actividad") {
          return {
            ...card,
            helper: `${card.helper} · ${formatNumber(catalogTotals.projects)} activos en catálogo`,
          };
        }

        return card;
      });
    }

    return baseCards;
  }, [catalogTotals.clients, catalogTotals.projects, sortedItems]);

  const chartTrendPoints = useMemo(
    () => buildDailyTrend(sortedItems),
    [sortedItems]
  );

  const statusDistribution = useMemo(
    () => buildStatusDistribution(sortedItems),
    [sortedItems]
  );

  const clientActivityDistribution = useMemo(
    () => buildActivityDistribution(sortedItems, "client"),
    [sortedItems]
  );

  const projectActivityDistribution = useMemo(
    () => buildActivityDistribution(sortedItems, "project"),
    [sortedItems]
  );

  const reportCharts = useMemo(
    () =>
      hasExecutedSearch && sortedItems.length ? (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartPanel
            title="Evolución del período"
          subtitle="Compara cuántas minutas aparecen por fecha y cuántas de ellas ya están completadas."
          footer="Se calcula sobre el mismo universo filtrado que alimenta la tabla."
        >
          <ReportTrendChart
            points={chartTrendPoints}
            chartRef={trendChartRef}
          />
        </ChartPanel>

        <ChartPanel
            title="Distribución por estado"
          subtitle="Muestra la proporción operacional entre procesamiento, edición, revisión, publicación y otros estados visibles."
          footer="Cada segmento refleja exactamente las filas actualmente visibles en el reporte filtrado."
        >
          <ReportStatusChart
            items={statusDistribution}
            chartRef={statusChartRef}
          />
        </ChartPanel>
      </section>
      ) : null,
    [chartTrendPoints, hasExecutedSearch, sortedItems.length, statusDistribution]
  );

  const columns = useMemo(
    () => [
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
            <p className="font-semibold text-gray-900 dark:text-white">
              {row.title}
            </p>
          </div>
        ),
      },
    ],
    []
  );

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
    exportRowsToCsv(
      "resumen-ejecutivo-general.csv",
      columns,
      sortedItems
    );
  }, [columns, sortedItems]);

  const handleExportPdf = useCallback(async () => {
    if (!sortedItems.length || isGeneratingPdf) return;

    let loadingModalId = null;

    try {
      setIsGeneratingPdf(true);
      loadingModalId = ModalManager.loading({
        title: "Generando reporte PDF",
        message: "Estamos preparando la portada, los indicadores y la vista previa del documento.",
        showProgress: true,
        indeterminate: true,
        showCancel: false,
      });

      const [trendChartImage, statusChartImage] = await Promise.all([
        Promise.resolve(exportChartInstanceToPng(trendChartRef)),
        Promise.resolve(exportChartInstanceToPng(statusChartRef)),
      ]);

      if (!trendChartImage || !statusChartImage) {
        reportLog.warn("No fue posible capturar uno o más gráficos ECharts para el PDF.", {
          hasTrendChartImage: Boolean(trendChartImage),
          hasStatusChartImage: Boolean(statusChartImage),
        });
      }

      const payload = {
        template_key: "executive_summary_general",
        report_key: "gestion-resumen-ejecutivo-general",
        report_type: "Reporte de Gestión",
        report_title: "Resumen Ejecutivo General",
        report_description:
          "Vista consolidada de actividad documental, clientes, proyectos y estado operacional del período seleccionado.",
        report_objective:
          "Entregar una salida ejecutiva y trazable del movimiento operacional visible, respetando los filtros aplicados por el usuario al momento de exportar.",
        source_module: "Módulo de Reportes",
        orientation: "landscape",
        paper_size: "A4",
        applied_filters: buildAppliedFiltersForExport(appliedFilters),
        summary_metrics: buildReportSummaryMetrics(sortedItems, catalogTotals),
        chart_data: {
          period_trend: chartTrendPoints.map((point) => ({
            label: point.date,
            total: point.total,
            completed: point.completed,
          })),
          status_distribution: statusDistribution.map((item) => ({
            label: item.label,
            count: item.count,
          })),
          client_activity: clientActivityDistribution.slice(0, 6),
          project_activity: projectActivityDistribution.slice(0, 6),
        },
        chart_images: [
          trendChartImage
            ? {
                title: "Evolución del período",
                subtitle:
                  "Compara cuántas minutas aparecen por fecha y cuántas de ellas ya están completadas.",
                image_data_url: trendChartImage,
              }
            : null,
          statusChartImage
            ? {
                title: "Distribución por estado",
                subtitle:
                  "Muestra la proporción operacional entre procesamiento, edición, revisión y publicación.",
                image_data_url: statusChartImage,
              }
            : null,
        ].filter(Boolean),
        table_title: "Detalle de resultados exportados",
        table_description:
          "Detalle tabular completo del mismo conjunto de registros visible al momento de generar el reporte.",
        table_range_label: buildReportRangeLabel(sortedItems, appliedFilters),
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
        title: "PDF - Resumen Ejecutivo General",
        filename: buildReportPdfFilename("resumen-ejecutivo-general"),
        blob: pdfBlob,
      });
    } catch (error) {
      reportLog.error("No se pudo generar el PDF del reporte.", error);
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
    catalogTotals,
    chartTrendPoints,
    clientActivityDistribution,
    columns,
    isGeneratingPdf,
    projectActivityDistribution,
    sortedItems,
    statusDistribution,
  ]);

  return (
    <ReportModulePage
      icon="gauge"
      title="Resumen Ejecutivo General"
      description="Reporte consolidado de movimientos operacionales asociados a clientes, proyectos y responsables internos."
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
          ? "Prueba ampliando el rango de fechas o usando otros términos de búsqueda."
          : "Define los parámetros de búsqueda y luego pulsa \"Filtrar / Ejecutar\" para consultar la información operacional."
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

export default ExecutiveSummaryGeneralReportPage;
