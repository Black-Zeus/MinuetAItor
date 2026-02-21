# services/record_drafts_service.py

from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.record_drafts import RecordDraft
from schemas.record_drafts import RecordDraftCreateRequest, RecordDraftFilterRequest, RecordDraftUpdateRequest


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(u.id),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _build_response_dict(obj: RecordDraft) -> dict:
    return {
        "record_id": str(obj.record_id),

        "created_at": obj.created_at.isoformat() if getattr(obj, "created_at", None) else None,
        "updated_at": obj.updated_at.isoformat() if getattr(obj, "updated_at", None) else None,

        "deleted_at": obj.deleted_at.isoformat() if obj.deleted_at else None,

        "created_by": _user_ref(getattr(obj, "created_by_user", None)),
        "updated_by": _user_ref(getattr(obj, "updated_by_user", None)),
        "deleted_by": _user_ref(getattr(obj, "deleted_by_user", None)),
    }


def _base_query(db: Session):
    return (
        db.query(RecordDraft)
        .options(
            joinedload(RecordDraft.created_by_user),
            joinedload(RecordDraft.updated_by_user),
            joinedload(RecordDraft.deleted_by_user),
        )
    )


def _get_or_404(db: Session, record_id: str) -> RecordDraft:
    obj = (
        _base_query(db)
        .filter(
            RecordDraft.record_id == record_id,
            RecordDraft.deleted_at.is_(None),
        )
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def get_record_draft(db: Session, record_id: str) -> dict:
    obj = _get_or_404(db, record_id)
    return _build_response_dict(obj)


def list_record_drafts(db: Session, filters: RecordDraftFilterRequest) -> dict:
    q = db.query(RecordDraft)

    # Por defecto: solo no eliminados
    if not filters.include_deleted:
        q = q.filter(RecordDraft.deleted_at.is_(None))

    if filters.record_id:
        q = q.filter(RecordDraft.record_id == filters.record_id)

    if filters.created_by:
        q = q.filter(RecordDraft.created_by == filters.created_by)

    if filters.updated_by:
        q = q.filter(RecordDraft.updated_by == filters.updated_by)

    total = q.with_entities(func.count(RecordDraft.record_id)).scalar() or 0

    items = (
        q.options(
            joinedload(RecordDraft.created_by_user),
            joinedload(RecordDraft.updated_by_user),
            joinedload(RecordDraft.deleted_by_user),
        )
        .order_by(RecordDraft.record_id.asc())
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


def create_record_draft(db: Session, body: RecordDraftCreateRequest, created_by_id: str) -> dict:
    # La PK es el mismo FK (record_id): no se genera UUID acá.
    existing = (
        _base_query(db)
        .filter(RecordDraft.record_id == body.record_id)
        .first()
    )

    if existing and existing.deleted_at is None:
        raise HTTPException(status_code=409, detail="RECORD_ID_ALREADY_EXISTS")

    if existing and existing.deleted_at is not None:
        # Revive draft eliminado (soft delete)
        existing.deleted_at = None
        existing.deleted_by = None
        existing.updated_by = created_by_id
        db.commit()
        db.refresh(existing)

        hydrated = _get_or_404(db, existing.record_id)
        return _build_response_dict(hydrated)

    obj = RecordDraft(
        record_id=body.record_id,
        created_by=created_by_id,
        updated_by=None,
        deleted_at=None,
        deleted_by=None,
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    hydrated = _get_or_404(db, obj.record_id)
    return _build_response_dict(hydrated)


def update_record_draft(db: Session, record_id: str, body: RecordDraftUpdateRequest, updated_by_id: str) -> dict:
    obj = _get_or_404(db, record_id)

    # No hay campos editables; se registra "touch" en updated_by/updated_at
    obj.updated_by = updated_by_id

    db.commit()
    db.refresh(obj)

    hydrated = _get_or_404(db, obj.record_id)
    return _build_response_dict(hydrated)


def delete_record_draft(db: Session, record_id: str, deleted_by_id: str) -> None:
    obj = _get_or_404(db, record_id)

    obj.deleted_at = datetime.utcnow()
    obj.deleted_by = deleted_by_id

    db.commit()