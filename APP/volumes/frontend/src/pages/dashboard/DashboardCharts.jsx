import React, { useMemo } from "react";

import AsyncEChart from "@/components/charts/AsyncEChart";
import Icon from "@/components/ui/icon/iconManager";

const CHART_TEXT = "#94a3b8";
const CHART_TITLE = "#e2e8f0";
const CHART_BORDER = "rgba(148,163,184,0.2)";
const CHART_TOOLTIP_BG = "rgba(15,23,42,0.94)";
const STATUS_COLORS = ["#2563eb", "#14b8a6", "#f59e0b", "#8b5cf6", "#ef4444", "#64748b"];

const numberFmt = new Intl.NumberFormat("es-CL");
const formatNumber = (value) => numberFmt.format(Number(value ?? 0));

const chartBase = () => ({
  animationDuration: 450,
  textStyle: {
    color: CHART_TEXT,
    fontFamily: "inherit",
  },
  tooltip: {
    trigger: "axis",
    backgroundColor: CHART_TOOLTIP_BG,
    borderColor: CHART_BORDER,
    textStyle: { color: CHART_TITLE },
    extraCssText: "box-shadow: 0 18px 42px rgba(15,23,42,0.28); border-radius: 14px;",
  },
});

const EmptyChartState = ({ message }) => (
  <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/70 px-4 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/20 dark:text-gray-400">
    {message}
  </div>
);

const ChartPanel = ({ title, subtitle, icon, children }) => (
  <section className="rounded-2xl border border-secondary-200 bg-surface p-5 shadow-card transition-theme dark:border-secondary-700/60 dark:ring-1 dark:ring-white/5">
    <div className="mb-4 flex items-start gap-3">
      <div className="rounded-xl bg-primary-50 p-2 text-primary-600 dark:bg-primary-900/20 dark:text-primary-300">
        <Icon name={icon} className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-gray-900 transition-theme dark:text-white">{title}</h2>
        <p className="mt-0.5 text-xs text-gray-500 transition-theme dark:text-gray-400">{subtitle}</p>
      </div>
    </div>
    {children}
  </section>
);

const buildTrendOption = (points) => ({
  ...chartBase(),
  color: ["#2563eb", "#14b8a6"],
  legend: {
    bottom: 0,
    icon: "roundRect",
    itemWidth: 12,
    itemHeight: 8,
    textStyle: { color: CHART_TEXT },
  },
  grid: {
    top: 18,
    right: 10,
    bottom: 42,
    left: 38,
  },
  xAxis: {
    type: "category",
    boundaryGap: false,
    data: points.map((point) => point.label),
    axisLine: { lineStyle: { color: "rgba(148,163,184,0.35)" } },
    axisTick: { show: false },
    axisLabel: { color: CHART_TEXT },
  },
  yAxis: {
    type: "value",
    minInterval: 1,
    splitLine: { lineStyle: { color: "rgba(148,163,184,0.16)" } },
    axisLabel: { color: CHART_TEXT, formatter: (value) => formatNumber(value) },
  },
  tooltip: {
    ...chartBase().tooltip,
    valueFormatter: (value) => formatNumber(value),
  },
  series: [
    {
      name: "Creadas",
      type: "line",
      smooth: true,
      symbol: "circle",
      symbolSize: 7,
      areaStyle: { color: "rgba(37,99,235,0.12)" },
      lineStyle: { width: 3 },
      data: points.map((point) => point.created),
    },
    {
      name: "Completadas",
      type: "line",
      smooth: true,
      symbol: "circle",
      symbolSize: 7,
      areaStyle: { color: "rgba(20,184,166,0.10)" },
      lineStyle: { width: 3 },
      data: points.map((point) => point.completed),
    },
  ],
});

const buildStatusOption = (items) => ({
  ...chartBase(),
  color: STATUS_COLORS,
  tooltip: {
    ...chartBase().tooltip,
    trigger: "item",
    formatter: ({ name, value, percent }) => `${name}<br/>${formatNumber(value)} minutas (${percent}%)`,
  },
  legend: {
    orient: "vertical",
    right: 0,
    top: "middle",
    icon: "circle",
    itemWidth: 8,
    itemHeight: 8,
    textStyle: { color: CHART_TEXT },
  },
  series: [
    {
      name: "Estados",
      type: "pie",
      radius: ["48%", "70%"],
      center: ["36%", "50%"],
      avoidLabelOverlap: true,
      label: {
        color: CHART_TEXT,
        formatter: "{d}%",
      },
      labelLine: {
        lineStyle: { color: "rgba(148,163,184,0.35)" },
      },
      data: items.map((item) => ({
        name: item.label,
        value: item.value,
      })),
    },
  ],
});

const DashboardCharts = ({ charts }) => {
  const trendPoints = charts?.minuteTrend ?? [];
  const statusItems = (charts?.statusDistribution ?? []).filter((item) => item.value > 0);
  const hasTrendData = trendPoints.some((point) => point.created > 0 || point.completed > 0);
  const hasStatusData = statusItems.length > 0;

  const trendOption = useMemo(() => buildTrendOption(trendPoints), [trendPoints]);
  const statusOption = useMemo(() => buildStatusOption(statusItems), [statusItems]);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <ChartPanel
        title="Tendencia de minutas"
        subtitle="Creadas y completadas durante los últimos 6 meses."
        icon="FaChartLine"
      >
        {hasTrendData ? (
          <AsyncEChart option={trendOption} style={{ height: 260, width: "100%" }} />
        ) : (
          <EmptyChartState message="Aún no hay actividad suficiente para mostrar una tendencia." />
        )}
      </ChartPanel>

      <ChartPanel
        title="Estado de minutas"
        subtitle="Distribución actual de tus minutas como elaborador."
        icon="FaChartPie"
      >
        {hasStatusData ? (
          <AsyncEChart option={statusOption} style={{ height: 260, width: "100%" }} />
        ) : (
          <EmptyChartState message="No hay minutas visibles para distribuir por estado." />
        )}
      </ChartPanel>
    </div>
  );
};

export default DashboardCharts;
