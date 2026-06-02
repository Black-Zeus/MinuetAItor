from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session, joinedload

from core.datetime_utils import utc_now_db
from models.ai_context_settings import AiContextSetting
from schemas.ai_context_settings import AiContextSettingsRequest

AI_CONTEXT_SETTINGS_SINGLETON_ID = 1

DEFAULT_AI_CONTEXT_SETTINGS = {
    "context_ai_enabled": False,
    "query_enabled": False,
    "indexing_enabled": False,
    "sync_enabled": False,
}


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def _user_ref(user) -> dict | None:
    if not user:
        return None
    return {
        "id": user.id,
        "username": getattr(user, "username", None),
        "full_name": getattr(user, "full_name", None),
    }


def _base_query(db: Session):
    return (
        db.query(AiContextSetting)
        .options(
            joinedload(AiContextSetting.created_by_user),
            joinedload(AiContextSetting.updated_by_user),
        )
    )


def _build_response(obj: AiContextSetting) -> dict:
    return {
        "id": obj.id,
        "context_ai_enabled": bool(obj.context_ai_enabled),
        "query_enabled": bool(obj.query_enabled),
        "indexing_enabled": bool(obj.indexing_enabled),
        "sync_enabled": bool(obj.sync_enabled),
        "created_at": _iso(obj.created_at),
        "updated_at": _iso(obj.updated_at),
        "created_by": _user_ref(obj.created_by_user),
        "updated_by": _user_ref(obj.updated_by_user),
    }


def _get_singleton(db: Session, *, actor_user_id: str | None = None) -> AiContextSetting:
    obj = _base_query(db).filter(AiContextSetting.id == AI_CONTEXT_SETTINGS_SINGLETON_ID).first()
    if obj:
        return obj

    now = utc_now_db()
    obj = AiContextSetting(
        id=AI_CONTEXT_SETTINGS_SINGLETON_ID,
        created_at=now,
        updated_at=now,
        created_by=actor_user_id,
        updated_by=actor_user_id,
        **DEFAULT_AI_CONTEXT_SETTINGS,
    )
    db.add(obj)
    db.commit()
    return _base_query(db).filter(AiContextSetting.id == AI_CONTEXT_SETTINGS_SINGLETON_ID).first()


def get_ai_context_settings(db: Session) -> dict:
    return _build_response(_get_singleton(db))


def get_ai_context_availability(db: Session) -> dict:
    obj = _get_singleton(db)
    context_ai_enabled = bool(obj.context_ai_enabled)
    query_enabled = bool(obj.query_enabled)
    return {
        "context_ai_enabled": context_ai_enabled,
        "query_enabled": query_enabled,
        "available": bool(context_ai_enabled and query_enabled),
    }


def update_ai_context_settings(
    db: Session,
    body: AiContextSettingsRequest,
    *,
    updated_by_id: str,
) -> dict:
    obj = _get_singleton(db, actor_user_id=updated_by_id)
    now = utc_now_db()

    obj.context_ai_enabled = body.context_ai_enabled
    obj.query_enabled = body.query_enabled
    obj.indexing_enabled = body.indexing_enabled
    obj.sync_enabled = body.sync_enabled
    if not obj.created_by:
        obj.created_by = updated_by_id
    obj.updated_by = updated_by_id
    obj.updated_at = now

    db.commit()
    return _build_response(
        _base_query(db).filter(AiContextSetting.id == AI_CONTEXT_SETTINGS_SINGLETON_ID).first()
    )


def is_ai_context_enabled(db: Session) -> bool:
    obj = _get_singleton(db)
    return bool(obj.context_ai_enabled)


def is_ai_context_query_enabled(db: Session) -> bool:
    obj = _get_singleton(db)
    return bool(obj.context_ai_enabled and obj.query_enabled)


def is_ai_context_indexing_enabled(db: Session) -> bool:
    obj = _get_singleton(db)
    return bool(obj.context_ai_enabled and obj.indexing_enabled)


def is_ai_context_sync_enabled(db: Session) -> bool:
    obj = _get_singleton(db)
    return bool(obj.context_ai_enabled and obj.sync_enabled)
