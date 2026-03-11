from __future__ import annotations

from typing import Iterable

from sqlalchemy.orm import Session

from models.record_version_participant import RecordVersionParticipant


ROLE_BY_TYPE = {
    "attendee": "required",
    "invited": "optional",
    "copy": "observer",
}


def _clean_text(value: object) -> str | None:
    text = str(value or "").strip()
    return text or None


def _normalize_role(value: object) -> str:
    role = str(value or "").strip().lower()
    return role if role in {"required", "optional", "observer", "unknown"} else "unknown"


def _append_named_participants(items: list[dict], names: Iterable[object], role: str) -> None:
    for name in names or []:
        display_name = _clean_text(name)
        if not display_name:
            continue
        items.append({
            "participant_id": None,
            "role": role,
            "display_name": display_name,
            "organization": None,
            "title": None,
            "email": None,
        })


def _dedupe_participants(participants: list[dict]) -> list[dict]:
    deduped = []
    seen = set()

    for item in participants:
        display_name = _clean_text(item.get("display_name"))
        if not display_name:
            continue

        normalized = {
            "participant_id": _clean_text(item.get("participant_id")),
            "role": _normalize_role(item.get("role")),
            "display_name": display_name,
            "organization": _clean_text(item.get("organization")),
            "title": _clean_text(item.get("title")),
            "email": _clean_text(item.get("email")),
        }
        key = (
            normalized["participant_id"] or "",
            normalized["display_name"].casefold(),
            (normalized["email"] or "").casefold(),
            normalized["role"],
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(normalized)

    return deduped


def build_version_participants_from_generate_request(request) -> list[dict]:
    participants = []
    declared = getattr(request, "participants", None)
    if not declared:
        return participants

    _append_named_participants(participants, getattr(declared, "attendees", []), "required")
    _append_named_participants(participants, getattr(declared, "invited", []), "optional")
    _append_named_participants(participants, getattr(declared, "copy_recipients", []), "observer")
    return _dedupe_participants(participants)


def build_version_participants_from_content(content: dict | None) -> list[dict]:
    payload = content if isinstance(content, dict) else {}

    if isinstance(payload.get("participants"), list):
        items = []
        for raw in payload.get("participants", []):
            if not isinstance(raw, dict):
                continue
            display_name = _clean_text(raw.get("fullName") or raw.get("name"))
            if not display_name:
                continue
            items.append({
                "participant_id": _clean_text(raw.get("participantId")),
                "role": _normalize_role(ROLE_BY_TYPE.get(raw.get("type"), raw.get("role"))),
                "display_name": display_name,
                "organization": _clean_text(raw.get("organization")),
                "title": _clean_text(raw.get("title") or raw.get("roleTitle")),
                "email": _clean_text(raw.get("email")),
            })
        return _dedupe_participants(items)

    declared = payload.get("declaredParticipants")
    if isinstance(declared, dict):
        items = []
        _append_named_participants(items, declared.get("attendees", []), "required")
        _append_named_participants(items, declared.get("invited", []), "optional")
        _append_named_participants(items, declared.get("copyRecipients", []), "observer")
        return _dedupe_participants(items)

    return []


def persist_record_version_participants(
    db: Session,
    record_version_id: str,
    participants: list[dict],
) -> None:
    if not record_version_id:
        return

    for item in _dedupe_participants(participants):
        db.add(RecordVersionParticipant(
            record_version_id=record_version_id,
            participant_id=item["participant_id"],
            role=item["role"],
            display_name=item["display_name"],
            organization=item["organization"],
            title=item["title"],
            email=item["email"],
        ))
