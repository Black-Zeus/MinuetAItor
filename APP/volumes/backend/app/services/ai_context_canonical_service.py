from __future__ import annotations

import hashlib
import json
from datetime import date, datetime, time
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.clients import Client
from models.projects import Project
from models.record_statuses import RecordStatus
from models.record_version_agreements import RecordVersionAgreement
from models.record_version_observation import RecordVersionObservation
from models.record_version_participant import RecordVersionParticipant
from models.record_version_requirements import RecordVersionRequirement
from models.record_versions import RecordVersion
from models.records import Record
from models.version_statuses import VersionStatus


CANONICAL_SCHEMA_VERSION = "context-minute-v1"
SOURCE_SYSTEM = "minuetaitor"
RECORD_STATUS_COMPLETED = "completed"
VERSION_STATUS_FINAL = "final"


def build_minute_canonical_context(db: Session, record_id: str) -> dict[str, Any]:
    record = _get_record_or_404(db, record_id)
    record_status = _get_record_status_code(db, record.status_id)
    if record_status != RECORD_STATUS_COMPLETED:
        raise HTTPException(
            status_code=409,
            detail="Solo se puede generar contexto canonico desde minutas completadas.",
        )

    version = _get_final_version_or_409(db, record)
    client = _get_client_or_404(db, str(record.client_id))
    project = _get_project(db, str(record.project_id)) if record.project_id else None

    participants = _list_participants(db, str(version.id))
    agreements = _list_agreements(db, str(version.id))
    requirements = _list_requirements(db, str(version.id))
    observations = _list_applied_observations(db, str(record.id), str(version.id))

    canonical = {
        "schemaVersion": CANONICAL_SCHEMA_VERSION,
        "sourceSystem": SOURCE_SYSTEM,
        "sourceHash": None,
        "client": _client_payload(client),
        "project": _project_payload(project),
        "minute": _minute_payload(record, record_status),
        "version": _version_payload(db, version),
        "participants": [_participant_payload(item) for item in participants],
        "items": _build_items(
            record=record,
            version=version,
            agreements=agreements,
            requirements=requirements,
            observations=observations,
        ),
    }
    canonical["sourceHash"] = _source_hash(canonical)
    return canonical


def _get_record_or_404(db: Session, record_id: str) -> Record:
    record = (
        db.query(Record)
        .filter(Record.id == record_id)
        .filter(Record.deleted_at.is_(None))
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Minuta no encontrada.")
    return record


def _get_client_or_404(db: Session, client_id: str) -> Client:
    client = (
        db.query(Client)
        .filter(Client.id == client_id)
        .filter(Client.deleted_at.is_(None))
        .first()
    )
    if not client:
        raise HTTPException(status_code=404, detail="Cliente de la minuta no encontrado.")
    return client


def _get_project(db: Session, project_id: str) -> Project | None:
    return (
        db.query(Project)
        .filter(Project.id == project_id)
        .filter(Project.deleted_at.is_(None))
        .first()
    )


def _get_record_status_code(db: Session, status_id: int) -> str | None:
    row = (
        db.query(RecordStatus.code)
        .filter(RecordStatus.id == status_id)
        .filter(RecordStatus.deleted_at.is_(None))
        .first()
    )
    return str(row[0]) if row else None


def _get_version_status_code(db: Session, status_id: int) -> str | None:
    row = (
        db.query(VersionStatus.code)
        .filter(VersionStatus.id == status_id)
        .filter(VersionStatus.deleted_at.is_(None))
        .first()
    )
    return str(row[0]) if row else None


def _get_final_version_or_409(db: Session, record: Record) -> RecordVersion:
    active_version = None
    if record.active_version_id:
        active_version = (
            db.query(RecordVersion)
            .filter(RecordVersion.id == record.active_version_id)
            .filter(RecordVersion.record_id == record.id)
            .filter(RecordVersion.deleted_at.is_(None))
            .first()
        )
        if active_version and _get_version_status_code(db, active_version.status_id) == VERSION_STATUS_FINAL:
            return active_version

    final_status_id = (
        db.query(VersionStatus.id)
        .filter(VersionStatus.code == VERSION_STATUS_FINAL)
        .filter(VersionStatus.deleted_at.is_(None))
        .scalar()
    )
    version = (
        db.query(RecordVersion)
        .filter(RecordVersion.record_id == record.id)
        .filter(RecordVersion.deleted_at.is_(None))
        .filter(RecordVersion.status_id == final_status_id)
        .order_by(RecordVersion.version_num.desc(), RecordVersion.published_at.desc())
        .first()
        if final_status_id
        else None
    )
    if not version:
        raise HTTPException(
            status_code=409,
            detail="La minuta completada no tiene una version final disponible.",
        )
    return version


def _list_participants(db: Session, version_id: str) -> list[RecordVersionParticipant]:
    return (
        db.query(RecordVersionParticipant)
        .filter(RecordVersionParticipant.record_version_id == version_id)
        .order_by(RecordVersionParticipant.id.asc())
        .all()
    )


def _list_agreements(db: Session, version_id: str) -> list[RecordVersionAgreement]:
    return (
        db.query(RecordVersionAgreement)
        .filter(RecordVersionAgreement.record_version_id == version_id)
        .order_by(RecordVersionAgreement.source_index.asc(), RecordVersionAgreement.id.asc())
        .all()
    )


def _list_requirements(db: Session, version_id: str) -> list[RecordVersionRequirement]:
    return (
        db.query(RecordVersionRequirement)
        .filter(RecordVersionRequirement.record_version_id == version_id)
        .order_by(RecordVersionRequirement.source_index.asc(), RecordVersionRequirement.id.asc())
        .all()
    )


def _list_applied_observations(
    db: Session,
    record_id: str,
    version_id: str,
) -> list[RecordVersionObservation]:
    return (
        db.query(RecordVersionObservation)
        .filter(RecordVersionObservation.record_id == record_id)
        .filter(RecordVersionObservation.applied_in_version_id == version_id)
        .filter(RecordVersionObservation.status == "inserted")
        .order_by(RecordVersionObservation.created_at.asc(), RecordVersionObservation.id.asc())
        .all()
    )


def _client_payload(client: Client) -> dict[str, Any]:
    return _clean(
        {
            "id": client.id,
            "name": client.name,
            "legalName": client.legal_name,
            "industry": client.industry,
            "status": client.status,
            "priority": client.priority,
            "isConfidential": bool(client.is_confidential),
            "isActive": bool(client.is_active),
        }
    )


def _project_payload(project: Project | None) -> dict[str, Any] | None:
    if not project:
        return None
    return _clean(
        {
            "id": project.id,
            "clientId": project.client_id,
            "name": project.name,
            "code": project.code,
            "status": project.status,
            "isConfidential": bool(project.is_confidential),
            "isActive": bool(project.is_active),
        }
    )


def _minute_payload(record: Record, status_code: str | None) -> dict[str, Any]:
    return _clean(
        {
            "id": record.id,
            "clientId": record.client_id,
            "projectId": record.project_id,
            "title": record.title,
            "status": status_code,
            "documentDate": _iso(record.document_date),
            "location": record.location,
            "scheduledStartTime": _iso(record.scheduled_start_time),
            "scheduledEndTime": _iso(record.scheduled_end_time),
            "actualStartTime": _iso(record.actual_start_time),
            "actualEndTime": _iso(record.actual_end_time),
            "activeVersionId": record.active_version_id,
            "latestVersionNum": int(record.latest_version_num or 0),
        }
    )


def _version_payload(db: Session, version: RecordVersion) -> dict[str, Any]:
    return _clean(
        {
            "id": version.id,
            "recordId": version.record_id,
            "versionNum": int(version.version_num or 0),
            "status": _get_version_status_code(db, version.status_id),
            "publishedAt": _iso(version.published_at),
            "publishedBy": version.published_by,
            "schemaVersion": version.schema_version,
            "templateVersion": version.template_version,
            "aiProvider": version.ai_provider,
            "aiModel": version.ai_model,
            "aiRunId": version.ai_run_id,
        }
    )


def _participant_payload(item: RecordVersionParticipant) -> dict[str, Any]:
    role = getattr(item.role, "value", item.role)
    return _clean(
        {
            "id": f"participant:{item.id}",
            "sourceId": item.participant_id,
            "role": role,
            "displayName": item.display_name,
            "organization": item.organization,
            "title": item.title,
            "email": item.email,
        }
    )


def _build_items(
    *,
    record: Record,
    version: RecordVersion,
    agreements: list[RecordVersionAgreement],
    requirements: list[RecordVersionRequirement],
    observations: list[RecordVersionObservation],
) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    items.extend(_text_item(record, version, "summary", "Resumen", version.summary_text))
    items.extend(_structured_text_items(record, version, "decision", "Decisiones", version.decisions_text))
    items.extend(_structured_text_items(record, version, "risk", "Riesgos", version.risks_text))
    items.extend(_text_item(record, version, "next_steps", "Proximos pasos", version.next_steps_text))
    items.extend(_text_item(record, version, "agreements_text", "Acuerdos", version.agreements_text))

    for agreement in agreements:
        item = _clean(
            {
                "id": f"agreement:{agreement.id}",
                "type": "agreement",
                "title": agreement.subject,
                "text": agreement.body,
                "canonicalText": _join_text(
                    [
                        f"Acuerdo {agreement.agreement_code}",
                        agreement.subject,
                        agreement.body,
                        f"Responsable: {agreement.responsible}" if agreement.responsible else None,
                        f"Fecha compromiso: {_iso(agreement.due_date)}" if agreement.due_date else None,
                        f"Estado: {agreement.status}" if agreement.status else None,
                    ]
                ),
                "metadata": {
                    "recordId": record.id,
                    "versionId": version.id,
                    "code": agreement.agreement_code,
                    "responsible": agreement.responsible,
                    "dueDate": _iso(agreement.due_date),
                    "status": agreement.status,
                    "sourceIndex": int(agreement.source_index or 0),
                },
            }
        )
        items.append(item)

    for requirement in requirements:
        item = _clean(
            {
                "id": f"requirement:{requirement.id}",
                "type": "requirement",
                "title": requirement.entity or requirement.requirement_code,
                "text": requirement.body,
                "canonicalText": _join_text(
                    [
                        f"Requerimiento {requirement.requirement_code}",
                        f"Entidad: {requirement.entity}" if requirement.entity else None,
                        requirement.body,
                        f"Responsable: {requirement.responsible}" if requirement.responsible else None,
                        f"Prioridad: {requirement.priority}" if requirement.priority else None,
                        f"Estado: {requirement.status}" if requirement.status else None,
                    ]
                ),
                "metadata": {
                    "recordId": record.id,
                    "versionId": version.id,
                    "code": requirement.requirement_code,
                    "entity": requirement.entity,
                    "responsible": requirement.responsible,
                    "priority": requirement.priority,
                    "status": requirement.status,
                    "sourceIndex": int(requirement.source_index or 0),
                },
            }
        )
        items.append(item)

    for observation in observations:
        item = _clean(
            {
                "id": f"observation:{observation.id}",
                "type": "applied_observation",
                "title": "Observacion aplicada",
                "text": observation.body,
                "canonicalText": _join_text(
                    [
                        "Observacion aplicada en la minuta final",
                        observation.body,
                        f"Autor: {observation.author_name or observation.author_email}",
                        f"Comentario editor: {observation.editor_comment}" if observation.editor_comment else None,
                        f"Nota resolucion: {observation.resolution_note}" if observation.resolution_note else None,
                    ]
                ),
                "metadata": {
                    "recordId": record.id,
                    "versionId": version.id,
                    "authorEmail": observation.author_email,
                    "authorName": observation.author_name,
                    "status": observation.status,
                    "resolutionType": observation.resolution_type,
                    "resolvedAt": _iso(observation.resolved_at),
                    "appliedInVersionId": observation.applied_in_version_id,
                },
            }
        )
        items.append(item)

    return items


def _text_item(
    record: Record,
    version: RecordVersion,
    item_type: str,
    title: str,
    text: str | None,
) -> list[dict[str, Any]]:
    clean_text = _normalize_text(text)
    if not clean_text:
        return []
    item_id = f"minute:{record.id}:version:{version.id}:{item_type}"
    return [
        {
            "id": item_id,
            "type": item_type,
            "title": title,
            "text": clean_text,
            "canonicalText": f"{title}: {clean_text}",
            "metadata": {
                "recordId": record.id,
                "versionId": version.id,
                "sourceField": item_type,
            },
        }
    ]


def _structured_text_items(
    record: Record,
    version: RecordVersion,
    item_type: str,
    title: str,
    text: str | None,
) -> list[dict[str, Any]]:
    entries = _split_structured_entries(text)
    if not entries:
        return []
    items: list[dict[str, Any]] = []
    for index, entry in enumerate(entries, start=1):
        code = f"{item_type.upper()}-{index:03d}"
        item_id = f"minute:{record.id}:version:{version.id}:{item_type}:{index}"
        item_title = f"{title} {index}"
        items.append(
            {
                "id": item_id,
                "type": item_type,
                "title": item_title,
                "text": entry,
                "canonicalText": _join_text([item_title, entry]),
                "metadata": {
                    "recordId": record.id,
                    "versionId": version.id,
                    "sourceField": f"{item_type}s",
                    "code": code,
                    "sourceIndex": index,
                    "normalized": True,
                },
            }
        )
    return items


def _split_structured_entries(value: str | None) -> list[str]:
    clean = str(value or "").replace("\r\n", "\n").strip()
    if not clean:
        return []

    entries: list[str] = []
    current: list[str] = []
    for raw_line in clean.split("\n"):
        line = raw_line.strip()
        if not line:
            continue
        normalized = line.lstrip("-*0123456789. )\t").strip()
        starts_new = bool(current) and line != normalized
        if starts_new:
            entries.append(_normalize_text(" ".join(current)))
            current = [normalized]
        else:
            current.append(normalized)
    if current:
        entries.append(_normalize_text(" ".join(current)))

    if len(entries) <= 1 and ". " in _normalize_text(clean):
        sentences = [
            sentence.strip()
            for sentence in _normalize_text(clean).split(". ")
            if sentence.strip()
        ]
        entries = [
            sentence if sentence.endswith(".") else f"{sentence}."
            for sentence in sentences
        ]

    return [entry for entry in entries if entry]


def _source_hash(payload: dict[str, Any]) -> str:
    stable_payload = dict(payload)
    stable_payload.pop("sourceHash", None)
    encoded = json.dumps(
        stable_payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _clean(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _clean(item) for key, item in value.items() if item is not None}
    if isinstance(value, list):
        return [_clean(item) for item in value if item is not None]
    return value


def _iso(value: date | datetime | time | None) -> str | None:
    return value.isoformat() if value is not None else None


def _join_text(parts: list[str | None]) -> str:
    return "\n".join(part for part in (_normalize_text(part) for part in parts) if part)


def _normalize_text(value: str | None) -> str:
    if value is None:
        return ""
    return " ".join(str(value).replace("\r\n", "\n").split())
