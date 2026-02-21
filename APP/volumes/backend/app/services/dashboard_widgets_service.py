# services/dashboard_widgets_service.py

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.dashboard_widgets import DashboardWidget
from schemas.dashboard_widgets import (
    DashboardWidgetCreateRequest,
    DashboardWidgetFilterRequest,
    DashboardWidgetUpdateRequest,
)


def _user_ref(u) -> dict | None:
    if not u:
        return None
    return {
        "id": str(getattr(u, "id")),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _get_or_404(db: Session, id: int) -> DashboardWidget:
    q = (
        db.query(DashboardWidget)
        .options(
            joinedload(DashboardWidget.created_by_user),
            joinedload(DashboardWidget.updated_by_user),
            joinedload(DashboardWidget.deleted_by_user),
        )
        .filter(DashboardWidget.id == id)
        .filter(DashboardWidget.deleted_at.is_(None))
    )

    obj = q.first()
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def _check_unique_code(db: Session, code: str, exclude_id: int | None = None) -> None:
    q = db.query(DashboardWidget).filter(DashboardWidget.code == code).filter(DashboardWidget.deleted_at.is_(None))
    if exclude_id is not None:
        q = q.filter(DashboardWidget.id != exclude_id)

    exists = q.with_entities(DashboardWidget.id).first()
    if exists:
        raise HTTPException(status_code=409, detail="CODE_ALREADY_EXISTS")


def _build_response_dict(obj: DashboardWidget) -> dict[str, Any]:
    return {
        "id": int(obj.id),
        "code": obj.code,
        "name": obj.name,
        "description": obj.description,
        "is_active": bool(obj.is_active),
        "created_at": obj.created_at.isoformat() if getattr(obj, "created_at", None) else None,
        "updated_at": obj.updated_at.isoformat() if getattr(obj, "updated_at", None) else None,
        "created_by": _user_ref(getattr(obj, "created_by_user", None)),
        "updated_by": _user_ref(getattr(obj, "updated_by_user", None)),
        "deleted_at": obj.deleted_at.isoformat() if obj.deleted_at else None,
        "deleted_by": _user_ref(getattr(obj, "deleted_by_user", None)),
    }


def get_dashboard_widget(db: Session, id: int) -> dict[str, Any]:
    obj = _get_or_404(db, id)
    return _build_response_dict(obj)


def list_dashboard_widgets(db: Session, filters: DashboardWidgetFilterRequest) -> dict[str, Any]:
    q = db.query(DashboardWidget).filter(DashboardWidget.deleted_at.is_(None))

    if filters.is_active is not None:
        q = q.filter(DashboardWidget.is_active.is_(bool(filters.is_active)))

    if filters.code:
        q = q.filter(DashboardWidget.code.ilike(f"%{filters.code}%"))

    if filters.name:
        q = q.filter(DashboardWidget.name.ilike(f"%{filters.name}%"))

    total = q.with_entities(func.count(DashboardWidget.id)).scalar() or 0

    items = (
        q.options(
            joinedload(DashboardWidget.created_by_user),
            joinedload(DashboardWidget.updated_by_user),
            joinedload(DashboardWidget.deleted_by_user),
        )
        .order_by(DashboardWidget.id.asc())
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


def create_dashboard_widget(
    db: Session,
    body: DashboardWidgetCreateRequest,
    created_by_id: str,
) -> dict[str, Any]:
    _check_unique_code(db, body.code, exclude_id=None)

    obj = DashboardWidget(
        code=body.code,
        name=body.name,
        description=body.description,
        is_active=bool(body.is_active),
        created_by=created_by_id,
        updated_by=created_by_id,
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, int(obj.id))
    return _build_response_dict(obj)


def update_dashboard_widget(
    db: Session,
    id: int,
    body: DashboardWidgetUpdateRequest,
    updated_by_id: str,
) -> dict[str, Any]:
    obj = _get_or_404(db, id)

    if body.code is not None and body.code != obj.code:
        _check_unique_code(db, body.code, exclude_id=id)
        obj.code = body.code

    if body.name is not None:
        obj.name = body.name

    if body.description is not None:
        obj.description = body.description

    if body.is_active is not None:
        obj.is_active = bool(body.is_active)

    obj.updated_by = updated_by_id

    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, id)
    return _build_response_dict(obj)


def change_dashboard_widget_status(db: Session, id: int, is_active: bool, updated_by_id: str) -> dict[str, Any]:
    obj = _get_or_404(db, id)
    obj.is_active = bool(is_active)
    obj.updated_by = updated_by_id

    db.commit()
    db.refresh(obj)

    obj = _get_or_404(db, id)
    return _build_response_dict(obj)


def delete_dashboard_widget(db: Session, id: int, deleted_by_id: str) -> None:
    obj = _get_or_404(db, id)

    obj.deleted_at = datetime.utcnow()
    obj.deleted_by = deleted_by_id
    obj.is_active = False

    db.commit()
