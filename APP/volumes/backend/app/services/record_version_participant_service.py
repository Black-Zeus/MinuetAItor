# services/record_version_participant_service.py

from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException

from models.record_version_participant import RecordVersionParticipant


def _get_or_404(db: Session, participant_id: int) -> RecordVersionParticipant:
    obj = (
        db.query(RecordVersionParticipant)
        .options(joinedload(RecordVersionParticipant.record_version))
        .filter(RecordVersionParticipant.id == participant_id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def _build_response_dict(obj: RecordVersionParticipant) -> dict:
    return {
        "id": int(obj.id),
        "record_version_id": str(obj.record_version_id),
        "role": obj.role.value if hasattr(obj.role, "value") else str(obj.role),

        "display_name": obj.display_name,
        "organization": obj.organization,
        "title": obj.title,
        "email": obj.email,

        "created_at": obj.created_at.isoformat() if getattr(obj, "created_at", None) else None,
        "updated_at": obj.updated_at.isoformat() if getattr(obj, "updated_at", None) else None,
    }


def get_record_version_participant(db: Session, participant_id: int) -> dict:
    obj = _get_or_404(db, participant_id)
    return _build_response_dict(obj)


def list_record_version_participants(db: Session, filters) -> dict:
    q = db.query(RecordVersionParticipant)

    if getattr(filters, "record_version_id", None):
        q = q.filter(RecordVersionParticipant.record_version_id == filters.record_version_id)

    if getattr(filters, "role", None):
        # role puede llegar como Enum Pydantic o str
        role_val = getattr(filters.role, "value", filters.role)
        q = q.filter(RecordVersionParticipant.role == role_val)

    if getattr(filters, "display_name", None):
        q = q.filter(RecordVersionParticipant.display_name.ilike(f"%{filters.display_name}%"))

    if getattr(filters, "email", None):
        q = q.filter(RecordVersionParticipant.email.ilike(f"%{filters.email}%"))

    total = q.with_entities(func.count(RecordVersionParticipant.id)).scalar() or 0

    items = (
        q.options(joinedload(RecordVersionParticipant.record_version))
        .order_by(RecordVersionParticipant.id.desc())
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


def create_record_version_participant(db: Session, body, created_by_id: str) -> dict:
    obj = RecordVersionParticipant(
        record_version_id=body.record_version_id,
        role=getattr(body.role, "value", body.role),
        display_name=body.display_name,
        organization=body.organization,
        title=body.title,
        email=body.email,
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def update_record_version_participant(db: Session, participant_id: int, body, updated_by_id: str) -> dict:
    obj = _get_or_404(db, participant_id)

    if body.record_version_id is not None:
        obj.record_version_id = body.record_version_id
    if body.role is not None:
        obj.role = getattr(body.role, "value", body.role)
    if body.display_name is not None:
        obj.display_name = body.display_name
    if body.organization is not None:
        obj.organization = body.organization
    if body.title is not None:
        obj.title = body.title
    if body.email is not None:
        obj.email = body.email

    db.add(obj)
    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, obj.id)
    return _build_response_dict(obj)


def delete_record_version_participant(db: Session, participant_id: int) -> None:
    obj = _get_or_404(db, participant_id)
    db.delete(obj)
    db.commit()