from __future__ import annotations

import uuid
from datetime import timezone
from typing import Any
from urllib.parse import urlencode

from fastapi import HTTPException, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from core.datetime_utils import utc_now_db
from models.access_requests import AccessRequest
from models.roles import Role
from models.system_maintenance_setting import SystemMaintenanceSetting
from models.user import User
from models.user_roles import UserRole
from schemas.access_requests import AccessRequestCreateRequest
from services.email_branding_service import build_email_branding_bundle
from services.email_queue import queue_templated_email
from services.notification_center_service import create_in_app_notification
from services.public_url_service import build_public_url

SYSTEM_MAINTENANCE_SINGLETON_ID = 1


def is_access_request_enabled(db: Session) -> bool:
    try:
        settings = (
            db.query(SystemMaintenanceSetting)
            .filter(SystemMaintenanceSetting.id == SYSTEM_MAINTENANCE_SINGLETON_ID)
            .first()
        )
    except Exception:
        return False
    if settings is None:
        return True
    return bool(getattr(settings, "access_request_enabled", True))


def _client_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    forwarded = str(request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    return forwarded or (request.client.host if request.client else None)


def _user_agent(request: Request | None) -> str | None:
    if request is None:
        return None
    return str(request.headers.get("user-agent") or "").strip()[:500] or None


def _admin_emails(db: Session) -> list[str]:
    rows = (
        db.query(User.email)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .filter(
            func.upper(Role.code) == "ADMIN",
            Role.is_active.is_(True),
            Role.deleted_at.is_(None),
            UserRole.deleted_at.is_(None),
            User.deleted_at.is_(None),
            User.is_active.is_(True),
            User.email.isnot(None),
        )
        .distinct()
        .all()
    )
    emails: list[str] = []
    seen: set[str] = set()
    for row in rows:
        email = str(getattr(row, "email", "") or "").strip()
        key = email.casefold()
        if email and key not in seen:
            seen.add(key)
            emails.append(email)
    return emails


def _teams_prefill_path(access_request: AccessRequest, *, include_notes: bool = True) -> str:
    payload = {
        "accessRequestId": access_request.id,
        "name": access_request.full_name,
        "email": access_request.email,
    }
    if include_notes:
        payload["notes"] = access_request.observation or ""
    params = urlencode(payload)
    return f"/teams?{params}"


def _teams_prefill_url(db: Session, access_request: AccessRequest) -> str:
    return build_public_url(db, _teams_prefill_path(access_request))


def _format_created_at(access_request: AccessRequest) -> str:
    value = access_request.created_at
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _template_context(db: Session, access_request: AccessRequest, teams_url: str) -> tuple[dict[str, Any], list[Any]]:
    branding = build_email_branding_bundle(db, include_organization_logo=True, include_client_logo=False)
    requested_at = _format_created_at(access_request)
    context = {
        **branding.context,
        "REQUESTER_NAME": access_request.full_name,
        "REQUESTER_EMAIL": access_request.email,
        "REQUEST_OBSERVATION": access_request.observation or "Sin observación registrada.",
        "REQUEST_SOURCE": access_request.source or "login",
        "REQUESTED_AT": requested_at,
        "ISSUED_AT": requested_at,
        "REQUEST_ID": access_request.id,
        "TEAMS_URL": teams_url,
    }
    return context, branding.inline_assets


async def _notify_access_request(db: Session, access_request: AccessRequest) -> dict[str, Any]:
    teams_path = _teams_prefill_path(access_request, include_notes=False)
    teams_url = _teams_prefill_url(db, access_request)
    template_context, inline_assets = _template_context(db, access_request, teams_url)

    await create_in_app_notification(
        db,
        notification_type="access.request.created",
        title="Nueva solicitud de alta",
        message=f"{access_request.full_name} solicitó acceso a MinuetAItor.",
        level="info",
        tags=["access", "team", "access.request.created"],
        role_codes=["ADMIN"],
        scope_type="access_request",
        scope_id=access_request.id,
        action_url=teams_path,
        metadata={
            "accessRequestId": access_request.id,
            "fullName": access_request.full_name,
            "email": access_request.email,
            "observation": access_request.observation,
        },
    )

    mail_result = {"adminMailQueued": False, "requesterMailQueued": False}
    admin_emails = _admin_emails(db)
    if admin_emails:
        try:
            await queue_templated_email(
                to=admin_emails,
                template_id="access_request_admin",
                template_context=template_context,
                inline_assets=inline_assets,
                notification_context={
                    "kind": "access_request_admin",
                    "access_request_id": access_request.id,
                },
            )
            mail_result["adminMailQueued"] = True
        except Exception:
            pass

    try:
        await queue_templated_email(
            to=[access_request.email],
            template_id="access_request_ack",
            template_context=template_context,
            inline_assets=inline_assets,
            notification_context={
                "kind": "access_request_ack",
                "access_request_id": access_request.id,
            },
        )
        mail_result["requesterMailQueued"] = True
    except Exception:
        pass

    return mail_result


async def create_access_request(
    db: Session,
    payload: AccessRequestCreateRequest,
    request: Request | None = None,
) -> dict[str, Any]:
    if not is_access_request_enabled(db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La solicitud de alta no está habilitada actualmente.",
        )

    now = utc_now_db()
    access_request = AccessRequest(
        id=str(uuid.uuid4()),
        full_name=payload.full_name,
        email=str(payload.email).strip().lower(),
        observation=payload.observation,
        status="pending",
        source="login",
        request_ip=_client_ip(request),
        request_user_agent=_user_agent(request),
        created_at=now,
        updated_at=now,
    )
    db.add(access_request)
    db.commit()
    db.refresh(access_request)

    await _notify_access_request(db, access_request)

    return {
        "id": access_request.id,
        "status": access_request.status,
        "message": "Solicitud recibida. Un administrador la revisará próximamente.",
    }
