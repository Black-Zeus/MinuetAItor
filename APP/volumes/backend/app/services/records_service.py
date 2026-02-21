# services/records_service.py

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.records import Record
from schemas.records import RecordCreateRequest, RecordUpdateRequest, RecordFilterRequest


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(getattr(u, "id", None)),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _entity_ref(x) -> dict | None:
    if not x:
        return None
    return {
        "id": str(getattr(x, "id", None)),
        "name": getattr(x, "name", None),
    }


def _get_or_404(db: Session, record_id: str) -> Record:
    obj = (
        db.query(Record)
        .options(
            joinedload(Record.client),
            joinedload(Record.project),
            joinedload(Record.record_type),
            joinedload(Record.status),
            joinedload(Record.ai_profile),
            joinedload(Record.prepared_by_user),
            joinedload(Record.created_by_user),
            joinedload(Record.updated_by_user),
            joinedload(Record.deleted_by_user),
        )
        .filter(Record.id == record_id, Record.deleted_at.is_(None))
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="RECORD_NOT_FOUND")
    return obj


def _build_response_dict(obj: Record) -> dict:
    return {
        "id": str(obj.id),

        "clientId": str(obj.client_id),
        "projectId": str(obj.project_id) if obj.project_id else None,

        "recordTypeId": int(obj.record_type_id),
        "statusId": int(obj.status_id),

        "aiProfileId": str(obj.ai_profile_id) if obj.ai_profile_id else None,

        "title": obj.title,
        "documentDate": str(obj.document_date) if obj.document_date else None,
        "location": obj.location,

        "scheduledStartTime": obj.scheduled_start_time.isoformat() if obj.scheduled_start_time else None,
        "scheduledEndTime": obj.scheduled_end_time.isoformat() if obj.scheduled_end_time else None,
        "actualStartTime": obj.actual_start_time.isoformat() if obj.actual_start_time else None,
        "actualEndTime": obj.actual_end_time.isoformat() if obj.actual_end_time else None,

        "preparedByUserId": str(obj.prepared_by_user_id),

        "introSnippet": obj.intro_snippet,

        "activeVersionId": str(obj.active_version_id) if obj.active_version_id else None,
        "latestVersionNum": int(obj.latest_version_num),

        "createdAt": obj.created_at.isoformat() if getattr(obj, "created_at", None) else None,
        "updatedAt": obj.updated_at.isoformat() if getattr(obj, "updated_at", None) else None,

        "createdBy": _user_ref(getattr(obj, "created_by_user", None)),
        "updatedBy": _user_ref(getattr(obj, "updated_by_user", None)),
        "deletedBy": _user_ref(getattr(obj, "deleted_by_user", None)),
        "deletedAt": obj.deleted_at.isoformat() if obj.deleted_at else None,

        "client": _entity_ref(getattr(obj, "client", None)),
        "project": _entity_ref(getattr(obj, "project", None)),
        "recordType": _entity_ref(getattr(obj, "record_type", None)),
        "status": _entity_ref(getattr(obj, "status", None)),
        "aiProfile": _entity_ref(getattr(obj, "ai_profile", None)),
        "preparedBy": _user_ref(getattr(obj, "prepared_by_user", None)),
    }


def get_record(db: Session, record_id: str) -> dict:
    obj = _get_or_404(db, record_id)
    return _build_response_dict(obj)


def list_records(db: Session, filters: RecordFilterRequest) -> dict:
    q = db.query(Record).filter(Record.deleted_at.is_(None))

    if filters.client_id:
        q = q.filter(Record.client_id == filters.client_id)
    if filters.project_id:
        q = q.filter(Record.project_id == filters.project_id)
    if filters.record_type_id is not None:
        q = q.filter(Record.record_type_id == filters.record_type_id)
    if filters.status_id is not None:
        q = q.filter(Record.status_id == filters.status_id)
    if filters.ai_profile_id:
        q = q.filter(Record.ai_profile_id == filters.ai_profile_id)
    if filters.prepared_by_user_id:
        q = q.filter(Record.prepared_by_user_id == filters.prepared_by_user_id)

    if filters.title_contains:
        q = q.filter(Record.title.like(f"%{filters.title_contains}%"))
    if filters.location_contains:
        q = q.filter(Record.location.like(f"%{filters.location_contains}%"))

    if filters.document_date_from:
        q = q.filter(Record.document_date >= filters.document_date_from)
    if filters.document_date_to:
        q = q.filter(Record.document_date <= filters.document_date_to)

    total = q.with_entities(func.count(Record.id)).scalar() or 0

    items = (
        q.options(
            joinedload(Record.client),
            joinedload(Record.project),
            joinedload(Record.record_type),
            joinedload(Record.status),
            joinedload(Record.ai_profile),
            joinedload(Record.prepared_by_user),
            joinedload(Record.created_by_user),
            joinedload(Record.updated_by_user),
            joinedload(Record.deleted_by_user),
        )
        .order_by(Record.created_at.desc())
        .offset(filters.skip)
        .limit(filters.limit)
        .all()
    )

    return {
        "items": [_build_response_dict(x) for x in items],
        "total": int(total),
        "skip": int(filters.skip),
        "limit": int(filters.limit),
    }


def create_record(db: Session, body: RecordCreateRequest, created_by_id: str) -> dict:
    obj = Record(
        id=str(uuid.uuid4()),

        client_id=body.client_id,
        project_id=body.project_id,

        record_type_id=body.record_type_id,
        status_id=body.status_id,

        ai_profile_id=body.ai_profile_id,

        title=body.title,
        document_date=body.document_date,
        location=body.location,

        scheduled_start_time=body.scheduled_start_time,
        scheduled_end_time=body.scheduled_end_time,
        actual_start_time=body.actual_start_time,
        actual_end_time=body.actual_end_time,

        prepared_by_user_id=body.prepared_by_user_id,

        intro_snippet=body.intro_snippet,

        active_version_id=body.active_version_id,
        latest_version_num=body.latest_version_num,

        created_by=created_by_id,
        updated_by=None,
        deleted_at=None,
        deleted_by=None,
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def update_record(db: Session, record_id: str, body: RecordUpdateRequest, updated_by_id: str) -> dict:
    obj = _get_or_404(db, record_id)

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)

    obj.updated_by = updated_by_id

    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def change_record_status(db: Session, record_id: str, status_id: int, updated_by_id: str) -> dict:
    obj = _get_or_404(db, record_id)

    obj.status_id = status_id
    obj.updated_by = updated_by_id

    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def delete_record(db: Session, record_id: str, deleted_by_id: str) -> None:
    obj = _get_or_404(db, record_id)

    obj.deleted_at = datetime.utcnow()
    obj.deleted_by = deleted_by_id

    db.commit()