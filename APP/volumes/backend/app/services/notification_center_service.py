from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.notification_recipients import NotificationRecipient
from models.notifications import Notification
from models.roles import Role
from models.user_roles import UserRole
from schemas.auth import UserSession
from services.notification_center_events_service import publish_notification_event
from services.notification_preferences_service import (
    apply_notification_preferences_filter,
    expand_always_included_recipients,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def _json_dumps(value: Any) -> str | None:
    if value in (None, {}, [], ""):
        return None
    return json.dumps(value, ensure_ascii=False)


def _json_loads(value: str | None, fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return fallback


def _clean_tags(tags: list[str] | None) -> list[str]:
    seen: set[str] = set()
    clean: list[str] = []
    for item in tags or []:
        value = str(item or "").strip()
        if not value:
            continue
        key = value.casefold()
        if key in seen:
            continue
        seen.add(key)
        clean.append(value)
    return clean


def _dedupe_user_ids(user_ids: list[str] | None) -> list[str]:
    seen: set[str] = set()
    clean: list[str] = []
    for user_id in user_ids or []:
        value = str(user_id or "").strip()
        if not value or value in seen:
            continue
        seen.add(value)
        clean.append(value)
    return clean


def _dedupe_notification_ids(notification_ids: list[str] | None) -> list[str]:
    seen: set[str] = set()
    clean: list[str] = []
    for notification_id in notification_ids or []:
        value = str(notification_id or "").strip()
        if not value or value in seen:
            continue
        seen.add(value)
        clean.append(value)
    return clean


def _actor_ref(user_obj) -> dict | None:
    if not user_obj:
        return None
    return {
        "id": str(user_obj.id),
        "username": getattr(user_obj, "username", None),
        "full_name": getattr(user_obj, "full_name", None),
    }


def _build_item_response(obj: NotificationRecipient) -> dict:
    notification = obj.notification
    return {
        "id": str(notification.id),
        "notification_type": notification.notification_type,
        "level": notification.level,
        "title": notification.title,
        "message": notification.message,
        "tags": _json_loads(notification.tags_json, []),
        "scope_type": notification.scope_type,
        "scope_id": notification.scope_id,
        "action_url": notification.action_url,
        "actor": _actor_ref(getattr(notification, "actor_user", None)),
        "metadata": _json_loads(notification.metadata_json, {}),
        "created_at": _iso(notification.created_at),
        "is_read": bool(obj.is_read),
        "read_at": _iso(obj.read_at),
    }


def _base_recipient_query(db: Session):
    return (
        db.query(NotificationRecipient)
        .join(Notification, Notification.id == NotificationRecipient.notification_id)
        .options(
            joinedload(NotificationRecipient.notification).joinedload(Notification.actor_user),
        )
    )


def _apply_list_filters(query, *, user_id: str, unread_only: bool, tag: str | None):
    query = query.filter(
        NotificationRecipient.user_id == user_id,
        NotificationRecipient.is_hidden.is_(False),
    )
    if unread_only:
        query = query.filter(NotificationRecipient.is_read.is_(False))
    normalized_tag = str(tag or "").strip()
    if normalized_tag:
        query = query.filter(Notification.tags_json.like(f'%"{normalized_tag}"%'))
    return query


def _normalized_tag(tag: str | None) -> str:
    return str(tag or "").strip()


def get_unread_notifications_count(db: Session, user_id: str) -> int:
    count = (
        db.query(func.count(NotificationRecipient.id))
        .filter(
            NotificationRecipient.user_id == user_id,
            NotificationRecipient.is_hidden.is_(False),
            NotificationRecipient.is_read.is_(False),
        )
        .scalar()
        or 0
    )
    return int(count)


def list_notification_tags(db: Session, session: UserSession) -> dict:
    rows = (
        db.query(Notification.tags_json)
        .join(NotificationRecipient, NotificationRecipient.notification_id == Notification.id)
        .filter(
            NotificationRecipient.user_id == session.user_id,
            NotificationRecipient.is_hidden.is_(False),
        )
        .all()
    )

    seen: set[str] = set()
    items: list[str] = []

    for row in rows:
        for tag in _json_loads(getattr(row, "tags_json", None), []):
            value = str(tag or "").strip()
            if not value:
                continue
            key = value.casefold()
            if key in seen:
                continue
            seen.add(key)
            items.append(value)

    return {
        "items": items,
        "total": len(items),
    }


def list_notifications(
    db: Session,
    session: UserSession,
    *,
    skip: int = 0,
    limit: int = 20,
    unread_only: bool = False,
    tag: str | None = None,
) -> dict:
    normalized_tag = _normalized_tag(tag)
    query = _apply_list_filters(
        _base_recipient_query(db),
        user_id=session.user_id,
        unread_only=bool(unread_only),
        tag=normalized_tag,
    )

    total_query = db.query(func.count(NotificationRecipient.id))
    if normalized_tag:
        total_query = total_query.join(Notification, Notification.id == NotificationRecipient.notification_id)
    total = (
        _apply_list_filters(
            total_query,
            user_id=session.user_id,
            unread_only=bool(unread_only),
            tag=normalized_tag,
        ).scalar()
        or 0
    )

    items = (
        query.order_by(NotificationRecipient.created_at.desc())
        .offset(max(0, int(skip)))
        .limit(max(1, int(limit)))
        .all()
    )

    return {
        "items": [_build_item_response(item) for item in items],
        "total": int(total),
        "unread_count": get_unread_notifications_count(db, session.user_id),
        "skip": max(0, int(skip)),
        "limit": max(1, int(limit)),
    }


def get_notification_detail(db: Session, session: UserSession, notification_id: str) -> dict:
    obj = (
        _base_recipient_query(db)
        .filter(
            NotificationRecipient.user_id == session.user_id,
            NotificationRecipient.is_hidden.is_(False),
            NotificationRecipient.notification_id == notification_id,
        )
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="NOTIFICATION_NOT_FOUND")
    return _build_item_response(obj)


async def mark_notification_as_read(db: Session, session: UserSession, notification_id: str) -> dict:
    obj = (
        db.query(NotificationRecipient)
        .filter(
            NotificationRecipient.user_id == session.user_id,
            NotificationRecipient.is_hidden.is_(False),
            NotificationRecipient.notification_id == notification_id,
        )
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="NOTIFICATION_NOT_FOUND")

    if not obj.is_read:
        obj.is_read = True
        obj.read_at = _utcnow()
        db.commit()

        await publish_notification_event(
            session.user_id,
            "notification_read",
            {
                "notification_id": notification_id,
                "is_read": True,
                "read_at": _iso(obj.read_at),
            },
        )

    return {
        "notification_id": notification_id,
        "is_read": True,
        "read_at": _iso(obj.read_at),
    }


async def mark_all_notifications_as_read(db: Session, session: UserSession) -> dict:
    now = _utcnow()
    rows = (
        db.query(NotificationRecipient)
        .filter(
            NotificationRecipient.user_id == session.user_id,
            NotificationRecipient.is_hidden.is_(False),
            NotificationRecipient.is_read.is_(False),
        )
        .all()
    )

    updated = 0
    for row in rows:
        row.is_read = True
        row.read_at = now
        updated += 1

    if updated:
        db.commit()
        await publish_notification_event(
            session.user_id,
            "notifications_read_all",
            {
                "updated": updated,
                "read_at": _iso(now),
            },
        )

    return {
        "updated": updated,
        "message": "Notificaciones marcadas como leídas.",
    }


async def hide_notification(db: Session, session: UserSession, notification_id: str) -> dict:
    obj = (
        db.query(NotificationRecipient)
        .filter(
            NotificationRecipient.user_id == session.user_id,
            NotificationRecipient.notification_id == notification_id,
            NotificationRecipient.is_hidden.is_(False),
        )
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="NOTIFICATION_NOT_FOUND")

    obj.is_hidden = True
    obj.hidden_at = _utcnow()
    db.commit()
    unread_count = get_unread_notifications_count(db, session.user_id)

    await publish_notification_event(
        session.user_id,
        "notification_hidden",
        {
            "notification_id": notification_id,
            "is_hidden": True,
            "hidden_at": _iso(obj.hidden_at),
            "unread_count": unread_count,
        },
    )

    return {
        "notification_id": notification_id,
        "is_hidden": True,
        "hidden_at": _iso(obj.hidden_at),
        "unread_count": unread_count,
    }


async def clear_notifications(
    db: Session,
    session: UserSession,
    notification_ids: list[str] | None = None,
) -> dict:
    now = _utcnow()
    visible_ids = _dedupe_notification_ids(notification_ids)
    if not visible_ids:
        return {
            "hidden": 0,
            "message": "No se recibieron notificaciones visibles para limpiar.",
            "unread_count": get_unread_notifications_count(db, session.user_id),
            "notification_ids": [],
        }

    rows = (
        db.query(NotificationRecipient)
        .filter(
            NotificationRecipient.user_id == session.user_id,
            NotificationRecipient.is_hidden.is_(False),
            NotificationRecipient.notification_id.in_(visible_ids),
        )
        .all()
    )

    hidden = 0
    hidden_ids: list[str] = []
    for row in rows:
        row.is_hidden = True
        row.hidden_at = now
        hidden += 1
        hidden_ids.append(str(row.notification_id))

    unread_count = get_unread_notifications_count(db, session.user_id) if not hidden else 0

    if hidden:
        db.commit()
        unread_count = get_unread_notifications_count(db, session.user_id)
        await publish_notification_event(
            session.user_id,
            "notifications_cleared",
            {
                "hidden": hidden,
                "hidden_at": _iso(now),
                "notification_ids": hidden_ids,
                "unread_count": unread_count,
            },
        )

    return {
        "hidden": hidden,
        "message": "Bandeja limpiada.",
        "unread_count": unread_count,
        "notification_ids": hidden_ids,
    }


def _resolve_role_recipient_ids(db: Session, role_codes: list[str] | None) -> list[str]:
    normalized = [str(code or "").strip().upper() for code in role_codes or [] if str(code or "").strip()]
    if not normalized:
        return []

    rows = (
        db.query(UserRole.user_id)
        .join(Role, Role.id == UserRole.role_id)
        .filter(
            func.upper(Role.code).in_(normalized),
            Role.is_active.is_(True),
            Role.deleted_at.is_(None),
            UserRole.deleted_at.is_(None),
        )
        .all()
    )
    return [str(row.user_id) for row in rows]


async def create_in_app_notification(
    db: Session,
    *,
    notification_type: str,
    title: str,
    message: str,
    level: str = "info",
    tags: list[str] | None = None,
    recipient_user_ids: list[str] | None = None,
    role_codes: list[str] | None = None,
    scope_type: str | None = None,
    scope_id: str | None = None,
    action_url: str | None = None,
    actor_user_id: str | None = None,
    metadata: dict | None = None,
) -> dict:
    resolved_user_ids = _dedupe_user_ids(
        list(recipient_user_ids or []) + _resolve_role_recipient_ids(db, role_codes)
    )
    resolved_user_ids = _dedupe_user_ids(
        expand_always_included_recipients(
            db,
            user_ids=resolved_user_ids,
            notification_type=notification_type,
            resolve_role_recipient_ids=_resolve_role_recipient_ids,
        )
    )
    resolved_user_ids = _dedupe_user_ids(
        apply_notification_preferences_filter(
            db,
            user_ids=resolved_user_ids,
            notification_type=notification_type,
        )
    )

    if not resolved_user_ids:
        return {
            "created_notifications": 0,
            "recipient_count": 0,
            "message": "No se resolvieron destinatarios para la notificación.",
        }

    now = _utcnow()
    notification = Notification(
        id=str(uuid.uuid4()),
        notification_type=str(notification_type or "general.notice").strip()[:80],
        level=str(level or "info").strip()[:20] or "info",
        title=str(title or "Notificación").strip()[:200],
        message=str(message or "").strip()[:2000],
        tags_json=_json_dumps(_clean_tags(tags)),
        scope_type=str(scope_type or "").strip()[:80] or None,
        scope_id=str(scope_id or "").strip()[:64] or None,
        action_url=str(action_url or "").strip()[:255] or None,
        actor_user_id=actor_user_id,
        metadata_json=_json_dumps(metadata or {}),
        created_at=now,
    )
    db.add(notification)
    db.flush()

    for user_id in resolved_user_ids:
        db.add(
            NotificationRecipient(
                id=str(uuid.uuid4()),
                notification_id=notification.id,
                user_id=user_id,
                is_read=False,
                read_at=None,
                delivered_at=now,
                created_at=now,
            )
        )

    db.commit()

    persisted = (
        _base_recipient_query(db)
        .filter(
            NotificationRecipient.notification_id == notification.id,
            NotificationRecipient.user_id.in_(resolved_user_ids),
        )
        .all()
    )

    items_by_user = {
        str(item.user_id): _build_item_response(item)
        for item in persisted
    }

    for user_id in resolved_user_ids:
        payload = items_by_user.get(user_id)
        if not payload:
            continue
        await publish_notification_event(
            user_id,
            "notification_created",
            {
                "notification": payload,
                "unread_count": get_unread_notifications_count(db, user_id),
            },
        )

    return {
        "created_notifications": 1,
        "recipient_count": len(resolved_user_ids),
        "message": "Notificación creada correctamente.",
    }
