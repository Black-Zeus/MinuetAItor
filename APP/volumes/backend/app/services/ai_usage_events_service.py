from __future__ import annotations

import logging
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from fastapi import HTTPException
from sqlalchemy import case, func, or_
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session, joinedload

from core.datetime_utils import assume_utc, utc_now_db
from models.ai_profiles import AiProfile
from models.ai_model_pricing import AiModelPricing
from models.ai_provider_configs import AiProviderConfig
from models.ai_usage_events import AiUsageEvent
from models.clients import Client
from models.projects import Project
from models.user_project_acl import UserProjectACL
from schemas.auth import UserSession
from services.access_control_service import can_access_all_clients, get_accessible_client_ids

logger = logging.getLogger(__name__)

_MILLION = Decimal("1000000")
_COST_SCALE = Decimal("0.000001")


def _is_missing_schema_error(exc: Exception) -> bool:
    text_value = str(exc).lower()
    missing_markers = ("doesn't exist", "does not exist", "no such table")
    return any(marker in text_value for marker in missing_markers) and (
        "ai_usage_events" in text_value or "ai_model_pricing" in text_value
    )


def ensure_ai_usage_schema_access(db: Session) -> None:
    db.query(AiUsageEvent.id).limit(1).first()


def _ensure_pricing_schema_access(db: Session) -> None:
    db.query(AiModelPricing.id).limit(1).first()


def _to_utc_naive(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    normalized = assume_utc(value)
    return normalized.replace(tzinfo=None) if normalized else None


def _as_iso(value: datetime | None) -> str | None:
    normalized = assume_utc(value)
    return normalized.isoformat() if normalized else None


def _decimal_to_float(value: Decimal | None) -> float | None:
    return float(value) if value is not None else None


def _normalize_total_tokens(input_tokens: int | None, output_tokens: int | None) -> int | None:
    values = [value for value in (input_tokens, output_tokens) if value is not None]
    if not values:
        return None
    return int(sum(int(value) for value in values))


def _quantize_cost(value: Decimal | None) -> Decimal | None:
    if value is None:
        return None
    return value.quantize(_COST_SCALE, rounding=ROUND_HALF_UP)


def _user_ref(user_obj) -> dict[str, Any] | None:
    if not user_obj:
        return None
    return {
        "id": str(getattr(user_obj, "id", None)),
        "username": getattr(user_obj, "username", None),
        "full_name": getattr(user_obj, "full_name", None),
    }


def _provider_config_ref(obj: AiProviderConfig | None) -> dict[str, Any] | None:
    if not obj:
        return None
    return {
        "id": str(obj.id),
        "name": getattr(obj, "name", None),
        "provider_type": getattr(obj, "provider_type", None),
        "model_name": getattr(obj, "model_name", None),
    }


def _safe_int(value: Any) -> int:
    if value is None:
        return 0
    return int(value)


def _safe_float(value: Any) -> float:
    if value is None:
        return 0.0
    return round(float(value), 6)


def _nullable_float(value: Any) -> float | None:
    if value is None:
        return None
    return round(float(value), 2)


def _percentage(numerator: int | float, denominator: int | float) -> float:
    if not denominator:
        return 0.0
    return round((float(numerator) / float(denominator)) * 100, 2)


def _get_accessible_project_ids(db: Session, session: UserSession) -> list[str]:
    if can_access_all_clients(db, session):
        return []

    rows = (
        db.query(UserProjectACL.project_id)
        .filter(
            UserProjectACL.user_id == session.user_id,
            UserProjectACL.deleted_at.is_(None),
            UserProjectACL.is_active.is_(True),
        )
        .all()
    )
    return [row[0] if isinstance(row, tuple) else row.project_id for row in rows]


def _apply_scope_filter(query, db: Session, session: UserSession):
    if can_access_all_clients(db, session):
        return query

    accessible_client_ids = get_accessible_client_ids(db, session)
    accessible_project_ids = _get_accessible_project_ids(db, session)
    scope_filters = []

    if accessible_client_ids:
        scope_filters.append(AiUsageEvent.client_id.in_(accessible_client_ids))
    if accessible_project_ids:
        scope_filters.append(AiUsageEvent.project_id.in_(accessible_project_ids))

    if not scope_filters:
        return query.filter(False)
    return query.filter(or_(*scope_filters))


def _apply_common_filters(query, filters):
    if getattr(filters, "event_type", None):
        query = query.filter(AiUsageEvent.event_type == filters.event_type)
    statuses = [str(value).strip() for value in (getattr(filters, "statuses", None) or []) if str(value).strip()]
    if statuses:
        query = query.filter(AiUsageEvent.status.in_(statuses))
    elif getattr(filters, "status", None):
        query = query.filter(AiUsageEvent.status == filters.status)
    if getattr(filters, "minute_transaction_id", None):
        query = query.filter(AiUsageEvent.minute_transaction_id == filters.minute_transaction_id)
    if getattr(filters, "record_id", None):
        query = query.filter(AiUsageEvent.record_id == filters.record_id)
    if getattr(filters, "record_version_id", None):
        query = query.filter(AiUsageEvent.record_version_id == filters.record_version_id)
    if getattr(filters, "client_id", None):
        query = query.filter(AiUsageEvent.client_id == filters.client_id)
    if getattr(filters, "project_id", None):
        query = query.filter(AiUsageEvent.project_id == filters.project_id)
    if getattr(filters, "ai_profile_id", None):
        query = query.filter(AiUsageEvent.ai_profile_id == filters.ai_profile_id)
    if getattr(filters, "requested_by", None):
        query = query.filter(AiUsageEvent.requested_by == filters.requested_by)
    if getattr(filters, "provider_config_id", None):
        query = query.filter(AiUsageEvent.provider_config_id == filters.provider_config_id)
    if getattr(filters, "provider_type", None):
        query = query.filter(AiUsageEvent.provider_type == filters.provider_type)
    if getattr(filters, "provider_family", None):
        query = query.filter(AiUsageEvent.provider_family == filters.provider_family)
    if getattr(filters, "execution_adapter", None):
        query = query.filter(AiUsageEvent.execution_adapter == filters.execution_adapter)
    if getattr(filters, "model_name", None):
        query = query.filter(AiUsageEvent.model_name == filters.model_name)
    if getattr(filters, "external_run_id", None):
        query = query.filter(AiUsageEvent.external_run_id == filters.external_run_id)
    if getattr(filters, "started_from", None):
        query = query.filter(AiUsageEvent.started_at >= _to_utc_naive(filters.started_from))
    if getattr(filters, "started_to", None):
        query = query.filter(AiUsageEvent.started_at <= _to_utc_naive(filters.started_to))
    return query


def _build_base_query(db: Session, session: UserSession, filters):
    q = db.query(AiUsageEvent)
    q = _apply_scope_filter(q, db, session)
    q = _apply_common_filters(q, filters)
    return q


def _get_or_404(db: Session, session: UserSession, event_id: int) -> AiUsageEvent:
    try:
        ensure_ai_usage_schema_access(db)
    except (OperationalError, ProgrammingError) as exc:
        if _is_missing_schema_error(exc):
            raise HTTPException(
                status_code=400,
                detail="La tabla ai_usage_events aún no está disponible. Aplica el esquema antes de consultar métricas IA.",
            )
        raise

    obj = (
        _apply_scope_filter(
            db.query(AiUsageEvent),
            db,
            session,
        )
        .options(
            joinedload(AiUsageEvent.requested_by_user),
            joinedload(AiUsageEvent.provider_config),
        )
        .filter(AiUsageEvent.id == event_id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="AI_USAGE_EVENT_NOT_FOUND")
    return obj


def _build_response_dict(obj: AiUsageEvent) -> dict[str, Any]:
    return {
        "id": int(obj.id),
        "eventType": str(obj.event_type),
        "status": str(obj.status),
        "minuteTransactionId": str(obj.minute_transaction_id) if obj.minute_transaction_id else None,
        "recordId": str(obj.record_id) if obj.record_id else None,
        "recordVersionId": str(obj.record_version_id) if obj.record_version_id else None,
        "clientId": str(obj.client_id) if obj.client_id else None,
        "projectId": str(obj.project_id) if obj.project_id else None,
        "aiProfileId": str(obj.ai_profile_id) if obj.ai_profile_id else None,
        "requestedBy": str(obj.requested_by) if obj.requested_by else None,
        "requestedByUser": _user_ref(getattr(obj, "requested_by_user", None)),
        "providerConfigId": str(obj.provider_config_id) if obj.provider_config_id else None,
        "providerConfig": _provider_config_ref(getattr(obj, "provider_config", None)),
        "pricingId": str(obj.pricing_id) if obj.pricing_id else None,
        "providerType": obj.provider_type,
        "providerFamily": obj.provider_family,
        "executionAdapter": obj.execution_adapter,
        "providerNameSnapshot": obj.provider_name_snapshot,
        "modelName": obj.model_name,
        "externalRunId": obj.external_run_id,
        "externalThreadId": obj.external_thread_id,
        "startedAt": _as_iso(obj.started_at),
        "finishedAt": _as_iso(obj.finished_at),
        "latencyMs": int(obj.latency_ms) if obj.latency_ms is not None else None,
        "inputTokens": int(obj.input_tokens) if obj.input_tokens is not None else None,
        "outputTokens": int(obj.output_tokens) if obj.output_tokens is not None else None,
        "totalTokens": int(obj.total_tokens) if obj.total_tokens is not None else None,
        "currency": str(obj.currency or "USD"),
        "inputCost": _decimal_to_float(obj.input_cost),
        "outputCost": _decimal_to_float(obj.output_cost),
        "totalCost": _decimal_to_float(obj.total_cost),
        "costEstimated": bool(obj.cost_estimated),
        "costSource": obj.cost_source,
        "errorCode": obj.error_code,
        "errorMessage": obj.error_message,
        "providerUsageRawJson": obj.provider_usage_raw_json,
        "providerMetaJson": obj.provider_meta_json,
        "createdAt": _as_iso(obj.created_at),
    }


def _empty_summary() -> dict[str, Any]:
    return {
        "overview": {
            "totalEvents": 0,
            "successEvents": 0,
            "failedEvents": 0,
            "successRate": 0,
            "totalInputTokens": 0,
            "totalOutputTokens": 0,
            "totalTokens": 0,
            "totalCost": 0,
            "estimatedCostEvents": 0,
            "averageCostPerSuccess": None,
            "averageLatencyMs": None,
            "uniqueClients": 0,
            "uniqueProjects": 0,
            "uniqueModels": 0,
            "uniqueProviders": 0,
        },
        "timeseries": [],
        "byStatus": [],
        "byProvider": [],
        "byModel": [],
        "byProfile": [],
        "byClient": [],
        "byProject": [],
        "recentEvents": [],
        "filtersMeta": {
            "eventTypes": [],
            "statuses": [],
            "providerTypes": [],
            "providerFamilies": [],
            "executionAdapters": [],
            "modelNames": [],
            "aiProfileIds": [],
        },
    }


def _resolve_pricing(
    db: Session,
    *,
    provider_type: str | None,
    model_name: str | None,
    started_at: datetime | None,
) -> AiModelPricing | None:
    if not provider_type or not model_name:
        return None

    try:
        _ensure_pricing_schema_access(db)
    except (OperationalError, ProgrammingError) as exc:
        if _is_missing_schema_error(exc):
            return None
        raise

    normalized_started_at = started_at or utc_now_db()
    return (
        db.query(AiModelPricing)
        .filter(
            AiModelPricing.deleted_at.is_(None),
            AiModelPricing.is_active.is_(True),
            AiModelPricing.provider_type == provider_type,
            AiModelPricing.model_name == model_name,
            AiModelPricing.effective_from <= normalized_started_at,
            or_(AiModelPricing.effective_to.is_(None), AiModelPricing.effective_to > normalized_started_at),
        )
        .order_by(AiModelPricing.effective_from.desc(), AiModelPricing.created_at.desc())
        .first()
    )


def _calculate_costs(
    *,
    pricing: AiModelPricing | None,
    input_tokens: int | None,
    output_tokens: int | None,
) -> dict[str, Any]:
    if not pricing:
        return {
            "pricing_id": None,
            "currency": "USD",
            "input_cost": None,
            "output_cost": None,
            "total_cost": None,
            "cost_estimated": False,
            "cost_source": None,
        }

    input_cost = None
    output_cost = None

    if pricing.input_price_per_million is not None and input_tokens is not None:
        input_cost = _quantize_cost((Decimal(int(input_tokens)) * Decimal(pricing.input_price_per_million)) / _MILLION)
    if pricing.output_price_per_million is not None and output_tokens is not None:
        output_cost = _quantize_cost((Decimal(int(output_tokens)) * Decimal(pricing.output_price_per_million)) / _MILLION)

    total_cost = None
    values = [value for value in (input_cost, output_cost) if value is not None]
    if values:
        total_cost = _quantize_cost(sum(values, Decimal("0")))

    return {
        "pricing_id": str(pricing.id),
        "currency": str(pricing.currency or "USD"),
        "input_cost": input_cost,
        "output_cost": output_cost,
        "total_cost": total_cost,
        "cost_estimated": total_cost is not None,
        "cost_source": "pricing_catalog" if total_cost is not None else None,
    }


def record_ai_usage_event(
    db: Session,
    *,
    event_type: str,
    status: str,
    minute_transaction_id: str | None = None,
    record_id: str | None = None,
    record_version_id: str | None = None,
    client_id: str | None = None,
    project_id: str | None = None,
    ai_profile_id: str | None = None,
    requested_by: str | None = None,
    provider_config_id: str | None = None,
    provider_type: str | None = None,
    provider_family: str | None = None,
    execution_adapter: str | None = None,
    provider_name_snapshot: str | None = None,
    model_name: str | None = None,
    external_run_id: str | None = None,
    external_thread_id: str | None = None,
    started_at: datetime | None = None,
    finished_at: datetime | None = None,
    latency_ms: int | None = None,
    input_tokens: int | None = None,
    output_tokens: int | None = None,
    error_code: str | None = None,
    error_message: str | None = None,
    provider_usage_raw_json: dict | list | None = None,
    provider_meta_json: dict | list | None = None,
    suppress_errors: bool = True,
) -> dict[str, Any] | None:
    try:
        ensure_ai_usage_schema_access(db)
    except (OperationalError, ProgrammingError) as exc:
        if _is_missing_schema_error(exc):
            logger.warning("ai_usage_events no disponible; se omite registro de métricas IA.")
            return None
        if suppress_errors:
            logger.warning("No se pudo verificar esquema ai_usage_events: %s", exc)
            return None
        raise

    started_at_db = _to_utc_naive(started_at) or utc_now_db()
    finished_at_db = _to_utc_naive(finished_at)
    total_tokens = _normalize_total_tokens(input_tokens, output_tokens)
    normalized_event_type = str(event_type or "minute_processing").strip() or "minute_processing"
    normalized_ai_profile_id = str(ai_profile_id or "").strip() or None

    if normalized_event_type == "minute_processing" and not normalized_ai_profile_id:
        message = (
            "Se omitió ai_usage_event porque falta ai_profile_id para minute_processing | "
            f"tx={minute_transaction_id} record={record_id} model={model_name} provider={provider_type}"
        )
        if suppress_errors:
            logger.error(message)
            return None
        raise ValueError(message)

    try:
        pricing_info = _calculate_costs(
            pricing=_resolve_pricing(
                db,
                provider_type=provider_type,
                model_name=model_name,
                started_at=started_at_db,
            ),
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )

        obj = AiUsageEvent(
            event_type=normalized_event_type,
            status=str(status or "success").strip() or "success",
            minute_transaction_id=minute_transaction_id,
            record_id=record_id,
            record_version_id=record_version_id,
            client_id=client_id,
            project_id=project_id,
            ai_profile_id=normalized_ai_profile_id,
            requested_by=requested_by,
            provider_config_id=provider_config_id,
            pricing_id=pricing_info["pricing_id"],
            provider_type=provider_type,
            provider_family=provider_family,
            execution_adapter=execution_adapter,
            provider_name_snapshot=provider_name_snapshot,
            model_name=model_name,
            external_run_id=external_run_id,
            external_thread_id=external_thread_id,
            started_at=started_at_db,
            finished_at=finished_at_db,
            latency_ms=int(latency_ms) if latency_ms is not None else None,
            input_tokens=int(input_tokens) if input_tokens is not None else None,
            output_tokens=int(output_tokens) if output_tokens is not None else None,
            total_tokens=total_tokens,
            currency=pricing_info["currency"],
            input_cost=pricing_info["input_cost"],
            output_cost=pricing_info["output_cost"],
            total_cost=pricing_info["total_cost"],
            cost_estimated=bool(pricing_info["cost_estimated"]),
            cost_source=pricing_info["cost_source"],
            error_code=error_code,
            error_message=(str(error_message or "").strip() or None),
            provider_usage_raw_json=provider_usage_raw_json,
            provider_meta_json=provider_meta_json,
        )

        db.add(obj)
        db.commit()
        db.refresh(obj)
        return _build_response_dict(obj)
    except Exception as exc:
        db.rollback()
        if suppress_errors:
            logger.warning("No se pudo registrar ai_usage_event | tx=%s err=%s", minute_transaction_id, exc)
            return None
        raise


def _build_overview(q) -> dict[str, Any]:
    row = (
        q.with_entities(
            func.count(AiUsageEvent.id).label("total_events"),
            func.sum(case((AiUsageEvent.status == "success", 1), else_=0)).label("success_events"),
            func.sum(case((AiUsageEvent.status != "success", 1), else_=0)).label("failed_events"),
            func.sum(func.coalesce(AiUsageEvent.input_tokens, 0)).label("input_tokens"),
            func.sum(func.coalesce(AiUsageEvent.output_tokens, 0)).label("output_tokens"),
            func.sum(func.coalesce(AiUsageEvent.total_tokens, 0)).label("total_tokens"),
            func.sum(func.coalesce(AiUsageEvent.total_cost, 0)).label("total_cost"),
            func.sum(case((AiUsageEvent.total_cost.isnot(None), 1), else_=0)).label("estimated_cost_events"),
            func.avg(case((AiUsageEvent.status == "success", AiUsageEvent.total_cost), else_=None)).label("average_cost"),
            func.avg(AiUsageEvent.latency_ms).label("average_latency_ms"),
            func.count(func.distinct(AiUsageEvent.client_id)).label("unique_clients"),
            func.count(func.distinct(AiUsageEvent.project_id)).label("unique_projects"),
            func.count(func.distinct(AiUsageEvent.model_name)).label("unique_models"),
            func.count(func.distinct(AiUsageEvent.provider_type)).label("unique_providers"),
        )
        .first()
    )

    total_events = _safe_int(getattr(row, "total_events", 0))
    success_events = _safe_int(getattr(row, "success_events", 0))
    failed_events = _safe_int(getattr(row, "failed_events", 0))

    return {
        "totalEvents": total_events,
        "successEvents": success_events,
        "failedEvents": failed_events,
        "successRate": _percentage(success_events, total_events),
        "totalInputTokens": _safe_int(getattr(row, "input_tokens", 0)),
        "totalOutputTokens": _safe_int(getattr(row, "output_tokens", 0)),
        "totalTokens": _safe_int(getattr(row, "total_tokens", 0)),
        "totalCost": _safe_float(getattr(row, "total_cost", 0)),
        "estimatedCostEvents": _safe_int(getattr(row, "estimated_cost_events", 0)),
        "averageCostPerSuccess": _nullable_float(getattr(row, "average_cost", None)),
        "averageLatencyMs": _nullable_float(getattr(row, "average_latency_ms", None)),
        "uniqueClients": _safe_int(getattr(row, "unique_clients", 0)),
        "uniqueProjects": _safe_int(getattr(row, "unique_projects", 0)),
        "uniqueModels": _safe_int(getattr(row, "unique_models", 0)),
        "uniqueProviders": _safe_int(getattr(row, "unique_providers", 0)),
    }


def _build_timeseries(q) -> list[dict[str, Any]]:
    rows = (
        q.with_entities(
            func.date(AiUsageEvent.started_at).label("bucket_date"),
            func.count(AiUsageEvent.id).label("events"),
            func.sum(case((AiUsageEvent.status == "success", 1), else_=0)).label("success_events"),
            func.sum(case((AiUsageEvent.status != "success", 1), else_=0)).label("failed_events"),
            func.sum(func.coalesce(AiUsageEvent.input_tokens, 0)).label("input_tokens"),
            func.sum(func.coalesce(AiUsageEvent.output_tokens, 0)).label("output_tokens"),
            func.sum(func.coalesce(AiUsageEvent.total_tokens, 0)).label("total_tokens"),
            func.sum(func.coalesce(AiUsageEvent.total_cost, 0)).label("total_cost"),
            func.avg(AiUsageEvent.latency_ms).label("average_latency_ms"),
        )
        .group_by(func.date(AiUsageEvent.started_at))
        .order_by(func.date(AiUsageEvent.started_at).asc())
        .all()
    )

    return [
        {
            "date": str(getattr(row, "bucket_date", "")),
            "events": _safe_int(getattr(row, "events", 0)),
            "successEvents": _safe_int(getattr(row, "success_events", 0)),
            "failedEvents": _safe_int(getattr(row, "failed_events", 0)),
            "inputTokens": _safe_int(getattr(row, "input_tokens", 0)),
            "outputTokens": _safe_int(getattr(row, "output_tokens", 0)),
            "totalTokens": _safe_int(getattr(row, "total_tokens", 0)),
            "totalCost": _safe_float(getattr(row, "total_cost", 0)),
            "averageLatencyMs": _nullable_float(getattr(row, "average_latency_ms", None)),
        }
        for row in rows
    ]


def _build_breakdown(q, *, key_expr, label_expr=None, limit: int = 8) -> list[dict[str, Any]]:
    if label_expr is None:
        label_expr = key_expr
    rows = (
        q.with_entities(
            key_expr.label("bucket_key"),
            label_expr.label("bucket_label"),
            func.count(AiUsageEvent.id).label("events"),
            func.sum(case((AiUsageEvent.status == "success", 1), else_=0)).label("success_events"),
            func.sum(case((AiUsageEvent.status != "success", 1), else_=0)).label("failed_events"),
            func.sum(func.coalesce(AiUsageEvent.input_tokens, 0)).label("input_tokens"),
            func.sum(func.coalesce(AiUsageEvent.output_tokens, 0)).label("output_tokens"),
            func.sum(func.coalesce(AiUsageEvent.total_tokens, 0)).label("total_tokens"),
            func.sum(AiUsageEvent.total_cost).label("total_cost"),
            func.sum(case((AiUsageEvent.total_cost.isnot(None), 1), else_=0)).label("estimated_cost_events"),
            func.avg(AiUsageEvent.latency_ms).label("average_latency_ms"),
        )
        .group_by(key_expr, label_expr)
        .order_by(func.count(AiUsageEvent.id).desc(), label_expr.asc())
        .limit(limit)
        .all()
    )

    results: list[dict[str, Any]] = []
    for row in rows:
        events = _safe_int(getattr(row, "events", 0))
        success_events = _safe_int(getattr(row, "success_events", 0))
        results.append(
            {
                "key": str(getattr(row, "bucket_key", "") or "sin-dato"),
                "label": str(getattr(row, "bucket_label", "") or "Sin dato"),
                "events": events,
                "successEvents": success_events,
                "failedEvents": _safe_int(getattr(row, "failed_events", 0)),
                "successRate": _percentage(success_events, events),
                "inputTokens": _safe_int(getattr(row, "input_tokens", 0)),
                "outputTokens": _safe_int(getattr(row, "output_tokens", 0)),
                "totalTokens": _safe_int(getattr(row, "total_tokens", 0)),
                "totalCost": _nullable_float(getattr(row, "total_cost", None)),
                "estimatedCostEvents": _safe_int(getattr(row, "estimated_cost_events", 0)),
                "averageLatencyMs": _nullable_float(getattr(row, "average_latency_ms", None)),
            }
        )
    return results


def _build_filters_meta(q) -> dict[str, Any]:
    def distinct_values(column) -> list[str]:
        rows = (
            q.with_entities(column)
            .filter(column.isnot(None))
            .distinct()
            .order_by(column.asc())
            .all()
        )
        values = []
        for row in rows:
            value = row[0]
            if value is not None:
                values.append(str(value))
        return values

    return {
        "eventTypes": distinct_values(AiUsageEvent.event_type),
        "statuses": distinct_values(AiUsageEvent.status),
        "providerTypes": distinct_values(AiUsageEvent.provider_type),
        "providerFamilies": distinct_values(AiUsageEvent.provider_family),
        "executionAdapters": distinct_values(AiUsageEvent.execution_adapter),
        "modelNames": distinct_values(AiUsageEvent.model_name),
        "aiProfileIds": distinct_values(AiUsageEvent.ai_profile_id),
    }


def get_ai_usage_event(db: Session, session: UserSession, event_id: int) -> dict[str, Any]:
    return _build_response_dict(_get_or_404(db, session, event_id))


def list_ai_usage_events(db: Session, session: UserSession, filters) -> dict[str, Any]:
    try:
        ensure_ai_usage_schema_access(db)
    except (OperationalError, ProgrammingError) as exc:
        if _is_missing_schema_error(exc):
            return {
                "items": [],
                "total": 0,
                "skip": int(filters.skip),
                "limit": int(filters.limit),
            }
        raise

    q = _build_base_query(db, session, filters)

    total = q.with_entities(func.count(AiUsageEvent.id)).scalar() or 0

    items = (
        q.options(
            joinedload(AiUsageEvent.requested_by_user),
            joinedload(AiUsageEvent.provider_config),
        )
        .order_by(AiUsageEvent.started_at.desc(), AiUsageEvent.id.desc())
        .offset(filters.skip)
        .limit(filters.limit)
        .all()
    )

    return {
        "items": [_build_response_dict(item) for item in items],
        "total": int(total),
        "skip": int(filters.skip),
        "limit": int(filters.limit),
    }


def get_ai_usage_summary(db: Session, session: UserSession, filters) -> dict[str, Any]:
    try:
        ensure_ai_usage_schema_access(db)
    except (OperationalError, ProgrammingError) as exc:
        if _is_missing_schema_error(exc):
            return _empty_summary()
        raise

    q = _build_base_query(db, session, filters)
    breakdown_limit = int(getattr(filters, "breakdown_limit", 8) or 8)
    recent_limit = int(getattr(filters, "recent_limit", 12) or 12)

    by_status = _build_breakdown(
        q,
        key_expr=AiUsageEvent.status,
        label_expr=AiUsageEvent.status,
        limit=breakdown_limit,
    )
    by_provider = _build_breakdown(
        q,
        key_expr=func.coalesce(AiUsageEvent.provider_type, "sin-provider"),
        label_expr=func.coalesce(AiUsageEvent.provider_name_snapshot, AiUsageEvent.provider_type, "Sin provider"),
        limit=breakdown_limit,
    )
    by_model = _build_breakdown(
        q,
        key_expr=func.coalesce(AiUsageEvent.model_name, "sin-modelo"),
        label_expr=func.coalesce(AiUsageEvent.model_name, "Sin modelo"),
        limit=breakdown_limit,
    )
    profile_query = q.outerjoin(AiProfile, AiProfile.id == AiUsageEvent.ai_profile_id)
    by_profile = _build_breakdown(
        profile_query,
        key_expr=func.coalesce(AiUsageEvent.ai_profile_id, "sin-perfil"),
        label_expr=func.coalesce(AiProfile.name, "Sin perfil"),
        limit=breakdown_limit,
    )

    client_query = q.outerjoin(Client, Client.id == AiUsageEvent.client_id)
    by_client = _build_breakdown(
        client_query,
        key_expr=func.coalesce(AiUsageEvent.client_id, "sin-cliente"),
        label_expr=func.coalesce(Client.name, "Sin cliente"),
        limit=breakdown_limit,
    )

    project_query = q.outerjoin(Project, Project.id == AiUsageEvent.project_id)
    by_project = _build_breakdown(
        project_query,
        key_expr=func.coalesce(AiUsageEvent.project_id, "sin-proyecto"),
        label_expr=func.coalesce(Project.name, "Sin proyecto"),
        limit=breakdown_limit,
    )

    recent_items = (
        q.options(
            joinedload(AiUsageEvent.requested_by_user),
            joinedload(AiUsageEvent.provider_config),
        )
        .order_by(AiUsageEvent.started_at.desc(), AiUsageEvent.id.desc())
        .limit(recent_limit)
        .all()
    )

    return {
        "overview": _build_overview(q),
        "timeseries": _build_timeseries(q),
        "byStatus": by_status,
        "byProvider": by_provider,
        "byModel": by_model,
        "byProfile": by_profile,
        "byClient": by_client,
        "byProject": by_project,
        "recentEvents": [_build_response_dict(item) for item in recent_items],
        "filtersMeta": _build_filters_meta(q),
    }
