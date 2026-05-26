from __future__ import annotations

from datetime import datetime, time

from sqlalchemy.orm import Session

from models.clients import Client
from models.projects import Project
from models.record_version_observation import RecordVersionObservation
from models.record_versions import RecordVersion
from models.records import Record
from schemas.auth import UserSession
from services.access_control_service import apply_record_scope_filter


def _date_start(value):
    if not value:
        return None
    return datetime.combine(value, time.min)


def _date_end(value):
    if not value:
        return None
    return datetime.combine(value, time.max)


def list_management_review_observations(db: Session, session: UserSession, filters) -> dict:
    q = (
        db.query(RecordVersionObservation, Record, RecordVersion, Client, Project)
        .join(Record, Record.id == RecordVersionObservation.record_id)
        .join(RecordVersion, RecordVersion.id == RecordVersionObservation.record_version_id)
        .join(Client, Client.id == Record.client_id)
        .outerjoin(Project, Project.id == Record.project_id)
        .filter(Record.deleted_at.is_(None))
    )
    q = apply_record_scope_filter(q, db, session, Record)

    if filters.date_from:
        q = q.filter(RecordVersionObservation.created_at >= _date_start(filters.date_from))
    if filters.date_to:
        q = q.filter(RecordVersionObservation.created_at <= _date_end(filters.date_to))
    if filters.client:
        q = q.filter(Client.name == filters.client)
    if filters.project:
        q = q.filter(Project.name == filters.project)
    if filters.status:
        q = q.filter(RecordVersionObservation.status == filters.status)

    rows = (
        q.order_by(
            RecordVersionObservation.created_at.desc(),
            RecordVersionObservation.id.desc(),
        )
        .limit(filters.limit)
        .all()
    )

    items = []
    for observation, record, version, client, project in rows:
        items.append(
            {
                "id": f"observation-{int(observation.id)}",
                "observation_id": int(observation.id),
                "record_id": str(record.id),
                "record_version_id": str(version.id),
                "version_num": int(version.version_num) if version.version_num is not None else None,
                "title": record.title or "Minuta sin título",
                "client": client.name if client else "Sin cliente",
                "project": project.name if project else "Sin proyecto",
                "author_email": observation.author_email,
                "author_name": observation.author_name,
                "status": observation.status,
                "resolution_type": observation.resolution_type,
                "body": observation.body,
                "editor_comment": observation.editor_comment,
                "created_at": observation.created_at,
                "resolved_at": observation.resolved_at,
            }
        )

    return {
        "items": items,
        "total": len(items),
    }
