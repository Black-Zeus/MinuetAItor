from __future__ import annotations

from sqlalchemy import BigInteger, Boolean, Column, DateTime, Integer, String, Text

from db.base import Base


class SystemOperationState(Base):
    __tablename__ = "system_operation_state"

    id = Column(Integer, primary_key=True)
    mode = Column(String(40), nullable=False, default="commissioning")
    operation_id = Column(String(36), nullable=True)
    operation_type = Column(String(60), nullable=True)
    reason = Column(String(500), nullable=True)
    started_by = Column(String(36), nullable=True)
    started_by_snapshot_json = Column(Text, nullable=True)
    allowed_session_jti = Column(String(80), nullable=True)
    started_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    metadata_json = Column(Text, nullable=True)
    updated_at = Column(DateTime, nullable=True)


class SystemBackupSetting(Base):
    __tablename__ = "system_backup_settings"

    id = Column(Integer, primary_key=True)
    retention_days = Column(Integer, nullable=False, default=14)
    history_visible = Column(Boolean, nullable=False, default=True)
    backup_purge_queue = Column(String(120), nullable=False, default="queue:backups / backup_purge")
    policies_json = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False)
    created_by = Column(String(36), nullable=True)
    created_by_snapshot_json = Column(Text, nullable=True)
    updated_at = Column(DateTime, nullable=True)
    updated_by = Column(String(36), nullable=True)
    updated_by_snapshot_json = Column(Text, nullable=True)


class SystemBackupArtifact(Base):
    __tablename__ = "system_backup_artifacts"

    id = Column(String(36), primary_key=True)
    scope = Column(String(30), nullable=False)
    name = Column(String(255), nullable=False)
    status = Column(String(30), nullable=False)
    origin_type = Column(String(30), nullable=False, default="manual")
    storage_path = Column(String(700), nullable=True)
    file_path = Column(String(700), nullable=True)
    size_bytes = Column(BigInteger, nullable=False, default=0)
    checksum_sha256 = Column(String(64), nullable=True)
    db_schema_version = Column(String(255), nullable=True)
    app_version = Column(String(80), nullable=True)
    metadata_json = Column(Text, nullable=True)
    manifest_json = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False)
    created_by = Column(String(36), nullable=True)
    created_by_snapshot_json = Column(Text, nullable=True)
    updated_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), nullable=True)
    deleted_by_snapshot_json = Column(Text, nullable=True)


class SystemBackupOperation(Base):
    __tablename__ = "system_backup_operations"

    id = Column(String(36), primary_key=True)
    operation_type = Column(String(60), nullable=False)
    scope = Column(String(30), nullable=False)
    status = Column(String(30), nullable=False)
    trigger_source = Column(String(30), nullable=False, default="manual")
    job_id = Column(String(36), nullable=True)
    artifact_id = Column(String(36), nullable=True)
    requested_at = Column(DateTime, nullable=False)
    requested_by = Column(String(36), nullable=True)
    requested_by_snapshot_json = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    message = Column(String(700), nullable=True)
    error_message = Column(Text, nullable=True)
    payload_json = Column(Text, nullable=True)
    result_json = Column(Text, nullable=True)


class SystemBackupAuditEvent(Base):
    __tablename__ = "system_backup_audit_events"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    event_at = Column(DateTime, nullable=False)
    event_type = Column(String(80), nullable=False)
    operation_id = Column(String(36), nullable=True)
    artifact_id = Column(String(36), nullable=True)
    actor_user_id = Column(String(36), nullable=True)
    actor_snapshot_json = Column(Text, nullable=True)
    details_json = Column(Text, nullable=True)


class SystemDeferredTask(Base):
    __tablename__ = "system_deferred_tasks"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    action = Column(String(80), nullable=False)
    scheduled_slot = Column(String(12), nullable=True)
    reason = Column(String(120), nullable=False)
    maintenance_operation_id = Column(String(36), nullable=True)
    decision = Column(String(40), nullable=False, default="pending")
    payload_json = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False)
    decided_at = Column(DateTime, nullable=True)
    decided_by = Column(String(36), nullable=True)
    decided_by_snapshot_json = Column(Text, nullable=True)
