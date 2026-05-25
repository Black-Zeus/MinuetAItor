from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

VALID_CLEANUP_MODES = ("soft_logout", "revoke_idle", "archive_only")
VALID_OPERATION_MODES = ("normal", "read_only", "maintenance")


def _normalize_cron_expression(value: str) -> str:
    return " ".join(str(value or "").strip().split())


def _is_number_in_range(value: str, min_value: int, max_value: int) -> bool:
    if not str(value or "").isdigit():
        return False
    numeric_value = int(value)
    return min_value <= numeric_value <= max_value


def _validate_cron_segment(segment: str, min_value: int, max_value: int) -> bool:
    raw_segment = str(segment or "").strip()
    if not raw_segment:
        return False

    parts = raw_segment.split("/")
    if len(parts) > 2:
        return False

    base = parts[0]
    step = parts[1] if len(parts) == 2 else None

    if step is not None and (not step.isdigit() or int(step) <= 0):
        return False

    if base == "*":
        return True

    if "-" in base:
        bounds = base.split("-")
        if len(bounds) != 2:
            return False
        start, end = bounds
        if not _is_number_in_range(start, min_value, max_value):
            return False
        if not _is_number_in_range(end, min_value, max_value):
            return False
        return int(start) <= int(end)

    return _is_number_in_range(base, min_value, max_value)


def _validate_cron_field_value(field_value: str, min_value: int, max_value: int) -> bool:
    parts = str(field_value or "").split(",")
    if not parts:
        return False
    return all(_validate_cron_segment(part, min_value, max_value) for part in parts)


def validate_cron_expression(value: str) -> str:
    normalized_value = _normalize_cron_expression(value)
    if not normalized_value:
        raise ValueError("Debes ingresar una programación cron de 5 campos.")

    fields = normalized_value.split(" ")
    if len(fields) != 5:
        raise ValueError("La expresión debe tener 5 campos: minuto hora día mes día-semana.")

    ranges = (
        (0, 59),
        (0, 23),
        (1, 31),
        (1, 12),
        (0, 6),
    )

    for index, field_value in enumerate(fields):
        min_value, max_value = ranges[index]
        if not _validate_cron_field_value(field_value, min_value, max_value):
            raise ValueError("La programación cron contiene campos inválidos.")

    return normalized_value


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class SystemMaintenanceConfigRequest(BaseModel):
    session_cleanup_enabled: bool = Field(..., serialization_alias="sessionCleanupEnabled")
    session_cleanup_cron: str = Field(..., serialization_alias="sessionCleanupCron")
    session_cleanup_mode: str = Field(..., serialization_alias="sessionCleanupMode")
    temp_cleanup_enabled: bool = Field(..., serialization_alias="tempCleanupEnabled")
    temp_cleanup_cron: str = Field(..., serialization_alias="tempCleanupCron")
    temp_cleanup_max_age_days: int = Field(..., ge=1, le=90, serialization_alias="tempCleanupMaxAgeDays")
    monitor_maintenance_queue_enabled: bool = Field(..., serialization_alias="monitorMaintenanceQueueEnabled")
    maintenance_queue_warning_threshold: int = Field(..., ge=1, le=500, serialization_alias="maintenanceQueueWarningThreshold")
    monitor_minutes_queue_enabled: bool = Field(..., serialization_alias="monitorMinutesQueueEnabled")
    minutes_queue_warning_threshold: int = Field(..., ge=1, le=500, serialization_alias="minutesQueueWarningThreshold")
    monitor_email_queue_enabled: bool = Field(..., serialization_alias="monitorEmailQueueEnabled")
    email_queue_warning_threshold: int = Field(..., ge=1, le=500, serialization_alias="emailQueueWarningThreshold")
    monitor_pdf_queue_enabled: bool = Field(..., serialization_alias="monitorPdfQueueEnabled")
    pdf_queue_warning_threshold: int = Field(..., ge=1, le=500, serialization_alias="pdfQueueWarningThreshold")
    monitor_dlq_enabled: bool = Field(..., serialization_alias="monitorDlqEnabled")
    dlq_warning_threshold: int = Field(..., ge=1, le=500, serialization_alias="dlqWarningThreshold")

    @field_validator("session_cleanup_cron", "temp_cleanup_cron")
    @classmethod
    def normalize_and_validate_cron(cls, value: str) -> str:
        return validate_cron_expression(value)

    @field_validator("session_cleanup_mode")
    @classmethod
    def validate_mode(cls, value: str) -> str:
        normalized = str(value or "").strip()
        if normalized not in VALID_CLEANUP_MODES:
            raise ValueError("El modo de limpieza de sesiones no es válido.")
        return normalized

    model_config = {"populate_by_name": True}


class SystemMaintenanceConfigResponse(BaseModel):
    id: int
    session_cleanup_enabled: bool = Field(..., serialization_alias="sessionCleanupEnabled")
    session_cleanup_cron: str = Field(..., serialization_alias="sessionCleanupCron")
    session_cleanup_mode: str = Field(..., serialization_alias="sessionCleanupMode")
    temp_cleanup_enabled: bool = Field(..., serialization_alias="tempCleanupEnabled")
    temp_cleanup_cron: str = Field(..., serialization_alias="tempCleanupCron")
    temp_cleanup_max_age_days: int = Field(..., serialization_alias="tempCleanupMaxAgeDays")
    monitor_maintenance_queue_enabled: bool = Field(..., serialization_alias="monitorMaintenanceQueueEnabled")
    maintenance_queue_warning_threshold: int = Field(..., serialization_alias="maintenanceQueueWarningThreshold")
    monitor_minutes_queue_enabled: bool = Field(..., serialization_alias="monitorMinutesQueueEnabled")
    minutes_queue_warning_threshold: int = Field(..., serialization_alias="minutesQueueWarningThreshold")
    monitor_email_queue_enabled: bool = Field(..., serialization_alias="monitorEmailQueueEnabled")
    email_queue_warning_threshold: int = Field(..., serialization_alias="emailQueueWarningThreshold")
    monitor_pdf_queue_enabled: bool = Field(..., serialization_alias="monitorPdfQueueEnabled")
    pdf_queue_warning_threshold: int = Field(..., serialization_alias="pdfQueueWarningThreshold")
    monitor_dlq_enabled: bool = Field(..., serialization_alias="monitorDlqEnabled")
    dlq_warning_threshold: int = Field(..., serialization_alias="dlqWarningThreshold")
    created_at: str | None = Field(None, serialization_alias="createdAt")
    updated_at: str | None = Field(None, serialization_alias="updatedAt")
    created_by: UserRefResponse | None = Field(None, serialization_alias="createdBy")
    updated_by: UserRefResponse | None = Field(None, serialization_alias="updatedBy")

    model_config = {"populate_by_name": True}


class MaintenanceQueueStatusResponse(BaseModel):
    queue: str
    size: int
    monitoring_enabled: bool = Field(..., serialization_alias="monitoringEnabled")
    warning_threshold: int = Field(..., serialization_alias="warningThreshold")
    is_warning: bool = Field(..., serialization_alias="isWarning")

    model_config = {"populate_by_name": True}


class MaintenanceRuntimeStatusResponse(BaseModel):
    last_enqueued_at: str | None = Field(None, serialization_alias="lastEnqueuedAt")
    last_started_at: str | None = Field(None, serialization_alias="lastStartedAt")
    last_finished_at: str | None = Field(None, serialization_alias="lastFinishedAt")
    last_status: str | None = Field(None, serialization_alias="lastStatus")
    last_message: str | None = Field(None, serialization_alias="lastMessage")
    affected_count: int | None = Field(None, serialization_alias="affectedCount")

    model_config = {"populate_by_name": True}


class MaintenanceRunNowResponse(BaseModel):
    action: str
    job_id: str = Field(..., serialization_alias="jobId")
    requested_at: str = Field(..., serialization_alias="requestedAt")
    scheduled_slot: str = Field(..., serialization_alias="scheduledSlot")
    trigger: str
    message: str

    model_config = {"populate_by_name": True}


class SystemOperationModeRequest(BaseModel):
    mode: str
    reason: str | None = None

    @field_validator("mode")
    @classmethod
    def validate_operation_mode(cls, value: str) -> str:
        normalized = str(value or "").strip()
        if normalized not in VALID_OPERATION_MODES:
            raise ValueError("El modo operativo solicitado no es válido.")
        return normalized

    model_config = {"populate_by_name": True}


class SystemOperationStateResponse(BaseModel):
    mode: str
    operation_id: str | None = Field(None, serialization_alias="operationId")
    operation_type: str | None = Field(None, serialization_alias="operationType")
    reason: str | None = None
    started_by: UserRefResponse | None = Field(None, serialization_alias="startedBy")
    started_at: str | None = Field(None, serialization_alias="startedAt")
    source: str

    model_config = {"populate_by_name": True}


class SystemMaintenanceStatusResponse(BaseModel):
    minutes_queue: MaintenanceQueueStatusResponse = Field(..., serialization_alias="minutesQueue")
    email_queue: MaintenanceQueueStatusResponse = Field(..., serialization_alias="emailQueue")
    maintenance_queue: MaintenanceQueueStatusResponse = Field(..., serialization_alias="maintenanceQueue")
    pdf_queue: MaintenanceQueueStatusResponse = Field(..., serialization_alias="pdfQueue")
    dlq: MaintenanceQueueStatusResponse
    session_cleanup: MaintenanceRuntimeStatusResponse = Field(..., serialization_alias="sessionCleanup")
    temp_cleanup: MaintenanceRuntimeStatusResponse = Field(..., serialization_alias="tempCleanup")
    operation_state: SystemOperationStateResponse = Field(..., serialization_alias="operationState")
    scheduler_timezone: str = Field(..., serialization_alias="schedulerTimezone")

    model_config = {"populate_by_name": True}
