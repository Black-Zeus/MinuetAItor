# services/record_versions_service.py
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.record_versions import RecordVersion
from schemas.record_versions import (
    RecordVersionCreateRequest,
    RecordVersionFilterRequest,
    RecordVersionUpdateRequest,
)


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id":        str(getattr(u, "id")),
        "username":  getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _record_ref(r) -> dict | None:
    if not r:
        return None
    return {
        "id":    str(getattr(r, "id")),
        "title": getattr(r, "title", None),
    }


def _status_ref(s) -> dict | None:
    if not s:
        return None
    return {
        "id":   int(getattr(s, "id")),
        "code": getattr(s, "code", None),
        "name": getattr(s, "name", None),
    }


def _build_response_dict(obj: RecordVersion) -> dict:
    return {
        "id":      str(obj.id),
        "record":  _record_ref(getattr(obj, "record", None)),
        "recordId": str(obj.record_id),

        "versionNum": int(obj.version_num),

        "status":   _status_ref(getattr(obj, "status", None)),
        "statusId": int(obj.status_id),

        "publishedAt": obj.published_at.isoformat() if obj.published_at else None,
        "publishedBy": _user_ref(getattr(obj, "published_by_user", None)),

        "schemaVersion":   obj.schema_version,
        "templateVersion": obj.template_version,

        "summaryText":    obj.summary_text,
        "decisionsText":  obj.decisions_text,
        "agreementsText": obj.agreements_text,
        "risksText":      obj.risks_text,
        "nextStepsText":  obj.next_steps_text,

        "aiProvider": obj.ai_provider,
        "aiModel":    obj.ai_model,
        "aiRunId":    obj.ai_run_id,

        "createdAt": obj.created_at.isoformat() if getattr(obj, "created_at", None) else None,
        "updatedAt": obj.updated_at.isoformat() if getattr(obj, "updated_at", None) else None,

        "deletedAt": obj.deleted_at.isoformat() if obj.deleted_at else None,
        "deletedBy": _user_ref(getattr(obj, "deleted_by_user", None)),
    }


def _get_or_404(db: Session, id: str) -> RecordVersion:
    obj = (
        db.query(RecordVersion)
        .options(
            joinedload(RecordVersion.record),
            joinedload(RecordVersion.status),
            joinedload(RecordVersion.published_by_user),
            joinedload(RecordVersion.deleted_by_user),
        )
        .filter(RecordVersion.id == id, RecordVersion.deleted_at.is_(None))
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="RECORD_VERSION_NOT_FOUND")
    return obj


def _check_unique_record_num(
    db: Session, record_id: str, version_num: int, exclude_id: str | None = None
) -> None:
    q = (
        db.query(RecordVersion)
        .filter(
            RecordVersion.record_id == record_id,
            RecordVersion.version_num == version_num,
            RecordVersion.deleted_at.is_(None),
        )
    )
    if exclude_id:
        q = q.filter(RecordVersion.id != exclude_id)
    if db.query(q.exists()).scalar():
        raise HTTPException(status_code=409, detail="RECORD_VERSION_NUM_ALREADY_EXISTS")


def get_record_version(db: Session, id: str) -> dict:
    obj = _get_or_404(db, id)
    return _build_response_dict(obj)


def list_record_versions(db: Session, filters: RecordVersionFilterRequest) -> dict:
    q = db.query(RecordVersion)

    if not filters.include_deleted:
        q = q.filter(RecordVersion.deleted_at.is_(None))

    if filters.record_id:
        q = q.filter(RecordVersion.record_id == filters.record_id)
    if filters.status_id is not None:
        q = q.filter(RecordVersion.status_id == filters.status_id)
    if filters.schema_version:
        q = q.filter(RecordVersion.schema_version == filters.schema_version)
    if filters.template_version:
        q = q.filter(RecordVersion.template_version == filters.template_version)
    if filters.ai_provider:
        q = q.filter(RecordVersion.ai_provider == filters.ai_provider)
    if filters.ai_model:
        q = q.filter(RecordVersion.ai_model == filters.ai_model)
    if filters.ai_run_id:
        q = q.filter(RecordVersion.ai_run_id == filters.ai_run_id)

    total = q.with_entities(func.count(RecordVersion.id)).scalar() or 0

    items = (
        q.options(
            joinedload(RecordVersion.record),
            joinedload(RecordVersion.status),
            joinedload(RecordVersion.published_by_user),
            joinedload(RecordVersion.deleted_by_user),
        )
        .order_by(RecordVersion.published_at.desc(), RecordVersion.version_num.desc())
        .offset(filters.skip)
        .limit(filters.limit)
        .all()
    )

    return {
        "items": [_build_response_dict(x) for x in items],
        "total": int(total),
        "skip":  int(filters.skip),
        "limit": int(filters.limit),
    }


def create_record_version(
    db: Session,
    body: RecordVersionCreateRequest,
    created_by_id: str,
) -> dict:
    """
    CORRECCIÓN: published_by se toma de created_by_id (session.user_id del token),
    no del body. El body ya no expone ese campo.
    """
    _check_unique_record_num(db, body.record_id, body.version_num)

    obj = RecordVersion(
        id          = str(uuid.uuid4()),
        record_id   = body.record_id,
        version_num = int(body.version_num),
        status_id   = int(body.status_id),

        published_at = body.published_at or datetime.now(timezone.utc),
        published_by = created_by_id,   # CORRECCIÓN: deriva del token, no del body

        schema_version   = body.schema_version,
        template_version = body.template_version,

        summary_text    = body.summary_text,
        decisions_text  = body.decisions_text,
        agreements_text = body.agreements_text,
        risks_text      = body.risks_text,
        next_steps_text = body.next_steps_text,

        ai_provider = body.ai_provider,
        ai_model    = body.ai_model,
        ai_run_id   = body.ai_run_id,
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    return _build_response_dict(_get_or_404(db, obj.id))


def update_record_version(
    db: Session,
    id: str,
    body: RecordVersionUpdateRequest,
    updated_by_id: str,
) -> dict:
    obj = _get_or_404(db, id)

    if body.status_id is not None:
        obj.status_id = int(body.status_id)
    if body.published_at is not None:
        obj.published_at = body.published_at
    if body.schema_version is not None:
        obj.schema_version = body.schema_version
    if body.template_version is not None:
        obj.template_version = body.template_version
    if body.summary_text is not None:
        obj.summary_text = body.summary_text
    if body.decisions_text is not None:
        obj.decisions_text = body.decisions_text
    if body.agreements_text is not None:
        obj.agreements_text = body.agreements_text
    if body.risks_text is not None:
        obj.risks_text = body.risks_text
    if body.next_steps_text is not None:
        obj.next_steps_text = body.next_steps_text
    if body.ai_provider is not None:
        obj.ai_provider = body.ai_provider
    if body.ai_model is not None:
        obj.ai_model = body.ai_model
    if body.ai_run_id is not None:
        obj.ai_run_id = body.ai_run_id

    db.commit()
    db.refresh(obj)

    return _build_response_dict(_get_or_404(db, obj.id))


def delete_record_version(db: Session, id: str, deleted_by_id: str) -> None:
    obj = _get_or_404(db, id)
    obj.deleted_at = datetime.now(timezone.utc)
    obj.deleted_by = deleted_by_id
    db.commit()