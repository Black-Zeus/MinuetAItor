from __future__ import annotations

from collections import defaultdict
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import false, or_
from sqlalchemy.orm import Session, joinedload

from core.datetime_utils import utc_now_db
from models.record_status_transitions import RecordStatusTransition
from models.record_versions import RecordVersion
from models.records import Record
from models.user import User
from schemas.auth import UserSession
from schemas.minutes import (
    MinuteCycleTimeItem,
    MinuteCycleTimeResponse,
    MinuteDetailResponse,
    MinuteReprocessHistoryItem,
    MinuteReprocessHistoryResponse,
    MinuteListItem,
    MinuteListResponse,
    MinuteRecordInfo,
    MinuteTagItem,
    MinuteVersionItem,
    MinuteVersionsResponse,
)
from services.access_control_service import apply_record_scope_filter
from services.minutes.attachments import list_minute_input_attachments
from services.minutes.constants import (
    BUCKET_DRAFT,
    BUCKET_JSON,
    RECORD_STATUS_COMPLETED,
    RECORD_STATUS_DELETED,
    RECORD_STATUS_IN_PROGRESS,
    RECORD_STATUS_PENDING,
    RECORD_STATUS_PREVIEW,
    RECORD_STATUS_READY,
    RECORD_STATUS_CANCELLED,
    STATUSES_NO_CONTENT,
)
from services.minutes.reprocess import (
    get_latest_minute_transaction,
    get_reprocess_eligibility,
)
from services.pdf_template_resolver import ensure_pdf_template_in_content, resolve_pdf_template_for_record
from services.minutes.sanitizers import (
    calculate_duration_label,
    extract_summary_from_minute_content,
    format_hhmm,
)
from services.minutes.storage import read_json


def _looks_like_ai_output(content: object) -> bool:
    if not isinstance(content, dict):
        return False

    if "generalInfo" in content or "scope" in content or "inputInfo" in content:
        return True

    participants = content.get("participants")
    agreements = content.get("agreements")
    requirements = content.get("requirements")
    upcoming_meetings = content.get("upcomingMeetings")

    return any(
        isinstance(candidate, dict)
        for candidate in (participants, agreements, requirements, upcoming_meetings)
    )


def _load_minute_list_summary(record_id: str, status_code: str, version_num: int) -> Optional[str]:
    if status_code == RECORD_STATUS_READY:
        content = _read_initial_ai_output(record_id)
        return extract_summary_from_minute_content(content)

    if status_code == RECORD_STATUS_PENDING:
        draft = read_json(BUCKET_DRAFT, f"{record_id}/draft_current.json")
        if draft is not None:
            return extract_summary_from_minute_content(draft)
        content = _read_initial_ai_output(record_id)
        return extract_summary_from_minute_content(content)

    if status_code in (RECORD_STATUS_PREVIEW, RECORD_STATUS_COMPLETED):
        content = read_json(BUCKET_JSON, f"{record_id}/schema_output_v{version_num}.json")
        return extract_summary_from_minute_content(content)

    return None


def _read_initial_ai_output(record_id: str) -> Optional[dict]:
    return (
        read_json(BUCKET_JSON, f"{record_id}/schema_output_v0.json")
        or read_json(BUCKET_JSON, f"{record_id}/schema_output_v1.json")
    )


def get_minute_detail(db: Session, record_id: str) -> MinuteDetailResponse:
    from models.record_statuses import RecordStatus

    record = (
        db.query(Record)
        .options(
            joinedload(Record.client),
            joinedload(Record.project),
            joinedload(Record.prepared_by_user),
            joinedload(Record.status),
        )
        .filter(Record.id == record_id, Record.deleted_at.is_(None))
        .first()
    )
    if record is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "record_not_found", "message": f"Minuta '{record_id}' no encontrada."},
        )

    status_row = getattr(record, "status", None) or db.query(RecordStatus).filter_by(id=record.status_id).first()
    status_code = status_row.code if status_row else "unknown"

    client_name = getattr(getattr(record, "client", None), "name", None)
    project_name = getattr(getattr(record, "project", None), "name", None)
    prepared_by_name = None
    prep_user = getattr(record, "prepared_by_user", None)
    if prep_user:
        prepared_by_name = (
            getattr(prep_user, "full_name", None)
            or getattr(prep_user, "username", None)
        )

    record_info = MinuteRecordInfo(
        id=record.id,
        status=status_code,
        title=record.title,
        client_id=str(record.client_id) if record.client_id else None,
        client_name=client_name,
        project_id=str(record.project_id) if record.project_id else None,
        project_name=project_name,
        active_version_id=str(record.active_version_id) if record.active_version_id else None,
        active_version_num=int(record.latest_version_num) if record.latest_version_num else None,
        document_date=record.document_date.isoformat() if record.document_date else None,
        location=record.location,
        prepared_by=prepared_by_name,
        created_at=record.created_at.isoformat() if getattr(record, "created_at", None) else None,
    )
    input_attachments = list_minute_input_attachments(db, record_id)

    if status_code in STATUSES_NO_CONTENT:
        return MinuteDetailResponse(
            record=record_info,
            content=None,
            content_type=None,
            input_attachments=input_attachments,
        )

    content = None
    content_type: Optional[str] = None
    version_num = int(record.latest_version_num) if record.latest_version_num else 1

    if status_code == RECORD_STATUS_READY:
        content = _read_initial_ai_output(record_id)
        content = ensure_pdf_template_in_content(content, resolve_pdf_template_for_record(record))
        content_type = "ai_output"
    elif status_code == RECORD_STATUS_PENDING:
        content = read_json(BUCKET_DRAFT, f"{record_id}/draft_current.json")
        if content is not None:
            content = ensure_pdf_template_in_content(content, resolve_pdf_template_for_record(record))
            content_type = "ai_output" if _looks_like_ai_output(content) else "draft"
        else:
            content = _read_initial_ai_output(record_id)
            content = ensure_pdf_template_in_content(content, resolve_pdf_template_for_record(record))
            content_type = "ai_output"
    elif status_code in (RECORD_STATUS_PREVIEW, RECORD_STATUS_COMPLETED):
        content = read_json(BUCKET_JSON, f"{record_id}/schema_output_v{version_num}.json")
        content = ensure_pdf_template_in_content(content, resolve_pdf_template_for_record(record))
        content_type = "snapshot"

    return MinuteDetailResponse(
        record=record_info,
        content=content,
        content_type=content_type,
        input_attachments=input_attachments,
    )


def list_minutes(
    db: Session,
    skip: int = 0,
    limit: int = 12,
    q: Optional[str] = None,
    status_filter: Optional[str] = None,
    client_id: Optional[str] = None,
    project_id: Optional[str] = None,
    prepared_by_user_id: Optional[str] = None,
    participant_user_id: Optional[str] = None,
    exclude_prepared_by_user_id: Optional[str] = None,
    session: UserSession | None = None,
) -> MinuteListResponse:
    from models.clients import Client
    from models.minute_transaction import MinuteTransaction
    from models.projects import Project
    from models.record_statuses import RecordStatus
    from models.record_version_participant import RecordVersionParticipant

    query = db.query(Record).filter(Record.deleted_at.is_(None))
    if session is not None:
        query = apply_record_scope_filter(query, db, session, Record)

    if q:
        term = f"%{q.strip()}%"
        query = (
            query.outerjoin(Client, Client.id == Record.client_id)
            .outerjoin(Project, Project.id == Record.project_id)
            .outerjoin(
                RecordVersionParticipant,
                RecordVersionParticipant.record_version_id == Record.active_version_id,
            )
            .filter(
                or_(
                    Record.title.ilike(term),
                    Record.intro_snippet.ilike(term),
                    Client.name.ilike(term),
                    Project.name.ilike(term),
                    RecordVersionParticipant.display_name.ilike(term),
                    RecordVersionParticipant.organization.ilike(term),
                    RecordVersionParticipant.title.ilike(term),
                    RecordVersionParticipant.email.ilike(term),
                )
            )
            .distinct()
        )

    if status_filter:
        status_obj = db.query(RecordStatus).filter_by(code=status_filter).first()
        if status_obj:
            query = query.filter(Record.status_id == status_obj.id)

    if client_id:
        query = query.filter(Record.client_id == client_id)
    if project_id:
        query = query.filter(Record.project_id == project_id)
    if prepared_by_user_id:
        query = query.filter(Record.prepared_by_user_id == prepared_by_user_id)
    if exclude_prepared_by_user_id:
        query = query.filter(Record.prepared_by_user_id != exclude_prepared_by_user_id)

    if participant_user_id:
        user = db.query(User).filter(User.id == participant_user_id, User.deleted_at.is_(None)).first()
        participant_email = (user.email or "").strip() if user else ""

        if not participant_email:
            query = query.filter(false())
        else:
            participant_exists = (
                db.query(RecordVersionParticipant.id)
                .filter(
                    RecordVersionParticipant.record_version_id == Record.active_version_id,
                    RecordVersionParticipant.email.ilike(participant_email),
                )
                .exists()
            )
            query = query.filter(participant_exists)

    total = query.count()
    records = (
        query.options(
            joinedload(Record.client),
            joinedload(Record.project),
            joinedload(Record.prepared_by_user),
            joinedload(Record.status),
        )
        .order_by(Record.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    record_ids = [str(rec.id) for rec in records]
    active_version_ids = [str(rec.active_version_id) for rec in records if rec.active_version_id]

    latest_tx_by_record: dict[str, MinuteTransaction] = {}
    if record_ids:
        tx_rows = (
            db.query(MinuteTransaction)
            .filter(MinuteTransaction.record_id.in_(record_ids))
            .order_by(
                MinuteTransaction.record_id.asc(),
                MinuteTransaction.created_at.desc(),
                MinuteTransaction.id.desc(),
            )
            .all()
        )
        for tx in tx_rows:
            record_key = str(tx.record_id)
            if record_key not in latest_tx_by_record:
                latest_tx_by_record[record_key] = tx

    participants_by_version: dict[str, list[str]] = defaultdict(list)
    if active_version_ids:
        participant_rows = (
            db.query(RecordVersionParticipant)
            .filter(RecordVersionParticipant.record_version_id.in_(active_version_ids))
            .order_by(
                RecordVersionParticipant.record_version_id.asc(),
                RecordVersionParticipant.display_name.asc(),
            )
            .all()
        )
        for participant in participant_rows:
            if participant.display_name:
                participants_by_version[str(participant.record_version_id)].append(participant.display_name)

    items = []
    for rec in records:
        status_row = getattr(rec, "status", None) or db.query(RecordStatus).filter_by(id=rec.status_id).first()
        status_code = status_row.code if status_row else "unknown"

        client_name = getattr(getattr(rec, "client", None), "name", None)
        project_name = getattr(getattr(rec, "project", None), "name", None)
        prep_user = getattr(rec, "prepared_by_user", None)
        prepared_by_name = (
            getattr(prep_user, "full_name", None)
            or getattr(prep_user, "username", None)
        )
        version_num = int(rec.latest_version_num) if rec.latest_version_num else 1
        # La vista de listado debe depender solo de BD. Leer JSON desde storage
        # por cada minuta vuelve el endpoint sensible a MinIO y genera N+1 I/O.
        summary_text = getattr(rec, "intro_snippet", None)
        latest_tx = latest_tx_by_record.get(str(rec.id))
        can_reprocess, reprocess_reason = get_reprocess_eligibility(status_code, latest_tx)
        tokens_input = int(getattr(latest_tx, "tokens_input", 0) or 0)
        tokens_output = int(getattr(latest_tx, "tokens_output", 0) or 0)
        time_text = format_hhmm(rec.actual_start_time or rec.scheduled_start_time)
        duration_text = calculate_duration_label(
            rec.scheduled_start_time,
            rec.scheduled_end_time,
            rec.actual_start_time,
            rec.actual_end_time,
        )

        participant_names = (
            participants_by_version.get(str(rec.active_version_id), [])
            if rec.active_version_id
            else []
        )

        tag_items = []
        if hasattr(rec, "tags"):
            tag_items = [MinuteTagItem(label=t.name, color=t.color or "#6B7280") for t in rec.tags]

        items.append(
            MinuteListItem(
                id=rec.id,
                title=rec.title or "",
                date=rec.document_date.isoformat() if rec.document_date else None,
                time=time_text,
                duration=duration_text,
                client_id=str(rec.client_id) if rec.client_id else None,
                project_id=str(rec.project_id) if rec.project_id else None,
                prepared_by=prepared_by_name,
                status=status_code,
                client=client_name,
                project=project_name,
                participants=participant_names,
                summary=summary_text,
                tags=tag_items,
                error_message=getattr(latest_tx, "error_message", None),
                can_reprocess=can_reprocess,
                reprocess_reason=reprocess_reason,
                tokens_input=tokens_input,
                tokens_output=tokens_output,
                total_tokens=tokens_input + tokens_output,
            )
        )

    return MinuteListResponse(minutes=items, total=total, skip=skip, limit=limit)


def list_minute_reprocess_history(
    db: Session,
    skip: int = 0,
    limit: int = 500,
    client_id: Optional[str] = None,
    project_id: Optional[str] = None,
    prepared_by_user_id: Optional[str] = None,
    session: UserSession | None = None,
) -> MinuteReprocessHistoryResponse:
    from models.ai_usage_events import AiUsageEvent
    from models.minute_transaction import MinuteTransaction
    from models.record_statuses import RecordStatus

    tx_query = (
        db.query(MinuteTransaction)
        .join(Record, Record.id == MinuteTransaction.record_id)
        .filter(Record.deleted_at.is_(None))
    )
    if session is not None:
        tx_query = apply_record_scope_filter(tx_query, db, session, Record)

    if client_id:
        tx_query = tx_query.filter(Record.client_id == client_id)
    if project_id:
        tx_query = tx_query.filter(Record.project_id == project_id)
    if prepared_by_user_id:
        tx_query = tx_query.filter(Record.prepared_by_user_id == prepared_by_user_id)

    transactions = (
        tx_query.options(
            joinedload(MinuteTransaction.record).joinedload(Record.client),
            joinedload(MinuteTransaction.record).joinedload(Record.project),
            joinedload(MinuteTransaction.record).joinedload(Record.prepared_by_user),
        )
        .order_by(
            MinuteTransaction.record_id.asc(),
            MinuteTransaction.created_at.asc(),
            MinuteTransaction.id.asc(),
        ).all()
    )

    if not transactions:
        return MinuteReprocessHistoryResponse(items=[], total=0, skip=skip, limit=limit)

    tx_ids = [tx.id for tx in transactions]
    usage_rows = (
        db.query(AiUsageEvent)
        .filter(AiUsageEvent.minute_transaction_id.in_(tx_ids))
        .order_by(AiUsageEvent.id.desc())
        .all()
    )
    usage_by_tx_id = {}
    for usage in usage_rows:
        tx_id = str(getattr(usage, "minute_transaction_id", "") or "").strip()
        if tx_id and tx_id not in usage_by_tx_id:
            usage_by_tx_id[tx_id] = usage

    status_cache: dict[str, str] = {}

    def resolve_record_status_label(record_status_id: str | None) -> str | None:
        if not record_status_id:
            return None
        if record_status_id not in status_cache:
            row = db.query(RecordStatus).filter_by(id=record_status_id).first()
            status_cache[record_status_id] = row.code if row else "unknown"
        return status_cache.get(record_status_id)

    attempts_by_record: dict[str, int] = {}
    history_items: list[MinuteReprocessHistoryItem] = []

    for tx in transactions:
        record = getattr(tx, "record", None)
        if not record:
            continue

        record_id = str(record.id)
        attempts_by_record[record_id] = attempts_by_record.get(record_id, 0) + 1
        attempt_number = attempts_by_record[record_id]

        # La primera transacción corresponde a la generación original; desde la segunda
        # se considera reproceso histórico.
        if attempt_number <= 1:
            continue

        usage = usage_by_tx_id.get(str(tx.id))
        event_error_code = str(getattr(usage, "error_code", "") or "").strip()
        tx_status = str(getattr(tx, "status", "") or "").strip() or "failed"

        if tx_status == "completed":
            status_code = "completed"
            status_label = "OK / siguió flujo"
            can_reprocess = False
        elif tx_status in {"pending", "processing"}:
            status_code = "in-progress"
            status_label = "En procesamiento"
            current_record_status = resolve_record_status_label(getattr(record, "status_id", None))
            latest_tx = get_latest_minute_transaction(db, record_id)
            can_reprocess, _ = get_reprocess_eligibility(current_record_status, latest_tx)
        else:
            status_code = event_error_code if event_error_code in {"llm-failed", "processing-error"} else "processing-error"
            status_label = "Con error"
            can_reprocess = True

        client_name = getattr(getattr(record, "client", None), "name", None)
        project_name = getattr(getattr(record, "project", None), "name", None)
        prep_user = getattr(record, "prepared_by_user", None)
        prepared_by_name = (
            getattr(prep_user, "full_name", None)
            or getattr(prep_user, "username", None)
        )

        tokens_input = int(getattr(tx, "tokens_input", 0) or 0)
        tokens_output = int(getattr(tx, "tokens_output", 0) or 0)

        history_items.append(
            MinuteReprocessHistoryItem(
                transaction_id=str(tx.id),
                record_id=record_id,
                attempt_number=attempt_number - 1,
                title=getattr(record, "title", None) or "Minuta sin título",
                date=tx.created_at.isoformat() if getattr(tx, "created_at", None) else None,
                client_id=str(record.client_id) if getattr(record, "client_id", None) else None,
                project_id=str(record.project_id) if getattr(record, "project_id", None) else None,
                prepared_by=prepared_by_name,
                status=status_code,
                status_label=status_label,
                client=client_name,
                project=project_name,
                error_message=getattr(tx, "error_message", None),
                can_reprocess=can_reprocess,
                reprocess_reason="record-error" if can_reprocess and tx_status == "failed" else None,
                tokens_input=tokens_input,
                tokens_output=tokens_output,
                total_tokens=tokens_input + tokens_output,
            )
        )

    history_items.sort(
        key=lambda item: (
            item.date or "",
            item.record_id,
            item.transaction_id,
        ),
        reverse=True,
    )

    total = len(history_items)
    paginated = history_items[skip : skip + limit]
    return MinuteReprocessHistoryResponse(items=paginated, total=total, skip=skip, limit=limit)


def list_minute_cycle_times(
    db: Session,
    skip: int = 0,
    limit: int = 500,
    client_id: Optional[str] = None,
    project_id: Optional[str] = None,
    prepared_by_user_id: Optional[str] = None,
    session: UserSession | None = None,
) -> MinuteCycleTimeResponse:
    from models.record_statuses import RecordStatus

    record_query = db.query(Record).filter(Record.deleted_at.is_(None))
    if session is not None:
        record_query = apply_record_scope_filter(record_query, db, session, Record)

    if client_id:
        record_query = record_query.filter(Record.client_id == client_id)
    if project_id:
        record_query = record_query.filter(Record.project_id == project_id)
    if prepared_by_user_id:
        record_query = record_query.filter(Record.prepared_by_user_id == prepared_by_user_id)

    records = (
        record_query.options(
            joinedload(Record.client),
            joinedload(Record.project),
            joinedload(Record.prepared_by_user),
            joinedload(Record.status),
        )
        .order_by(Record.created_at.desc())
        .all()
    )
    if not records:
        return MinuteCycleTimeResponse(items=[], total=0, skip=skip, limit=limit)

    record_ids = [record.id for record in records]
    transition_rows = (
        db.query(RecordStatusTransition)
        .options(
            joinedload(RecordStatusTransition.from_status),
            joinedload(RecordStatusTransition.to_status),
        )
        .filter(RecordStatusTransition.record_id.in_(record_ids))
        .order_by(
            RecordStatusTransition.record_id.asc(),
            RecordStatusTransition.changed_at.asc(),
            RecordStatusTransition.id.asc(),
        )
        .all()
    )
    if not transition_rows:
        return MinuteCycleTimeResponse(items=[], total=0, skip=skip, limit=limit)

    transitions_by_record: dict[str, list[RecordStatusTransition]] = defaultdict(list)
    for transition in transition_rows:
        if transition.record_id:
            transitions_by_record[str(transition.record_id)].append(transition)

    terminal_statuses = {RECORD_STATUS_COMPLETED, RECORD_STATUS_CANCELLED, RECORD_STATUS_DELETED}
    now_utc = utc_now_db()
    items: list[MinuteCycleTimeItem] = []

    for record in records:
        record_transitions = transitions_by_record.get(str(record.id), [])
        if not record_transitions:
            continue

        first_transition = record_transitions[0]
        last_transition = record_transitions[-1]
        current_status_code = (
            getattr(getattr(last_transition, "to_status", None), "code", None)
            or getattr(getattr(record, "status", None), "code", None)
            or "unknown"
        )
        cycle_closed = current_status_code in terminal_statuses
        cycle_end_at = last_transition.changed_at if cycle_closed else now_utc

        processing_duration_ms = 0
        editing_duration_ms = 0
        review_duration_ms = 0
        return_to_edit_count = 0

        for index, transition in enumerate(record_transitions):
            status_code = getattr(getattr(transition, "to_status", None), "code", None) or "unknown"
            segment_start = transition.changed_at
            if segment_start is None:
                continue

            if index + 1 < len(record_transitions):
                segment_end = record_transitions[index + 1].changed_at
            else:
                segment_end = cycle_end_at

            if segment_end is None or segment_end < segment_start:
                continue

            delta_ms = int((segment_end - segment_start).total_seconds() * 1000)
            if status_code == RECORD_STATUS_IN_PROGRESS:
                processing_duration_ms += delta_ms
            elif status_code in {RECORD_STATUS_READY, RECORD_STATUS_PENDING}:
                editing_duration_ms += delta_ms
            elif status_code == RECORD_STATUS_PREVIEW:
                review_duration_ms += delta_ms

            from_status_code = getattr(getattr(transition, "from_status", None), "code", None)
            if from_status_code == RECORD_STATUS_PREVIEW and status_code == RECORD_STATUS_PENDING:
                return_to_edit_count += 1

        total_cycle_duration_ms = 0
        if first_transition.changed_at and cycle_end_at and cycle_end_at >= first_transition.changed_at:
            total_cycle_duration_ms = int((cycle_end_at - first_transition.changed_at).total_seconds() * 1000)

        client_name = getattr(getattr(record, "client", None), "name", None)
        project_name = getattr(getattr(record, "project", None), "name", None)
        prep_user = getattr(record, "prepared_by_user", None)
        prepared_by_name = (
            getattr(prep_user, "full_name", None)
            or getattr(prep_user, "username", None)
        )

        status_label_map = {
            RECORD_STATUS_IN_PROGRESS: "En procesamiento",
            RECORD_STATUS_READY: "Listo para editar",
            RECORD_STATUS_PENDING: "Pendiente",
            RECORD_STATUS_PREVIEW: "En revisión",
            RECORD_STATUS_COMPLETED: "Completado",
            RECORD_STATUS_CANCELLED: "Cancelado",
            "llm-failed": "Fallo IA",
            "processing-error": "Error de proceso",
            RECORD_STATUS_DELETED: "Eliminado",
        }

        items.append(
            MinuteCycleTimeItem(
                record_id=str(record.id),
                title=record.title or "Minuta sin título",
                date=record.document_date.isoformat() if record.document_date else None,
                client_id=str(record.client_id) if record.client_id else None,
                project_id=str(record.project_id) if record.project_id else None,
                prepared_by=prepared_by_name,
                status=current_status_code,
                status_label=status_label_map.get(current_status_code, current_status_code),
                client=client_name,
                project=project_name,
                cycle_started_at=first_transition.changed_at.isoformat() if first_transition.changed_at else None,
                last_transition_at=last_transition.changed_at.isoformat() if last_transition.changed_at else None,
                completed_at=last_transition.changed_at.isoformat() if cycle_closed and last_transition.changed_at else None,
                transition_count=len(record_transitions),
                return_to_edit_count=return_to_edit_count,
                processing_duration_ms=processing_duration_ms,
                editing_duration_ms=editing_duration_ms,
                review_duration_ms=review_duration_ms,
                total_cycle_duration_ms=total_cycle_duration_ms,
                cycle_closed=cycle_closed,
            )
        )

    total = len(items)
    paginated = items[skip : skip + limit]
    return MinuteCycleTimeResponse(items=paginated, total=total, skip=skip, limit=limit)


def get_minute_versions(db: Session, record_id: str) -> MinuteVersionsResponse:
    from models.version_statuses import VersionStatus

    record = db.query(Record).filter(Record.id == record_id, Record.deleted_at.is_(None)).first()
    if record is None:
        raise HTTPException(
            status_code=404,
            detail={"error": "record_not_found", "message": f"Minuta '{record_id}' no encontrada."},
        )

    versions_rows = (
        db.query(RecordVersion)
        .filter(
            RecordVersion.record_id == record_id,
            RecordVersion.version_num > 0,
            RecordVersion.deleted_at.is_(None),
        )
        .order_by(RecordVersion.version_num.desc())
        .all()
    )

    version_status_labels = {
        "snapshot": "Borrador",
        "final": "Publicada",
    }

    items = []
    for version in versions_rows:
        published_by_name = None
        if version.published_by_user:
            profile = getattr(version.published_by_user, "profile", None)
            published_by_name = getattr(profile, "full_name", None) or getattr(
                version.published_by_user,
                "username",
                None,
            )

        status: VersionStatus = version.status
        status_code = status.code if status else "unknown"
        status_label = version_status_labels.get(status_code, status_code)

        items.append(
            MinuteVersionItem(
                version_id=str(version.id),
                version_num=int(version.version_num),
                version_label=f"v{version.version_num}",
                status_code=status_code,
                status_label=status_label,
                published_at=version.published_at.isoformat() if version.published_at else None,
                published_by=published_by_name,
                commit_message=version.summary_text,
            )
        )

    return MinuteVersionsResponse(record_id=record_id, versions=items)
