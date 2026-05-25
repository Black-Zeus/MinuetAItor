from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

from schemas.system_maintenance import validate_cron_expression


BACKUP_SCOPES = ("database", "objects", "full")
DESTINATIONS = ("backend_shared",)
DATABASE_FORMATS = ("sql_gzip", "sql_plain")
OBJECT_FORMATS = ("tar_gzip", "tar_plain")
FULL_FORMATS = ("tar_gzip", "zip_bundle")
VERIFICATION_MODES = ("none", "inventory", "manifest", "checksum")


class BackupPolicyConfig(BaseModel):
    enabled: bool
    cron: str
    destination: str = "backend_shared"
    path_prefix: str = Field(..., serialization_alias="pathPrefix")
    file_format: str = Field(..., serialization_alias="fileFormat")
    verification_mode: str = Field("manifest", serialization_alias="verificationMode")
    notify_by_email: bool = Field(False, serialization_alias="notifyByEmail")
    notify_recipient_name: str | None = Field(None, serialization_alias="notifyRecipientName")
    notify_recipient_email: str | None = Field(None, serialization_alias="notifyRecipientEmail")

    @field_validator("cron")
    @classmethod
    def validate_cron(cls, value: str) -> str:
        return validate_cron_expression(value)

    @field_validator("destination")
    @classmethod
    def validate_destination(cls, value: str) -> str:
        normalized = str(value or "").strip()
        if normalized not in DESTINATIONS:
            raise ValueError("Destino de respaldo no soportado.")
        return normalized

    @field_validator("verification_mode")
    @classmethod
    def validate_verification_mode(cls, value: str) -> str:
        normalized = str(value or "").strip()
        if normalized not in VERIFICATION_MODES:
            raise ValueError("Modo de verificación no soportado.")
        return normalized

    model_config = {"populate_by_name": True}


class BackupPoliciesConfig(BaseModel):
    database: BackupPolicyConfig
    objects: BackupPolicyConfig
    full: BackupPolicyConfig

    @field_validator("database")
    @classmethod
    def validate_database_format(cls, value: BackupPolicyConfig) -> BackupPolicyConfig:
        if value.file_format not in DATABASE_FORMATS:
            raise ValueError("Formato de respaldo de base de datos no soportado.")
        return value

    @field_validator("objects")
    @classmethod
    def validate_objects_format(cls, value: BackupPolicyConfig) -> BackupPolicyConfig:
        if value.file_format not in OBJECT_FORMATS:
            raise ValueError("Formato de respaldo de objetos no soportado.")
        return value

    @field_validator("full")
    @classmethod
    def validate_full_format(cls, value: BackupPolicyConfig) -> BackupPolicyConfig:
        if value.file_format not in FULL_FORMATS:
            raise ValueError("Formato de respaldo full no soportado.")
        return value

    model_config = {"populate_by_name": True}


class ActorSnapshotResponse(BaseModel):
    user_id: str | None = Field(None, serialization_alias="userId")
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")
    email: str | None = None

    model_config = {"populate_by_name": True}


class SystemBackupsConfigRequest(BaseModel):
    backup_retention_days: int = Field(..., ge=1, le=365, serialization_alias="backupRetentionDays")
    backup_history_visible: bool = Field(..., serialization_alias="backupHistoryVisible")
    backup_purge_queue: str = Field("queue:backups / backup_purge", serialization_alias="backupPurgeQueue")
    policies: BackupPoliciesConfig

    model_config = {"populate_by_name": True}


class SystemBackupsConfigResponse(SystemBackupsConfigRequest):
    id: int
    created_at: str | None = Field(None, serialization_alias="createdAt")
    updated_at: str | None = Field(None, serialization_alias="updatedAt")
    created_by: ActorSnapshotResponse | None = Field(None, serialization_alias="createdBy")
    updated_by: ActorSnapshotResponse | None = Field(None, serialization_alias="updatedBy")

    model_config = {"populate_by_name": True}


class BackupArtifactResponse(BaseModel):
    id: str
    item_type: str = Field("artifact", serialization_alias="itemType")
    scope: str
    name: str
    status: str
    origin_type: str = Field(..., serialization_alias="originType")
    operation_type: str | None = Field(None, serialization_alias="operationType")
    job_id: str | None = Field(None, serialization_alias="jobId")
    artifact_id: str | None = Field(None, serialization_alias="artifactId")
    storage_path: str | None = Field(None, serialization_alias="storagePath")
    file_path: str | None = Field(None, serialization_alias="filePath")
    size_bytes: int = Field(..., serialization_alias="sizeBytes")
    checksum_sha256: str | None = Field(None, serialization_alias="checksumSha256")
    db_schema_version: str | None = Field(None, serialization_alias="dbSchemaVersion")
    app_version: str | None = Field(None, serialization_alias="appVersion")
    created_at: str | None = Field(None, serialization_alias="createdAt")
    created_by: ActorSnapshotResponse | None = Field(None, serialization_alias="createdBy")
    message: str | None = None

    model_config = {"populate_by_name": True}


class BackupOperationResponse(BaseModel):
    id: str
    operation_type: str = Field(..., serialization_alias="operationType")
    scope: str
    status: str
    trigger_source: str = Field(..., serialization_alias="triggerSource")
    job_id: str | None = Field(None, serialization_alias="jobId")
    artifact_id: str | None = Field(None, serialization_alias="artifactId")
    requested_at: str | None = Field(None, serialization_alias="requestedAt")
    requested_by: ActorSnapshotResponse | None = Field(None, serialization_alias="requestedBy")
    message: str | None = None

    model_config = {"populate_by_name": True}


class BackupQueueStatusResponse(BaseModel):
    queue: str
    size: int
    dlq_queue: str = Field(..., serialization_alias="dlqQueue")
    dlq_size: int = Field(..., serialization_alias="dlqSize")

    model_config = {"populate_by_name": True}


class SystemBackupsStatusResponse(BaseModel):
    queue: BackupQueueStatusResponse
    latest_operation: BackupOperationResponse | None = Field(None, serialization_alias="latestOperation")
    latest_artifact: BackupArtifactResponse | None = Field(None, serialization_alias="latestArtifact")
    db_schema_version: str = Field(..., serialization_alias="dbSchemaVersion")
    backup_storage_root: str = Field(..., serialization_alias="backupStorageRoot")

    model_config = {"populate_by_name": True}


class BackupHistoryResponse(BaseModel):
    items: list[BackupArtifactResponse]

    model_config = {"populate_by_name": True}


class BackupImportResponse(BaseModel):
    artifact: BackupArtifactResponse
    message: str

    model_config = {"populate_by_name": True}


class BackupRunNowResponse(BaseModel):
    operation_id: str = Field(..., serialization_alias="operationId")
    job_id: str = Field(..., serialization_alias="jobId")
    action: str
    scope: str
    status: str
    queued_at: str = Field(..., serialization_alias="queuedAt")
    message: str

    model_config = {"populate_by_name": True}


class BackupPurgeCandidateResponse(BaseModel):
    id: str
    scope: str
    name: str
    status: str
    file_path: str | None = Field(None, serialization_alias="filePath")
    size_bytes: int = Field(..., serialization_alias="sizeBytes")
    created_at: str | None = Field(None, serialization_alias="createdAt")

    model_config = {"populate_by_name": True}


class BackupPurgePreviewResponse(BaseModel):
    retention_days: int = Field(..., serialization_alias="retentionDays")
    cutoff_at: str = Field(..., serialization_alias="cutoffAt")
    keep_latest_per_scope: bool = Field(True, serialization_alias="keepLatestPerScope")
    total_count: int = Field(..., serialization_alias="totalCount")
    total_size_bytes: int = Field(..., serialization_alias="totalSizeBytes")
    candidates: list[BackupPurgeCandidateResponse]

    model_config = {"populate_by_name": True}


class BackupSyncResponse(BaseModel):
    discovered_count: int = Field(..., serialization_alias="discoveredCount")
    missing_count: int = Field(..., serialization_alias="missingCount")
    restored_count: int = Field(..., serialization_alias="restoredCount")
    scanned_count: int = Field(..., serialization_alias="scannedCount")
    errors: list[str]

    model_config = {"populate_by_name": True}


class BackupInspectFileResponse(BaseModel):
    path: str
    size_bytes: int | None = Field(None, serialization_alias="sizeBytes")
    expected_sha256: str | None = Field(None, serialization_alias="expectedSha256")
    actual_sha256: str | None = Field(None, serialization_alias="actualSha256")
    status: str

    model_config = {"populate_by_name": True}


class BackupInspectSectionResponse(BaseModel):
    enabled: bool
    path: str | None = None
    format: str | None = None
    data_only: bool | None = Field(None, serialization_alias="dataOnly")
    buckets: list[dict] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class BackupInspectResponse(BaseModel):
    artifact: BackupArtifactResponse
    package_exists: bool = Field(..., serialization_alias="packageExists")
    package_sha256: str | None = Field(None, serialization_alias="packageSha256")
    package_sha256_matches_catalog: bool | None = Field(None, serialization_alias="packageSha256MatchesCatalog")
    metadata: dict
    manifest: dict
    sections: dict[str, BackupInspectSectionResponse]
    files: list[BackupInspectFileResponse]
    errors: list[str]
    warnings: list[str]
    is_valid: bool = Field(..., serialization_alias="isValid")

    model_config = {"populate_by_name": True}
