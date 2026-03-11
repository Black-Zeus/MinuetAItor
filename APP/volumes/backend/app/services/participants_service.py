# services/participants_service.py
from __future__ import annotations

import re
import unicodedata
import uuid
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from models.participant import Participant
from models.participant_email import ParticipantEmail
from models.user import User
from schemas.participants import (
    ParticipantEmailLookupRequest,
    ParticipantFilterRequest,
    ParticipantResolveRequest,
)


def _normalize_name(value: str) -> str:
    collapsed = " ".join((value or "").strip().split())
    normalized = unicodedata.normalize("NFKD", collapsed)
    without_marks = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    lowered = without_marks.lower()
    return re.sub(r"\s+", " ", lowered).strip()


def _clean_email(value: str | None) -> str | None:
    email = (value or "").strip().lower()
    return email or None


def _user_ref(u: User | None) -> dict | None:
    if not u:
        return None
    return {
        "id": str(u.id),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _participant_email_to_dict(obj: ParticipantEmail) -> dict:
    return {
        "id": int(obj.id),
        "email": obj.email,
        "is_primary": bool(obj.is_primary),
        "is_active": bool(obj.is_active),
    }


def _participant_to_dict(obj: Participant) -> dict:
    active_emails = [x for x in (obj.emails or []) if x.deleted_at is None]
    active_emails.sort(key=lambda x: (not bool(x.is_primary), x.email))
    return {
        "id": str(obj.id),
        "display_name": obj.display_name,
        "normalized_name": obj.normalized_name,
        "organization": obj.organization,
        "title": obj.title,
        "notes": obj.notes,
        "is_active": bool(obj.is_active),
        "emails": [_participant_email_to_dict(x) for x in active_emails],
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
        "deleted_at": obj.deleted_at.isoformat() if obj.deleted_at else None,
        "created_by": _user_ref(obj.created_by_user),
        "updated_by": _user_ref(obj.updated_by_user),
        "deleted_by": _user_ref(obj.deleted_by_user),
    }


def _participant_query(db: Session):
    return (
        db.query(Participant)
        .options(
            joinedload(Participant.emails),
            joinedload(Participant.created_by_user),
            joinedload(Participant.updated_by_user),
            joinedload(Participant.deleted_by_user),
        )
    )


def _get_or_404(db: Session, participant_id: str) -> Participant:
    obj = (
        _participant_query(db)
        .filter(Participant.id == participant_id, Participant.deleted_at.is_(None))
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def _find_by_normalized_name(db: Session, normalized_name: str) -> Participant | None:
    return (
        _participant_query(db)
        .filter(
            Participant.normalized_name == normalized_name,
            Participant.deleted_at.is_(None),
        )
        .order_by(Participant.is_active.desc(), Participant.display_name.asc())
        .first()
    )


def _find_by_email_and_name(
    db: Session,
    email: str,
    normalized_name: str,
) -> Participant | None:
    found = (
        db.query(ParticipantEmail)
        .join(Participant, Participant.id == ParticipantEmail.participant_id)
        .options(joinedload(ParticipantEmail.participant).joinedload(Participant.emails))
        .filter(
            ParticipantEmail.email == email,
            ParticipantEmail.deleted_at.is_(None),
            Participant.deleted_at.is_(None),
            Participant.normalized_name == normalized_name,
        )
        .first()
    )
    return found.participant if found else None


def _ensure_email_assignment(
    db: Session,
    participant: Participant,
    email: str | None,
    actor_id: str,
) -> None:
    if not email:
        return

    existing_global = (
        db.query(ParticipantEmail)
        .filter(
            ParticipantEmail.email == email,
            ParticipantEmail.deleted_at.is_(None),
        )
        .first()
    )
    if existing_global and existing_global.participant_id != participant.id:
        raise HTTPException(status_code=409, detail="EMAIL_ALREADY_ASSIGNED")

    same_participant = next(
        (x for x in (participant.emails or []) if x.email == email),
        None,
    )
    if same_participant:
        same_participant.is_active = True
        same_participant.deleted_at = None
        same_participant.deleted_by = None
        same_participant.updated_by = actor_id
    else:
        participant.emails.append(
            ParticipantEmail(
                email=email,
                is_primary=not any(x.is_primary and x.deleted_at is None for x in participant.emails or []),
                is_active=True,
                created_by=actor_id,
                updated_by=actor_id,
            )
        )


def get_participant(db: Session, participant_id: str) -> dict:
    return _participant_to_dict(_get_or_404(db, participant_id))


def list_participants(db: Session, filters: ParticipantFilterRequest) -> dict:
    q = db.query(Participant).filter(Participant.deleted_at.is_(None))

    if filters.is_active is not None:
        q = q.filter(Participant.is_active == bool(filters.is_active))

    if filters.search:
        term = f"%{filters.search.strip()}%"
        normalized_term = f"%{_normalize_name(filters.search)}%"
        q = (
            q.outerjoin(ParticipantEmail, ParticipantEmail.participant_id == Participant.id)
            .filter(
                or_(
                    Participant.display_name.ilike(term),
                    Participant.normalized_name.ilike(normalized_term),
                    Participant.organization.ilike(term),
                    ParticipantEmail.email.ilike(term),
                )
            )
            .distinct()
        )

    total = q.with_entities(func.count(func.distinct(Participant.id))).scalar() or 0

    ids = [
        row[0]
        for row in (
            q.with_entities(Participant.id)
            .order_by(Participant.display_name.asc())
            .offset(filters.skip)
            .limit(filters.limit)
            .all()
        )
    ]

    if not ids:
        return {"items": [], "total": int(total), "skip": int(filters.skip), "limit": int(filters.limit)}

    items = (
        _participant_query(db)
        .filter(Participant.id.in_(ids))
        .order_by(Participant.display_name.asc())
        .all()
    )

    return {
        "items": [_participant_to_dict(x) for x in items],
        "total": int(total),
        "skip": int(filters.skip),
        "limit": int(filters.limit),
    }


def lookup_participant_emails(db: Session, payload: ParticipantEmailLookupRequest) -> dict:
    cleaned_names = [" ".join(str(name or "").strip().split()) for name in (payload.names or [])]
    normalized_names = [_normalize_name(name) for name in cleaned_names]
    wanted_names = [name for name in normalized_names if name]

    if not wanted_names:
        return {"items": []}

    participants = (
        _participant_query(db)
        .filter(
            Participant.deleted_at.is_(None),
            Participant.normalized_name.in_(sorted(set(wanted_names))),
        )
        .order_by(Participant.is_active.desc(), Participant.display_name.asc(), Participant.id.asc())
        .all()
    )

    grouped: dict[str, list[Participant]] = {}
    for participant in participants:
        grouped.setdefault(participant.normalized_name, []).append(participant)

    items = []
    for original_name, normalized_name in zip(cleaned_names, normalized_names):
        matches = grouped.get(normalized_name, []) if normalized_name else []
        unique_emails: dict[str, dict] = {}

        for participant in matches:
            active_emails = [email for email in (participant.emails or []) if email.deleted_at is None]
            active_emails.sort(key=lambda email: (not bool(email.is_primary), email.email))
            for email in active_emails:
                unique_emails.setdefault(email.email, _participant_email_to_dict(email))

        only_match = matches[0] if len(matches) == 1 else None
        sorted_emails = sorted(
            unique_emails.values(),
            key=lambda item: (not bool(item["is_primary"]), item["email"]),
        )

        items.append({
            "display_name": original_name,
            "normalized_name": normalized_name,
            "participant_id": str(only_match.id) if only_match else None,
            "organization": only_match.organization if only_match else None,
            "title": only_match.title if only_match else None,
            "matched_participants": len(matches),
            "emails": sorted_emails,
        })

    return {"items": items}


def resolve_participant(db: Session, payload: ParticipantResolveRequest, actor_id: str) -> dict:
    clean_name = " ".join(payload.display_name.strip().split())
    normalized_name = _normalize_name(clean_name)
    if not normalized_name:
        raise HTTPException(status_code=422, detail="INVALID_DISPLAY_NAME")

    clean_email = _clean_email(payload.email)

    if payload.participant_id:
        participant = _get_or_404(db, payload.participant_id)
    else:
        participant = _find_by_email_and_name(db, clean_email, normalized_name) if clean_email else None
        if participant is None:
            participant = _find_by_normalized_name(db, normalized_name)
        if participant is None:
            participant = Participant(
                id=str(uuid.uuid4()),
                display_name=clean_name,
                normalized_name=normalized_name,
                organization=(payload.organization or "").strip() or None,
                title=(payload.title or "").strip() or None,
                is_active=True,
                created_by=actor_id,
                updated_by=actor_id,
            )
            db.add(participant)

    participant.display_name = clean_name
    participant.normalized_name = normalized_name
    participant.is_active = True
    participant.updated_by = actor_id

    if payload.organization is not None:
        participant.organization = (payload.organization or "").strip() or None
    if payload.title is not None:
        participant.title = (payload.title or "").strip() or None

    _ensure_email_assignment(db, participant, clean_email, actor_id)

    db.commit()
    db.refresh(participant)
    return get_participant(db, participant.id)


def soft_delete_participant(db: Session, participant_id: str, actor_id: str) -> None:
    participant = _get_or_404(db, participant_id)
    participant.deleted_at = datetime.utcnow()
    participant.deleted_by = actor_id
    participant.is_active = False
    participant.updated_by = actor_id
    db.commit()
