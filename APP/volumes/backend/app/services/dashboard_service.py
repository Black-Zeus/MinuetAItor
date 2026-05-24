from __future__ import annotations

from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from core.datetime_utils import utc_now
from models.clients import Client
from models.projects import Project
from models.records import Record
from models.record_status_transitions import RecordStatusTransition
from models.record_statuses import RecordStatus
from schemas.auth import UserSession
from services.access_control_service import apply_client_scope_filter, apply_project_scope_filter
from services.minutes.constants import RECORD_STATUS_COMPLETED


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


def _add_months(value: datetime, offset: int) -> datetime:
    month_index = value.month - 1 + offset
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    return value.replace(year=year, month=month)


def _month_key(value: datetime) -> str:
    return value.strftime("%Y-%m")


def _month_label(key: str) -> str:
    year, month = key.split("-")
    return f"{month}/{year[-2:]}"


def _date_format_month(column):
    return func.date_format(column, "%Y-%m")


def _minute_trend(db: Session, session: UserSession, current_start: datetime, now: datetime) -> list[dict]:
    start = _add_months(current_start, -5)
    month_keys = [_month_key(_add_months(start, index)) for index in range(6)]
    trend_by_month = {
        month: {"month": month, "label": _month_label(month), "created": 0, "completed": 0}
        for month in month_keys
    }

    created_month = _date_format_month(Record.created_at).label("month")
    created_rows = (
        db.query(created_month, func.count(Record.id))
        .filter(
            Record.deleted_at.is_(None),
            Record.prepared_by_user_id == session.user_id,
            Record.created_at >= start,
            Record.created_at < now,
        )
        .group_by(created_month)
        .all()
    )
    for month, total in created_rows:
        if month in trend_by_month:
            trend_by_month[month]["created"] = int(total or 0)

    completed_month = _date_format_month(RecordStatusTransition.changed_at).label("month")
    completed_rows = (
        db.query(completed_month, func.count(func.distinct(RecordStatusTransition.record_id)))
        .join(Record, Record.id == RecordStatusTransition.record_id)
        .join(RecordStatus, RecordStatus.id == RecordStatusTransition.to_status_id)
        .filter(
            Record.deleted_at.is_(None),
            Record.prepared_by_user_id == session.user_id,
            RecordStatus.code == RECORD_STATUS_COMPLETED,
            RecordStatusTransition.changed_at >= start,
            RecordStatusTransition.changed_at < now,
        )
        .group_by(completed_month)
        .all()
    )
    for month, total in completed_rows:
        if month in trend_by_month:
            trend_by_month[month]["completed"] = int(total or 0)

    return [trend_by_month[month] for month in month_keys]


def _status_distribution(db: Session, session: UserSession) -> list[dict]:
    rows = (
        db.query(
            RecordStatus.code,
            RecordStatus.name,
            func.count(Record.id),
        )
        .join(RecordStatus, RecordStatus.id == Record.status_id)
        .filter(
            Record.deleted_at.is_(None),
            Record.prepared_by_user_id == session.user_id,
        )
        .group_by(RecordStatus.code, RecordStatus.name)
        .order_by(func.count(Record.id).desc(), RecordStatus.name.asc())
        .all()
    )

    return [
        {
            "status": code,
            "label": label or code,
            "value": int(total or 0),
        }
        for code, label, total in rows
    ]


def get_dashboard_stats(db: Session, session: UserSession) -> dict:
    previous_start, current_start, now = _month_bounds(utc_now())

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
        "charts": {
            "minute_trend": _minute_trend(db, session, current_start, now),
            "status_distribution": _status_distribution(db, session),
        },
    }
