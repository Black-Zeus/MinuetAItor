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
import aiProviderConfigService from "@/services/aiProviderConfigService";
import aiUsageMetricsService from "@/services/aiUsageMetricsService";
import clientService from "@/services/clientService";
import profileService from "@/services/profileService";
import projectService from "@/services/projectService";
import { previewReportPdfBlob } from "@/services/reportsService";
import { formatDateInputValue, formatDateTime, formatNumber, parseAppDate } from "@/utils/formats";
import logger from "@/utils/logger";

const reportLog = logger.scope("ai-reports");

const ITEMS_PER_PAGE = 10;
const DEFAULT_VISIBLE_FILTERS = {
  dateFrom: true,
  dateTo: true,
  clientId: true,
  projectId: true,
  aiProfileId: false,
  providerType: false,
  modelName: false,
  status: false,
  eventType: false,
};
const ERROR_STATUSES = ["failed", "timeout", "cancelled"];
const ECHART_TEXT = "#94a3b8";
const ECHART_TITLE = "#e2e8f0";
const ECHART_TOOLTIP_BG = "rgba(15,23,42,0.94)";
const ECHART_BORDER = "rgba(148,163,184,0.18)";
const CHART_EXPORT_BG = "#3b4252";
const CHART_THEME = {
  grid: "rgba(148,163,184,0.28)",
  primary: "#2563eb",
  secondary: "#059669",
  tertiary: "#f59e0b",
  quaternary: "#7c3aed",
  negative: "#dc2626",
  slate: "#64748b",
  donut: ["#2563eb", "#059669", "#f59e0b", "#7c3aed", "#dc2626", "#64748b"],
};

const STATUS_LABELS = {
  success: "Exitoso",
  failed: "Fallido",
  timeout: "Timeout",
  cancelled: "Cancelado",
};

const STATUS_FILTER_OPTIONS = [
  { value: "success", label: "Exitoso" },
  { value: "failed", label: "Fallido" },
  { value: "timeout", label: "Timeout" },
  { value: "cancelled", label: "Cancelado" },
];

const EVENT_TYPE_FILTER_OPTIONS = [
  { value: "minute_processing", label: "Procesamiento de minuta" },
];

const USD_FORMATTER = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PERCENT_FORMATTER = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const REPORT_DEFINITIONS = [
  {
    id: "gestion-ai-usage",
    path: "/reports/management/general-ai-usage",
    title: "Uso General de IA",
    description:
      "Reporte consolidado del consumo, exito, tokens, costo y latencia de los eventos IA visibles para el usuario.",
    icon: "FaRobot",
    pdfSlug: "general-ai-usage",
    pdfReportKey: "gestion-uso-general-ia",
    pdfDescription:
      "Vista ejecutiva del uso de IA con volumen, costo, tokens, estados y detalle de eventos procesados en el periodo seleccionado.",
    tableDescription:
      "Detalle de eventos IA visibles para el usuario dentro del periodo consultado.",
    kind: "general",
  },
  {
    id: "gestion-ai-cost-client",
    path: "/reports/management/ai-cost-by-client",
    title: "Costo de IA por Cliente",
    description:
      "Consolida el costo estimado, los tokens y la tasa de exito del uso IA agrupado por cliente.",
    icon: "FaChartPie",
    pdfSlug: "ai-cost-by-client",
    pdfReportKey: "gestion-costo-ia-cliente",
    pdfDescription:
      "Distribucion del costo estimado y del consumo IA agrupado por cliente segun los filtros aplicados.",
    tableDescription:
      "Detalle agregado por cliente del consumo IA visible en el reporte generado.",
    kind: "cost",
    breakdownKey: "byClient",
    entityLabel: "Cliente",
    entityPluralLabel: "clientes",
  },
  {
    id: "gestion-ai-cost-project",
    path: "/reports/management/ai-cost-by-project",
    title: "Costo de IA por Proyecto",
    description:
      "Consolida el costo estimado, los tokens y la tasa de exito del uso IA agrupado por proyecto.",
    icon: "FaChartPie",
    pdfSlug: "ai-cost-by-project",
    pdfReportKey: "gestion-costo-ia-proyecto",
    pdfDescription:
      "Distribucion del costo estimado y del consumo IA agrupado por proyecto segun los filtros aplicados.",
    tableDescription:
      "Detalle agregado por proyecto del consumo IA visible en el reporte generado.",
    kind: "cost",
    breakdownKey: "byProject",
    entityLabel: "Proyecto",
    entityPluralLabel: "proyectos",
  },
  {
    id: "gestion-ai-cost-model",
    path: "/reports/management/ai-cost-by-model",
    title: "Costo de IA por Modelo",
    description:
      "Compara costo estimado, tokens y rendimiento del consumo IA agrupado por modelo.",
    icon: "FaBrain",
    pdfSlug: "ai-cost-by-model",
    pdfReportKey: "gestion-costo-ia-modelo",
    pdfDescription:
      "Comparativo ejecutivo del costo estimado y del uso IA agrupado por modelo.",
    tableDescription:
      "Detalle agregado por modelo del consumo IA visible en el reporte generado.",
    kind: "cost",
    breakdownKey: "byModel",
    entityLabel: "Modelo",
    entityPluralLabel: "modelos",
  },
  {
    id: "gestion-ai-cost-provider",
    path: "/reports/management/ai-cost-by-provider",
    title: "Costo de IA por Proveedor",
    description:
      "Compara costo estimado, volumen y rendimiento entre providers o adapters de IA.",
    icon: "FaDatabase",
    pdfSlug: "ai-cost-by-provider",
    pdfReportKey: "gestion-costo-ia-proveedor",
    pdfDescription:
      "Comparativo ejecutivo del costo estimado y del uso IA agrupado por proveedor.",
    tableDescription:
      "Detalle agregado por proveedor del consumo IA visible en el reporte generado.",
    kind: "cost",
    breakdownKey: "byProvider",
    entityLabel: "Proveedor",
    entityPluralLabel: "proveedores",
  },
  {
    id: "gestion-ai-latency-model",
    path: "/reports/management/ai-latency-success-by-model",
    title: "Latencia y Exito por Modelo",
    description:
      "Evalua estabilidad, latencia promedio y tasa de exito de los modelos usados por el sistema.",
    icon: "FaChartLine",
    pdfSlug: "ai-latency-success-by-model",
    pdfReportKey: "gestion-latencia-exito-modelo",
    pdfDescription:
      "Comparativo tecnico del rendimiento IA por modelo con foco en latencia y exito.",
    tableDescription:
      "Detalle agregado por modelo con latencia, exito y volumen del uso IA visible.",
    kind: "latency",
  },
  {
    id: "gestion-ai-profile-usage",
    path: "/reports/management/ai-usage-by-profile",
    title: "Uso de IA por Perfil",
    description:
      "Muestra que perfiles de analisis IA concentran mayor volumen, costo y carga de procesamiento.",
    icon: "FaBrain",
    pdfSlug: "ai-usage-by-profile",
    pdfReportKey: "gestion-uso-ia-perfil",
    pdfDescription:
      "Comparativo ejecutivo del uso IA agrupado por perfil de analisis configurado en el sistema.",
    tableDescription:
      "Detalle agregado por perfil IA con volumen, costo, tokens y rendimiento del periodo visible.",
    kind: "profile",
    breakdownKey: "byProfile",
    entityLabel: "Perfil IA",
    entityPluralLabel: "perfiles IA",
  },
  {
    id: "gestion-ai-errors",
    path: "/reports/management/ai-error-events",
    title: "Eventos IA con Error",
    description:
      "Centraliza fallos, timeouts y cancelaciones del flujo IA con foco en trazabilidad operativa.",
    icon: "FaTriangleExclamation",
    pdfSlug: "ai-error-events",
    pdfReportKey: "gestion-eventos-ia-error",
    pdfDescription:
      "Vista operativa de los eventos IA con error, timeout o cancelacion dentro del periodo seleccionado.",
    tableDescription:
      "Detalle de eventos IA con error visibles para el usuario dentro del periodo consultado.",
    kind: "errors",
    presetStatuses: ERROR_STATUSES,
  },
];

const REPORT_CONFIG_BY_PATH = Object.fromEntries(
  REPORT_DEFINITIONS.map((item) => [item.path, item])
);

const SORTERS = {
  startedAt: (row) => row.startedAtTimestamp ?? 0,
  entityLabel: (row) => row.entityLabel ?? "",
  clientLabel: (row) => row.clientLabel ?? "",
  projectLabel: (row) => row.projectLabel ?? "",
  providerLabel: (row) => row.providerLabel ?? "",
  modelLabel: (row) => row.modelLabel ?? "",
  statusLabel: (row) => row.statusLabel ?? "",
  eventTypeLabel: (row) => row.eventTypeLabel ?? "",
  totalTokens: (row) => row.totalTokens ?? 0,
  totalCost: (row) => row.totalCost ?? 0,
  latencyMs: (row) => row.latencyMs ?? Number.MAX_SAFE_INTEGER,
  successRate: (row) => row.successRateValue ?? 0,
  successEvents: (row) => row.successEvents ?? 0,
  failedEvents: (row) => row.failedEvents ?? 0,
  events: (row) => row.events ?? 0,
  errorCode: (row) => row.errorCode ?? "",
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

const formatUsd = (value) => USD_FORMATTER.format(Number(value ?? 0));

const formatMaybeUsd = (value) =>
  value == null ? "Sin pricing" : formatUsd(value);

const formatLatency = (value) =>
  value == null ? "—" : `${formatNumber(Number(value ?? 0), 0)} ms`;

const hasPricingCoverage = (overview = {}) =>
  Number(overview?.estimatedCostEvents ?? 0) > 0;

const hasPartialPricingCoverageForOverview = (overview = {}) => {
  const totalEvents = Number(overview?.totalEvents ?? 0);
  const estimatedCostEvents = Number(overview?.estimatedCostEvents ?? 0);
  return totalEvents > 0 && estimatedCostEvents < totalEvents;
};

const formatOverviewCost = (overview = {}) =>
  hasPricingCoverage(overview)
    ? formatUsd(overview?.totalCost ?? 0)
    : "Sin pricing";

const buildPricingCoverageHelper = (overview = {}) => {
  const estimatedCostEvents = Number(overview?.estimatedCostEvents ?? 0);
  const totalEvents = Number(overview?.totalEvents ?? 0);

  if (estimatedCostEvents <= 0) {
    return "Sin pricing cargado; el reporte mantiene tokens, volumen y latencia.";
  }

  if (estimatedCostEvents < totalEvents) {
    return `${formatNumber(estimatedCostEvents)} eventos con pricing resuelto; costo parcial sobre el universo visible.`;
  }

  return `${formatNumber(estimatedCostEvents)} eventos con pricing resuelto.`;
};

const formatDateForInput = (date) => formatDateInputValue(date);

const buildDefaultFilters = () => {
  const today = new Date();
  const dateTo = formatDateForInput(today);
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - 7);

  return {
    dateFrom: formatDateForInput(fromDate),
    dateTo,
    clientId: "",
    projectId: "",
    aiProfileId: "",
    providerType: "",
    modelName: "",
    status: "",
    eventType: "",
  };
};

const hasAnyFilterValue = (filters = {}) =>
  Object.values(filters).some((value) => String(value ?? "").trim() !== "");

const getStatusLabel = (value) => STATUS_LABELS[String(value ?? "").trim()] ?? "Sin estado";

const getProviderLabel = (event) =>
  event?.providerNameSnapshot ||
  event?.providerType ||
  event?.providerConfig?.name ||
  "Sin proveedor";

const getEventTypeLabel = (value) => {
  if (String(value ?? "") === "minute_processing") {
    return "Procesamiento de minuta";
  }
  return String(value ?? "Sin tipo");
};

const coalesceName = (primary, fallback) => {
  const primaryText = String(primary ?? "").trim();
  if (primaryText) return primaryText;
  const fallbackText = String(fallback ?? "").trim();
  return fallbackText || "Sin dato";
};

const buildSummaryCard = (label, value, helper, icon, tone) => ({
  label,
  value,
  helper,
  icon,
  tone,
});

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

const buildTrendChartOption = ({
  points = [],
  primaryLabel = "Eventos",
  secondaryLabel = "Exitosos",
  primaryColor = CHART_THEME.primary,
  secondaryColor = CHART_THEME.secondary,
} = {}) => ({
  ...buildChartOptionBase(),
  color: [primaryColor, secondaryColor],
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
    data: points.map((point) => point.label),
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
      name: primaryLabel,
      type: "bar",
      barWidth: 22,
      data: points.map((point) => point.primaryValue),
      itemStyle: {
        color: primaryColor,
        borderRadius: [8, 8, 0, 0],
      },
    },
    {
      name: secondaryLabel,
      type: "line",
      smooth: true,
      symbol: "circle",
      symbolSize: 7,
      data: points.map((point) => point.secondaryValue),
      lineStyle: { width: 3, color: secondaryColor },
      itemStyle: { color: secondaryColor },
    },
  ],
});

const buildStatusChartOption = (items = []) => {
  const total = items.reduce((sum, item) => sum + Number(item.value ?? 0), 0);

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
          value: item.value,
        })),
      },
    ],
  };
};

const buildHorizontalMetricChartOption = ({
  items = [],
  seriesName = "Valor",
  color = CHART_THEME.primary,
  labelFormatter = null,
  tooltipFormatter = null,
} = {}) => ({
  ...buildChartOptionBase(),
  color: [color],
  grid: { left: 18, right: 20, top: 12, bottom: 12, containLabel: true },
  tooltip: {
    ...buildChartOptionBase().tooltip,
    trigger: "axis",
    axisPointer: { type: "shadow" },
    valueFormatter: tooltipFormatter ?? undefined,
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
      width: 180,
      overflow: "truncate",
    },
    axisLine: { show: false },
    axisTick: { show: false },
  },
  series: [
    {
      name: seriesName,
      type: "bar",
      data: items.map((item) => item.value),
      barWidth: 18,
      label: {
        show: true,
        position: "right",
        color: ECHART_TITLE,
        formatter: ({ value }) =>
          typeof labelFormatter === "function" ? labelFormatter(value) : formatNumber(value, 0),
      },
      itemStyle: {
        color,
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

const ReportTrendChart = ({ chartRef, points = [], chart }) => {
  if (!points.length) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No hay datos suficientes para graficar la evolucion del periodo.
      </p>
    );
  }

  return (
    <AsyncEChart
      ref={chartRef}
      option={buildTrendChartOption({
        points,
        primaryLabel: chart.primaryLabel,
        secondaryLabel: chart.secondaryLabel,
        primaryColor: chart.primaryColor,
        secondaryColor: chart.secondaryColor,
      })}
      style={{ height: 280, width: "100%" }}
    />
  );
};

const ReportStatusChart = ({ chartRef, items = [] }) => {
  if (!items.length) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No hay datos suficientes para construir la distribucion por estado.
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

const ReportMetricBarChart = ({ chartRef, chart }) => {
  if (!chart?.data?.length) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {chart?.emptyMessage ?? "No hay datos suficientes para construir la comparacion visual."}
      </p>
    );
  }

  return (
    <AsyncEChart
      ref={chartRef}
      option={buildHorizontalMetricChartOption({
        items: chart.data,
        seriesName: chart.seriesName,
        color: chart.color,
        labelFormatter: chart.labelFormatter,
        tooltipFormatter: chart.tooltipFormatter,
      })}
      style={{ height: 280, width: "100%" }}
    />
  );
};

const renderChartByType = (chart, chartRef) => {
  if (chart.type === "trend") {
    return (
      <ReportTrendChart
        chart={chart}
        points={chart.data}
        chartRef={chartRef}
      />
    );
  }

  if (chart.type === "status") {
    return <ReportStatusChart items={chart.data} chartRef={chartRef} />;
  }

  return <ReportMetricBarChart chart={chart} chartRef={chartRef} />;
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

const buildAppliedFiltersForExport = (filters = {}, options = {}) => {
  const clientMap = options.clientMap ?? new Map();
  const projectMap = options.projectMap ?? new Map();
  const profileMap = options.profileMap ?? new Map();
  const providerMap = options.providerMap ?? new Map();
  const modelMap = options.modelMap ?? new Map();
  const eventTypeMap = options.eventTypeMap ?? new Map();

  return [
    { label: "Fecha desde", value: filters.dateFrom || null },
    { label: "Fecha hasta", value: filters.dateTo || null },
    {
      label: "Cliente",
      value: filters.clientId ? clientMap.get(filters.clientId) ?? filters.clientId : "Todos",
    },
    {
      label: "Proyecto",
      value: filters.projectId ? projectMap.get(filters.projectId) ?? filters.projectId : "Todos",
    },
    {
      label: "Perfil IA",
      value: filters.aiProfileId ? profileMap.get(filters.aiProfileId) ?? filters.aiProfileId : "Todos",
    },
    {
      label: "Proveedor",
      value: filters.providerType
        ? providerMap.get(filters.providerType) ?? filters.providerType
        : "Todos",
    },
    {
      label: "Modelo",
      value: filters.modelName ? modelMap.get(filters.modelName) ?? filters.modelName : "Todos",
    },
    {
      label: "Estado",
      value: filters.status ? getStatusLabel(filters.status) : "Todos",
    },
    {
      label: "Tipo de evento",
      value: filters.eventType
        ? eventTypeMap.get(filters.eventType) ?? getEventTypeLabel(filters.eventType)
        : "Todos",
    },
  ];
};

const buildSummaryMetricsFromCards = (cards = []) =>
  cards.map((card) => ({
    label: card.label,
    value: String(card.value ?? ""),
    helper: card.helper ?? null,
  }));

const buildChartDataPayload = (summary = {}) => ({
  period_trend: Array.isArray(summary?.timeseries)
    ? summary.timeseries.slice(0, 60).map((point) => ({
        label: point.date,
        total: Number(point.events ?? 0),
        completed: Number(point.successEvents ?? 0),
      }))
    : [],
  status_distribution: Array.isArray(summary?.byStatus)
    ? summary.byStatus.slice(0, 12).map((item) => ({
        label: item.label,
        count: Number(item.events ?? 0),
      }))
    : [],
  client_activity: Array.isArray(summary?.byClient)
    ? summary.byClient.slice(0, 12).map((item) => ({
        label: item.label,
        count: Number(item.events ?? 0),
      }))
    : [],
  project_activity: Array.isArray(summary?.byProject)
    ? summary.byProject.slice(0, 12).map((item) => ({
        label: item.label,
        count: Number(item.events ?? 0),
      }))
    : [],
});

const buildReportRangeLabel = (filters = {}) => {
  const dateFrom = String(filters?.dateFrom ?? "").trim();
  const dateTo = String(filters?.dateTo ?? "").trim();

  if (dateFrom && dateTo) return `${dateFrom} al ${dateTo}`;
  if (dateFrom) return `Desde ${dateFrom}`;
  if (dateTo) return `Hasta ${dateTo}`;
  return "Sin rango explicito";
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

const countStatus = (items = [], key) =>
  Number(
    items.find((item) => normalizeText(item.key ?? item.label) === normalizeText(key))?.events ?? 0
  );

const sortMetricItems = (items = [], selector) =>
  [...items].sort((left, right) => {
    const rightValue = Number(selector(right) ?? 0);
    const leftValue = Number(selector(left) ?? 0);
    if (rightValue !== leftValue) return rightValue - leftValue;
    return compareByLabel(left.label, right.label);
  });

const buildRawEventRows = (items = [], catalogs = {}) =>
  items.map((event) => {
    const startedAtLabel = event.startedAt
      ? formatDateTime(event.startedAt)
      : "Sin fecha";
    const startedAtTimestamp = event.startedAt ? parseAppDate(event.startedAt).getTime() : 0;
    const clientLabel = coalesceName(
      catalogs.clientMap?.get?.(event.clientId),
      event.clientId ? "Cliente no resuelto" : "Sin cliente"
    );
    const projectLabel = coalesceName(
      catalogs.projectMap?.get?.(event.projectId),
      event.projectId ? "Proyecto no resuelto" : "Sin proyecto"
    );
    const requestedByLabel = coalesceName(
      event.requestedByUser?.fullName,
      event.requestedByUser?.username || "Sistema"
    );

    return {
      id: `event-${event.id}`,
      startedAtLabel,
      startedAtTimestamp,
      clientLabel,
      projectLabel,
      providerLabel: getProviderLabel(event),
      modelLabel: coalesceName(event.modelName, "Sin modelo"),
      statusLabel: getStatusLabel(event.status),
      eventTypeLabel: getEventTypeLabel(event.eventType),
      requestedByLabel,
      inputTokens: Number(event.inputTokens ?? 0),
      outputTokens: Number(event.outputTokens ?? 0),
      totalTokens: Number(event.totalTokens ?? 0),
      totalCost: event.totalCost == null ? null : Number(event.totalCost ?? 0),
      totalCostLabel: formatMaybeUsd(event.totalCost),
      latencyMs: event.latencyMs == null ? null : Number(event.latencyMs ?? 0),
      latencyLabel: formatLatency(event.latencyMs),
      errorCode: coalesceName(event.errorCode, "—"),
      errorMessage: coalesceName(event.errorMessage, "—"),
      costStateLabel: event.costEstimated ? "Estimado" : "Sin pricing",
    };
  });

const buildGroupedRows = (items = [], entityLabel, options = {}) =>
  items.map((item) => ({
    id: `${normalizeText(entityLabel)}-${normalizeText(item.key || item.label) || "sin-dato"}`,
    entityLabel: item.label,
    entityKey: item.key,
    events: Number(item.events ?? 0),
    successEvents: Number(item.successEvents ?? 0),
    failedEvents: Number(item.failedEvents ?? 0),
    successRateValue: Number(item.successRate ?? 0),
    successRateLabel: formatPercent(item.successRate ?? 0),
    inputTokens: Number(item.inputTokens ?? 0),
    outputTokens: Number(item.outputTokens ?? 0),
    totalTokens: Number(item.totalTokens ?? 0),
    estimatedCostEvents: Number(item.estimatedCostEvents ?? 0),
    totalCost:
      Number(item.estimatedCostEvents ?? 0) > 0
        ? Number(item.totalCost ?? 0)
        : null,
    totalCostLabel:
      Number(item.estimatedCostEvents ?? 0) > 0
        ? formatMaybeUsd(item.totalCost)
        : "Sin pricing",
    latencyMs: item.averageLatencyMs == null ? null : Number(item.averageLatencyMs ?? 0),
    latencyLabel: formatLatency(item.averageLatencyMs),
    entityTypeLabel: entityLabel,
    categoryLabel: options.categoryByKey?.get?.(String(item.key ?? "")) ?? "—",
  }));

const buildGeneralSummaryCards = (summary = {}) => [
  buildSummaryCard(
    "Eventos IA",
    formatNumber(summary.overview.totalEvents ?? 0),
    "Ejecuciones IA visibles en el periodo",
    "FaRobot",
    "sky"
  ),
  buildSummaryCard(
    "Tasa de exito",
    formatPercent(summary.overview.successRate ?? 0),
    `${formatNumber(summary.overview.successEvents ?? 0)} eventos exitosos`,
    "FaCircleCheck",
    "emerald"
  ),
  buildSummaryCard(
    "Tokens totales",
    formatNumber(summary.overview.totalTokens ?? 0),
    "Suma de input y output tokens registrados",
    "FaHashtag",
    "amber"
  ),
  buildSummaryCard(
    "Costo estimado",
    formatOverviewCost(summary.overview),
    buildPricingCoverageHelper(summary.overview),
    "FaDollarSign",
    "rose"
  ),
];

const buildCostSummaryCards = (summary = {}, reportConfig) => {
  const countMap = {
    Cliente: summary.overview.uniqueClients ?? 0,
    Proyecto: summary.overview.uniqueProjects ?? 0,
    Modelo: summary.overview.uniqueModels ?? 0,
    Proveedor: summary.overview.uniqueProviders ?? 0,
    "Perfil IA": Number(summary.byProfile?.length ?? 0),
  };

  return [
    buildSummaryCard(
      "Costo estimado",
      formatOverviewCost(summary.overview),
      buildPricingCoverageHelper(summary.overview),
      "FaDollarSign",
      "rose"
    ),
    buildSummaryCard(
      "Eventos IA",
      formatNumber(summary.overview.totalEvents ?? 0),
      "Universo visible para el usuario filtrado",
      "FaRobot",
      "sky"
    ),
    buildSummaryCard(
      "Tokens totales",
      formatNumber(summary.overview.totalTokens ?? 0),
      "Carga total procesada por los modelos",
      "FaHashtag",
      "amber"
    ),
    buildSummaryCard(
      `${reportConfig.entityLabel}s visibles`,
      formatNumber(countMap[reportConfig.entityLabel] ?? 0),
      `Cantidad de ${reportConfig.entityPluralLabel} con consumo IA`,
      "FaLayerGroup",
      "slate"
    ),
  ];
};

const buildLatencySummaryCards = (summary = {}) => [
  buildSummaryCard(
    "Modelos visibles",
    formatNumber(summary.overview.uniqueModels ?? 0),
    "Modelos con actividad IA en el periodo",
    "FaBrain",
    "sky"
  ),
  buildSummaryCard(
    "Tasa de exito",
    formatPercent(summary.overview.successRate ?? 0),
    `${formatNumber(summary.overview.successEvents ?? 0)} ejecuciones exitosas`,
    "FaCircleCheck",
    "emerald"
  ),
  buildSummaryCard(
    "Latencia promedio",
    formatLatency(summary.overview.averageLatencyMs),
    "Promedio general visible para el usuario",
    "FaGaugeHigh",
    "amber"
  ),
  buildSummaryCard(
    "Costo estimado",
    formatOverviewCost(summary.overview),
    buildPricingCoverageHelper(summary.overview),
    "FaDollarSign",
    "rose"
  ),
];

const buildErrorSummaryCards = (summary = {}) => [
  buildSummaryCard(
    "Eventos con error",
    formatNumber(summary.overview.totalEvents ?? 0),
    "Fallos, timeouts y cancelaciones visibles",
    "FaTriangleExclamation",
    "rose"
  ),
  buildSummaryCard(
    "Fallidos",
    formatNumber(countStatus(summary.byStatus, "failed")),
    "Eventos terminados en fallo explicito",
    "FaBug",
    "amber"
  ),
  buildSummaryCard(
    "Timeouts",
    formatNumber(countStatus(summary.byStatus, "timeout")),
    "Eventos que excedieron el tiempo esperado",
    "FaClockRotateLeft",
    "sky"
  ),
  buildSummaryCard(
    "Cancelados",
    formatNumber(countStatus(summary.byStatus, "cancelled")),
    "Eventos abortados antes de completarse",
    "FaBan",
    "slate"
  ),
];

const buildRawTableColumns = (isErrorReport = false) => {
  const base = [
    { key: "startedAtLabel", label: "Fecha", exportValue: (row) => row.startedAtLabel },
    { key: "clientLabel", label: "Cliente" },
    { key: "projectLabel", label: "Proyecto" },
    { key: "providerLabel", label: "Proveedor" },
    { key: "modelLabel", label: "Modelo" },
    { key: "statusLabel", label: "Estado" },
  ];

  if (isErrorReport) {
    return [
      ...base,
      { key: "errorCode", label: "Codigo error" },
      { key: "errorMessage", label: "Mensaje error" },
      buildTokenBreakdownColumn(),
      { key: "latencyLabel", label: "Latencia" },
    ];
  }

  return [
    ...base,
    { key: "eventTypeLabel", label: "Tipo evento" },
    buildTokenBreakdownColumn(),
    { key: "totalCostLabel", label: "Costo" },
    { key: "latencyLabel", label: "Latencia" },
  ];
};

const buildGroupedColumns = (entityLabel) => [
  { key: "entityLabel", label: entityLabel },
  { key: "events", label: "Eventos", exportValue: (row) => formatNumber(row.events ?? 0) },
  {
    key: "successEvents",
    label: "Exitosos",
    exportValue: (row) => formatNumber(row.successEvents ?? 0),
  },
  {
    key: "failedEvents",
    label: "No exitosos",
    exportValue: (row) => formatNumber(row.failedEvents ?? 0),
  },
  {
    key: "successRateLabel",
    label: "Tasa de exito",
    exportValue: (row) => row.successRateLabel,
  },
  buildTokenBreakdownColumn(),
  {
    key: "totalCostLabel",
    label: "Costo estimado",
    exportValue: (row) => row.totalCostLabel,
  },
  {
    key: "latencyLabel",
    label: "Latencia promedio",
    exportValue: (row) => row.latencyLabel,
  },
];

const buildProfileColumns = () => [
  { key: "entityLabel", label: "Perfil IA" },
  { key: "categoryLabel", label: "Categoría" },
  { key: "events", label: "Eventos", exportValue: (row) => formatNumber(row.events ?? 0) },
  {
    key: "successEvents",
    label: "Exitosos",
    exportValue: (row) => formatNumber(row.successEvents ?? 0),
  },
  {
    key: "failedEvents",
    label: "No exitosos",
    exportValue: (row) => formatNumber(row.failedEvents ?? 0),
  },
  {
    key: "successRateLabel",
    label: "Tasa de exito",
    exportValue: (row) => row.successRateLabel,
  },
  buildTokenBreakdownColumn(),
  {
    key: "totalCostLabel",
    label: "Costo estimado",
    exportValue: (row) => row.totalCostLabel,
  },
];

const buildLatencyColumns = () => [
  { key: "entityLabel", label: "Modelo" },
  { key: "events", label: "Eventos", exportValue: (row) => formatNumber(row.events ?? 0) },
  {
    key: "successRateLabel",
    label: "Tasa de exito",
    exportValue: (row) => row.successRateLabel,
  },
  {
    key: "latencyLabel",
    label: "Latencia promedio",
    exportValue: (row) => row.latencyLabel,
  },
  {
    key: "successEvents",
    label: "Exitosos",
    exportValue: (row) => formatNumber(row.successEvents ?? 0),
  },
  {
    key: "failedEvents",
    label: "No exitosos",
    exportValue: (row) => formatNumber(row.failedEvents ?? 0),
  },
  buildTokenBreakdownColumn(),
  {
    key: "totalCostLabel",
    label: "Costo estimado",
    exportValue: (row) => row.totalCostLabel,
  },
];

const pickTopMetricItems = (rows = [], metricKey, limit = 8) =>
  rows
    .map((row) => ({
      label: row.entityLabel ?? row.providerLabel ?? row.modelLabel ?? "Sin dato",
      value: Number(row?.[metricKey] ?? 0),
    }))
    .filter((item) => item.value > 0)
    .sort((left, right) => {
      if (right.value !== left.value) return right.value - left.value;
      return compareByLabel(left.label, right.label);
    })
    .slice(0, limit);

const buildChartDefinitions = ({ reportConfig, summary, rows }) => {
  if (!reportConfig) return [];

  if (reportConfig.kind === "general") {
    return [
      {
        key: "trend",
        type: "trend",
        title: "Evolucion del uso IA",
        subtitle: "Muestra cuantos eventos IA se registran por fecha y cuantos terminan exitosamente.",
        footer: "La evolucion se calcula sobre el mismo universo filtrado que alimenta la tabla.",
        primaryLabel: "Eventos",
        secondaryLabel: "Exitosos",
        primaryColor: CHART_THEME.primary,
        secondaryColor: CHART_THEME.secondary,
        data: (summary.timeseries ?? []).map((point) => ({
          label: point.date,
          primaryValue: Number(point.events ?? 0),
          secondaryValue: Number(point.successEvents ?? 0),
        })),
      },
      {
        key: "status",
        type: "status",
        title: "Distribucion por estado",
        subtitle: "Proporcion de exito, fallo, timeout y cancelacion dentro del periodo visible.",
        footer: "Cada segmento refleja el estado final registrado en los eventos IA consultados.",
        data: (summary.byStatus ?? []).map((item) => ({
          label: item.label,
          value: Number(item.events ?? 0),
        })),
      },
    ];
  }

  if (reportConfig.kind === "cost") {
    return [
      {
        key: "cost",
        type: "metric-bar",
        title: `${reportConfig.entityPluralLabel[0].toUpperCase()}${reportConfig.entityPluralLabel.slice(1)} por costo estimado`,
        subtitle: `Destaca los ${reportConfig.entityPluralLabel} con mayor costo IA acumulado en el periodo filtrado.`,
        footer: "El costo depende de la cobertura vigente del catalogo de pricing.",
        seriesName: "Costo estimado",
        color: CHART_THEME.negative,
        labelFormatter: (value) => formatUsd(value),
        tooltipFormatter: (value) => formatUsd(value),
        emptyMessage: "No hay pricing resuelto para construir el ranking de costo estimado.",
        data: pickTopMetricItems(rows, "totalCost"),
      },
      {
        key: "tokens",
        type: "metric-bar",
        title: `${reportConfig.entityPluralLabel[0].toUpperCase()}${reportConfig.entityPluralLabel.slice(1)} por tokens`,
        subtitle: `Compara donde se concentra la mayor carga de tokens del uso IA agrupado por ${reportConfig.entityLabel.toLowerCase()}.`,
        footer: "Los tokens consideran el total registrado entre input y output.",
        seriesName: "Tokens",
        color: CHART_THEME.primary,
        labelFormatter: (value) => formatNumber(value, 0),
        tooltipFormatter: (value) => formatNumber(value, 0),
        data: pickTopMetricItems(rows, "totalTokens"),
      },
    ];
  }

  if (reportConfig.kind === "profile") {
    return [
      {
        key: "profile-events",
        type: "metric-bar",
        title: "Perfiles IA por volumen de eventos",
        subtitle: "Destaca los perfiles mas utilizados dentro del periodo filtrado.",
        footer: "Cada barra refleja el uso operacional real del perfil sobre eventos visibles para el usuario.",
        seriesName: "Eventos",
        color: CHART_THEME.primary,
        labelFormatter: (value) => formatNumber(value, 0),
        tooltipFormatter: (value) => formatNumber(value, 0),
        data: pickTopMetricItems(rows, "events"),
      },
      {
        key: "profile-cost",
        type: "metric-bar",
        title: "Perfiles IA por costo estimado",
        subtitle: "Compara el costo visible atribuible a cada perfil de analisis.",
        footer: "El costo depende de la cobertura vigente del catalogo de pricing por modelo.",
        seriesName: "Costo estimado",
        color: CHART_THEME.quaternary,
        labelFormatter: (value) => formatUsd(value),
        tooltipFormatter: (value) => formatUsd(value),
        emptyMessage: "No hay pricing resuelto para comparar costo estimado entre perfiles.",
        data: pickTopMetricItems(rows, "totalCost"),
      },
    ];
  }

  if (reportConfig.kind === "latency") {
    return [
      {
        key: "latency",
        type: "metric-bar",
        title: "Modelos por latencia promedio",
        subtitle: "Compara la demora promedio registrada por modelo visible para el usuario.",
        footer: "Una mayor latencia no siempre implica error, pero si mayor costo operacional.",
        seriesName: "Latencia promedio",
        color: CHART_THEME.tertiary,
        labelFormatter: (value) => `${formatNumber(value, 0)} ms`,
        tooltipFormatter: (value) => `${formatNumber(value, 0)} ms`,
        data: sortMetricItems(
          rows
            .filter((row) => row.latencyMs != null)
            .map((row) => ({ label: row.entityLabel, value: Number(row.latencyMs ?? 0) })),
          (item) => item.value
        ).slice(0, 8),
      },
      {
        key: "success",
        type: "metric-bar",
        title: "Modelos por tasa de exito",
        subtitle: "Mide estabilidad relativa entre modelos sobre el mismo universo filtrado.",
        footer: "La tasa de exito se calcula como eventos exitosos sobre eventos totales por modelo.",
        seriesName: "Tasa de exito",
        color: CHART_THEME.secondary,
        labelFormatter: (value) => `${formatNumber(value, 1)}%`,
        tooltipFormatter: (value) => `${formatNumber(value, 1)}%`,
        data: sortMetricItems(
          rows.map((row) => ({
            label: row.entityLabel,
            value: Number(row.successRateValue ?? 0),
          })),
          (item) => item.value
        ).slice(0, 8),
      },
    ];
  }

  return [
    {
      key: "errors-trend",
      type: "trend",
      title: "Evolucion de eventos con error",
      subtitle: "Compara cuantos eventos con error aparecen por fecha y cuantos son fallos explicitos.",
      footer: "Incluye fallos, timeouts y cancelaciones segun la seleccion visible.",
      primaryLabel: "Errores",
      secondaryLabel: "Fallidos",
      primaryColor: CHART_THEME.negative,
      secondaryColor: CHART_THEME.tertiary,
      data: (summary.timeseries ?? []).map((point) => ({
        label: point.date,
        primaryValue: Number(point.events ?? 0),
        secondaryValue: Number(point.failedEvents ?? 0),
      })),
    },
    {
      key: "errors-status",
      type: "status",
      title: "Distribucion por estado de error",
      subtitle: "Distingue la proporcion entre fallidos, timeout y cancelados dentro del periodo consultado.",
      footer: "Cada segmento representa el estado terminal de los eventos no exitosos visibles.",
      data: (summary.byStatus ?? []).map((item) => ({
        label: item.label,
        value: Number(item.events ?? 0),
      })),
    },
  ];
};

const buildReportDataset = ({ reportConfig, summary, listResponse, catalogs }) => {
  const eventRows = buildRawEventRows(listResponse.items ?? [], catalogs);

  if (reportConfig.kind === "general") {
    return {
      rows: eventRows,
      columns: buildRawTableColumns(false),
      summaryCards: buildGeneralSummaryCards(summary),
      chartDefinitions: buildChartDefinitions({ reportConfig, summary, rows: eventRows }),
    };
  }

  if (reportConfig.kind === "errors") {
    return {
      rows: eventRows,
      columns: buildRawTableColumns(true),
      summaryCards: buildErrorSummaryCards(summary),
      chartDefinitions: buildChartDefinitions({ reportConfig, summary, rows: eventRows }),
    };
  }

  if (reportConfig.kind === "latency") {
    const rows = buildGroupedRows(summary.byModel ?? [], "Modelo");
    return {
      rows,
      columns: buildLatencyColumns(),
      summaryCards: buildLatencySummaryCards(summary),
      chartDefinitions: buildChartDefinitions({ reportConfig, summary, rows }),
    };
  }

  if (reportConfig.kind === "profile") {
    const rows = buildGroupedRows(summary.byProfile ?? [], "Perfil IA", {
      categoryByKey: catalogs.profileCategoryMap,
    });
    return {
      rows,
      columns: buildProfileColumns(),
      summaryCards: buildCostSummaryCards(summary, reportConfig),
      chartDefinitions: buildChartDefinitions({ reportConfig, summary, rows }),
    };
  }

  const groupedRows = buildGroupedRows(summary[reportConfig.breakdownKey] ?? [], reportConfig.entityLabel);
  return {
    rows: groupedRows,
    columns: buildGroupedColumns(reportConfig.entityLabel),
    summaryCards: buildCostSummaryCards(summary, reportConfig),
    chartDefinitions: buildChartDefinitions({ reportConfig, summary, rows: groupedRows }),
  };
};

const buildProviderOptions = (providerCatalog = [], summary = null) => {
  const entries = new Map();

  providerCatalog.forEach((item) => {
    const key = String(item?.id ?? "").trim();
    if (!key) return;
    entries.set(key, item?.name ? `${item.name}` : key);
  });

  const summaryOptions = summary?.filtersMeta?.providerTypes ?? [];
  summaryOptions.forEach((value) => {
    const key = String(value ?? "").trim();
    if (!key) return;
    if (!entries.has(key)) {
      entries.set(key, key);
    }
  });

  return [...entries.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => compareByLabel(left.label, right.label));
};

const buildModelOptions = (providerConfigs = [], summary = null) => {
  const labels = new Map();

  providerConfigs.forEach((item) => {
    const key = String(item?.model_name ?? item?.modelName ?? "").trim();
    if (!key) return;
    labels.set(key, key);
  });

  (summary?.filtersMeta?.modelNames ?? []).forEach((value) => {
    const key = String(value ?? "").trim();
    if (!key) return;
    labels.set(key, key);
  });

  return [...labels.keys()]
    .map((value) => ({ value, label: value }))
    .sort((left, right) => compareByLabel(left.label, right.label));
};

const MissingReportPage = () => (
  <div className="rounded-3xl border border-dashed border-amber-300 bg-amber-50 px-6 py-10 text-center text-amber-900 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-100">
    <h1 className="text-2xl font-semibold">Reporte IA no encontrado</h1>
    <p className="mt-2 text-sm">
      La ruta solicitada no coincide con uno de los reportes IA habilitados en esta primera pasada.
    </p>
  </div>
);

const ManagementAiUsageReportPage = () => {
  const location = useLocation();
  const requestScope = useAbortableRequestScope();
  const chartRefs = useRef({});

  const reportConfig = useMemo(
    () => REPORT_CONFIG_BY_PATH[location.pathname] ?? null,
    [location.pathname]
  );

  useDocumentTitle(reportConfig?.title ?? "Reportes IA");

  const [draftFilters, setDraftFilters] = useState(() => buildDefaultFilters());
  const [page, setPage] = useState(1);
  const [hasExecutedSearch, setHasExecutedSearch] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [summary, setSummary] = useState(null);
  const [listResponse, setListResponse] = useState({ items: [], total: 0, skip: 0, limit: 0 });
  const [catalogs, setCatalogs] = useState({
    clients: [],
    projects: [],
    profiles: [],
    providerCatalog: [],
    providerConfigs: [],
  });

  const filterRequestOptions = useMemo(() => {
    if (!reportConfig) return {};

    const presetStatuses =
      reportConfig.presetStatuses && !draftFilters.status
        ? reportConfig.presetStatuses
        : [];

    return {
      startDate: draftFilters.dateFrom,
      endDate: draftFilters.dateTo,
      clientId: draftFilters.clientId,
      projectId: draftFilters.projectId,
      aiProfileId: draftFilters.aiProfileId,
      providerType: draftFilters.providerType,
      modelName: draftFilters.modelName,
      status: draftFilters.status,
      statuses: presetStatuses,
      eventType: draftFilters.eventType,
      limit: 1000,
      recentLimit: 50,
      breakdownLimit: 100,
    };
  }, [draftFilters, reportConfig]);

  useEffect(() => {
    setDraftFilters(buildDefaultFilters());
    setPage(1);
    setHasExecutedSearch(false);
    setSummary(null);
    setListResponse({ items: [], total: 0, skip: 0, limit: 0 });
    chartRefs.current = {};
  }, [location.pathname]);

  useEffect(() => {
    if (!reportConfig) return undefined;

    let isMounted = true;
    const run = async () => {
      try {
        const clientReq = requestScope.createRequestConfig();
        const projectReq = requestScope.createRequestConfig();
        const profileReq = requestScope.createRequestConfig();
        const providerCatalogReq = requestScope.createRequestConfig();
        const providerListReq = requestScope.createRequestConfig();

        const [
          clientResult,
          projectResult,
          profileResult,
          providerCatalog,
          providerConfigs,
        ] = await Promise.allSettled([
          clientService.list(
            { skip: 0, limit: 300, isActive: true },
            clientReq
          ),
          projectService.list(
            { skip: 0, limit: 300, isActive: true },
            projectReq
          ),
          profileService.list(
            { skip: 0, limit: 200, isActive: null },
            profileReq
          ),
          aiProviderConfigService.getCatalog(providerCatalogReq),
          aiProviderConfigService.list(
            { skip: 0, limit: 100, isActive: true },
            providerListReq
          ),
        ]);

        if (!isMounted) return;

        if (profileResult.status === "rejected") {
          reportLog.warn("No fue posible precargar el catalogo de perfiles IA.", profileResult.reason);
        }

        setCatalogs({
          clients: clientResult.status === "fulfilled" ? clientResult.value.items ?? [] : [],
          projects: projectResult.status === "fulfilled" ? projectResult.value.items ?? [] : [],
          profiles: profileResult.status === "fulfilled" ? profileResult.value.items ?? [] : [],
          providerCatalog:
            providerCatalog.status === "fulfilled" && Array.isArray(providerCatalog.value)
              ? providerCatalog.value
              : [],
          providerConfigs:
            providerConfigs.status === "fulfilled" ? providerConfigs.value.items ?? [] : [],
        });
      } catch (error) {
        reportLog.warn("No fue posible precargar catalogos para reportes IA.", error);
      }
    };

    run();

    return () => {
      isMounted = false;
    };
  }, [reportConfig, requestScope]);

  const loadReportData = useCallback(
    async (filtersToApply) => {
      if (!reportConfig) return;

      requestScope.cancelAll();
      setIsLoading(true);
      setHasExecutedSearch(true);
      chartRefs.current = {};

      try {
        const summaryRequest = requestScope.createRequestConfig();
        const listRequest = requestScope.createRequestConfig();

        const requestPayload = {
          ...filterRequestOptions,
          ...filtersToApply,
        };

        const [summaryResult, listResult] = await Promise.all([
          aiUsageMetricsService.getSummary(requestPayload, summaryRequest),
          aiUsageMetricsService.getEventsList(requestPayload, listRequest),
        ]);

        if (requestScope.wasAborted(summaryRequest) || requestScope.wasAborted(listRequest)) {
          return;
        }

        setSummary(summaryResult);
        setListResponse(listResult);
        startTransition(() => {
          setPage(1);
        });
      } catch (error) {
        reportLog.error(
          `No fue posible cargar el reporte IA ${reportConfig.id}.`,
          error
        );

        ModalManager.error?.({
          title: "Error al cargar reporte",
          message:
            "No fue posible consultar la informacion del reporte IA. Intenta nuevamente en unos segundos.",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [filterRequestOptions, reportConfig, requestScope]
  );

  const clientMap = useMemo(
    () =>
      new Map(
        (catalogs.clients ?? []).map((item) => [
          String(item.id),
          coalesceName(item.company, item.name),
        ])
      ),
    [catalogs.clients]
  );

  const projectMap = useMemo(
    () =>
      new Map(
        (catalogs.projects ?? []).map((item) => [
          String(item.id),
          coalesceName(item.name, item.projectName),
        ])
      ),
    [catalogs.projects]
  );

  const profileMap = useMemo(
    () =>
      new Map(
        (catalogs.profiles ?? []).map((item) => [
          String(item.id),
          coalesceName(item.name, "Sin perfil"),
        ])
      ),
    [catalogs.profiles]
  );

  const profileCategoryMap = useMemo(
    () =>
      new Map(
        (catalogs.profiles ?? []).map((item) => [
          String(item.id),
          coalesceName(item.category?.name, "Sin categoría"),
        ])
      ),
    [catalogs.profiles]
  );

  const providerOptions = useMemo(
    () => buildProviderOptions(catalogs.providerCatalog, summary),
    [catalogs.providerCatalog, summary]
  );

  const modelOptions = useMemo(
    () => buildModelOptions(catalogs.providerConfigs, summary),
    [catalogs.providerConfigs, summary]
  );

  const filterFields = useMemo(
    () => [
      { name: "dateFrom", label: "Fecha desde", type: "date", icon: "FaCalendarAlt" },
      { name: "dateTo", label: "Fecha hasta", type: "date", icon: "FaCalendarAlt" },
      {
        name: "clientId",
        label: "Cliente",
        type: "select",
        icon: "FaBuilding",
        placeholder: "Todos los clientes",
        options: catalogs.clients,
        getOptionValue: (option) => option.id,
        getOptionLabel: (option) => coalesceName(option.company, option.name),
      },
      {
        name: "projectId",
        label: "Proyecto",
        type: "select",
        icon: "FaDiagramProject",
        placeholder: "Todos los proyectos",
        options: catalogs.projects,
        getOptionValue: (option) => option.id,
        getOptionLabel: (option) => coalesceName(option.name, option.projectName),
      },
      {
        name: "aiProfileId",
        label: "Perfil IA",
        type: "select",
        icon: "FaBrain",
        placeholder: "Todos los perfiles",
        options: catalogs.profiles,
        getOptionValue: (option) => option.id,
        getOptionLabel: (option) => coalesceName(option.name, "Sin perfil"),
      },
      {
        name: "providerType",
        label: "Proveedor",
        type: "select",
        icon: "FaDatabase",
        placeholder: "Todos los providers",
        options: providerOptions,
      },
      {
        name: "modelName",
        label: "Modelo",
        type: "select",
        icon: "FaBrain",
        placeholder: "Todos los modelos",
        options: modelOptions,
      },
      {
        name: "status",
        label: "Estado",
        type: "select",
        icon: "FaCircleInfo",
        placeholder: "Todos los estados",
        options: STATUS_FILTER_OPTIONS,
      },
      {
        name: "eventType",
        label: "Tipo de evento",
        type: "select",
        icon: "FaListCheck",
        placeholder: "Todos los tipos",
        options: EVENT_TYPE_FILTER_OPTIONS,
      },
    ],
    [catalogs.clients, catalogs.profiles, catalogs.projects, modelOptions, providerOptions]
  );

  const { rows, columns, summaryCards, chartDefinitions } = useMemo(() => {
    if (!reportConfig || !summary) {
      return {
        rows: [],
        columns:
          reportConfig?.kind === "errors"
            ? buildRawTableColumns(true)
            : reportConfig?.kind === "general"
              ? buildRawTableColumns(false)
              : reportConfig?.kind === "latency"
                ? buildLatencyColumns()
                : reportConfig?.kind === "profile"
                  ? buildProfileColumns()
                : buildGroupedColumns(reportConfig?.entityLabel ?? "Agrupador"),
        summaryCards: [],
        chartDefinitions: [],
      };
    }

    return buildReportDataset({
      reportConfig,
      summary,
      listResponse,
      catalogs: { clientMap, projectMap, profileCategoryMap },
    });
  }, [clientMap, listResponse, profileCategoryMap, projectMap, reportConfig, summary]);

  const { sortedItems, sortConfig, toggleSort } = useTableSorting(rows, SORTERS);

  const totalItems = sortedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedRows = useMemo(() => {
    const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
    return sortedItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [safePage, sortedItems]);

  const hasPartialPricingCoverage = useMemo(
    () => hasPartialPricingCoverageForOverview(summary?.overview),
    [summary]
  );

  const hasLegacyEventsWithoutProfile = useMemo(
    () =>
      Boolean(
        summary?.byProfile?.some(
          (item) => String(item.key ?? "").trim() === "sin-perfil"
        )
      ),
    [summary]
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
          "Indica al menos un parametro de busqueda antes de ejecutar el reporte.",
      });
      return;
    }

    loadReportData({ ...filterRequestOptions });
  }, [draftFilters, filterRequestOptions, loadReportData]);

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
          "Estamos preparando la portada, los graficos y la vista previa del documento.",
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
        reportLog.warn("No fue posible capturar uno o mas graficos IA para el PDF.", {
          reportId: reportConfig.id,
          requestedCharts: chartDefinitions.slice(0, 2).length,
          exportedCharts: chartImages.length,
        });
      }

      const providerMap = new Map(providerOptions.map((item) => [String(item.value), item.label]));
      const modelMap = new Map(modelOptions.map((item) => [String(item.value), item.label]));
      const eventTypeMap = new Map(EVENT_TYPE_FILTER_OPTIONS.map((item) => [item.value, item.label]));

      const payload = {
        template_key: "executive_summary_general",
        report_key: reportConfig.pdfReportKey,
        report_type: "Reporte de IA",
        report_title: reportConfig.title,
        report_description: reportConfig.pdfDescription,
        report_objective: `Entregar una salida ejecutiva y trazable de ${reportConfig.title.toLowerCase()} respetando los filtros aplicados por el usuario al momento de exportar.`,
        source_module: "Modulo de Reportes",
        orientation: "landscape",
        paper_size: "A4",
        applied_filters: buildAppliedFiltersForExport(draftFilters, {
          clientMap,
          projectMap,
          profileMap,
          providerMap,
          modelMap,
          eventTypeMap,
        }),
        summary_metrics: buildSummaryMetricsFromCards(summaryCards),
        chart_data: buildChartDataPayload(summary),
        chart_images: chartImages,
        table_title: "Detalle de resultados exportados",
        table_description: reportConfig.tableDescription,
        table_range_label: buildReportRangeLabel(draftFilters),
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
    chartDefinitions,
    clientMap,
    columns,
    draftFilters,
    isGeneratingPdf,
    modelOptions,
    profileMap,
    projectMap,
    providerOptions,
    reportConfig,
    sortedItems,
    summary,
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
      icon={reportConfig.icon}
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
          ? "No hay eventos IA para el periodo filtrado"
          : "Aun no se ha ejecutado el reporte"
      }
      emptyMessage={
        hasExecutedSearch
          ? "Prueba ampliando el rango de fechas o ajustando los filtros de cliente, proyecto, provider o modelo."
          : 'Define los parametros de busqueda y luego pulsa "Filtrar / Ejecutar" para consultar el uso de IA.'
      }
    >
      {hasExecutedSearch && hasLegacyEventsWithoutProfile ? (
        <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-700/40 dark:bg-rose-900/20 dark:text-rose-100">
          Se detectaron eventos IA historicos sin perfil asociado. Desde esta pasada los nuevos eventos `minute_processing` sin `ai_profile_id` ya no se persisten como metricas validas y deben revisarse como deuda de integridad previa.
        </div>
      ) : null}

      {hasExecutedSearch && hasPartialPricingCoverage ? (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-100">
          Parte del universo visible aun no tiene pricing cargado en el catalogo de modelos. Los costos exportados representan solo los eventos con precio resuelto.
        </div>
      ) : null}
    </ReportModulePage>
  );
};

export default ManagementAiUsageReportPage;
