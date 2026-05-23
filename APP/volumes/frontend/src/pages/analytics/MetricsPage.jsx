import React, { useEffect, useMemo, useState } from "react";
import {
  FaChartLine,
  FaClock,
  FaCoins,
  FaDatabase,
  FaFilter,
  FaMicrochip,
  FaProjectDiagram,
  FaRedoAlt,
  FaRobot,
} from "react-icons/fa";

import AsyncEChart from "@/components/charts/AsyncEChart";
import CollapsibleSection from "@/components/common/CollapsibleSection";
import ModuleHeader from "@/components/common/page/ModuleHeader";
import PageLoadingSpinner from "@/components/ui/modal/types/system/PageLoadingSpinner";
import { TXT_BODY, TXT_META, TXT_TITLE } from "@/pages/system/SystemSettingsShared";
import aiUsageMetricsService from "@/services/aiUsageMetricsService";
import clientService from "@/services/clientService";
import projectService from "@/services/projectService";
import logger from "@/utils/logger";

const metricsLog = logger.scope("metrics");

const TOKENS_PALETTE = ["#2563eb", "#0f766e", "#059669", "#d97706", "#dc2626", "#475569"];
const STATUS_COLORS = {
  success: "#059669",
  failed: "#dc2626",
  timeout: "#d97706",
  cancelled: "#64748b",
};
const CHART_THEME = {
  grid: "rgba(148,163,184,0.28)",
  areaTop: "#0ea5e9",
  areaBottom: "#0ea5e9",
  totalLine: "#38bdf8",
  inputLine: "#2563eb",
  outputLine: "#14b8a6",
  eventsBar: "#2563eb",
  latencyLine: "#f59e0b",
  point: "#e0f2fe",
};

const ECHART_TEXT = "#94a3b8";
const ECHART_TITLE = "#e2e8f0";
const ECHART_TOOLTIP_BG = "rgba(15,23,42,0.94)";
const ECHART_BORDER = "rgba(148,163,184,0.18)";

const SECTION_DEFAULTS = {
  executive: true,
  trends: true,
  operations: true,
  business: true,
  events: true,
};

const toInputDate = (date) => {
  const normalized = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return normalized.toISOString().slice(0, 10);
};

const buildDefaultFilters = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29);

  return {
    startDate: toInputDate(start),
    endDate: toInputDate(end),
    clientId: "",
    projectId: "",
    providerType: "",
    providerFamily: "",
    executionAdapter: "",
    modelName: "",
    status: "",
    eventType: "",
  };
};

const numberFmt = new Intl.NumberFormat("es-CL");
const compactFmt = new Intl.NumberFormat("es-CL", { notation: "compact", maximumFractionDigits: 1 });
const currencyFmt = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const percentFmt = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const formatNumber = (value) => numberFmt.format(Number(value ?? 0));
const formatCompactNumber = (value) => compactFmt.format(Number(value ?? 0));
const formatCurrency = (value) => currencyFmt.format(Number(value ?? 0));
const formatPercent = (value) => `${percentFmt.format(Number(value ?? 0))}%`;
const formatLatency = (value) => (value == null ? "Sin dato" : `${formatNumber(Math.round(value))} ms`);

const formatDateTime = (value) => {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatAxisDate = (value) => {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return String(value);
  return `${day}/${month}`;
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
    extraCssText: "box-shadow: 0 18px 42px rgba(15,23,42,0.28); border-radius: 14px;",
  },
});

const statusBadgeClass = (status) => {
  if (status === "success") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300";
  if (status === "failed") return "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300";
  if (status === "timeout") return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300";
  return "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300";
};

const inputClassName =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-sky-400 dark:focus:ring-sky-500/20";

const chartPoint = (value, index, total, width, height, paddingX, paddingY, maxValue) => {
  const spanX = Math.max(width - paddingX * 2, 1);
  const spanY = Math.max(height - paddingY * 2, 1);
  const x = total <= 1 ? width / 2 : paddingX + (index / (total - 1)) * spanX;
  const y = height - paddingY - (maxValue <= 0 ? 0 : (Number(value ?? 0) / maxValue) * spanY);
  return [x, y];
};

const buildLinePath = (values, width, height, paddingX = 18, paddingY = 18) => {
  if (!values.length) return "";
  const maxValue = Math.max(...values.map((value) => Number(value ?? 0)), 1);
  return values
    .map((value, index) => {
      const [x, y] = chartPoint(value, index, values.length, width, height, paddingX, paddingY, maxValue);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
};

const buildAreaPath = (values, width, height, paddingX = 18, paddingY = 18) => {
  if (!values.length) return "";
  const maxValue = Math.max(...values.map((value) => Number(value ?? 0)), 1);
  const first = chartPoint(values[0], 0, values.length, width, height, paddingX, paddingY, maxValue);
  const last = chartPoint(values[values.length - 1], values.length - 1, values.length, width, height, paddingX, paddingY, maxValue);
  const line = values
    .map((value, index) => {
      const [x, y] = chartPoint(value, index, values.length, width, height, paddingX, paddingY, maxValue);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  return `${line} L ${last[0]} ${height - paddingY} L ${first[0]} ${height - paddingY} Z`;
};

const ChartPanel = ({ title, subtitle, children, footer, className = "" }) => (
  <div className={`rounded-[26px] border border-gray-200/80 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`}>
    <div className="mb-4">
      <h3 className={`text-base font-semibold ${TXT_TITLE}`}>{title}</h3>
      {subtitle ? <p className={`mt-1 text-sm ${TXT_BODY}`}>{subtitle}</p> : null}
    </div>
    {children}
    {footer ? <div className={`mt-4 border-t border-gray-100 pt-3 text-xs dark:border-gray-700 ${TXT_META}`}>{footer}</div> : null}
  </div>
);

const StatCard = ({ icon: Icon, title, value, helper, tone = "blue" }) => {
  const tones = {
    blue: "bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-300",
    green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-300",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-300",
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-300",
  };

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-slate-50/80 p-5 shadow-sm dark:border-gray-700/80 dark:bg-slate-900/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-sm font-medium ${TXT_META}`}>{title}</p>
          <p className={`mt-2 text-2xl font-bold ${TXT_TITLE}`}>{value}</p>
          {helper ? <p className={`mt-2 text-xs ${TXT_META}`}>{helper}</p> : null}
        </div>
        <div className={`rounded-2xl p-3 ${tones[tone] ?? tones.blue}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
};

const SectionCard = ({ title, subtitle, children, action }) => (
  <section className="rounded-[26px] border border-gray-200/80 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h2 className={`text-lg font-semibold ${TXT_TITLE}`}>{title}</h2>
        {subtitle ? <p className={`mt-1 text-sm ${TXT_BODY}`}>{subtitle}</p> : null}
      </div>
      {action}
    </div>
    {children}
  </section>
);

const FilterField = ({ label, children }) => (
  <label className="flex flex-col gap-1">
    <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</span>
    {children}
  </label>
);

const InsightStrip = ({ insights = [] }) => (
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
    {insights.map((item) => (
      <div key={item.title} className="rounded-2xl border border-gray-100 bg-slate-50/80 px-4 py-4 dark:border-gray-700/80 dark:bg-slate-900/40">
        <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>{item.title}</p>
        <p className={`mt-2 text-base font-semibold ${TXT_TITLE}`}>{item.value}</p>
        <p className={`mt-1 text-sm ${TXT_BODY}`}>{item.helper}</p>
      </div>
    ))}
  </div>
);

const HeaderSummaryTile = ({ label, value, helper }) => (
  <div className="rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-center dark:border-gray-700 dark:bg-slate-900/40">
    <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>{label}</p>
    <p className={`mt-2 text-2xl font-bold ${TXT_TITLE}`}>{value}</p>
    {helper ? <p className={`mt-1 text-xs ${TXT_META}`}>{helper}</p> : null}
  </div>
);

const TrendAreaFallbackChart = ({ points = [] }) => {
  if (!points.length) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No hay actividad registrada.</p>;
  }

  const width = 420;
  const height = 180;
  const totalTokens = points.map((point) => Number(point.totalTokens ?? 0));
  const outputTokens = points.map((point) => Number(point.outputTokens ?? 0));
  const maxValue = Math.max(...totalTokens, 1);
  const areaPath = buildAreaPath(totalTokens, width, height, 20, 22);
  const totalPath = buildLinePath(totalTokens, width, height, 20, 22);
  const outputPath = buildLinePath(outputTokens, width, height, 20, 22);
  const peak = Math.max(...totalTokens, 0);
  const total = totalTokens.reduce((sum, value) => sum + value, 0);

  return (
    <div className="space-y-4">
      <div className="h-48 rounded-2xl border border-sky-100 bg-gradient-to-b from-sky-50 via-white to-teal-50/70 p-3 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/40">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
          <defs>
            <linearGradient id="tokens-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={CHART_THEME.areaTop} stopOpacity="0.35" />
              <stop offset="100%" stopColor={CHART_THEME.areaBottom} stopOpacity="0.03" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((tick) => {
            const y = height - 22 - tick * (height - 44);
            return <line key={tick} x1="20" x2={width - 20} y1={y} y2={y} stroke={CHART_THEME.grid} strokeDasharray="4 6" />;
          })}
          <path d={areaPath} fill="url(#tokens-area)" />
          <path d={totalPath} fill="none" stroke={CHART_THEME.totalLine} strokeWidth="3" strokeLinecap="round" />
          <path d={outputPath} fill="none" stroke={CHART_THEME.outputLine} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="5 6" />
          {points.map((point, index) => {
            const [x, y] = chartPoint(totalTokens[index], index, points.length, width, height, 20, 22, maxValue);
            return <circle key={point.date} cx={x} cy={y} r="3.6" fill={CHART_THEME.point} stroke={CHART_THEME.totalLine} strokeWidth="2" />;
          })}
        </svg>
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-900/40">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Total rango</p>
          <p className="mt-1 font-semibold text-gray-900 dark:text-white">{formatNumber(total)} tokens</p>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-900/40">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Pico diario</p>
          <p className="mt-1 font-semibold text-gray-900 dark:text-white">{formatNumber(peak)} tokens</p>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-900/40">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Ultimo punto</p>
          <p className="mt-1 font-semibold text-gray-900 dark:text-white">{formatNumber(totalTokens.at(-1) ?? 0)} tokens</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_THEME.totalLine }} />
          Tokens totales
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4" style={{ backgroundColor: CHART_THEME.outputLine }} />
          Output tokens
        </span>
      </div>
    </div>
  );
};

const ActivityComboFallbackChart = ({ points = [] }) => {
  if (!points.length) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No hay actividad registrada.</p>;
  }

  const width = 420;
  const height = 180;
  const events = points.map((point) => Number(point.events ?? 0));
  const latency = points.map((point) => Number(point.averageLatencyMs ?? 0));
  const maxEvents = Math.max(...events, 1);
  const maxLatency = Math.max(...latency, 1);
  const latencyPath = latency
    .map((value, index) => {
      const [x, y] = chartPoint(value, index, latency.length, width, height, 24, 22, maxLatency);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <div className="space-y-4">
      <div className="h-48 rounded-2xl border border-amber-100 bg-gradient-to-b from-amber-50/80 via-white to-sky-50/70 p-3 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/25">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
          {[0.25, 0.5, 0.75].map((tick) => {
            const y = height - 22 - tick * (height - 44);
            return <line key={tick} x1="20" x2={width - 20} y1={y} y2={y} stroke={CHART_THEME.grid} strokeDasharray="4 6" />;
          })}
          {points.map((point, index) => {
            const [x] = chartPoint(events[index], index, points.length, width, height, 24, 22, maxEvents);
            const barHeight = maxEvents <= 0 ? 0 : (events[index] / maxEvents) * (height - 44);
            const y = height - 22 - barHeight;
            return (
              <rect
                key={point.date}
                x={x - 12}
                y={y}
                width="24"
                height={Math.max(barHeight, 3)}
                rx="7"
                fill={CHART_THEME.eventsBar}
                fillOpacity="0.82"
              />
            );
          })}
          <path d={latencyPath} fill="none" stroke={CHART_THEME.latencyLine} strokeWidth="3" strokeLinecap="round" />
          {points.map((point, index) => {
            const [x, y] = chartPoint(latency[index], index, points.length, width, height, 24, 22, maxLatency);
            return <circle key={`${point.date}-latency`} cx={x} cy={y} r="3.6" fill={CHART_THEME.point} stroke={CHART_THEME.latencyLine} strokeWidth="2" />;
          })}
        </svg>
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-900/40">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Eventos rango</p>
          <p className="mt-1 font-semibold text-gray-900 dark:text-white">{formatNumber(events.reduce((sum, value) => sum + value, 0))}</p>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-900/40">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Latencia maxima</p>
          <p className="mt-1 font-semibold text-gray-900 dark:text-white">{formatLatency(Math.max(...latency, 0))}</p>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-900/40">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Promedio</p>
          <p className="mt-1 font-semibold text-gray-900 dark:text-white">{formatLatency(latency.filter(Boolean).reduce((sum, value) => sum + value, 0) / Math.max(latency.filter(Boolean).length, 1))}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded" style={{ backgroundColor: CHART_THEME.eventsBar }} />
          Eventos diarios
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4" style={{ backgroundColor: CHART_THEME.latencyLine }} />
          Latencia promedio
        </span>
      </div>
    </div>
  );
};

const DonutShareFallbackChart = ({ items = [], valueKey = "totalTokens", metricLabel = "tokens" }) => {
  const safeItems = items.filter((item) => Number(item?.[valueKey] ?? 0) > 0);

  if (!safeItems.length) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No hay datos suficientes para construir la distribución.</p>;
  }

  const total = safeItems.reduce((sum, item) => sum + Number(item?.[valueKey] ?? 0), 0);
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[180px_minmax(0,1fr)] lg:items-center">
      <div className="relative mx-auto h-44 w-44">
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="rgba(148,163,184,0.16)" strokeWidth="18" />
          {safeItems.map((item, index) => {
            const value = Number(item?.[valueKey] ?? 0);
            const share = total <= 0 ? 0 : value / total;
            const arc = share * circumference;
            const element = (
              <circle
                key={item.key}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={TOKENS_PALETTE[index % TOKENS_PALETTE.length]}
                strokeWidth="18"
                strokeDasharray={`${arc} ${circumference - arc}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
              />
            );
            offset += arc;
            return element;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Participacion</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{formatCompactNumber(total)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{metricLabel}</p>
        </div>
      </div>
      <div className="space-y-3">
        {safeItems.map((item, index) => {
          const value = Number(item?.[valueKey] ?? 0);
          const share = total <= 0 ? 0 : (value / total) * 100;
          return (
            <div key={item.key} className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-900/40">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900 dark:text-white">{item.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatNumber(item.events)} eventos</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {valueKey === "totalCost" ? formatCurrency(value) : formatNumber(value)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatPercent(share)}</p>
                </div>
              </div>
              <div className="mt-2 h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${Math.max(share, 4)}%`,
                    backgroundColor: TOKENS_PALETTE[index % TOKENS_PALETTE.length],
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const StatusStackFallbackChart = ({ items = [] }) => {
  if (!items.length) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No hay estados registrados para este rango.</p>;
  }

  const total = items.reduce((sum, item) => sum + Number(item.events ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex h-4 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
        {items.map((item) => {
          const share = total <= 0 ? 0 : (Number(item.events ?? 0) / total) * 100;
          return (
            <div
              key={item.key}
              className="h-full"
              style={{
                width: `${Math.max(share, 3)}%`,
                backgroundColor: STATUS_COLORS[item.key] ?? "#94a3b8",
              }}
              title={`${item.label}: ${formatNumber(item.events)} eventos`}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.key} className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-900/40">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[item.key] ?? "#94a3b8" }} />
                <p className="font-medium text-gray-900 dark:text-white">{item.label}</p>
              </div>
              <p className="font-semibold text-gray-900 dark:text-white">{formatNumber(item.events)}</p>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span>{formatPercent(item.successRate)}</span>
              <span>{formatNumber(item.totalTokens)} tokens</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const BreakdownListFallback = ({ items = [], metric = "cost", emptyMessage = "No hay datos para este rango." }) => {
  const maxValue = items.reduce((acc, item) => {
    const current = metric === "tokens" ? Number(item.totalTokens ?? 0) : Number(item.totalCost ?? 0);
    return Math.max(acc, current);
  }, 0);

  if (!items.length) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const value = metric === "tokens" ? Number(item.totalTokens ?? 0) : Number(item.totalCost ?? 0);
        const width = maxValue > 0 ? Math.max((value / maxValue) * 100, 4) : 4;
        return (
          <div key={`${item.key}-${item.label}`} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900 dark:text-white">{item.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatNumber(item.events)} eventos, {formatPercent(item.successRate)} exito
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900 dark:text-white">
                  {metric === "tokens" ? formatNumber(item.totalTokens) : formatCurrency(item.totalCost)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{formatLatency(item.averageLatencyMs)}</p>
              </div>
            </div>
            <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700">
              <div
                className="h-2 rounded-full"
                style={{
                  width: `${width}%`,
                  background: `linear-gradient(90deg, ${TOKENS_PALETTE[index % TOKENS_PALETTE.length]}, #67e8f9)`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const TrendAreaChart = ({ points = [] }) => {
  if (!points.length) {
    return <TrendAreaFallbackChart points={points} />;
  }

  const option = {
    ...buildChartOptionBase(),
    color: [CHART_THEME.totalLine, CHART_THEME.outputLine],
    grid: { left: 16, right: 16, top: 20, bottom: 20, containLabel: true },
    tooltip: {
      ...buildChartOptionBase().tooltip,
      trigger: "axis",
      valueFormatter: (value) => `${formatNumber(value)} tokens`,
    },
    xAxis: {
      type: "category",
      data: points.map((point) => point.date),
      boundaryGap: false,
      axisLabel: { color: ECHART_TEXT, formatter: formatAxisDate },
      axisLine: { lineStyle: { color: "rgba(148,163,184,0.18)" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: ECHART_TEXT, formatter: (value) => formatCompactNumber(value) },
      splitLine: { lineStyle: { color: CHART_THEME.grid, type: "dashed" } },
    },
    series: [
      {
        name: "Tokens totales",
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 7,
        data: points.map((point) => Number(point.totalTokens ?? 0)),
        lineStyle: { width: 3, color: CHART_THEME.totalLine },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(14,165,233,0.35)" },
              { offset: 1, color: "rgba(14,165,233,0.03)" },
            ],
          },
        },
      },
      {
        name: "Output tokens",
        type: "line",
        smooth: true,
        symbol: "none",
        data: points.map((point) => Number(point.outputTokens ?? 0)),
        lineStyle: { width: 2.5, type: "dashed", color: CHART_THEME.outputLine },
      },
    ],
  };

  return <AsyncEChart option={option} style={{ height: 260, width: "100%" }} fallback={<TrendAreaFallbackChart points={points} />} />;
};

const TokenSplitLineFallbackChart = ({ points = [] }) => {
  if (!points.length) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No hay actividad registrada.</p>;
  }

  const width = 420;
  const height = 180;
  const inputTokens = points.map((point) => Number(point.inputTokens ?? 0));
  const outputTokens = points.map((point) => Number(point.outputTokens ?? 0));
  const maxValue = Math.max(...inputTokens, ...outputTokens, 1);
  const inputPath = buildLinePath(inputTokens, width, height, 20, 22);
  const outputPath = buildLinePath(outputTokens, width, height, 20, 22);

  return (
    <div className="space-y-4">
      <div className="h-48 rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50/80 via-white to-emerald-50/70 p-3 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/25">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
          {[0.25, 0.5, 0.75].map((tick) => {
            const y = height - 22 - tick * (height - 44);
            return <line key={tick} x1="20" x2={width - 20} y1={y} y2={y} stroke={CHART_THEME.grid} strokeDasharray="4 6" />;
          })}
          <path d={inputPath} fill="none" stroke={CHART_THEME.inputLine} strokeWidth="3" strokeLinecap="round" />
          <path d={outputPath} fill="none" stroke={CHART_THEME.outputLine} strokeWidth="3" strokeLinecap="round" strokeDasharray="5 6" />
          {points.map((point, index) => {
            const [x, y] = chartPoint(inputTokens[index], index, points.length, width, height, 20, 22, maxValue);
            return <circle key={`${point.date}-input`} cx={x} cy={y} r="3.4" fill={CHART_THEME.point} stroke={CHART_THEME.inputLine} strokeWidth="2" />;
          })}
          {points.map((point, index) => {
            const [x, y] = chartPoint(outputTokens[index], index, points.length, width, height, 20, 22, maxValue);
            return <circle key={`${point.date}-output`} cx={x} cy={y} r="3.4" fill={CHART_THEME.point} stroke={CHART_THEME.outputLine} strokeWidth="2" />;
          })}
        </svg>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-900/40">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Input rango</p>
          <p className="mt-1 font-semibold text-gray-900 dark:text-white">{formatNumber(inputTokens.reduce((sum, value) => sum + value, 0))} tokens</p>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-900/40">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Output rango</p>
          <p className="mt-1 font-semibold text-gray-900 dark:text-white">{formatNumber(outputTokens.reduce((sum, value) => sum + value, 0))} tokens</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4" style={{ backgroundColor: CHART_THEME.inputLine }} />
          Input tokens
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4" style={{ backgroundColor: CHART_THEME.outputLine }} />
          Output tokens
        </span>
      </div>
    </div>
  );
};

const TokenSplitLineChart = ({ points = [] }) => {
  if (!points.length) {
    return <TokenSplitLineFallbackChart points={points} />;
  }

  const option = {
    ...buildChartOptionBase(),
    color: [CHART_THEME.inputLine, CHART_THEME.outputLine],
    grid: { left: 16, right: 16, top: 28, bottom: 20, containLabel: true },
    tooltip: {
      ...buildChartOptionBase().tooltip,
      trigger: "axis",
      valueFormatter: (value) => `${formatNumber(value)} tokens`,
    },
    legend: {
      top: 0,
      right: 8,
      textStyle: { color: ECHART_TEXT },
    },
    xAxis: {
      type: "category",
      data: points.map((point) => point.date),
      boundaryGap: false,
      axisLabel: { color: ECHART_TEXT, formatter: formatAxisDate },
      axisLine: { lineStyle: { color: "rgba(148,163,184,0.18)" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: ECHART_TEXT, formatter: (value) => formatCompactNumber(value) },
      splitLine: { lineStyle: { color: CHART_THEME.grid, type: "dashed" } },
    },
    series: [
      {
        name: "Input tokens",
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 7,
        lineStyle: { width: 3, color: CHART_THEME.inputLine },
        itemStyle: { color: CHART_THEME.inputLine },
        data: points.map((point) => Number(point.inputTokens ?? 0)),
      },
      {
        name: "Output tokens",
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 7,
        lineStyle: { width: 3, color: CHART_THEME.outputLine },
        itemStyle: { color: CHART_THEME.outputLine },
        data: points.map((point) => Number(point.outputTokens ?? 0)),
      },
    ],
  };

  return (
    <AsyncEChart
      option={option}
      style={{ height: 260, width: "100%" }}
      fallback={<TokenSplitLineFallbackChart points={points} />}
    />
  );
};

const ActivityComboChart = ({ points = [] }) => {
  if (!points.length) {
    return <ActivityComboFallbackChart points={points} />;
  }

  const option = {
    ...buildChartOptionBase(),
    grid: { left: 16, right: 20, top: 20, bottom: 20, containLabel: true },
    tooltip: {
      ...buildChartOptionBase().tooltip,
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    legend: {
      top: 0,
      right: 8,
      textStyle: { color: ECHART_TEXT },
    },
    xAxis: {
      type: "category",
      data: points.map((point) => point.date),
      axisLabel: { color: ECHART_TEXT, formatter: formatAxisDate },
      axisLine: { lineStyle: { color: "rgba(148,163,184,0.18)" } },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: "value",
        name: "Eventos",
        nameTextStyle: { color: ECHART_TEXT },
        axisLabel: { color: ECHART_TEXT },
        splitLine: { lineStyle: { color: CHART_THEME.grid, type: "dashed" } },
      },
      {
        type: "value",
        name: "Latencia ms",
        nameTextStyle: { color: ECHART_TEXT },
        axisLabel: { color: ECHART_TEXT, formatter: (value) => formatCompactNumber(value) },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: "Eventos",
        type: "bar",
        barWidth: 24,
        itemStyle: {
          color: CHART_THEME.eventsBar,
          borderRadius: [8, 8, 0, 0],
        },
        data: points.map((point) => Number(point.events ?? 0)),
      },
      {
        name: "Latencia",
        type: "line",
        yAxisIndex: 1,
        smooth: true,
        symbol: "circle",
        symbolSize: 7,
        lineStyle: { width: 3, color: CHART_THEME.latencyLine },
        itemStyle: { color: CHART_THEME.latencyLine },
        data: points.map((point) => Number(point.averageLatencyMs ?? 0)),
      },
    ],
  };

  return <AsyncEChart option={option} style={{ height: 260, width: "100%" }} fallback={<ActivityComboFallbackChart points={points} />} />;
};

const DonutShareChart = ({ items = [], valueKey = "totalTokens", metricLabel = "tokens" }) => {
  const safeItems = items.filter((item) => Number(item?.[valueKey] ?? 0) > 0);
  if (!safeItems.length) {
    return <DonutShareFallbackChart items={items} valueKey={valueKey} metricLabel={metricLabel} />;
  }

  const option = {
    ...buildChartOptionBase(),
    color: TOKENS_PALETTE,
    tooltip: {
      ...buildChartOptionBase().tooltip,
      trigger: "item",
      valueFormatter: (value) =>
        valueKey === "totalCost" ? formatCurrency(value) : `${formatNumber(value)} ${metricLabel}`,
    },
    legend: {
      bottom: 0,
      left: "center",
      textStyle: { color: ECHART_TEXT },
      itemWidth: 10,
      itemHeight: 10,
    },
    series: [
      {
        name: "Distribucion",
        type: "pie",
        radius: ["58%", "78%"],
        center: ["50%", "44%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: "rgba(15,23,42,0.08)", borderWidth: 2 },
        label: {
          color: ECHART_TITLE,
          formatter: ({ percent }) => `${percent?.toFixed?.(1) ?? percent}%`,
        },
        labelLine: { lineStyle: { color: ECHART_TEXT } },
        data: safeItems.map((item) => ({
          name: item.label,
          value: Number(item?.[valueKey] ?? 0),
        })),
      },
    ],
  };

  return (
    <AsyncEChart
      option={option}
      style={{ height: 340, width: "100%" }}
      fallback={<DonutShareFallbackChart items={items} valueKey={valueKey} metricLabel={metricLabel} />}
    />
  );
};

const StatusStackChart = ({ items = [] }) => {
  if (!items.length) {
    return <StatusStackFallbackChart items={items} />;
  }

  const option = {
    ...buildChartOptionBase(),
    color: items.map((item) => STATUS_COLORS[item.key] ?? "#64748b"),
    tooltip: {
      ...buildChartOptionBase().tooltip,
      trigger: "item",
      valueFormatter: (value) => `${formatNumber(value)} eventos`,
    },
    legend: {
      bottom: 0,
      left: "center",
      textStyle: { color: ECHART_TEXT },
    },
    grid: { left: 24, right: 24, top: 28, bottom: 40, containLabel: true },
    xAxis: {
      type: "value",
      axisLabel: { color: ECHART_TEXT },
      splitLine: { lineStyle: { color: CHART_THEME.grid, type: "dashed" } },
    },
    yAxis: {
      type: "category",
      data: ["Pipeline"],
      axisLabel: { color: ECHART_TEXT },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: items.map((item) => ({
      name: item.label,
      type: "bar",
      stack: "status",
      barWidth: 26,
      emphasis: { focus: "series" },
      label: {
        show: Number(item.events ?? 0) > 0,
        position: "inside",
        formatter: () => formatNumber(item.events),
        color: "#f8fafc",
        fontWeight: 600,
      },
      data: [Number(item.events ?? 0)],
      itemStyle: {
        color: STATUS_COLORS[item.key] ?? "#64748b",
        borderRadius: 10,
      },
    })),
  };

  return <AsyncEChart option={option} style={{ height: 240, width: "100%" }} fallback={<StatusStackFallbackChart items={items} />} />;
};

const BreakdownList = ({ items = [], metric = "cost", emptyMessage = "No hay datos para este rango." }) => {
  const safeItems = items.filter((item) => {
    const value = metric === "tokens" ? Number(item.totalTokens ?? 0) : Number(item.totalCost ?? 0);
    return value > 0;
  });
  if (!safeItems.length) {
    return <BreakdownListFallback items={items} metric={metric} emptyMessage={emptyMessage} />;
  }

  const topItems = safeItems.slice(0, 8);
  const option = {
    ...buildChartOptionBase(),
    color: TOKENS_PALETTE,
    tooltip: {
      ...buildChartOptionBase().tooltip,
      trigger: "axis",
      axisPointer: { type: "shadow" },
      valueFormatter: (value) =>
        metric === "tokens" ? `${formatNumber(value)} tokens` : formatCurrency(value),
    },
    grid: { left: 12, right: 18, top: 10, bottom: 10, containLabel: true },
    xAxis: {
      type: "value",
      axisLabel: {
        color: ECHART_TEXT,
        formatter: (value) => (metric === "tokens" ? formatCompactNumber(value) : formatCurrency(value)),
      },
      splitLine: { lineStyle: { color: CHART_THEME.grid, type: "dashed" } },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: topItems.map((item) => item.label),
      axisLabel: { color: ECHART_TEXT, width: 130, overflow: "truncate" },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        type: "bar",
        barWidth: 18,
        data: topItems.map((item, index) => ({
          value: metric === "tokens" ? Number(item.totalTokens ?? 0) : Number(item.totalCost ?? 0),
          itemStyle: {
            color: TOKENS_PALETTE[index % TOKENS_PALETTE.length],
            borderRadius: [0, 10, 10, 0],
          },
        })),
        label: {
          show: true,
          position: "right",
          color: ECHART_TEXT,
          formatter: ({ value }) => (metric === "tokens" ? formatCompactNumber(value) : formatCurrency(value)),
        },
      },
    ],
  };

  return (
    <AsyncEChart
      option={option}
      style={{ height: Math.max(220, topItems.length * 42), width: "100%" }}
      fallback={<BreakdownListFallback items={items} metric={metric} emptyMessage={emptyMessage} />}
      loadingFallback={<BreakdownListFallback items={items} metric={metric} emptyMessage={emptyMessage} />}
    />
  );
};

const RecentEventsTable = ({ items = [], showCostState = false }) => {
  if (!items.length) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No hay eventos recientes con estos filtros.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
            <th className="px-3 py-3">Fecha</th>
            <th className="px-3 py-3">Provider / modelo</th>
            <th className="px-3 py-3">Tipo</th>
            <th className="px-3 py-3">Estado</th>
            <th className="px-3 py-3 text-right">Tokens</th>
            <th className="px-3 py-3 text-right">Costo</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800">
              <td className="px-3 py-3 text-gray-600 dark:text-gray-300">{formatDateTime(item.startedAt ?? item.started_at)}</td>
              <td className="px-3 py-3">
                <div className="font-medium text-gray-900 dark:text-white">
                  {item.providerNameSnapshot ?? item.providerType ?? "Sin provider"}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{item.modelName ?? "Sin modelo"}</div>
              </td>
              <td className="px-3 py-3 text-gray-600 dark:text-gray-300">{item.eventType ?? item.event_type ?? "-"}</td>
              <td className="px-3 py-3">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(item.status)}`}>
                  {item.status}
                </span>
              </td>
              <td className="px-3 py-3 text-right text-gray-600 dark:text-gray-300">
                {formatNumber(item.totalTokens ?? item.total_tokens ?? 0)}
              </td>
              <td className="px-3 py-3 text-right font-medium text-gray-900 dark:text-white">
                {item.totalCost == null && item.total_cost == null
                  ? (showCostState ? "Sin pricing" : "-")
                  : formatCurrency(item.totalCost ?? item.total_cost ?? 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const MetricsPage = () => {
  const [draftFilters, setDraftFilters] = useState(buildDefaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(buildDefaultFilters);
  const [summary, setSummary] = useState(null);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [openSections, setOpenSections] = useState(SECTION_DEFAULTS);

  const visibleProjects = useMemo(() => {
    if (!draftFilters.clientId) return projects;
    return projects.filter((project) => String(project.clientId ?? project.client_id ?? "") === String(draftFilters.clientId));
  }, [projects, draftFilters.clientId]);

  const loadCatalogs = async () => {
    const [clientsResult, projectsResult] = await Promise.all([
      clientService.list({ isActive: true, limit: 200 }),
      projectService.list({ isActive: true, limit: 200 }),
    ]);
    setClients(Array.isArray(clientsResult?.items) ? clientsResult.items : []);
    setProjects(Array.isArray(projectsResult?.items) ? projectsResult.items : []);
  };

  const loadSummary = async (filters, { background = false } = {}) => {
    if (background) setIsRefreshing(true);
    else setIsLoading(true);

    setError("");
    try {
      const response = await aiUsageMetricsService.getSummary(filters);
      setSummary(response);
    } catch (err) {
      metricsLog.error("Error cargando metricas IA", err);
      setError(err?.response?.data?.error?.message ?? err?.message ?? "No fue posible cargar las metricas.");
    } finally {
      if (background) setIsRefreshing(false);
      else setIsLoading(false);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await loadCatalogs();
      } catch (err) {
        metricsLog.error("Error cargando catalogos de metricas", err);
      }
      await loadSummary(appliedFilters);
    };
    bootstrap();
  }, []);

  const handleChange = (name, value) => {
    setDraftFilters((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "clientId") next.projectId = "";
      return next;
    });
  };

  const handleApplyFilters = async (event) => {
    event?.preventDefault?.();
    setAppliedFilters(draftFilters);
    await loadSummary(draftFilters, { background: Boolean(summary) });
  };

  const handleResetFilters = async () => {
    const next = buildDefaultFilters();
    setDraftFilters(next);
    setAppliedFilters(next);
    await loadSummary(next, { background: Boolean(summary) });
  };

  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (isLoading && !summary) {
    return <PageLoadingSpinner message="Cargando modulo de metricas..." />;
  }

  const overview = summary?.overview ?? {
    totalEvents: 0,
    successEvents: 0,
    failedEvents: 0,
    successRate: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    totalCost: 0,
    estimatedCostEvents: 0,
    averageCostPerSuccess: null,
    averageLatencyMs: null,
    uniqueClients: 0,
    uniqueProjects: 0,
    uniqueModels: 0,
    uniqueProviders: 0,
  };

  const meta = summary?.filtersMeta ?? {
    eventTypes: [],
    statuses: [],
    providerTypes: [],
    providerFamilies: [],
    executionAdapters: [],
    modelNames: [],
  };

  const timeseries = summary?.timeseries ?? [];
  const providerItems = summary?.byProvider ?? [];
  const modelItems = summary?.byModel ?? [];
  const clientItems = summary?.byClient ?? [];
  const projectItems = summary?.byProject ?? [];
  const statusItems = summary?.byStatus ?? [];
  const recentEvents = summary?.recentEvents ?? [];
  const hasPricing = Number(overview.estimatedCostEvents ?? 0) > 0;
  const noData = !overview.totalEvents;

  const topProvider = providerItems[0];
  const topModel = modelItems[0];
  const businessMetricMode = hasPricing ? "cost" : "tokens";
  const businessMetricLabel = hasPricing ? "costo" : "tokens";

  const insights = [
    {
      title: "Lectura del rango",
      value: `${formatNumber(overview.totalEvents)} ejecuciones analizadas`,
      helper: `${formatNumber(overview.uniqueProviders)} providers, ${formatNumber(overview.uniqueModels)} modelos y ${formatNumber(overview.uniqueProjects)} proyectos visibles.`,
    },
    {
      title: "Mayor concentracion",
      value: topProvider ? topProvider.label : "Sin provider dominante",
      helper: topProvider
        ? `${formatNumber(topProvider.totalTokens)} tokens y ${formatPercent(topProvider.successRate)} de exito.`
        : "Aun no hay suficiente data para detectar concentracion por provider.",
    },
    {
      title: "Costo estimado",
      value: hasPricing ? formatCurrency(overview.totalCost) : "Sin estimacion USD",
      helper: hasPricing
        ? `${formatNumber(overview.estimatedCostEvents)} eventos con precios aplicados.`
        : "Los tokens y modelos si estan contabilizados; aun no hay precios cargados para estimar USD.",
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <ModuleHeader
        icon="FaChartLine"
        title="Metricas"
        description="Consumo, rendimiento y trazabilidad del uso IA por provider, modelo, cliente y proyecto."
      />

      <div className="rounded-[26px] border border-gray-200/80 bg-white px-6 py-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${TXT_META}`}>Analisis operacional IA</p>
            <h2 className={`mt-1 text-xl font-semibold ${TXT_TITLE}`}>Cobertura del rango seleccionado</h2>
            <p className={`mt-2 text-sm ${TXT_BODY}`}>
              Esta vista resume actividad, consumo y calidad de ejecución para entender dónde se concentra el uso de IA.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[420px] sm:grid-cols-4">
            <HeaderSummaryTile label="Eventos" value={formatNumber(overview.totalEvents)} />
            <HeaderSummaryTile label="Costo" value={hasPricing ? formatCurrency(overview.totalCost) : "Sin USD"} />
            <HeaderSummaryTile label="Tokens" value={formatCompactNumber(overview.totalTokens)} />
            <HeaderSummaryTile label="Exito" value={formatPercent(overview.successRate)} />
          </div>
        </div>
      </div>

      <SectionCard
        title="Filtros"
        subtitle="Acota el analisis por rango, provider, modelo, cliente, proyecto y tipo de evento."
        action={
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <FaFilter className="h-3.5 w-3.5" />
            <span>{isRefreshing ? "Actualizando..." : "Listo"}</span>
          </div>
        }
      >
        <form className="space-y-4" onSubmit={handleApplyFilters}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <FilterField label="Desde">
              <input type="date" className={inputClassName} value={draftFilters.startDate} onChange={(event) => handleChange("startDate", event.target.value)} />
            </FilterField>
            <FilterField label="Hasta">
              <input type="date" className={inputClassName} value={draftFilters.endDate} onChange={(event) => handleChange("endDate", event.target.value)} />
            </FilterField>
            <FilterField label="Cliente">
              <select className={inputClassName} value={draftFilters.clientId} onChange={(event) => handleChange("clientId", event.target.value)}>
                <option value="">Todos</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Proyecto">
              <select className={inputClassName} value={draftFilters.projectId} onChange={(event) => handleChange("projectId", event.target.value)}>
                <option value="">Todos</option>
                {visibleProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Provider">
              <select className={inputClassName} value={draftFilters.providerType} onChange={(event) => handleChange("providerType", event.target.value)}>
                <option value="">Todos</option>
                {meta.providerTypes.map((providerType) => (
                  <option key={providerType} value={providerType}>
                    {providerType}
                  </option>
                ))}
              </select>
            </FilterField>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <FilterField label="Familia provider">
              <select className={inputClassName} value={draftFilters.providerFamily} onChange={(event) => handleChange("providerFamily", event.target.value)}>
                <option value="">Todas</option>
                {meta.providerFamilies.map((providerFamily) => (
                  <option key={providerFamily} value={providerFamily}>
                    {providerFamily}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Adaptador">
              <select className={inputClassName} value={draftFilters.executionAdapter} onChange={(event) => handleChange("executionAdapter", event.target.value)}>
                <option value="">Todos</option>
                {meta.executionAdapters.map((executionAdapter) => (
                  <option key={executionAdapter} value={executionAdapter}>
                    {executionAdapter}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Modelo">
              <select className={inputClassName} value={draftFilters.modelName} onChange={(event) => handleChange("modelName", event.target.value)}>
                <option value="">Todos</option>
                {meta.modelNames.map((modelName) => (
                  <option key={modelName} value={modelName}>
                    {modelName}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Estado">
              <select className={inputClassName} value={draftFilters.status} onChange={(event) => handleChange("status", event.target.value)}>
                <option value="">Todos</option>
                {meta.statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Tipo de evento">
              <select className={inputClassName} value={draftFilters.eventType} onChange={(event) => handleChange("eventType", event.target.value)}>
                <option value="">Todos</option>
                {meta.eventTypes.map((eventType) => (
                  <option key={eventType} value={eventType}>
                    {eventType}
                  </option>
                ))}
              </select>
            </FilterField>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Rango activo: {appliedFilters.startDate} a {appliedFilters.endDate}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"
                onClick={handleResetFilters}
              >
                <FaRedoAlt className="h-3.5 w-3.5" />
                Limpiar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
              >
                <FaChartLine className="h-3.5 w-3.5" />
                Actualizar
              </button>
            </div>
          </div>
        </form>
      </SectionCard>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <CollapsibleSection
        title="Resumen Ejecutivo"
        subtitle="KPI centrales y primeras lecturas del uso IA en el rango seleccionado."
        icon="FaChartLine"
        count={overview.totalEvents}
        isOpen={openSections.executive}
        onToggle={() => toggleSection("executive")}
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={FaCoins}
              title="Costo total estimado"
              value={hasPricing ? formatCurrency(overview.totalCost) : "Sin estimacion USD"}
              helper={hasPricing ? `${formatNumber(overview.estimatedCostEvents)} eventos con precios aplicados` : "Los tokens estan contabilizados aunque aun no hay precios cargados"}
              tone="amber"
            />
            <StatCard
              icon={FaDatabase}
              title="Tokens totales"
              value={formatNumber(overview.totalTokens)}
              helper={`${formatNumber(overview.totalInputTokens)} input / ${formatNumber(overview.totalOutputTokens)} output`}
              tone="blue"
            />
            <StatCard
              icon={FaChartLine}
              title="Tasa de exito"
              value={formatPercent(overview.successRate)}
              helper={`${formatNumber(overview.successEvents)} exitosos de ${formatNumber(overview.totalEvents)}`}
              tone="green"
            />
            <StatCard
              icon={FaClock}
              title="Latencia promedio"
              value={formatLatency(overview.averageLatencyMs)}
              helper="Promedio de eventos con tiempo registrado"
              tone="violet"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={FaRobot} title="Providers unicos" value={formatNumber(overview.uniqueProviders)} helper="Providers observados en el rango" tone="slate" />
            <StatCard
              icon={FaMicrochip}
              title="Modelos unicos"
              value={formatNumber(overview.uniqueModels)}
              helper={topModel ? `${topModel.label} domina con ${formatNumber(topModel.totalTokens)} tokens` : "Sin modelo dominante aun"}
              tone="rose"
            />
            <StatCard icon={FaProjectDiagram} title="Clientes cubiertos" value={formatNumber(overview.uniqueClients)} helper={`${formatNumber(overview.uniqueProjects)} proyectos con eventos`} tone="blue" />
            <StatCard icon={FaDatabase} title="Eventos fallidos" value={formatNumber(overview.failedEvents)} helper="Incluye failed, timeout y cancelled" tone="rose" />
          </div>

          <InsightStrip insights={insights} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Tendencias Temporales"
        subtitle="Graficos de area, linea y barras para volumen, tokens y latencia en el tiempo."
        icon="FaChartLine"
        count={timeseries.length}
        isOpen={openSections.trends}
        onToggle={() => toggleSection("trends")}
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <ChartPanel
            title="Area de tokens por dia"
            subtitle="Relacion entre consumo total y salida generada por fecha."
            footer="El area representa tokens totales; la linea punteada destaca el volumen de output."
          >
            <TrendAreaChart points={timeseries} />
          </ChartPanel>

          <ChartPanel
            title="Input vs output por dia"
            subtitle="Grafico de lineas independiente para comparar entrada y salida por separado."
            footer="Ideal para detectar dias con prompts pesados, respuestas largas o cambios de eficiencia entre input y output."
          >
            <TokenSplitLineChart points={timeseries} />
          </ChartPanel>

          <ChartPanel
            title="Eventos y latencia"
            subtitle="Barras para actividad diaria y linea para tiempo promedio de ejecucion."
            footer="Sirve para detectar si la demanda diaria se correlaciona con aumento de latencia."
            className="xl:col-span-2"
          >
            <ActivityComboChart points={timeseries} />
          </ChartPanel>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Distribucion Operativa"
        subtitle="Reparto por provider, estados del pipeline y ranking de modelos."
        icon="FaRobot"
        count={providerItems.length}
        isOpen={openSections.operations}
        onToggle={() => toggleSection("operations")}
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <ChartPanel
            title={hasPricing ? "Participacion por costo provider" : "Participacion por tokens provider"}
            subtitle={hasPricing ? "Comparacion relativa del gasto estimado por provider." : "Comparacion relativa del consumo de tokens por provider."}
          >
            <DonutShareChart items={providerItems} valueKey={hasPricing ? "totalCost" : "totalTokens"} metricLabel={hasPricing ? "USD" : "tokens"} />
          </ChartPanel>

          <ChartPanel
            title="Estado del pipeline"
            subtitle="Distribucion visual de exito, falla, timeout y cancelacion."
          >
            <StatusStackChart items={statusItems} />
          </ChartPanel>

          <ChartPanel
            title="Ranking por modelo"
            subtitle="Modelos con mayor concentracion de tokens y mejor lectura de volumen."
          >
            <BreakdownList items={modelItems} metric="tokens" emptyMessage="Aun no hay modelos suficientes para armar el ranking." />
          </ChartPanel>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Segmentacion de Negocio"
        subtitle="Consumo distribuido por cliente y proyecto para conectar IA con operacion real."
        icon="FaProjectDiagram"
        count={overview.uniqueProjects}
        isOpen={openSections.business}
        onToggle={() => toggleSection("business")}
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <ChartPanel
            title={`Clientes por ${businessMetricLabel}`}
            subtitle={hasPricing ? "Distribucion de costo estimado y exito por cliente." : "Distribucion de tokens y exito por cliente."}
          >
            <BreakdownList
              items={clientItems}
              metric={businessMetricMode}
              emptyMessage="No hay clientes visibles para este rango o el usuario no tiene alcance sobre ellos."
            />
          </ChartPanel>

          <ChartPanel
            title="Proyectos por tokens"
            subtitle="Detecta en que frentes se concentra realmente el uso de IA."
          >
            <BreakdownList
              items={projectItems}
              metric="tokens"
              emptyMessage="No hay proyectos visibles para este rango o el usuario no tiene alcance sobre ellos."
            />
          </ChartPanel>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Eventos Recientes"
        subtitle="Trazabilidad detallada del ultimo uso IA visible para el usuario."
        icon="FaDatabase"
        count={recentEvents.length}
        isOpen={openSections.events}
        onToggle={() => toggleSection("events")}
      >
        <RecentEventsTable items={recentEvents} showCostState={!hasPricing} />
      </CollapsibleSection>

      {noData ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-base font-medium text-gray-900 dark:text-white">Aun no hay eventos IA para este filtro</p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Cuando se registren ejecuciones con `ai_usage_events`, aqui podras revisar costo, tokens, rendimiento y consumo por cliente o proyecto.
          </p>
        </div>
      ) : null}
    </div>
  );
};

export default MetricsPage;
