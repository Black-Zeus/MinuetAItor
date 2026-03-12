from __future__ import annotations

import os
import re
from copy import deepcopy
from datetime import datetime, time as dt_time
from pathlib import Path
from typing import Any, Optional

from fastapi import HTTPException, UploadFile

from schemas.minutes import MinuteGenerateRequest
from services.file_sanitizer import FileSanitizationError, sanitize_file

WHITESPACE_RE = re.compile(r"\s+")
CONTROL_CHARS_RE = re.compile(r"[\x00-\x1f\x7f]")


def collapse_text(value: Any, *, limit: int | None = None) -> str:
    text = CONTROL_CHARS_RE.sub(" ", str(value or ""))
    text = WHITESPACE_RE.sub(" ", text).strip()
    if limit is not None:
        return text[:limit]
    return text


def clean_optional_text(value: Any, *, limit: int | None = None) -> str | None:
    text = collapse_text(value, limit=limit)
    return text or None


def clean_string_list(values: list[str] | None, *, unique: bool = True, limit: int | None = None) -> list[str]:
    items: list[str] = []
    seen: set[str] = set()
    for value in values or []:
        item = collapse_text(value, limit=limit)
        if not item:
            continue
        key = item.casefold()
        if unique and key in seen:
            continue
        seen.add(key)
        items.append(item)
    return items


def sanitize_filename(filename: str | None, fallback: str = "attachment") -> str:
    base_name = os.path.basename(str(filename or "")).strip()
    base_name = CONTROL_CHARS_RE.sub("", base_name).replace("/", "_").replace("\\", "_")
    return base_name or fallback


def detect_input_file_type(filename: str | None) -> str:
    lower_name = str(filename or "").lower()
    if any(token in lower_name for token in ("transcript", "transcripcion", "transcripción", "transcrip")):
        return "transcript"
    if any(token in lower_name for token in ("summary", "resumen")):
        return "summary"
    return "attachment"


def parse_hhmm(value: Optional[str]) -> Optional[dt_time]:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        return datetime.strptime(raw, "%H:%M").time()
    except ValueError:
        return None


def format_hhmm(value: Optional[dt_time]) -> Optional[str]:
    return value.strftime("%H:%M") if value else None


def calculate_duration_label(
    scheduled_start: Optional[dt_time],
    scheduled_end: Optional[dt_time],
    actual_start: Optional[dt_time],
    actual_end: Optional[dt_time],
) -> Optional[str]:
    start = actual_start or scheduled_start
    end = actual_end or scheduled_end
    if not start or not end:
        return None

    start_minutes = start.hour * 60 + start.minute
    end_minutes = end.hour * 60 + end.minute
    if end_minutes < start_minutes:
        return None

    duration_minutes = end_minutes - start_minutes
    if duration_minutes <= 0:
        return None
    return f"{duration_minutes} min"


def sanitize_generate_request(request: MinuteGenerateRequest) -> MinuteGenerateRequest:
    payload = request.model_dump(by_alias=True)

    payload["meetingInfo"]["location"] = clean_optional_text(payload["meetingInfo"].get("location"), limit=200)
    payload["meetingInfo"]["title"] = clean_optional_text(payload["meetingInfo"].get("title"), limit=250)

    payload["projectInfo"]["client"] = collapse_text(payload["projectInfo"].get("client"), limit=200)
    payload["projectInfo"]["project"] = collapse_text(payload["projectInfo"].get("project"), limit=220)
    payload["projectInfo"]["category"] = clean_optional_text(payload["projectInfo"].get("category"), limit=120)

    participants = payload["participants"]
    participants["attendees"] = clean_string_list(participants.get("attendees"), limit=220)
    participants["invited"] = clean_string_list(participants.get("invited"), limit=220)
    participants["copyRecipients"] = clean_string_list(participants.get("copyRecipients"), limit=220)

    payload["profileInfo"]["profileName"] = collapse_text(payload["profileInfo"].get("profileName"), limit=180)
    payload["preparedBy"] = collapse_text(payload.get("preparedBy"), limit=220)
    payload["additionalNotes"] = clean_optional_text(payload.get("additionalNotes"), limit=4000)

    return MinuteGenerateRequest.model_validate(payload)


async def sanitize_upload_file(upload: UploadFile, *, max_bytes: int) -> tuple[bytes, str, str, str]:
    raw = await upload.read()
    safe_name = sanitize_filename(upload.filename)
    mime_type = upload.content_type or "application/octet-stream"
    sha256 = __import__("hashlib").sha256(raw).hexdigest()

    try:
        sanitize_file(
            content=raw,
            filename=safe_name,
            mime_type=mime_type,
            expected_sha256=sha256,
            max_bytes=max_bytes,
        )
    except FileSanitizationError as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "invalid_attachment",
                "message": f"Adjunto invalido: {exc}",
            },
        )

    return raw, safe_name, mime_type, sha256


def sanitize_editor_content(content: dict[str, Any]) -> dict[str, Any]:
    sanitized = deepcopy(content)

    if isinstance(sanitized.get("meetingInfo"), dict):
        meeting_info = sanitized["meetingInfo"]
        for field, limit in (("title", 250), ("location", 200), ("preparedBy", 220)):
            if field in meeting_info:
                meeting_info[field] = clean_optional_text(meeting_info.get(field), limit=limit)

    if isinstance(sanitized.get("additionalNote"), str):
        sanitized["additionalNote"] = clean_optional_text(sanitized.get("additionalNote"), limit=4000)

    if isinstance(sanitized.get("participants"), list):
        cleaned_participants = []
        for item in sanitized["participants"]:
            if not isinstance(item, dict):
                continue
            current = dict(item)
            for field, limit in (
                ("displayName", 220),
                ("fullName", 220),
                ("organization", 220),
                ("title", 160),
                ("email", 200),
                ("role", 80),
            ):
                if field in current:
                    current[field] = clean_optional_text(current.get(field), limit=limit)
            cleaned_participants.append(current)
        sanitized["participants"] = cleaned_participants

    if isinstance(sanitized.get("scopeSections"), list):
        cleaned_sections = []
        for section in sanitized["scopeSections"]:
            if not isinstance(section, dict):
                continue
            current = dict(section)
            for field, limit in (("title", 180), ("summary", 2000), ("type", 80)):
                if field in current:
                    current[field] = clean_optional_text(current.get(field), limit=limit)
            cleaned_sections.append(current)
        sanitized["scopeSections"] = cleaned_sections

    return sanitized


def build_initial_intro_snippet(summary_candidates: list[bytes], additional_notes: Optional[str]) -> Optional[str]:
    for raw in summary_candidates:
        if not raw:
            continue
        text = None
        for encoding in ("utf-8", "latin-1"):
            try:
                text = raw.decode(encoding)
                break
            except UnicodeDecodeError:
                text = None
        if not text:
            continue
        collapsed = collapse_text(text, limit=800)
        if collapsed:
            return collapsed

    return clean_optional_text(additional_notes, limit=800)


def extract_summary_from_minute_content(content: Optional[dict]) -> Optional[str]:
    if not isinstance(content, dict):
        return None

    scope = content.get("scope")
    if isinstance(scope, dict):
        sections = scope.get("sections")
        if isinstance(sections, list):
            for section in sections:
                if not isinstance(section, dict):
                    continue
                section_content = section.get("content")
                if not isinstance(section_content, dict):
                    continue
                summary = clean_optional_text(section_content.get("summary"), limit=1000)
                if summary:
                    return summary

    scope_sections = content.get("scopeSections")
    if isinstance(scope_sections, list):
        for section in scope_sections:
            if not isinstance(section, dict):
                continue
            summary = clean_optional_text(section.get("summary"), limit=1000)
            if summary:
                return summary

    return None
