from __future__ import annotations

import json
from datetime import datetime, time
from typing import Any

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from models.audit_logs import AuditLog
from models.clients import Client
from models.email_delivery_events import EmailDeliveryEvent
from models.projects import Project
from models.record_version_observation import RecordVersionObservation
from models.records import Record
from models.user import User
from models.user_sessions import UserSession
from models.visitor_access_request import VisitorAccessRequest
from models.visitor_session import VisitorSession
from schemas.audit_reports import AuditReportRequest, AuditReportResponse, AuditReportRow


ACTION_LABELS = {
    "LOGIN_SESSION": "Inicio de sesión",
    "LOGOUT_SESSION": "Cierre remoto de sesión",
    "LOGOUT_ALL_OTHER_SESSIONS": "Cierre de otras sesiones",
    "CHANGE_PASSWORD_BY_ADMIN": "Cambio de contraseña por administración",
    "GROUP_BY_ENTITY": "Agrupación por entidad",
    "GROUP_BY_ACTOR": "Agrupación por actor",
    "GROUP_BY_PERIOD": "Agrupación por período",
    "EMAIL_DELIVERY": "Envío de correo",
    "OTP_REQUEST": "Solicitud OTP",
    "GUEST_SESSION": "Sesión de invitado",
    "EXTERNAL_OBSERVATION": "Observación externa",
    "EXTERNAL_ACCESS_SUMMARY": "Actividad externa por minuta",
}

ENTITY_LABELS = {
    "user": "Usuario",
    "user_session": "Sesión de usuario",
    "audit_log": "Bitácora de auditoría",
    "email_delivery": "Correo del sistema",
    "visitor_access_request": "Solicitud OTP",
    "visitor_session": "Sesión de invitado",
    "record_version_observation": "Observación externa",
    "record": "Minuta",
}


def list_audit_report(db: Session, payload: AuditReportRequest) -> AuditReportResponse:
    report_type = payload.report_type
    if report_type == "user-sessions":
        items = _user_sessions(db, payload)
    elif report_type == "remote-session-closes":
        items = _audit_logs(db, payload, actions={"LOGOUT_SESSION", "LOGOUT_ALL_OTHER_SESSIONS"})
    elif report_type == "password-changes":
        items = _audit_logs(db, payload, actions={"CHANGE_PASSWORD_BY_ADMIN"})
    elif report_type == "available-audit-activity":
        items = _audit_logs(db, payload)
    elif report_type == "changes-by-entity":
        items = _audit_grouped(db, payload, "entity")
    elif report_type == "changes-by-actor":
        items = _audit_grouped(db, payload, "actor")
    elif report_type == "changes-by-period":
        items = _audit_grouped(db, payload, "period")
    elif report_type == "system-sendmail":
        items = _email_events(db, payload)
    elif report_type == "minute-otp-requests":
        items = _visitor_access_requests(db, payload)
    elif report_type == "guest-sessions":
        items = _visitor_sessions(db, payload)
    elif report_type == "external-observations-evidence":
        items = _external_observations(db, payload)
    elif report_type == "external-access-by-minute":
        items = _external_access_by_minute(db, payload)
    else:
        items = []

    return AuditReportResponse(items=items, total=len(items))


def _range(column, payload: AuditReportRequest):
    filters = []
    if payload.date_from:
        filters.append(column >= datetime.combine(payload.date_from, time.min))
    if payload.date_to:
        filters.append(column <= datetime.combine(payload.date_to, time.max))
    return filters


def _like(value: str | None) -> str | None:
    clean = str(value or "").strip()
    return f"%{clean}%" if clean else None


def _clean(value: Any, fallback: str = "-") -> str:
    clean = str(value or "").strip()
    return clean or fallback


def _label_action(action: str | None) -> str:
    raw = _clean(action, "")
    return ACTION_LABELS.get(raw, raw.replace("_", " ").capitalize() or "Evento auditado")


def _label_entity(entity_type: str | None) -> str:
    raw = _clean(entity_type, "")
    return ENTITY_LABELS.get(raw, raw.replace("_", " ").capitalize() or "Entidad")


def _short_ref(value: Any) -> str:
    raw = _clean(value, "")
    return raw[:8] if raw else "-"


def _yes_no(value: Any) -> str:
    if isinstance(value, bool):
        return "Sí" if value else "No"
    return "Sí" if str(value).strip().lower() in {"true", "1", "yes", "si", "sí"} else "No"


def _details(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else {}
    except (json.JSONDecodeError, TypeError):
        return {}


def _json_list(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return [str(item) for item in parsed if str(item or "").strip()]
    except (json.JSONDecodeError, TypeError):
        pass
    return []


def _user_label(user: User | None) -> str:
    if not user:
        return "Sistema"
    return user.full_name or user.username or user.email or user.id


def _audit_subject(action: str, details: dict[str, Any], entity_type: str, entity_id: str | None) -> str:
    if action == "LOGOUT_SESSION":
        return "Sesión seleccionada"
    if action == "LOGOUT_ALL_OTHER_SESSIONS":
        return "Otras sesiones del usuario"
    if action == "CHANGE_PASSWORD_BY_ADMIN":
        target = _clean(details.get("target_username"), "")
        return target or "Usuario actualizado"
    return _label_entity(entity_type) if entity_type else _label_action(action)


def _audit_detail(action: str, details: dict[str, Any], entity_id: str | None) -> str:
    if action == "LOGOUT_SESSION":
        revoked = _yes_no(details.get("session_revoked"))
        target = _short_ref(details.get("target_session_jti"))
        return f"Sesión objetivo: {target} · Sesión revocada: {revoked}"
    if action == "LOGOUT_ALL_OTHER_SESSIONS":
        total = details.get("sessions_revoked")
        return f"Sesiones revocadas: {int(total or 0)}"
    if action == "CHANGE_PASSWORD_BY_ADMIN":
        reason = _clean(details.get("reason"), "Sin motivo informado")
        total = int(details.get("sessions_revoked") or 0)
        return f"Motivo: {reason} · Sesiones revocadas: {total}"

    readable = []
    for key, value in details.items():
        label = str(key).replace("_", " ").capitalize()
        if isinstance(value, bool):
            value = _yes_no(value)
        readable.append(f"{label}: {value}")
    return " · ".join(readable) or "Evento auditado"


def _user_sessions(db: Session, payload: AuditReportRequest) -> list[AuditReportRow]:
    query = (
        db.query(UserSession, User)
        .join(User, User.id == UserSession.user_id)
        .filter(*_range(UserSession.created_at, payload))
    )
    actor = _like(payload.actor)
    if actor:
        query = query.filter(or_(User.username.ilike(actor), User.full_name.ilike(actor), User.email.ilike(actor)))
    if payload.status == "active":
        query = query.filter(UserSession.logged_out_at.is_(None))
    elif payload.status == "closed":
        query = query.filter(UserSession.logged_out_at.is_not(None))

    rows = query.order_by(UserSession.created_at.desc()).limit(payload.limit).all()
    items = []
    for session, user in rows:
        status = "active" if session.logged_out_at is None else "closed"
        ended = f"Cierre: {session.logged_out_at}" if session.logged_out_at else "Sesión activa"
        items.append(AuditReportRow(
            id=session.id,
            date=session.created_at,
            actor=_user_label(user),
            action=_label_action("LOGIN_SESSION"),
            entity_type=_label_entity("user_session"),
            entity_id=session.jti,
            status=status,
            subject=user.username or user.email or user.id,
            detail=ended,
            ip=session.ip_v4 or session.ip_v6,
            device=session.device,
            location=session.location,
            user_agent=session.user_agent,
        ))
    return items


def _audit_logs(db: Session, payload: AuditReportRequest, actions: set[str] | None = None) -> list[AuditReportRow]:
    query = (
        db.query(AuditLog, User)
        .join(User, User.id == AuditLog.actor_user_id)
        .filter(*_range(AuditLog.event_at, payload))
    )
    if actions:
        query = query.filter(AuditLog.action.in_(actions))
    if payload.entity_type:
        query = query.filter(AuditLog.entity_type == payload.entity_type)
    actor = _like(payload.actor)
    if actor:
        query = query.filter(or_(User.username.ilike(actor), User.full_name.ilike(actor), User.email.ilike(actor)))

    rows = query.order_by(AuditLog.event_at.desc()).limit(payload.limit).all()
    items = []
    for audit, user in rows:
        details = _details(audit.details_json)
        items.append(AuditReportRow(
            id=str(audit.id),
            date=audit.event_at,
            actor=_user_label(user),
            action=_label_action(audit.action),
            entity_type=_label_entity(audit.entity_type),
            entity_id=audit.entity_id,
            status="audited",
            subject=_audit_subject(audit.action, details, audit.entity_type, audit.entity_id),
            detail=_audit_detail(audit.action, details, audit.entity_id),
        ))
    return items


def _audit_grouped(db: Session, payload: AuditReportRequest, group_by: str) -> list[AuditReportRow]:
    filters = _range(AuditLog.event_at, payload)
    if payload.entity_type:
        filters.append(AuditLog.entity_type == payload.entity_type)

    if group_by == "entity":
        rows = (
            db.query(AuditLog.entity_type, func.count(AuditLog.id), func.max(AuditLog.event_at))
            .filter(*filters)
            .group_by(AuditLog.entity_type)
            .order_by(func.count(AuditLog.id).desc())
            .limit(payload.limit)
            .all()
        )
        return [
            AuditReportRow(
                id=f"entity:{entity}",
                date=last_at,
                actor="Sistema de auditoría",
                action=_label_action("GROUP_BY_ENTITY"),
                entity_type=_label_entity(entity),
                status="grouped",
                subject=_label_entity(entity),
                detail=f"{total} evento(s) auditado(s)",
                count=int(total or 0),
            )
            for entity, total, last_at in rows
        ]

    if group_by == "actor":
        rows = (
            db.query(User.id, User.username, User.full_name, User.email, func.count(AuditLog.id), func.max(AuditLog.event_at))
            .join(User, User.id == AuditLog.actor_user_id)
            .filter(*filters)
            .group_by(User.id, User.username, User.full_name, User.email)
            .order_by(func.count(AuditLog.id).desc())
            .limit(payload.limit)
            .all()
        )
        actor = _like(payload.actor)
        if actor:
            rows = [row for row in rows if actor.strip("%").casefold() in _clean(row[1], "").casefold() or actor.strip("%").casefold() in _clean(row[2], "").casefold()]
        return [
            AuditReportRow(
                id=f"actor:{user_id}",
                date=last_at,
                actor=full_name or username or email or user_id,
                action=_label_action("GROUP_BY_ACTOR"),
                entity_type=_label_entity("audit_log"),
                entity_id=user_id,
                status="grouped",
                subject=full_name or username or email or user_id,
                detail=f"{total} evento(s) auditado(s)",
                count=int(total or 0),
            )
            for user_id, username, full_name, email, total, last_at in rows
        ]

    period = func.date(AuditLog.event_at)
    rows = (
        db.query(period.label("period"), func.count(AuditLog.id), func.max(AuditLog.event_at))
        .filter(*filters)
        .group_by(period)
        .order_by(period.desc())
        .limit(payload.limit)
        .all()
    )
    return [
        AuditReportRow(
            id=f"period:{period_value}",
            date=last_at,
            actor="Sistema de auditoría",
            action=_label_action("GROUP_BY_PERIOD"),
            entity_type=_label_entity("audit_log"),
            status="grouped",
            subject=str(period_value),
            detail=f"{total} evento(s) auditado(s)",
            count=int(total or 0),
        )
        for period_value, total, last_at in rows
    ]


def _email_events(db: Session, payload: AuditReportRequest) -> list[AuditReportRow]:
    query = db.query(EmailDeliveryEvent).filter(*_range(EmailDeliveryEvent.event_at, payload))
    if payload.status:
        query = query.filter(EmailDeliveryEvent.status == payload.status)
    rows = query.order_by(EmailDeliveryEvent.event_at.desc()).limit(payload.limit).all()
    items = []
    for event in rows:
        recipients = ", ".join(_json_list(event.to_json)[:3])
        items.append(AuditReportRow(
            id=event.id,
            date=event.event_at,
            actor=event.actor_user_id or "Sistema",
            action=_label_action("EMAIL_DELIVERY"),
            entity_type=_label_entity("email_delivery"),
            entity_id=event.job_id,
            status=event.status,
            subject=event.subject,
            detail=f"{event.email_kind} · {event.recipient_count} destinatario(s) · {event.attachment_count} adjunto(s) · {recipients}",
            record_id=event.record_id,
            count=event.recipient_count,
        ))
    return items


def _visitor_access_requests(db: Session, payload: AuditReportRequest) -> list[AuditReportRow]:
    query = (
        db.query(VisitorAccessRequest, Record, Client, Project)
        .join(Record, Record.id == VisitorAccessRequest.record_id)
        .join(Client, Client.id == Record.client_id)
        .outerjoin(Project, Project.id == Record.project_id)
        .filter(*_range(VisitorAccessRequest.created_at, payload))
    )
    query = _record_filters(query, payload, Client, Project)
    if payload.status:
        query = query.filter(VisitorAccessRequest.delivery_status == payload.status)
    rows = query.order_by(VisitorAccessRequest.created_at.desc()).limit(payload.limit).all()
    return [
        AuditReportRow(
            id=req.id,
            date=req.created_at,
            actor=req.email,
            action=_label_action("OTP_REQUEST"),
            entity_type=_label_entity("visitor_access_request"),
            entity_id=req.id,
            status=req.delivery_status,
            subject=record.title,
            detail=f"Intentos: {req.attempt_count} · Consumido: {'sí' if req.consumed_at else 'no'}",
            ip=req.requester_ip,
            user_agent=req.requester_user_agent,
            client=client.name,
            project=project.name if project else None,
            record_id=record.id,
            record_title=record.title,
        )
        for req, record, client, project in rows
    ]


def _visitor_sessions(db: Session, payload: AuditReportRequest) -> list[AuditReportRow]:
    query = (
        db.query(VisitorSession, Record, Client, Project)
        .join(Record, Record.id == VisitorSession.record_id)
        .join(Client, Client.id == Record.client_id)
        .outerjoin(Project, Project.id == Record.project_id)
        .filter(*_range(VisitorSession.created_at, payload))
    )
    query = _record_filters(query, payload, Client, Project)
    if payload.status == "active":
        query = query.filter(VisitorSession.revoked_at.is_(None), VisitorSession.expires_at >= datetime.utcnow())
    elif payload.status == "revoked":
        query = query.filter(VisitorSession.revoked_at.is_not(None))
    rows = query.order_by(VisitorSession.created_at.desc()).limit(payload.limit).all()
    items = []
    for session, record, client, project in rows:
        status = "revoked" if session.revoked_at else "active"
        items.append(AuditReportRow(
            id=session.id,
            date=session.created_at,
            actor=session.email,
            action=_label_action("GUEST_SESSION"),
            entity_type=_label_entity("visitor_session"),
            entity_id=session.jti,
            status=status,
            subject=record.title,
            detail=f"Expira: {session.expires_at}",
            ip=session.ip_v4 or session.ip_v6,
            device=session.device,
            user_agent=session.user_agent,
            client=client.name,
            project=project.name if project else None,
            record_id=record.id,
            record_title=record.title,
        ))
    return items


def _external_observations(db: Session, payload: AuditReportRequest) -> list[AuditReportRow]:
    query = (
        db.query(RecordVersionObservation, Record, Client, Project)
        .join(Record, Record.id == RecordVersionObservation.record_id)
        .join(Client, Client.id == Record.client_id)
        .outerjoin(Project, Project.id == Record.project_id)
        .filter(*_range(RecordVersionObservation.created_at, payload))
    )
    query = _record_filters(query, payload, Client, Project)
    if payload.status:
        query = query.filter(RecordVersionObservation.status == payload.status)
    rows = query.order_by(RecordVersionObservation.created_at.desc()).limit(payload.limit).all()
    return [
        AuditReportRow(
            id=str(obs.id),
            date=obs.created_at,
            actor=obs.author_name or obs.author_email,
            action=_label_action("EXTERNAL_OBSERVATION"),
            entity_type=_label_entity("record_version_observation"),
            entity_id=str(obs.id),
            status=obs.status,
            subject=record.title,
            detail=_clean(obs.body),
            client=client.name,
            project=project.name if project else None,
            record_id=record.id,
            record_title=record.title,
        )
        for obs, record, client, project in rows
    ]


def _external_access_by_minute(db: Session, payload: AuditReportRequest) -> list[AuditReportRow]:
    activity_at = func.coalesce(
        VisitorSession.created_at,
        VisitorAccessRequest.created_at,
        RecordVersionObservation.created_at,
    )
    last_activity_at = func.max(activity_at)
    query = (
        db.query(
            Record.id,
            Record.title,
            Client.name,
            Project.name,
            func.count(func.distinct(VisitorAccessRequest.id)),
            func.count(func.distinct(VisitorSession.id)),
            func.count(func.distinct(RecordVersionObservation.id)),
            last_activity_at,
        )
        .join(Client, Client.id == Record.client_id)
        .outerjoin(Project, Project.id == Record.project_id)
        .outerjoin(VisitorAccessRequest, VisitorAccessRequest.record_id == Record.id)
        .outerjoin(VisitorSession, VisitorSession.record_id == Record.id)
        .outerjoin(RecordVersionObservation, RecordVersionObservation.record_id == Record.id)
    )
    query = _record_filters(query, payload, Client, Project)
    grouped = query.group_by(Record.id, Record.title, Client.name, Project.name).having(
        or_(
            func.count(func.distinct(VisitorAccessRequest.id)) > 0,
            func.count(func.distinct(VisitorSession.id)) > 0,
            func.count(func.distinct(RecordVersionObservation.id)) > 0,
        )
    )
    if payload.date_from:
        grouped = grouped.having(last_activity_at >= datetime.combine(payload.date_from, time.min))
    if payload.date_to:
        grouped = grouped.having(last_activity_at <= datetime.combine(payload.date_to, time.max))
    rows = (
        grouped.order_by(func.count(func.distinct(VisitorSession.id)).desc())
        .limit(payload.limit)
        .all()
    )
    return [
        AuditReportRow(
            id=record_id,
            date=last_at,
            actor="Acceso externo",
            action=_label_action("EXTERNAL_ACCESS_SUMMARY"),
            entity_type=_label_entity("record"),
            entity_id=record_id,
            status="with_activity",
            subject=title,
            detail=f"OTP: {otp_count} · Sesiones: {session_count} · Observaciones: {observation_count}",
            client=client_name,
            project=project_name,
            record_id=record_id,
            record_title=title,
            count=int((session_count or 0) + (observation_count or 0)),
        )
        for record_id, title, client_name, project_name, otp_count, session_count, observation_count, last_at in rows
    ]


def _record_filters(query, payload: AuditReportRequest, client_model, project_model):
    client = _like(payload.client)
    if client:
        query = query.filter(client_model.name.ilike(client))
    project = _like(payload.project)
    if project:
        query = query.filter(project_model.name.ilike(project))
    return query
