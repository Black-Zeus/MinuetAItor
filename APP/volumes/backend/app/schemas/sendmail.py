# schemas/sendmail.py
"""
Schemas para el endpoint de debug de email.
Solo usado en dev/qa — nunca en prod.
"""
from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, EmailStr, field_validator


# ── Request ───────────────────────────────────────────────────────────────────

class SendMailRequest(BaseModel):
    to:         list[EmailStr]
    cc:         Optional[list[EmailStr]] = None
    bcc:        Optional[list[EmailStr]] = None
    subject:    str
    body:       str
    email_type: str = "html"           # "html" | "text"
    reply_to:   Optional[EmailStr] = None

    @field_validator("email_type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in ("html", "text"):
            raise ValueError("email_type debe ser 'html' o 'text'")
        return v

    @field_validator("to")
    @classmethod
    def validate_to(cls, v: list) -> list:
        if not v:
            raise ValueError("'to' no puede estar vacío")
        return v


# ── Responses ─────────────────────────────────────────────────────────────────

class SendMailResponse(BaseModel):
    queued: bool
    message: str
    queue_length: int


class QueueJobItem(BaseModel):
    position:   int
    type:       str
    to:         list[str]
    subject:    str
    email_type: str


class QueueStatusResponse(BaseModel):
    queue:        str
    length:       int
    jobs:         list[QueueJobItem]


class QueueClearResponse(BaseModel):
    queue:   str
    cleared: int
    message: str