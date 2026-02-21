# services/user_dashboard_widgets_service.py
from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.user_dashboard_widgets import UserDashboardWidget
from schemas.user_dashboard_widgets import (
    UserDashboardWidgetCreateRequest,
    UserDashboardWidgetUpdateRequest,
    UserDashboardWidgetFilterRequest,
)


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(getattr(u, "id", None)),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _widget_ref(w) -> dict | None:
    if not w:
        return None
    return {
        "id": int(getattr(w, "id", 0)),
        "code": getattr(w, "code", None),
        "name": getattr(w, "name", None),
    }


def _build_response_dict(obj: UserDashboardWidget) -> dict[str, Any]:
    return {
        "user_id": str(obj.user_id),
        "widget_id": int(obj.widget_id),
        "enabled": bool(obj.enabled),
        "sort_order": int(obj.sort_order) if obj.sort_order is not None else None,
        "user": _user_ref(obj.user),
        "widget": _widget_ref(obj.widget),
        "created_at": obj.created_at.isoformat() if getattr(obj, "created_at", None) else None,
        "updated_at": obj.updated_at.isoformat() if getattr(obj, "updated_at", None) else None,
        "created_by": _user_ref(obj.created_by_user),
        "updated_by": _user_ref(obj.updated_by_user),
        "deleted_at": obj.deleted_at.isoformat() if obj.deleted_at else None,
        "deleted_by": _user_ref(obj.deleted_by_user),
    }


def _get_or_404(db: Session, user_id: str, widget_id: int) -> UserDashboardWidget:
    obj = (
        db.query(UserDashboardWidget)
        .options(
            joinedload(UserDashboardWidget.user),
            joinedload(UserDashboardWidget.widget),
            joinedload(UserDashboardWidget.created_by_user),
            joinedload(UserDashboardWidget.updated_by_user),
            joinedload(UserDashboardWidget.deleted_by_user),
        )
        .filter(
            UserDashboardWidget.user_id == user_id,
            UserDashboardWidget.widget_id == widget_id,
            UserDashboardWidget.deleted_at.is_(None),
        )
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def _check_exists_active(db: Session, user_id: str, widget_id: int) -> None:
    exists = (
        db.query(UserDashboardWidget)
        .filter(
            UserDashboardWidget.user_id == user_id,
            UserDashboardWidget.widget_id == widget_id,
            UserDashboardWidget.deleted_at.is_(None),
        )
        .first()
    )
    if exists:
        raise HTTPException(status_code=409, detail="RELATION_ALREADY_EXISTS")


def get_user_dashboard_widget(db: Session, user_id: str, widget_id: int) -> dict[str, Any]:
    obj = _get_or_404(db, user_id, widget_id)
    return _build_response_dict(obj)


def list_user_dashboard_widgets(db: Session, filters: UserDashboardWidgetFilterRequest) -> dict[str, Any]:
    q = db.query(UserDashboardWidget).filter(UserDashboardWidget.deleted_at.is_(None))

    if filters.user_id:
        q = q.filter(UserDashboardWidget.user_id == filters.user_id)
    if filters.widget_id is not None:
        q = q.filter(UserDashboardWidget.widget_id == filters.widget_id)
    if filters.enabled is not None:
        q = q.filter(UserDashboardWidget.enabled == filters.enabled)

    total = q.with_entities(func.count()).scalar() or 0

    items = (
        q.options(
            joinedload(UserDashboardWidget.user),
            joinedload(UserDashboardWidget.widget),
            joinedload(UserDashboardWidget.created_by_user),
            joinedload(UserDashboardWidget.updated_by_user),
            joinedload(UserDashboardWidget.deleted_by_user),
        )
        .order_by(UserDashboardWidget.user_id.asc(), UserDashboardWidget.sort_order.asc(), UserDashboardWidget.widget_id.asc())
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


def create_user_dashboard_widget(
    db: Session,
    body: UserDashboardWidgetCreateRequest,
    created_by_id: str,
) -> dict[str, Any]:
    _check_exists_active(db, body.user_id, int(body.widget_id))

    obj = UserDashboardWidget(
        user_id=body.user_id,
        widget_id=int(body.widget_id),
        enabled=bool(body.enabled),
        sort_order=int(body.sort_order) if body.sort_order is not None else None,
        created_by=created_by_id,
        updated_by=created_by_id,
    )

    db.add(obj)
    db.commit()

    obj2 = _get_or_404(db, obj.user_id, int(obj.widget_id))
    return _build_response_dict(obj2)


def update_user_dashboard_widget(
    db: Session,
    user_id: str,
    widget_id: int,
    body: UserDashboardWidgetUpdateRequest,
    updated_by_id: str,
) -> dict[str, Any]:
    obj = _get_or_404(db, user_id, widget_id)

    if body.enabled is not None:
        obj.enabled = bool(body.enabled)
    if body.sort_order is not None or body.sort_order is None:
        # Permite setear NULL explícitamente
        obj.sort_order = int(body.sort_order) if body.sort_order is not None else None

    obj.updated_by = updated_by_id

    db.commit()

    obj2 = _get_or_404(db, obj.user_id, int(obj.widget_id))
    return _build_response_dict(obj2)


def change_user_dashboard_widget_status(
    db: Session,
    user_id: str,
    widget_id: int,
    enabled: bool,
    updated_by_id: str,
) -> dict[str, Any]:
    obj = _get_or_404(db, user_id, widget_id)
    obj.enabled = bool(enabled)
    obj.updated_by = updated_by_id

    db.commit()

    obj2 = _get_or_404(db, obj.user_id, int(obj.widget_id))
    return _build_response_dict(obj2)


def delete_user_dashboard_widget(
    db: Session,
    user_id: str,
    widget_id: int,
    deleted_by_id: str,
) -> None:
    obj = _get_or_404(db, user_id, widget_id)

    obj.deleted_at = datetime.utcnow()
    obj.deleted_by = deleted_by_id
    obj.enabled = False
    obj.updated_by = deleted_by_id

    db.commit()
    return None