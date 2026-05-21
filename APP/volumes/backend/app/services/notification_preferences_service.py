from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from core.datetime_utils import utc_now
from core.datetime_utils import utc_now_db
from models.roles import Role
from models.user_notification_preferences import UserNotificationPreference
from models.user_roles import UserRole
from schemas.auth import UserSession

GLOBAL_NOTIFICATION_PREF_KEY = "global.in_app"
ADMIN_ROLE_CODE = "ADMIN"

PREFERENCE_DEFINITIONS: list[dict[str, Any]] = [
    {
        "key": "minute.activity",
        "section": "minutes",
        "title": "Actividad de minutas",
        "description": "Procesamiento, observaciones, cambios de estado y PDFs de tus minutas.",
        "type_prefixes": ["minute."],
    },
    {
        "key": "access.management",
        "section": "access",
        "title": "Accesos y asignaciones",
        "description": "Altas, bajas y cambios de acceso a clientes, proyectos y ACL.",
        "type_prefixes": ["access.", "acl."],
    },
    {
        "key": "account.roles",
        "section": "account",
        "title": "Cuenta y roles",
        "description": "Cambios de cuenta, activaciones y modificaciones de roles.",
        "type_prefixes": ["team.", "rbac."],
    },
    {
        "key": "security.credentials",
        "section": "security",
        "title": "Seguridad de credenciales",
        "description": "Cambios y restablecimientos de contraseña vinculados a tu cuenta.",
        "type_prefixes": ["auth."],
    },
    {
        "key": "system.operational",
        "section": "system",
        "title": "Alertas operacionales del sistema",
        "description": "Incidentes y recuperaciones operativas del sistema. Siempre llegan a administradores.",
        "type_prefixes": ["system."],
        "audience_role_codes": [ADMIN_ROLE_CODE],
        "mandatory_role_codes": [ADMIN_ROLE_CODE],
        "always_include_role_codes": [ADMIN_ROLE_CODE],
    },
]

SECTION_DEFINITIONS: list[dict[str, str]] = [
    {
        "key": "minutes",
        "title": "Minutas",
        "description": "Eventos del ciclo de vida de minutas y artefactos asociados.",
    },
    {
        "key": "access",
        "title": "Accesos y permisos",
        "description": "Asignaciones y revocaciones que impactan tus accesos operativos.",
    },
    {
        "key": "account",
        "title": "Cuenta y roles",
        "description": "Cambios administrativos que afectan tu cuenta dentro de la plataforma.",
    },
    {
        "key": "security",
        "title": "Sistema y seguridad",
        "description": "Eventos sensibles relacionados con credenciales y seguridad personal.",
    },
    {
        "key": "system",
        "title": "Operación del sistema",
        "description": "Alertas internas reservadas para la operación administrativa.",
    },
]

PREFERENCE_DEFINITIONS_BY_KEY = {item["key"]: item for item in PREFERENCE_DEFINITIONS}


def _utcnow() -> datetime:
    return utc_now()


def _normalize_role_codes(role_codes: list[str] | None) -> set[str]:
    return {str(code or "").strip().upper() for code in role_codes or [] if str(code or "").strip()}


def _load_user_role_codes(db: Session, user_ids: list[str]) -> dict[str, set[str]]:
    if not user_ids:
        return {}

    rows = (
        db.query(UserRole.user_id, Role.code)
        .join(Role, Role.id == UserRole.role_id)
        .filter(
            UserRole.user_id.in_(user_ids),
            UserRole.deleted_at.is_(None),
            Role.deleted_at.is_(None),
            Role.is_active.is_(True),
        )
        .all()
    )

    result: dict[str, set[str]] = defaultdict(set)
    for row in rows:
        result[str(row.user_id)].add(str(row.code or "").strip().upper())
    return result


def _load_preference_rows(db: Session, user_ids: list[str]) -> dict[str, dict[str, bool]]:
    if not user_ids:
        return {}

    rows = (
        db.query(UserNotificationPreference)
        .filter(UserNotificationPreference.user_id.in_(user_ids))
        .all()
    )

    result: dict[str, dict[str, bool]] = defaultdict(dict)
    for row in rows:
        result[str(row.user_id)][str(row.preference_key)] = bool(row.is_enabled)
    return result


def resolve_preference_definition(notification_type: str | None) -> dict[str, Any] | None:
    normalized = str(notification_type or "").strip().lower()
    if not normalized:
        return None

    for definition in PREFERENCE_DEFINITIONS:
        for prefix in definition.get("type_prefixes", []):
            normalized_prefix = str(prefix or "").strip().lower()
            if normalized_prefix and normalized.startswith(normalized_prefix):
                return definition
    return None


def _is_role_eligible(definition: dict[str, Any], role_codes: set[str]) -> bool:
    audience = _normalize_role_codes(definition.get("audience_role_codes"))
    return not audience or bool(audience & role_codes)


def _is_mandatory_for_roles(definition: dict[str, Any], role_codes: set[str]) -> bool:
    mandatory_roles = _normalize_role_codes(definition.get("mandatory_role_codes"))
    return bool(mandatory_roles & role_codes)


def _item_state_for_user(
    definition: dict[str, Any],
    *,
    role_codes: set[str],
    global_enabled: bool,
    stored_enabled: bool,
) -> dict[str, Any]:
    is_eligible = _is_role_eligible(definition, role_codes)
    is_mandatory = _is_mandatory_for_roles(definition, role_codes)

    if is_mandatory:
        receives_notifications = True
        is_enabled = True
        is_editable = False
        disabled_reason = "Los administradores siempre reciben estas alertas del sistema."
    elif not is_eligible:
        receives_notifications = False
        is_enabled = False
        is_editable = False
        disabled_reason = "Disponible solo para administradores."
    else:
        receives_notifications = bool(global_enabled and stored_enabled)
        is_enabled = bool(stored_enabled)
        is_editable = True
        disabled_reason = (
            "Activa primero las notificaciones generales para volver a recibirlas."
            if not global_enabled
            else None
        )

    return {
        "key": definition["key"],
        "title": definition["title"],
        "description": definition["description"],
        "is_enabled": is_enabled,
        "is_editable": is_editable,
        "is_mandatory": is_mandatory,
        "receives_notifications": receives_notifications,
        "disabled_reason": disabled_reason,
        "type_prefixes": list(definition.get("type_prefixes", [])),
    }


def get_user_notification_preferences(db: Session, session: UserSession) -> dict[str, Any]:
    user_id = str(session.user_id)
    user_roles = _normalize_role_codes(session.roles)
    prefs_by_user = _load_preference_rows(db, [user_id])
    pref_map = prefs_by_user.get(user_id, {})
    global_enabled = bool(pref_map.get(GLOBAL_NOTIFICATION_PREF_KEY, True))

    sections_map: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for definition in PREFERENCE_DEFINITIONS:
        if not _is_role_eligible(definition, user_roles) and not _is_mandatory_for_roles(definition, user_roles):
            continue

        stored_enabled = bool(pref_map.get(definition["key"], True))
        sections_map[definition["section"]].append(
            _item_state_for_user(
                definition,
                role_codes=user_roles,
                global_enabled=global_enabled,
                stored_enabled=stored_enabled,
            )
        )

    sections: list[dict[str, Any]] = []
    total_items = 0
    for section in SECTION_DEFINITIONS:
        items = sections_map.get(section["key"], [])
        if not items:
            continue
        total_items += len(items)
        sections.append(
            {
                "key": section["key"],
                "title": section["title"],
                "description": section["description"],
                "items": items,
            }
        )

    return {
        "global_enabled": global_enabled,
        "sections": sections,
        "total_items": total_items,
    }


def update_user_notification_preferences(
    db: Session,
    session: UserSession,
    *,
    global_enabled: bool | None,
    items: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    user_id = str(session.user_id)
    user_roles = _normalize_role_codes(session.roles)
    requested_items = items or []
    now = utc_now_db()

    if global_enabled is not None:
        row = (
            db.query(UserNotificationPreference)
            .filter(
                UserNotificationPreference.user_id == user_id,
                UserNotificationPreference.preference_key == GLOBAL_NOTIFICATION_PREF_KEY,
            )
            .first()
        )
        if not row:
            row = UserNotificationPreference(
                user_id=user_id,
                preference_key=GLOBAL_NOTIFICATION_PREF_KEY,
                is_enabled=bool(global_enabled),
                created_at=now,
                updated_at=now,
            )
            db.add(row)
        else:
            row.is_enabled = bool(global_enabled)
            row.updated_at = now

    for payload in requested_items:
        key = str(payload.get("key") or "").strip()
        if not key:
            continue

        definition = PREFERENCE_DEFINITIONS_BY_KEY.get(key)
        if not definition:
            continue

        if _is_mandatory_for_roles(definition, user_roles) or not _is_role_eligible(definition, user_roles):
            continue

        is_enabled = bool(payload.get("is_enabled", True))
        row = (
            db.query(UserNotificationPreference)
            .filter(
                UserNotificationPreference.user_id == user_id,
                UserNotificationPreference.preference_key == key,
            )
            .first()
        )
        if not row:
            row = UserNotificationPreference(
                user_id=user_id,
                preference_key=key,
                is_enabled=is_enabled,
                created_at=now,
                updated_at=now,
            )
            db.add(row)
        else:
            row.is_enabled = is_enabled
            row.updated_at = now

    db.commit()
    return get_user_notification_preferences(db, session)


def apply_notification_preferences_filter(
    db: Session,
    *,
    user_ids: list[str],
    notification_type: str,
) -> list[str]:
    definition = resolve_preference_definition(notification_type)
    if not definition:
        return user_ids

    clean_user_ids = [str(user_id or "").strip() for user_id in user_ids if str(user_id or "").strip()]
    if not clean_user_ids:
        return []

    role_codes_by_user = _load_user_role_codes(db, clean_user_ids)
    prefs_by_user = _load_preference_rows(db, clean_user_ids)
    result: list[str] = []

    for user_id in clean_user_ids:
        role_codes = role_codes_by_user.get(user_id, set())
        user_prefs = prefs_by_user.get(user_id, {})

        if _is_mandatory_for_roles(definition, role_codes):
            result.append(user_id)
            continue

        if not _is_role_eligible(definition, role_codes):
            continue

        global_enabled = bool(user_prefs.get(GLOBAL_NOTIFICATION_PREF_KEY, True))
        pref_enabled = bool(user_prefs.get(definition["key"], True))

        if global_enabled and pref_enabled:
            result.append(user_id)

    return result


def expand_always_included_recipients(
    db: Session,
    *,
    user_ids: list[str],
    notification_type: str,
    resolve_role_recipient_ids,
) -> list[str]:
    definition = resolve_preference_definition(notification_type)
    if not definition:
        return user_ids

    expanded = list(user_ids or [])
    always_include_role_codes = definition.get("always_include_role_codes", [])
    if always_include_role_codes:
        expanded.extend(resolve_role_recipient_ids(db, always_include_role_codes))
    return expanded
