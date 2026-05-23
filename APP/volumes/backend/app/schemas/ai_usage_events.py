from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class AIUsageUserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, alias="fullName")

    model_config = {"populate_by_name": True}


class AIUsageProviderConfigRefResponse(BaseModel):
    id: str
    name: str | None = None
    provider_type: str | None = Field(None, alias="providerType")
    model_name: str | None = Field(None, alias="modelName")

    model_config = {"populate_by_name": True}


class AIUsageEventFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=1000)

    event_type: str | None = Field(None, max_length=40, alias="eventType")
    status: str | None = Field(None, max_length=20)
    statuses: list[str] | None = Field(None, alias="statuses")
    minute_transaction_id: str | None = Field(None, max_length=36, alias="minuteTransactionId")
    record_id: str | None = Field(None, max_length=36, alias="recordId")
    record_version_id: str | None = Field(None, max_length=36, alias="recordVersionId")
    client_id: str | None = Field(None, max_length=36, alias="clientId")
    project_id: str | None = Field(None, max_length=36, alias="projectId")
    ai_profile_id: str | None = Field(None, max_length=36, alias="aiProfileId")
    requested_by: str | None = Field(None, max_length=36, alias="requestedBy")
    provider_config_id: str | None = Field(None, max_length=36, alias="providerConfigId")
    provider_type: str | None = Field(None, max_length=40, alias="providerType")
    provider_family: str | None = Field(None, max_length=40, alias="providerFamily")
    execution_adapter: str | None = Field(None, max_length=40, alias="executionAdapter")
    model_name: str | None = Field(None, max_length=180, alias="modelName")
    external_run_id: str | None = Field(None, max_length=120, alias="externalRunId")

    started_from: datetime | None = Field(None, alias="startedFrom")
    started_to: datetime | None = Field(None, alias="startedTo")

    model_config = {"populate_by_name": True}


class AIUsageEventResponse(BaseModel):
    id: int
    event_type: str = Field(..., alias="eventType")
    status: str

    minute_transaction_id: str | None = Field(None, alias="minuteTransactionId")
    record_id: str | None = Field(None, alias="recordId")
    record_version_id: str | None = Field(None, alias="recordVersionId")
    client_id: str | None = Field(None, alias="clientId")
    project_id: str | None = Field(None, alias="projectId")
    ai_profile_id: str | None = Field(None, alias="aiProfileId")
    requested_by: str | None = Field(None, alias="requestedBy")
    requested_by_user: AIUsageUserRefResponse | None = Field(None, alias="requestedByUser")

    provider_config_id: str | None = Field(None, alias="providerConfigId")
    provider_config: AIUsageProviderConfigRefResponse | None = Field(None, alias="providerConfig")
    pricing_id: str | None = Field(None, alias="pricingId")

    provider_type: str | None = Field(None, alias="providerType")
    provider_family: str | None = Field(None, alias="providerFamily")
    execution_adapter: str | None = Field(None, alias="executionAdapter")
    provider_name_snapshot: str | None = Field(None, alias="providerNameSnapshot")
    model_name: str | None = Field(None, alias="modelName")

    external_run_id: str | None = Field(None, alias="externalRunId")
    external_thread_id: str | None = Field(None, alias="externalThreadId")

    started_at: str | None = Field(None, alias="startedAt")
    finished_at: str | None = Field(None, alias="finishedAt")
    latency_ms: int | None = Field(None, alias="latencyMs")

    input_tokens: int | None = Field(None, alias="inputTokens")
    output_tokens: int | None = Field(None, alias="outputTokens")
    total_tokens: int | None = Field(None, alias="totalTokens")

    currency: str
    input_cost: float | None = Field(None, alias="inputCost")
    output_cost: float | None = Field(None, alias="outputCost")
    total_cost: float | None = Field(None, alias="totalCost")
    cost_estimated: bool = Field(False, alias="costEstimated")
    cost_source: str | None = Field(None, alias="costSource")

    error_code: str | None = Field(None, alias="errorCode")
    error_message: str | None = Field(None, alias="errorMessage")
    provider_usage_raw_json: dict | list | None = Field(None, alias="providerUsageRawJson")
    provider_meta_json: dict | list | None = Field(None, alias="providerMetaJson")
    created_at: str | None = Field(None, alias="createdAt")

    model_config = {"populate_by_name": True}


class AIUsageEventListResponse(BaseModel):
    items: list[AIUsageEventResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}


class AIUsageSummaryRequest(AIUsageEventFilterRequest):
    recent_limit: int = Field(12, ge=1, le=50, alias="recentLimit")
    breakdown_limit: int = Field(8, ge=1, le=100, alias="breakdownLimit")

    model_config = {"populate_by_name": True}


class AIUsageSummaryKpiResponse(BaseModel):
    total_events: int = Field(0, alias="totalEvents")
    success_events: int = Field(0, alias="successEvents")
    failed_events: int = Field(0, alias="failedEvents")
    success_rate: float = Field(0, alias="successRate")
    total_input_tokens: int = Field(0, alias="totalInputTokens")
    total_output_tokens: int = Field(0, alias="totalOutputTokens")
    total_tokens: int = Field(0, alias="totalTokens")
    total_cost: float = Field(0, alias="totalCost")
    estimated_cost_events: int = Field(0, alias="estimatedCostEvents")
    average_cost_per_success: float | None = Field(None, alias="averageCostPerSuccess")
    average_latency_ms: float | None = Field(None, alias="averageLatencyMs")
    unique_clients: int = Field(0, alias="uniqueClients")
    unique_projects: int = Field(0, alias="uniqueProjects")
    unique_models: int = Field(0, alias="uniqueModels")
    unique_providers: int = Field(0, alias="uniqueProviders")

    model_config = {"populate_by_name": True}


class AIUsageTimeseriesPointResponse(BaseModel):
    date: str
    events: int = 0
    success_events: int = Field(0, alias="successEvents")
    failed_events: int = Field(0, alias="failedEvents")
    input_tokens: int = Field(0, alias="inputTokens")
    output_tokens: int = Field(0, alias="outputTokens")
    total_tokens: int = Field(0, alias="totalTokens")
    total_cost: float = Field(0, alias="totalCost")
    average_latency_ms: float | None = Field(None, alias="averageLatencyMs")

    model_config = {"populate_by_name": True}


class AIUsageBreakdownItemResponse(BaseModel):
    key: str
    label: str
    events: int = 0
    success_events: int = Field(0, alias="successEvents")
    failed_events: int = Field(0, alias="failedEvents")
    success_rate: float = Field(0, alias="successRate")
    input_tokens: int = Field(0, alias="inputTokens")
    output_tokens: int = Field(0, alias="outputTokens")
    total_tokens: int = Field(0, alias="totalTokens")
    total_cost: float = Field(0, alias="totalCost")
    average_latency_ms: float | None = Field(None, alias="averageLatencyMs")

    model_config = {"populate_by_name": True}


class AIUsageSummaryFiltersMetaResponse(BaseModel):
    event_types: list[str] = Field(default_factory=list, alias="eventTypes")
    statuses: list[str] = Field(default_factory=list)
    provider_types: list[str] = Field(default_factory=list, alias="providerTypes")
    provider_families: list[str] = Field(default_factory=list, alias="providerFamilies")
    execution_adapters: list[str] = Field(default_factory=list, alias="executionAdapters")
    model_names: list[str] = Field(default_factory=list, alias="modelNames")
    ai_profile_ids: list[str] = Field(default_factory=list, alias="aiProfileIds")

    model_config = {"populate_by_name": True}


class AIUsageSummaryResponse(BaseModel):
    overview: AIUsageSummaryKpiResponse
    timeseries: list[AIUsageTimeseriesPointResponse]
    by_status: list[AIUsageBreakdownItemResponse] = Field(default_factory=list, alias="byStatus")
    by_provider: list[AIUsageBreakdownItemResponse] = Field(default_factory=list, alias="byProvider")
    by_model: list[AIUsageBreakdownItemResponse] = Field(default_factory=list, alias="byModel")
    by_profile: list[AIUsageBreakdownItemResponse] = Field(default_factory=list, alias="byProfile")
    by_client: list[AIUsageBreakdownItemResponse] = Field(default_factory=list, alias="byClient")
    by_project: list[AIUsageBreakdownItemResponse] = Field(default_factory=list, alias="byProject")
    recent_events: list[AIUsageEventResponse] = Field(default_factory=list, alias="recentEvents")
    filters_meta: AIUsageSummaryFiltersMetaResponse = Field(
        default_factory=AIUsageSummaryFiltersMetaResponse,
        alias="filtersMeta",
    )

    model_config = {"populate_by_name": True}
