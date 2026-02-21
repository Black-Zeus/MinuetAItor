# services/ai_tag_conversions_service.py

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.ai_tag_conversions import AiTagConversion


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(u.id),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _get_or_404(db: Session, ai_tag_id: str, tag_id: str) -> AiTagConversion:
    obj = (
        db.query(AiTagConversion)
        .options(
            joinedload(AiTagConversion.ai_tag),
            joinedload(AiTagConversion.tag),
            joinedload(AiTagConversion.converted_by_user),
        )
        .filter(
            AiTagConversion.ai_tag_id == ai_tag_id,
            AiTagConversion.tag_id == tag_id,
        )
        .first()
    )

    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def _build_response_dict(obj: AiTagConversion) -> dict:
    return {
        "ai_tag_id": str(obj.ai_tag_id),
        "tag_id": str(obj.tag_id),
        "converted_at": obj.converted_at,
        "converted_by": _user_ref(obj.converted_by_user),
    }


def get_ai_tag_conversion(db: Session, ai_tag_id: str, tag_id: str) -> dict:
    obj = _get_or_404(db, ai_tag_id, tag_id)
    return _build_response_dict(obj)


def list_ai_tag_conversions(db: Session, filters) -> dict:
    q = db.query(AiTagConversion)

    if getattr(filters, "ai_tag_id", None):
        q = q.filter(AiTagConversion.ai_tag_id == filters.ai_tag_id)

    if getattr(filters, "tag_id", None):
        q = q.filter(AiTagConversion.tag_id == filters.tag_id)

    if getattr(filters, "converted_by_id", None):
        q = q.filter(AiTagConversion.converted_by == filters.converted_by_id)

    total = q.with_entities(func.count(func.literal_column("*"))).scalar() or 0

    items = (
        q.options(
            joinedload(AiTagConversion.ai_tag),
            joinedload(AiTagConversion.tag),
            joinedload(AiTagConversion.converted_by_user),
        )
        .order_by(AiTagConversion.converted_at.desc())
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


def create_ai_tag_conversion(db: Session, body, created_by_id: str) -> dict:
    # Si ya existe, conflicto por PK compuesta.
    exists = (
        db.query(AiTagConversion)
        .filter(
            AiTagConversion.ai_tag_id == body.ai_tag_id,
            AiTagConversion.tag_id == body.tag_id,
        )
        .first()
    )
    if exists:
        raise HTTPException(status_code=409, detail="AI_TAG_CONVERSION_ALREADY_EXISTS")

    obj = AiTagConversion(
        ai_tag_id=body.ai_tag_id,
        tag_id=body.tag_id,
        converted_by=created_by_id,  # FK converted_by
    )

    db.add(obj)
    db.commit()

    obj = _get_or_404(db, body.ai_tag_id, body.tag_id)
    return _build_response_dict(obj)


def update_ai_tag_conversion(db: Session, ai_tag_id: str, tag_id: str, body, updated_by_id: str) -> dict:
    obj = _get_or_404(db, ai_tag_id, tag_id)

    # Único campo mutable razonable en esta tabla: converted_by
    if body.converted_by_id is not None:
        obj.converted_by = body.converted_by_id

    # Si el frontend manda null explícito, se permite limpiar el campo:
    if body.converted_by_id is None:
        # Nota: esto también se ejecuta cuando no viene el campo.
        # Para diferenciar "no viene" vs "viene null", Pydantic v2 requiere extra metadata.
        # En este patrón, aceptamos que UpdateRequest siempre incluye el campo opcional.
        pass

    # En cualquier caso, si deseas forzar siempre "quién actualiza":
    obj.converted_by = updated_by_id if body.converted_by_id is None else obj.converted_by

    db.commit()

    obj = _get_or_404(db, ai_tag_id, tag_id)
    return _build_response_dict(obj)


def delete_ai_tag_conversion(db: Session, ai_tag_id: str, tag_id: str) -> None:
    obj = _get_or_404(db, ai_tag_id, tag_id)
    db.delete(obj)
    db.commit()
    return None