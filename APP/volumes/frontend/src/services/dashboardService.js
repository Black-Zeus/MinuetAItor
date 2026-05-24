import api from "@/services/axiosInterceptor";

const BASE = "/v1/dashboard";

const unwrap = (res) => res?.data?.result ?? res?.data;

const normalizeMetric = (metric) => ({
  value: Number.isFinite(Number(metric?.value)) ? Number(metric.value) : 0,
  change: Number.isFinite(Number(metric?.change)) ? Number(metric.change) : 0,
});

const normalizeTrendPoint = (point) => ({
  month: String(point?.month ?? ""),
  label: String(point?.label ?? point?.month ?? ""),
  created: Number.isFinite(Number(point?.created)) ? Number(point.created) : 0,
  completed: Number.isFinite(Number(point?.completed)) ? Number(point.completed) : 0,
});

const normalizeStatusPoint = (point) => ({
  status: String(point?.status ?? ""),
  label: String(point?.label ?? point?.status ?? "Sin estado"),
  value: Number.isFinite(Number(point?.value)) ? Number(point.value) : 0,
});

export const getDashboardStats = async () => {
  const res = await api.get(`${BASE}/stats`);
  const data = unwrap(res);
  const charts = data?.charts ?? {};

  return {
    minutesThisMonth: normalizeMetric(data?.minutesThisMonth ?? data?.minutes_this_month),
    activeProjects: normalizeMetric(data?.activeProjects ?? data?.active_projects),
    activeClients: normalizeMetric(data?.activeClients ?? data?.active_clients),
    charts: {
      minuteTrend: (charts?.minuteTrend ?? charts?.minute_trend ?? []).map(normalizeTrendPoint),
      statusDistribution: (charts?.statusDistribution ?? charts?.status_distribution ?? []).map(normalizeStatusPoint),
    },
  };
};

export default {
  getDashboardStats,
};
