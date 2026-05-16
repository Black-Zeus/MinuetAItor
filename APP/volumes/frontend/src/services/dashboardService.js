import api from "@/services/axiosInterceptor";

const BASE = "/v1/dashboard";

const unwrap = (res) => res?.data?.result ?? res?.data;

const normalizeMetric = (metric) => ({
  value: Number.isFinite(Number(metric?.value)) ? Number(metric.value) : 0,
  change: Number.isFinite(Number(metric?.change)) ? Number(metric.change) : 0,
});

export const getDashboardStats = async () => {
  const res = await api.get(`${BASE}/stats`);
  const data = unwrap(res);

  return {
    minutesThisMonth: normalizeMetric(data?.minutesThisMonth ?? data?.minutes_this_month),
    activeProjects: normalizeMetric(data?.activeProjects ?? data?.active_projects),
    activeClients: normalizeMetric(data?.activeClients ?? data?.active_clients),
  };
};

export default {
  getDashboardStats,
};
