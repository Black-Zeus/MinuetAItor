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
  aiProfileId = "",
  providerType = "",
  providerFamily = "",
  executionAdapter = "",
  modelName = "",
  status = "",
  statuses = [],
  eventType = "",
  limit = 500,
  recentLimit = 12,
  breakdownLimit = 8,
} = {}) => {
  const payload = {
    limit,
    recentLimit,
    breakdownLimit,
  };

  const startedFrom = buildDateIso(startDate, false);
  const startedTo = buildDateIso(endDate, true);

  if (startedFrom) payload.startedFrom = startedFrom;
  if (startedTo) payload.startedTo = startedTo;
  if (clientId) payload.clientId = String(clientId);
  if (projectId) payload.projectId = String(projectId);
  if (aiProfileId) payload.aiProfileId = String(aiProfileId);
  if (providerType) payload.providerType = String(providerType);
  if (providerFamily) payload.providerFamily = String(providerFamily);
  if (executionAdapter) payload.executionAdapter = String(executionAdapter);
  if (modelName) payload.modelName = String(modelName);
  if (status) payload.status = String(status);
  if (Array.isArray(statuses) && statuses.length > 0) {
    payload.statuses = statuses
      .map((value) => String(value ?? "").trim())
      .filter(Boolean);
  }
  if (eventType) payload.eventType = String(eventType);

  return payload;
};

const normalizeEventItem = (item = {}) => ({
  id: Number(item.id ?? 0),
  eventType: String(item.eventType ?? item.event_type ?? ""),
  status: String(item.status ?? ""),
  minuteTransactionId: item.minuteTransactionId ?? item.minute_transaction_id ?? null,
  recordId: item.recordId ?? item.record_id ?? null,
  recordVersionId: item.recordVersionId ?? item.record_version_id ?? null,
  clientId: item.clientId ?? item.client_id ?? null,
  projectId: item.projectId ?? item.project_id ?? null,
  aiProfileId: item.aiProfileId ?? item.ai_profile_id ?? null,
  requestedBy: item.requestedBy ?? item.requested_by ?? null,
  requestedByUser: item.requestedByUser ?? item.requested_by_user ?? null,
  providerConfigId: item.providerConfigId ?? item.provider_config_id ?? null,
  providerConfig: item.providerConfig ?? item.provider_config ?? null,
  pricingId: item.pricingId ?? item.pricing_id ?? null,
  providerType: item.providerType ?? item.provider_type ?? null,
  providerFamily: item.providerFamily ?? item.provider_family ?? null,
  executionAdapter: item.executionAdapter ?? item.execution_adapter ?? null,
  providerNameSnapshot: item.providerNameSnapshot ?? item.provider_name_snapshot ?? null,
  modelName: item.modelName ?? item.model_name ?? null,
  externalRunId: item.externalRunId ?? item.external_run_id ?? null,
  externalThreadId: item.externalThreadId ?? item.external_thread_id ?? null,
  startedAt: item.startedAt ?? item.started_at ?? null,
  finishedAt: item.finishedAt ?? item.finished_at ?? null,
  latencyMs:
    item.latencyMs == null && item.latency_ms == null
      ? null
      : Number(item.latencyMs ?? item.latency_ms ?? 0),
  inputTokens: Number(item.inputTokens ?? item.input_tokens ?? 0),
  outputTokens: Number(item.outputTokens ?? item.output_tokens ?? 0),
  totalTokens: Number(item.totalTokens ?? item.total_tokens ?? 0),
  currency: String(item.currency ?? "USD"),
  inputCost:
    item.inputCost == null && item.input_cost == null
      ? null
      : Number(item.inputCost ?? item.input_cost ?? 0),
  outputCost:
    item.outputCost == null && item.output_cost == null
      ? null
      : Number(item.outputCost ?? item.output_cost ?? 0),
  totalCost:
    item.totalCost == null && item.total_cost == null
      ? null
      : Number(item.totalCost ?? item.total_cost ?? 0),
  costEstimated: Boolean(item.costEstimated ?? item.cost_estimated ?? false),
  costSource: item.costSource ?? item.cost_source ?? null,
  errorCode: item.errorCode ?? item.error_code ?? null,
  errorMessage: item.errorMessage ?? item.error_message ?? null,
  providerUsageRawJson: item.providerUsageRawJson ?? item.provider_usage_raw_json ?? null,
  providerMetaJson: item.providerMetaJson ?? item.provider_meta_json ?? null,
  createdAt: item.createdAt ?? item.created_at ?? null,
});

const normalizeList = (payload = {}) => ({
  items: Array.isArray(payload?.items) ? payload.items.map(normalizeEventItem) : [],
  total: Number(payload?.total ?? 0),
  skip: Number(payload?.skip ?? 0),
  limit: Number(payload?.limit ?? 0),
});

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
  byProfile: Array.isArray(payload?.byProfile ?? payload?.by_profile)
    ? (payload.byProfile ?? payload.by_profile).map(normalizeBreakdownItem)
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
    aiProfileIds: Array.isArray(payload?.filtersMeta?.aiProfileIds ?? payload?.filters_meta?.ai_profile_ids)
      ? (payload.filtersMeta?.aiProfileIds ?? payload.filters_meta?.ai_profile_ids)
      : [],
  },
});

export const aiUsageMetricsService = {
  async getSummary(filters = {}, requestConfig = {}) {
    const payload = buildSummaryPayload(filters);
    const res = await axiosInstance.post(`${BASE}/summary`, payload, requestConfig);
    return normalizeSummary(unwrap(res));
  },

  async getEventsList(filters = {}, requestConfig = {}) {
    const payload = buildSummaryPayload(filters);
    const res = await axiosInstance.post(`${BASE}/list`, payload, requestConfig);
    return normalizeList(unwrap(res));
  },
};

export default aiUsageMetricsService;
