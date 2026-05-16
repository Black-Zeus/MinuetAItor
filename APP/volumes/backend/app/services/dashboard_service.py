from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from models.clients import Client
from models.projects import Project
from models.records import Record
from schemas.auth import UserSession
from services.access_control_service import apply_client_scope_filter, apply_project_scope_filter


def _month_bounds(now: datetime) -> tuple[datetime, datetime, datetime]:
    current_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    previous_month = current_start.month - 1 or 12
    previous_year = current_start.year - 1 if current_start.month == 1 else current_start.year
    previous_start = current_start.replace(year=previous_year, month=previous_month)
    return previous_start, current_start, now


def _percent_change(current: int, previous: int) -> float:
    if previous == 0:
        return 100.0 if current > 0 else 0.0
    return round(((current - previous) / previous) * 100, 1)


def _metric(value: int, previous: int) -> dict:
    return {
        "value": int(value),
        "change": _percent_change(int(value), int(previous)),
    }


def get_dashboard_stats(db: Session, session: UserSession) -> dict:
    previous_start, current_start, now = _month_bounds(datetime.now(timezone.utc))

    minutes_current = (
        db.query(func.count(Record.id))
        .filter(
            Record.deleted_at.is_(None),
            Record.prepared_by_user_id == session.user_id,
            Record.created_at >= current_start,
            Record.created_at < now,
        )
        .scalar()
        or 0
    )
    minutes_previous = (
        db.query(func.count(Record.id))
        .filter(
            Record.deleted_at.is_(None),
            Record.prepared_by_user_id == session.user_id,
            Record.created_at >= previous_start,
            Record.created_at < current_start,
        )
        .scalar()
        or 0
    )

    projects_query = db.query(Project).filter(Project.deleted_at.is_(None), Project.is_active.is_(True))
    projects_query = apply_project_scope_filter(projects_query, db, session, Project)
    active_projects = projects_query.with_entities(func.count(func.distinct(Project.id))).scalar() or 0
    active_projects_previous = (
        projects_query
        .filter(Project.created_at < current_start)
        .with_entities(func.count(func.distinct(Project.id)))
        .scalar()
        or 0
    )

    clients_query = db.query(Client).filter(Client.deleted_at.is_(None), Client.is_active.is_(True))
    clients_query = apply_client_scope_filter(clients_query, db, session, Client.id)
    active_clients = clients_query.with_entities(func.count(Client.id)).scalar() or 0
    active_clients_previous = (
        clients_query
        .filter(Client.created_at < current_start)
        .with_entities(func.count(Client.id))
        .scalar()
        or 0
    )

    return {
        "minutes_this_month": _metric(minutes_current, minutes_previous),
        "active_projects": _metric(active_projects, active_projects_previous),
        "active_clients": _metric(active_clients, active_clients_previous),
    }
