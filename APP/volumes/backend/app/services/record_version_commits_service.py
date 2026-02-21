# services/record_version_commits_service.py

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.record_version_commits import RecordVersionCommit
from models.record_versions import RecordVersion  # asumido existente
from schemas.record_version_commits import (
    RecordVersionCommitCreateRequest,
    RecordVersionCommitFilterRequest,
    RecordVersionCommitUpdateRequest,
)


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(u.id),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _get_or_404(db: Session, id: int) -> RecordVersionCommit:
    obj = (
        db.query(RecordVersionCommit)
        .options(
            joinedload(RecordVersionCommit.actor_user),
            joinedload(RecordVersionCommit.deleted_by_user),
            joinedload(RecordVersionCommit.record_version),
            joinedload(RecordVersionCommit.parent_version),
        )
        .filter(RecordVersionCommit.id == id)
        .filter(RecordVersionCommit.deleted_at.is_(None))
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="RECORD_VERSION_COMMIT_NOT_FOUND")
    return obj


def _check_unique_record_version_id(db: Session, record_version_id: str, exclude_id: int | None = None) -> None:
    q = db.query(RecordVersionCommit).filter(RecordVersionCommit.record_version_id == record_version_id)
    if exclude_id is not None:
        q = q.filter(RecordVersionCommit.id != exclude_id)

    exists = db.query(q.exists()).scalar()
    if exists:
        raise HTTPException(status_code=409, detail="RECORD_VERSION_ID_ALREADY_HAS_COMMIT")


def _ensure_record_version_exists(db: Session, record_version_id: str) -> None:
    exists = (
        db.query(RecordVersion.id)
        .filter(RecordVersion.id == record_version_id)
        .first()
    )
    if not exists:
        raise HTTPException(status_code=404, detail="RECORD_VERSION_NOT_FOUND")


def _build_response_dict(obj: RecordVersionCommit) -> dict[str, Any]:
    return {
        "id": int(obj.id),
        "record_version_id": str(obj.record_version_id),
        "parent_version_id": str(obj.parent_version_id) if obj.parent_version_id else None,
        "commit_title": obj.commit_title,
        "commit_body": obj.commit_body,
        "actor_user": _user_ref(obj.actor_user),
        "created_at": obj.created_at.isoformat() if getattr(obj, "created_at", None) else None,
        "deleted_at": obj.deleted_at.isoformat() if obj.deleted_at else None,
        "deleted_by": _user_ref(obj.deleted_by_user),
    }


def get_record_version_commit(db: Session, id: int) -> dict:
    obj = _get_or_404(db, id)
    return _build_response_dict(obj)


def list_record_version_commits(db: Session, filters: RecordVersionCommitFilterRequest) -> dict:
    q = db.query(RecordVersionCommit).filter(RecordVersionCommit.deleted_at.is_(None))

    if filters.record_version_id:
        q = q.filter(RecordVersionCommit.record_version_id == filters.record_version_id)
    if filters.parent_version_id:
        q = q.filter(RecordVersionCommit.parent_version_id == filters.parent_version_id)
    if filters.actor_user_id:
        q = q.filter(RecordVersionCommit.actor_user_id == filters.actor_user_id)

    total = q.with_entities(func.count(RecordVersionCommit.id)).scalar() or 0

    items = (
        q.options(
            joinedload(RecordVersionCommit.actor_user),
            joinedload(RecordVersionCommit.deleted_by_user),
            joinedload(RecordVersionCommit.record_version),
            joinedload(RecordVersionCommit.parent_version),
        )
        .order_by(RecordVersionCommit.id.desc())
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


def create_record_version_commit(
    db: Session,
    body: RecordVersionCommitCreateRequest,
    actor_user_id: str,
) -> dict:
    _ensure_record_version_exists(db, body.record_version_id)
    _check_unique_record_version_id(db, body.record_version_id, exclude_id=None)

    obj = RecordVersionCommit(
        record_version_id=body.record_version_id,
        parent_version_id=body.parent_version_id,
        commit_title=body.commit_title,
        commit_body=body.commit_body,
        actor_user_id=actor_user_id,
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def update_record_version_commit(
    db: Session,
    id: int,
    body: RecordVersionCommitUpdateRequest,
) -> dict:
    obj = _get_or_404(db, id)

    if body.parent_version_id is not None:
        obj.parent_version_id = body.parent_version_id
    if body.commit_title is not None:
        obj.commit_title = body.commit_title
    if body.commit_body is not None or body.commit_body is None:
        # permite setear explícitamente null
        obj.commit_body = body.commit_body

    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def delete_record_version_commit(db: Session, id: int, deleted_by_id: str) -> None:
    obj = _get_or_404(db, id)

    obj.deleted_at = datetime.utcnow()
    obj.deleted_by = deleted_by_id

    db.commit()