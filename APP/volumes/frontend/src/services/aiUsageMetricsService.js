import axiosInstance from "@/services/axiosInterceptor";

const BASE = "/v1/ai-usage-events";

const unwrap = (res) => {
  const data = res?.data ?? {};
  return data?.result ?? data;
};

const buildDateIso = (value, endOfDay = false) => {
  if (!value) return null;
  const suffix = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
  const date = new Date(`${value}${suffix}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const buildSummaryPayload = ({
  startDate = "",
  endDate = "",
  clientId = "",
  projectId = "",
  providerType = "",
  providerFamily = "",
  executionAdapter = "",
  modelName = "",
  status = "",
  eventType = "",
  recentLimit = 12,
  breakdownLimit = 8,
} = {}) => {
  const payload = {
    recentLimit,
    breakdownLimit,
  };

  const startedFrom = buildDateIso(startDate, false);
  const startedTo = buildDateIso(endDate, true);

  if (startedFrom) payload.startedFrom = startedFrom;
  if (startedTo) payload.startedTo = startedTo;
  if (clientId) payload.clientId = String(clientId);
  if (projectId) payload.projectId = String(projectId);
  if (providerType) payload.providerType = String(providerType);
  if (providerFamily) payload.providerFamily = String(providerFamily);
  if (executionAdapter) payload.executionAdapter = String(executionAdapter);
  if (modelName) payload.modelName = String(modelName);
  if (status) payload.status = String(status);
  if (eventType) payload.eventType = String(eventType);

  return payload;
};

const normalizeBreakdownItem = (item = {}) => ({
  key: String(item.key ?? ""),
  label: String(item.label ?? "Sin dato"),
  events: Number(item.events ?? 0),
  successEvents: Number(item.successEvents ?? item.success_events ?? 0),
  failedEvents: Number(item.failedEvents ?? item.failed_events ?? 0),
  successRate: Number(item.successRate ?? item.success_rate ?? 0),
  inputTokens: Number(item.inputTokens ?? item.input_tokens ?? 0),
  outputTokens: Number(item.outputTokens ?? item.output_tokens ?? 0),
  totalTokens: Number(item.totalTokens ?? item.total_tokens ?? 0),
  totalCost: Number(item.totalCost ?? item.total_cost ?? 0),
  averageLatencyMs:
    item.averageLatencyMs == null && item.average_latency_ms == null
      ? null
      : Number(item.averageLatencyMs ?? item.average_latency_ms ?? 0),
});

const normalizeSummary = (payload = {}) => ({
  overview: {
    totalEvents: Number(payload?.overview?.totalEvents ?? payload?.overview?.total_events ?? 0),
    successEvents: Number(payload?.overview?.successEvents ?? payload?.overview?.success_events ?? 0),
    failedEvents: Number(payload?.overview?.failedEvents ?? payload?.overview?.failed_events ?? 0),
    successRate: Number(payload?.overview?.successRate ?? payload?.overview?.success_rate ?? 0),
    totalInputTokens: Number(payload?.overview?.totalInputTokens ?? payload?.overview?.total_input_tokens ?? 0),
    totalOutputTokens: Number(payload?.overview?.totalOutputTokens ?? payload?.overview?.total_output_tokens ?? 0),
    totalTokens: Number(payload?.overview?.totalTokens ?? payload?.overview?.total_tokens ?? 0),
    totalCost: Number(payload?.overview?.totalCost ?? payload?.overview?.total_cost ?? 0),
    estimatedCostEvents: Number(payload?.overview?.estimatedCostEvents ?? payload?.overview?.estimated_cost_events ?? 0),
    averageCostPerSuccess:
      payload?.overview?.averageCostPerSuccess == null && payload?.overview?.average_cost_per_success == null
        ? null
        : Number(payload?.overview?.averageCostPerSuccess ?? payload?.overview?.average_cost_per_success ?? 0),
    averageLatencyMs:
      payload?.overview?.averageLatencyMs == null && payload?.overview?.average_latency_ms == null
        ? null
        : Number(payload?.overview?.averageLatencyMs ?? payload?.overview?.average_latency_ms ?? 0),
    uniqueClients: Number(payload?.overview?.uniqueClients ?? payload?.overview?.unique_clients ?? 0),
    uniqueProjects: Number(payload?.overview?.uniqueProjects ?? payload?.overview?.unique_projects ?? 0),
    uniqueModels: Number(payload?.overview?.uniqueModels ?? payload?.overview?.unique_models ?? 0),
    uniqueProviders: Number(payload?.overview?.uniqueProviders ?? payload?.overview?.unique_providers ?? 0),
  },
  timeseries: Array.isArray(payload?.timeseries)
    ? payload.timeseries.map((item) => ({
      date: String(item.date ?? ""),
      events: Number(item.events ?? 0),
      successEvents: Number(item.successEvents ?? item.success_events ?? 0),
      failedEvents: Number(item.failedEvents ?? item.failed_events ?? 0),
      inputTokens: Number(item.inputTokens ?? item.input_tokens ?? 0),
      outputTokens: Number(item.outputTokens ?? item.output_tokens ?? 0),
      totalTokens: Number(item.totalTokens ?? item.total_tokens ?? 0),
      totalCost: Number(item.totalCost ?? item.total_cost ?? 0),
      averageLatencyMs:
        item.averageLatencyMs == null && item.average_latency_ms == null
          ? null
          : Number(item.averageLatencyMs ?? item.average_latency_ms ?? 0),
    }))
    : [],
  byStatus: Array.isArray(payload?.byStatus ?? payload?.by_status)
    ? (payload.byStatus ?? payload.by_status).map(normalizeBreakdownItem)
    : [],
  byProvider: Array.isArray(payload?.byProvider ?? payload?.by_provider)
    ? (payload.byProvider ?? payload.by_provider).map(normalizeBreakdownItem)
    : [],
  byModel: Array.isArray(payload?.byModel ?? payload?.by_model)
    ? (payload.byModel ?? payload.by_model).map(normalizeBreakdownItem)
    : [],
  byClient: Array.isArray(payload?.byClient ?? payload?.by_client)
    ? (payload.byClient ?? payload.by_client).map(normalizeBreakdownItem)
    : [],
  byProject: Array.isArray(payload?.byProject ?? payload?.by_project)
    ? (payload.byProject ?? payload.by_project).map(normalizeBreakdownItem)
    : [],
  recentEvents: Array.isArray(payload?.recentEvents ?? payload?.recent_events)
    ? (payload.recentEvents ?? payload.recent_events)
    : [],
  filtersMeta: {
    eventTypes: Array.isArray(payload?.filtersMeta?.eventTypes ?? payload?.filters_meta?.event_types)
      ? (payload.filtersMeta?.eventTypes ?? payload.filters_meta?.event_types)
      : [],
    statuses: Array.isArray(payload?.filtersMeta?.statuses ?? payload?.filters_meta?.statuses)
      ? (payload.filtersMeta?.statuses ?? payload.filters_meta?.statuses)
      : [],
    providerTypes: Array.isArray(payload?.filtersMeta?.providerTypes ?? payload?.filters_meta?.provider_types)
      ? (payload.filtersMeta?.providerTypes ?? payload.filters_meta?.provider_types)
      : [],
    providerFamilies: Array.isArray(payload?.filtersMeta?.providerFamilies ?? payload?.filters_meta?.provider_families)
      ? (payload.filtersMeta?.providerFamilies ?? payload.filters_meta?.provider_families)
      : [],
    executionAdapters: Array.isArray(payload?.filtersMeta?.executionAdapters ?? payload?.filters_meta?.execution_adapters)
      ? (payload.filtersMeta?.executionAdapters ?? payload.filters_meta?.execution_adapters)
      : [],
    modelNames: Array.isArray(payload?.filtersMeta?.modelNames ?? payload?.filters_meta?.model_names)
      ? (payload.filtersMeta?.modelNames ?? payload.filters_meta?.model_names)
      : [],
  },
});

export const aiUsageMetricsService = {
  async getSummary(filters = {}, requestConfig = {}) {
    const payload = buildSummaryPayload(filters);
    const res = await axiosInstance.post(`${BASE}/summary`, payload, requestConfig);
    return normalizeSummary(unwrap(res));
  },
};

export default aiUsageMetricsService;
