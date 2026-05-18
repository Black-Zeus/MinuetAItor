from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.dashboard_widgets import DashboardWidget
from models.user_dashboard_widgets import UserDashboardWidget
from models.user_profiles import UserProfile

DEFAULT_THEME = "light"
DEFAULT_DENSITY = "comfortable"
DEFAULT_ANIMATIONS = True
DEFAULT_SIDEBAR_COLLAPSED = False

ALLOWED_THEMES = {"light", "dark", "system"}
ALLOWED_DENSITIES = {"comfortable", "compact"}

DEFAULT_WIDGETS: list[dict[str, Any]] = [
    {"code": "stats", "enabled": True, "sort_order": 1},
    {"code": "ultima_conexion", "enabled": True, "sort_order": 2},
    {"code": "minutas_pendientes", "enabled": True, "sort_order": 3},
    {"code": "minutas_participadas", "enabled": True, "sort_order": 4},
    {"code": "clientes_confidenciales", "enabled": True, "sort_order": 5},
    {"code": "proyectos_confidenciales", "enabled": True, "sort_order": 6},
    {"code": "tags_populares", "enabled": True, "sort_order": 7},
]
DEFAULT_WIDGETS_BY_CODE = {item["code"]: item for item in DEFAULT_WIDGETS}


def _normalize_theme(value: str | None) -> str:
    normalized = str(value or "").strip().lower()
    return normalized if normalized in ALLOWED_THEMES else DEFAULT_THEME


def _normalize_density(value: str | None) -> str:
    normalized = str(value or "").strip().lower()
    return normalized if normalized in ALLOWED_DENSITIES else DEFAULT_DENSITY


def _load_profile(db: Session, user_id: str) -> UserProfile | None:
    return db.query(UserProfile).filter(UserProfile.user_id == user_id).first()


def _ensure_profile(db: Session, user_id: str) -> UserProfile:
    profile = _load_profile(db, user_id)
    if profile:
        return profile

    profile = UserProfile(user_id=user_id)
    db.add(profile)
    db.flush()
    return profile


def _load_widget_catalog(db: Session) -> dict[str, DashboardWidget]:
    rows = (
        db.query(DashboardWidget)
        .filter(
            DashboardWidget.deleted_at.is_(None),
            DashboardWidget.is_active.is_(True),
        )
        .all()
    )
    return {str(row.code): row for row in rows if getattr(row, "code", None)}


def _widget_sort_key(widget_code: str, sort_order: int | None) -> tuple[int, int, str]:
    default_sort = DEFAULT_WIDGETS_BY_CODE.get(widget_code, {}).get("sort_order", 999)
    effective_sort = int(sort_order) if sort_order is not None else int(default_sort)
    return (effective_sort, default_sort, widget_code)


def _build_dashboard_widgets(
    db: Session,
    user_id: str,
) -> list[dict[str, Any]]:
    catalog = _load_widget_catalog(db)
    stored_rows = (
        db.query(UserDashboardWidget, DashboardWidget.code)
        .join(DashboardWidget, DashboardWidget.id == UserDashboardWidget.widget_id)
        .filter(
            UserDashboardWidget.user_id == user_id,
            UserDashboardWidget.deleted_at.is_(None),
            DashboardWidget.deleted_at.is_(None),
            DashboardWidget.is_active.is_(True),
        )
        .all()
    )

    stored_by_code: dict[str, UserDashboardWidget] = {}
    for row, code in stored_rows:
        normalized_code = str(code or "").strip()
        if normalized_code:
            stored_by_code[normalized_code] = row

    widget_codes = list(DEFAULT_WIDGETS_BY_CODE.keys())
    for code in catalog.keys():
        if code not in DEFAULT_WIDGETS_BY_CODE:
            widget_codes.append(code)

    widgets: list[dict[str, Any]] = []
    for code in widget_codes:
        if code not in catalog:
            continue
        default = DEFAULT_WIDGETS_BY_CODE.get(code, {})
        stored = stored_by_code.get(code)
        widgets.append(
            {
                "code": code,
                "enabled": bool(stored.enabled) if stored else bool(default.get("enabled", True)),
                "sort_order": (
                    int(stored.sort_order)
                    if stored and stored.sort_order is not None
                    else default.get("sort_order")
                ),
            }
        )

    widgets.sort(key=lambda item: _widget_sort_key(item["code"], item.get("sort_order")))
    return widgets


def get_user_personalization(db: Session, user_id: str) -> dict[str, Any]:
    profile = _load_profile(db, user_id)

    return {
        "theme": _normalize_theme(getattr(profile, "theme", None)),
        "density": _normalize_density(getattr(profile, "ui_density", None)),
        "animations": bool(
            DEFAULT_ANIMATIONS if getattr(profile, "ui_animations", None) is None else profile.ui_animations
        ),
        "sidebar_collapsed": bool(
            DEFAULT_SIDEBAR_COLLAPSED
            if getattr(profile, "sidebar_collapsed", None) is None
            else profile.sidebar_collapsed
        ),
        "dashboard_widgets": _build_dashboard_widgets(db, user_id),
    }


def update_user_personalization(
    db: Session,
    *,
    user_id: str,
    theme: str | None,
    density: str | None,
    animations: bool | None,
    sidebar_collapsed: bool | None,
    dashboard_widgets: list[dict[str, Any]] | None,
    actor_user_id: str | None = None,
) -> dict[str, Any]:
    profile = _ensure_profile(db, user_id)

    if theme is not None:
        profile.theme = _normalize_theme(theme)
    if density is not None:
        profile.ui_density = _normalize_density(density)
    if animations is not None:
        profile.ui_animations = bool(animations)
    if sidebar_collapsed is not None:
        profile.sidebar_collapsed = bool(sidebar_collapsed)

    if dashboard_widgets:
        catalog = _load_widget_catalog(db)
        existing_rows = (
            db.query(UserDashboardWidget, DashboardWidget.code)
            .join(DashboardWidget, DashboardWidget.id == UserDashboardWidget.widget_id)
            .filter(
                UserDashboardWidget.user_id == user_id,
                DashboardWidget.deleted_at.is_(None),
            )
            .all()
        )

        existing_by_code: dict[str, UserDashboardWidget] = {}
        for row, code in existing_rows:
            normalized_code = str(code or "").strip()
            if normalized_code:
                existing_by_code[normalized_code] = row

        for item in dashboard_widgets:
            code = str(item.get("code") or "").strip()
            if not code:
                continue

            widget_catalog_row = catalog.get(code)
            if not widget_catalog_row:
                raise HTTPException(status_code=422, detail=f"WIDGET_CODE_NOT_SUPPORTED:{code}")

            row = existing_by_code.get(code)
            if not row:
                row = UserDashboardWidget(
                    user_id=user_id,
                    widget_id=int(widget_catalog_row.id),
                    created_by=actor_user_id,
                )
                db.add(row)
                existing_by_code[code] = row

            row.enabled = bool(item.get("enabled", True))
            sort_order = item.get("sort_order")
            row.sort_order = int(sort_order) if sort_order is not None else None
            row.updated_by = actor_user_id
            row.deleted_at = None
            row.deleted_by = None

    db.commit()
    return get_user_personalization(db, user_id)
