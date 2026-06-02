from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from core.datetime_utils import utc_now_db
from db.base import Base


class AiContextDocument(Base):
    __tablename__ = "ai_context_documents"

    id = Column(String(36), primary_key=True)
    source_system = Column(String(60), nullable=False, default="minuetaitor")
    source_client_id = Column(String(36), ForeignKey("clients.id"), nullable=False)
    source_project_id = Column(String(36), ForeignKey("projects.id"), nullable=True)
    source_minute_id = Column(String(36), ForeignKey("records.id"), nullable=False)
    source_version_id = Column(String(36), ForeignKey("record_versions.id"), nullable=False)
    source_version_num = Column(Integer, nullable=False)
    status = Column(String(30), nullable=False, default="not_indexed")
    source_hash = Column(String(64), nullable=True)
    indexed_hash = Column(String(64), nullable=True)
    embedding_provider_config_id = Column(String(36), ForeignKey("ai_provider_configs.id"), nullable=True)
    embedding_binding_id = Column(String(36), ForeignKey("ai_provider_bindings.id"), nullable=True)
    embedding_model = Column(String(180), nullable=True)
    embedding_dimensions = Column(Integer, nullable=True)
    qdrant_collection = Column(String(120), nullable=True)
    chunk_count = Column(Integer, nullable=False, default=0)
    last_error = Column(Text, nullable=True)
    indexed_at = Column(DateTime, nullable=True)
    last_checked_at = Column(DateTime, nullable=True)
    deactivated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now_db)
    updated_at = Column(DateTime, nullable=True, default=utc_now_db, onupdate=utc_now_db)

    client = relationship("Client", lazy="select")
    project = relationship("Project", lazy="select")
    minute = relationship("Record", lazy="select")
    version = relationship("RecordVersion", lazy="select")
    embedding_provider = relationship("AiProviderConfig", lazy="select")
    embedding_binding = relationship("AiProviderBinding", lazy="select")


class AiContextChunk(Base):
    __tablename__ = "ai_context_chunks"

    id = Column(String(36), primary_key=True)
    document_id = Column(String(36), ForeignKey("ai_context_documents.id"), nullable=False)
    source_system = Column(String(60), nullable=False, default="minuetaitor")
    source_client_id = Column(String(36), ForeignKey("clients.id"), nullable=False)
    source_project_id = Column(String(36), ForeignKey("projects.id"), nullable=True)
    source_minute_id = Column(String(36), ForeignKey("records.id"), nullable=False)
    source_version_id = Column(String(36), ForeignKey("record_versions.id"), nullable=False)
    source_item_id = Column(String(160), nullable=False)
    item_type = Column(String(60), nullable=False)
    chunk_index = Column(Integer, nullable=False, default=0)
    chunk_hash = Column(String(64), nullable=False)
    source_hash = Column(String(64), nullable=False)
    qdrant_collection = Column(String(120), nullable=False)
    qdrant_point_id = Column(String(36), nullable=False)
    embedding_provider_config_id = Column(String(36), ForeignKey("ai_provider_configs.id"), nullable=False)
    embedding_binding_id = Column(String(36), ForeignKey("ai_provider_bindings.id"), nullable=True)
    embedding_model = Column(String(180), nullable=False)
    embedding_dimensions = Column(Integer, nullable=False)
    status = Column(String(30), nullable=False, default="indexed")
    last_error = Column(Text, nullable=True)
    indexed_at = Column(DateTime, nullable=True)
    deactivated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now_db)
    updated_at = Column(DateTime, nullable=True, default=utc_now_db, onupdate=utc_now_db)

    document = relationship("AiContextDocument", lazy="select")
    client = relationship("Client", lazy="select")
    project = relationship("Project", lazy="select")
    minute = relationship("Record", lazy="select")
    version = relationship("RecordVersion", lazy="select")
    embedding_provider = relationship("AiProviderConfig", lazy="select")
    embedding_binding = relationship("AiProviderBinding", lazy="select")


class AiContextIndexJob(Base):
    __tablename__ = "ai_context_index_jobs"

    id = Column(String(36), primary_key=True)
    job_id = Column(String(36), nullable=True)
    job_type = Column(String(60), nullable=False)
    queue_name = Column(String(80), nullable=False, default="queue:context")
    status = Column(String(30), nullable=False, default="queued")
    source_client_id = Column(String(36), ForeignKey("clients.id"), nullable=True)
    source_project_id = Column(String(36), ForeignKey("projects.id"), nullable=True)
    source_minute_id = Column(String(36), ForeignKey("records.id"), nullable=True)
    source_version_id = Column(String(36), ForeignKey("record_versions.id"), nullable=True)
    parent_job_id = Column(String(36), ForeignKey("ai_context_index_jobs.id"), nullable=True)
    requested_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    attempts = Column(Integer, nullable=False, default=0)
    max_attempts = Column(Integer, nullable=False, default=3)
    payload_json = Column(Text, nullable=True)
    last_error = Column(Text, nullable=True)
    queued_at = Column(DateTime, nullable=False, default=utc_now_db)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now_db)
    updated_at = Column(DateTime, nullable=True, default=utc_now_db, onupdate=utc_now_db)

    client = relationship("Client", lazy="select")
    project = relationship("Project", lazy="select")
    minute = relationship("Record", lazy="select")
    version = relationship("RecordVersion", lazy="select")
    parent_job = relationship("AiContextIndexJob", remote_side=[id], lazy="select")
    requested_by_user = relationship("User", lazy="select")


class AiContextQueryRun(Base):
    __tablename__ = "ai_context_query_runs"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    scope_type = Column(String(30), nullable=False)
    scope_client_id = Column(String(36), ForeignKey("clients.id"), nullable=True)
    scope_project_id = Column(String(36), ForeignKey("projects.id"), nullable=True)
    scope_minute_id = Column(String(36), ForeignKey("records.id"), nullable=True)
    question_hash = Column(String(64), nullable=False)
    question_text = Column(Text, nullable=False)
    status = Column(String(30), nullable=False, default="queued")
    embedding_provider_config_id = Column(String(36), ForeignKey("ai_provider_configs.id"), nullable=True)
    embedding_binding_id = Column(String(36), ForeignKey("ai_provider_bindings.id"), nullable=True)
    embedding_model = Column(String(180), nullable=True)
    qdrant_collection = Column(String(120), nullable=True)
    answer_provider_config_id = Column(String(36), ForeignKey("ai_provider_configs.id"), nullable=True)
    answer_binding_id = Column(String(36), ForeignKey("ai_provider_bindings.id"), nullable=True)
    answer_model = Column(String(180), nullable=True)
    answer_text = Column(Text, nullable=True)
    retrieved_chunks_count = Column(Integer, nullable=False, default=0)
    cited_chunks_count = Column(Integer, nullable=False, default=0)
    citations_json = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now_db)
    updated_at = Column(DateTime, nullable=True, default=utc_now_db, onupdate=utc_now_db)

    user = relationship("User", foreign_keys=[user_id], lazy="select")
    scope_client = relationship("Client", lazy="select")
    scope_project = relationship("Project", lazy="select")
    scope_minute = relationship("Record", lazy="select")
    embedding_provider = relationship("AiProviderConfig", foreign_keys=[embedding_provider_config_id], lazy="select")
    embedding_binding = relationship("AiProviderBinding", foreign_keys=[embedding_binding_id], lazy="select")
    answer_provider = relationship("AiProviderConfig", foreign_keys=[answer_provider_config_id], lazy="select")
    answer_binding = relationship("AiProviderBinding", foreign_keys=[answer_binding_id], lazy="select")
