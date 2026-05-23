from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from models.ai_tag_conversions import AiTagConversion
from models.ai_tags import AITag
from models.clients import Client
from models.projects import Project
from models.record_version_ai_tags import RecordVersionAiTag
from models.record_version_tags import RecordVersionTag
from models.record_versions import RecordVersion
from models.records import Record
from models.tag_categories import TagCategory
from models.tags import Tag


def _record_activity_date_expr():
    return func.coalesce(Record.document_date, func.date(RecordVersion.published_at))


def _apply_record_scope_filters(q, filters, date_expr):
    q = q.filter(
        Record.deleted_at.is_(None),
        RecordVersion.deleted_at.is_(None),
    )

    if filters.date_from:
        q = q.filter(date_expr >= filters.date_from)
    if filters.date_to:
        q = q.filter(date_expr <= filters.date_to)
    if filters.client:
        q = q.filter(Client.name == filters.client)
    if filters.project:
        q = q.filter(Project.name == filters.project)

    return q


def _label_for_filtered_client(filters) -> str:
    return filters.client if filters.client else ""


def _label_for_filtered_project(filters) -> str:
    return filters.project if filters.project else ""


def list_minutes_by_tag(db: Session, filters) -> list[dict]:
    date_expr = _record_activity_date_expr()
    q = (
        db.query(
            Tag.id.label("tag_id"),
            Tag.name.label("tag"),
            Tag.source.label("source"),
            Tag.status.label("status_key"),
            Tag.is_active.label("is_active"),
            TagCategory.name.label("category"),
            func.count(func.distinct(Record.id)).label("total_records"),
            func.count(RecordVersionTag.record_version_id).label("total_assignments"),
            func.count(func.distinct(Record.client_id)).label("client_count"),
            func.count(func.distinct(Record.project_id)).label("project_count"),
            func.max(date_expr).label("last_activity"),
        )
        .join(RecordVersionTag, RecordVersionTag.tag_id == Tag.id)
        .join(RecordVersion, RecordVersion.id == RecordVersionTag.record_version_id)
        .join(Record, Record.id == RecordVersion.record_id)
        .join(Client, Client.id == Record.client_id)
        .outerjoin(Project, Project.id == Record.project_id)
        .outerjoin(TagCategory, TagCategory.id == Tag.category_id)
        .filter(Tag.deleted_at.is_(None))
    )
    q = _apply_record_scope_filters(q, filters, date_expr)
    rows = (
        q.group_by(Tag.id, Tag.name, Tag.source, Tag.status, Tag.is_active, TagCategory.name)
        .order_by(func.count(func.distinct(Record.id)).desc(), Tag.name.asc())
        .limit(filters.limit)
        .all()
    )

    return [
        {
            "id": f"tag-{row.tag_id}",
            "label": row.tag,
            "tag_id": row.tag_id,
            "tag": row.tag,
            "category": row.category or "Sin categoría",
            "source": str(row.source.value if hasattr(row.source, "value") else row.source or "user"),
            "status_key": "active" if row.is_active else "inactive",
            "status_label": row.status_key or ("Activo" if row.is_active else "Inactivo"),
            "total_records": int(row.total_records or 0),
            "total_assignments": int(row.total_assignments or 0),
            "client_count": int(row.client_count or 0),
            "project_count": int(row.project_count or 0),
            "last_activity": row.last_activity,
            "client": _label_for_filtered_client(filters),
            "project": _label_for_filtered_project(filters),
        }
        for row in rows
    ]


def list_detected_ai_tags(db: Session, filters) -> list[dict]:
    date_expr = _record_activity_date_expr()
    q = (
        db.query(
            AITag.id.label("ai_tag_id"),
            AITag.slug.label("ai_tag"),
            AITag.is_active.label("is_active"),
            func.count(func.distinct(Record.id)).label("total_records"),
            func.count(RecordVersionAiTag.record_version_id).label("detected_count"),
            func.count(func.distinct(Record.client_id)).label("client_count"),
            func.count(func.distinct(Record.project_id)).label("project_count"),
            func.max(date_expr).label("last_activity"),
        )
        .join(RecordVersionAiTag, RecordVersionAiTag.ai_tag_id == AITag.id)
        .join(RecordVersion, RecordVersion.id == RecordVersionAiTag.record_version_id)
        .join(Record, Record.id == RecordVersion.record_id)
        .join(Client, Client.id == Record.client_id)
        .outerjoin(Project, Project.id == Record.project_id)
    )
    q = _apply_record_scope_filters(q, filters, date_expr)
    rows = (
        q.group_by(AITag.id, AITag.slug, AITag.is_active)
        .order_by(func.count(RecordVersionAiTag.record_version_id).desc(), AITag.slug.asc())
        .limit(filters.limit)
        .all()
    )

    return [
        {
            "id": f"ai-tag-{row.ai_tag_id}",
            "label": row.ai_tag,
            "ai_tag_id": row.ai_tag_id,
            "ai_tag": row.ai_tag,
            "status_key": "active" if row.is_active else "inactive",
            "status_label": "Activo" if row.is_active else "Inactivo",
            "total_records": int(row.total_records or 0),
            "detected_count": int(row.detected_count or 0),
            "client_count": int(row.client_count or 0),
            "project_count": int(row.project_count or 0),
            "last_activity": row.last_activity,
            "client": _label_for_filtered_client(filters),
            "project": _label_for_filtered_project(filters),
        }
        for row in rows
    ]


def list_ai_tag_conversions_report(db: Session, filters) -> list[dict]:
    date_expr = _record_activity_date_expr()
    q = (
        db.query(
            AITag.id.label("ai_tag_id"),
            AITag.slug.label("ai_tag"),
            Tag.id.label("tag_id"),
            Tag.name.label("tag"),
            TagCategory.name.label("category"),
            func.count(func.distinct(Record.id)).label("total_records"),
            func.count(RecordVersionAiTag.record_version_id).label("detected_count"),
            func.count(AiTagConversion.tag_id).label("converted_count"),
            func.count(func.distinct(Record.client_id)).label("client_count"),
            func.count(func.distinct(Record.project_id)).label("project_count"),
            func.max(date_expr).label("last_activity"),
        )
        .join(RecordVersionAiTag, RecordVersionAiTag.ai_tag_id == AITag.id)
        .join(RecordVersion, RecordVersion.id == RecordVersionAiTag.record_version_id)
        .join(Record, Record.id == RecordVersion.record_id)
        .join(Client, Client.id == Record.client_id)
        .outerjoin(Project, Project.id == Record.project_id)
        .outerjoin(AiTagConversion, AiTagConversion.ai_tag_id == AITag.id)
        .outerjoin(Tag, Tag.id == AiTagConversion.tag_id)
        .outerjoin(TagCategory, TagCategory.id == Tag.category_id)
    )
    q = _apply_record_scope_filters(q, filters, date_expr)
    rows = (
        q.group_by(AITag.id, AITag.slug, Tag.id, Tag.name, TagCategory.name)
        .order_by(func.count(RecordVersionAiTag.record_version_id).desc(), AITag.slug.asc())
        .limit(filters.limit)
        .all()
    )

    output = []
    for row in rows:
        detected_count = int(row.detected_count or 0)
        converted_count = int(row.converted_count or 0)
        is_converted = bool(row.tag_id)
        output.append(
            {
                "id": f"ai-conversion-{row.ai_tag_id}-{row.tag_id or 'none'}",
                "label": row.ai_tag,
                "ai_tag_id": row.ai_tag_id,
                "ai_tag": row.ai_tag,
                "tag_id": row.tag_id,
                "tag": row.tag,
                "category": row.category or "Sin categoría",
                "conversion_target": row.tag or "Sin conversión",
                "status_key": "converted" if is_converted else "unconverted",
                "status_label": "Convertido" if is_converted else "Sin conversión",
                "total_records": int(row.total_records or 0),
                "detected_count": detected_count,
                "converted_count": converted_count if is_converted else 0,
                "unconverted_count": 0 if is_converted else detected_count,
                "client_count": int(row.client_count or 0),
                "project_count": int(row.project_count or 0),
                "conversion_rate": 100.0 if is_converted and detected_count else 0.0,
                "last_activity": row.last_activity,
                "client": _label_for_filtered_client(filters),
                "project": _label_for_filtered_project(filters),
            }
        )
    return output


def list_topic_trends(db: Session, filters) -> list[dict]:
    date_expr = _record_activity_date_expr()
    period_expr = func.date_format(date_expr, "%Y-%m")
    q = (
        db.query(
            period_expr.label("period"),
            Tag.id.label("tag_id"),
            Tag.name.label("tag"),
            TagCategory.name.label("category"),
            func.count(func.distinct(Record.id)).label("total_records"),
            func.count(func.distinct(Record.client_id)).label("client_count"),
            func.count(func.distinct(Record.project_id)).label("project_count"),
            func.max(date_expr).label("last_activity"),
        )
        .join(RecordVersionTag, RecordVersionTag.tag_id == Tag.id)
        .join(RecordVersion, RecordVersion.id == RecordVersionTag.record_version_id)
        .join(Record, Record.id == RecordVersion.record_id)
        .join(Client, Client.id == Record.client_id)
        .outerjoin(Project, Project.id == Record.project_id)
        .outerjoin(TagCategory, TagCategory.id == Tag.category_id)
        .filter(Tag.deleted_at.is_(None))
    )
    q = _apply_record_scope_filters(q, filters, date_expr)
    rows = (
        q.group_by(period_expr, Tag.id, Tag.name, TagCategory.name)
        .order_by(period_expr.desc(), func.count(func.distinct(Record.id)).desc(), Tag.name.asc())
        .limit(filters.limit)
        .all()
    )

    return [
        {
            "id": f"trend-{row.period}-{row.tag_id}",
            "label": row.tag,
            "tag_id": row.tag_id,
            "tag": row.tag,
            "category": row.category or "Sin categoría",
            "period": row.period,
            "status_key": "trend",
            "status_label": "Tendencia",
            "total_records": int(row.total_records or 0),
            "client_count": int(row.client_count or 0),
            "project_count": int(row.project_count or 0),
            "last_activity": row.last_activity,
            "client": _label_for_filtered_client(filters),
            "project": _label_for_filtered_project(filters),
        }
        for row in rows
    ]


def list_management_topic_report(db: Session, filters) -> dict:
    handlers = {
        "minutes-by-tag": list_minutes_by_tag,
        "detected-ai-tags": list_detected_ai_tags,
        "ai-tag-conversions": list_ai_tag_conversions_report,
        "topic-trends": list_topic_trends,
    }
    items = handlers[filters.report_type](db, filters)
    return {
        "items": items,
        "total": len(items),
    }
