from __future__ import annotations

from typing import Optional

from fastapi import HTTPException
from sqlalchemy import false, or_
from sqlalchemy.orm import Session

from models.record_versions import RecordVersion
from models.records import Record
from models.user import User
from schemas.minutes import (
    MinuteDetailResponse,
    MinuteListItem,
    MinuteListResponse,
    MinuteRecordInfo,
    MinuteTagItem,
    MinuteVersionItem,
    MinuteVersionsResponse,
)
from services.minutes.attachments import list_minute_input_attachments
from services.minutes.constants import (
    BUCKET_DRAFT,
    BUCKET_JSON,
    RECORD_STATUS_COMPLETED,
    RECORD_STATUS_PENDING,
    RECORD_STATUS_PREVIEW,
    RECORD_STATUS_READY,
    STATUSES_NO_CONTENT,
)
from services.minutes.sanitizers import (
    calculate_duration_label,
    extract_summary_from_minute_content,
    format_hhmm,
)
from services.minutes.storage import read_json


def _load_minute_list_summary(record_id: str, status_code: str, version_num: int) -> Optional[str]:
    if status_code == RECORD_STATUS_READY:
        content = read_json(BUCKET_JSON, f"{record_id}/schema_output_v1.json")
        return extract_summary_from_minute_content(content)

    if status_code == RECORD_STATUS_PENDING:
        draft = read_json(BUCKET_DRAFT, f"{record_id}/draft_current.json")
        if draft is not None:
            return extract_summary_from_minute_content(draft)
        content = read_json(BUCKET_JSON, f"{record_id}/schema_output_v1.json")
        return extract_summary_from_minute_content(content)

    if status_code in (RECORD_STATUS_PREVIEW, RECORD_STATUS_COMPLETED):
        content = read_json(BUCKET_JSON, f"{record_id}/schema_output_v{version_num}.json")
        return extract_summary_from_minute_content(content)

    return None


def get_minute_detail(db: Session, record_id: str) -> MinuteDetailResponse:
    from models.record_statuses import RecordStatus

    record = db.query(Record).filter(Record.id == record_id, Record.deleted_at.is_(None)).first()
    if record is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "record_not_found", "message": f"Minuta '{record_id}' no encontrada."},
        )

    status_row = db.query(RecordStatus).filter_by(id=record.status_id).first()
    status_code = status_row.code if status_row else "unknown"

    client_name = getattr(getattr(record, "client", None), "name", None)
    project_name = getattr(getattr(record, "project", None), "name", None)
    prepared_by_name = None
    prep_user = getattr(record, "prepared_by_user", None)
    if prep_user:
        profile = getattr(prep_user, "profile", None)
        prepared_by_name = getattr(profile, "full_name", None) or getattr(prep_user, "username", None)

    record_info = MinuteRecordInfo(
        id=record.id,
        status=status_code,
        title=record.title,
        client_id=str(record.client_id) if record.client_id else None,
        client_name=client_name,
        project_id=str(record.project_id) if record.project_id else None,
        project_name=project_name,
        active_version_id=str(record.active_version_id) if record.active_version_id else None,
        active_version_num=int(record.latest_version_num) if record.latest_version_num else None,
        document_date=record.document_date.isoformat() if record.document_date else None,
        location=record.location,
        prepared_by=prepared_by_name,
        created_at=record.created_at.isoformat() if getattr(record, "created_at", None) else None,
    )
    input_attachments = list_minute_input_attachments(db, record_id)

    if status_code in STATUSES_NO_CONTENT:
        return MinuteDetailResponse(
            record=record_info,
            content=None,
            content_type=None,
            input_attachments=input_attachments,
        )

    content = None
    content_type: Optional[str] = None
    version_num = int(record.latest_version_num) if record.latest_version_num else 1

    if status_code == RECORD_STATUS_READY:
        content = read_json(BUCKET_JSON, f"{record_id}/schema_output_v1.json")
        content_type = "ai_output"
    elif status_code == RECORD_STATUS_PENDING:
        content = read_json(BUCKET_DRAFT, f"{record_id}/draft_current.json")
        if content is not None:
            content_type = "draft"
        else:
            content = read_json(BUCKET_JSON, f"{record_id}/schema_output_v1.json")
            content_type = "ai_output"
    elif status_code in (RECORD_STATUS_PREVIEW, RECORD_STATUS_COMPLETED):
        content = read_json(BUCKET_JSON, f"{record_id}/schema_output_v{version_num}.json")
        content_type = "snapshot"

    return MinuteDetailResponse(
        record=record_info,
        content=content,
        content_type=content_type,
        input_attachments=input_attachments,
    )


def list_minutes(
    db: Session,
    skip: int = 0,
    limit: int = 12,
    q: Optional[str] = None,
    status_filter: Optional[str] = None,
    client_id: Optional[str] = None,
    project_id: Optional[str] = None,
    prepared_by_user_id: Optional[str] = None,
    participant_user_id: Optional[str] = None,
    exclude_prepared_by_user_id: Optional[str] = None,
) -> MinuteListResponse:
    from models.clients import Client
    from models.projects import Project
    from models.record_statuses import RecordStatus
    from models.record_version_participant import RecordVersionParticipant

    query = db.query(Record).filter(Record.deleted_at.is_(None))

    if q:
        term = f"%{q.strip()}%"
        query = (
            query.outerjoin(Client, Client.id == Record.client_id)
            .outerjoin(Project, Project.id == Record.project_id)
            .outerjoin(
                RecordVersionParticipant,
                RecordVersionParticipant.record_version_id == Record.active_version_id,
            )
            .filter(
                or_(
                    Record.title.ilike(term),
                    Record.intro_snippet.ilike(term),
                    Client.name.ilike(term),
                    Project.name.ilike(term),
                    RecordVersionParticipant.display_name.ilike(term),
                    RecordVersionParticipant.organization.ilike(term),
                    RecordVersionParticipant.title.ilike(term),
                    RecordVersionParticipant.email.ilike(term),
                )
            )
            .distinct()
        )

    if status_filter:
        status_obj = db.query(RecordStatus).filter_by(code=status_filter).first()
        if status_obj:
            query = query.filter(Record.status_id == status_obj.id)

    if client_id:
        query = query.filter(Record.client_id == client_id)
    if project_id:
        query = query.filter(Record.project_id == project_id)
    if prepared_by_user_id:
        query = query.filter(Record.prepared_by_user_id == prepared_by_user_id)
    if exclude_prepared_by_user_id:
        query = query.filter(Record.prepared_by_user_id != exclude_prepared_by_user_id)

    if participant_user_id:
        user = db.query(User).filter(User.id == participant_user_id, User.deleted_at.is_(None)).first()
        participant_email = (user.email or "").strip() if user else ""

        if not participant_email:
            query = query.filter(false())
        else:
            participant_exists = (
                db.query(RecordVersionParticipant.id)
                .filter(
                    RecordVersionParticipant.record_version_id == Record.active_version_id,
                    RecordVersionParticipant.email.ilike(participant_email),
                )
                .exists()
            )
            query = query.filter(participant_exists)

    total = query.count()
    records = query.order_by(Record.created_at.desc()).offset(skip).limit(limit).all()

    items = []
    for rec in records:
        status_row = db.query(RecordStatus).filter_by(id=rec.status_id).first()
        status_code = status_row.code if status_row else "unknown"

        client_name = getattr(getattr(rec, "client", None), "name", None)
        project_name = getattr(getattr(rec, "project", None), "name", None)
        prep_user = getattr(rec, "prepared_by_user", None)
        prep_profile = getattr(prep_user, "profile", None) if prep_user else None
        prepared_by_name = getattr(prep_profile, "full_name", None) or getattr(prep_user, "username", None)
        version_num = int(rec.latest_version_num) if rec.latest_version_num else 1
        summary_text = getattr(rec, "intro_snippet", None) or _load_minute_list_summary(
            rec.id,
            status_code,
            version_num,
        )
        time_text = format_hhmm(rec.actual_start_time or rec.scheduled_start_time)
        duration_text = calculate_duration_label(
            rec.scheduled_start_time,
            rec.scheduled_end_time,
            rec.actual_start_time,
            rec.actual_end_time,
        )

        participant_rows = (
            db.query(RecordVersionParticipant)
            .filter(RecordVersionParticipant.record_version_id == rec.active_version_id)
            .order_by(RecordVersionParticipant.display_name.asc())
            .all()
            if rec.active_version_id
            else []
        )
        participant_names = [p.display_name for p in participant_rows if p.display_name]

        tag_items = []
        if hasattr(rec, "tags"):
            tag_items = [MinuteTagItem(label=t.name, color=t.color or "#6B7280") for t in rec.tags]

        items.append(
            MinuteListItem(
                id=rec.id,
                title=rec.title or "",
                date=rec.document_date.isoformat() if rec.document_date else None,
                time=time_text,
                duration=duration_text,
                prepared_by=prepared_by_name,
                status=status_code,
                client=client_name,
                project=project_name,
                participants=participant_names,
                summary=summary_text,
                tags=tag_items,
            )
        )

    return MinuteListResponse(minutes=items, total=total, skip=skip, limit=limit)


def get_minute_versions(db: Session, record_id: str) -> MinuteVersionsResponse:
    from models.version_statuses import VersionStatus

    record = db.query(Record).filter(Record.id == record_id, Record.deleted_at.is_(None)).first()
    if record is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "record_not_found", "message": f"Minuta '{record_id}' no encontrada."},
        )

    versions_rows = (
        db.query(RecordVersion)
        .filter(RecordVersion.record_id == record_id, RecordVersion.deleted_at.is_(None))
        .order_by(RecordVersion.version_num.desc())
        .all()
    )

    version_status_labels = {
        "snapshot": "Borrador",
        "final": "Publicada",
    }

    items = []
    for version in versions_rows:
        published_by_name = None
        if version.published_by_user:
            profile = getattr(version.published_by_user, "profile", None)
            published_by_name = getattr(profile, "full_name", None) or getattr(
                version.published_by_user,
                "username",
                None,
            )

        status: VersionStatus = version.status
        status_code = status.code if status else "unknown"
        status_label = version_status_labels.get(status_code, status_code)

        items.append(
            MinuteVersionItem(
                version_id=str(version.id),
                version_num=int(version.version_num),
                version_label=f"v{version.version_num}",
                status_code=status_code,
                status_label=status_label,
                published_at=version.published_at.isoformat() if version.published_at else None,
                published_by=published_by_name,
                commit_message=version.summary_text,
            )
        )

    return MinuteVersionsResponse(record_id=record_id, versions=items)
