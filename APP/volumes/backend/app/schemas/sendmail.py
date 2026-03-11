# schemas/sendmail.py
"""
Schemas para el endpoint de debug de email.
Solo usado en dev/qa — nunca en prod.
"""
from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


# ── Request ───────────────────────────────────────────────────────────────────

class InlineAsset(BaseModel):
    cid: str
    path: str
    mime_type: str | None = Field(default=None, serialization_alias="mimeType")

    @field_validator("cid", "path")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        value = v.strip()
        if not value:
            raise ValueError("El valor no puede estar vacío")
        return value


class EmailAttachment(BaseModel):
    filename: str
    content_base64: str = Field(serialization_alias="contentBase64")
    mime_type: str | None = Field(default=None, serialization_alias="mimeType")

    @field_validator("filename", "content_base64")
    @classmethod
    def validate_required(cls, v: str) -> str:
        value = v.strip()
        if not value:
            raise ValueError("El valor no puede estar vacío")
        return value


class SendMailRequest(BaseModel):
    to:         list[EmailStr]
    cc:         Optional[list[EmailStr]] = None
    bcc:        Optional[list[EmailStr]] = None
    subject:    str | None = None
    body:       str | None = None
    email_type: str = "html"           # "html" | "text"
    reply_to:   Optional[EmailStr] = None
    template_id: str | None = None
    template_context: dict[str, Any] | None = None
    inline_assets: list[InlineAsset] | None = None
    attachments: list[EmailAttachment] | None = None

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

    @field_validator("subject")
    @classmethod
    def validate_subject(cls, v: str | None) -> str | None:
        if v is None:
            return None
        value = v.strip()
        return value or None

    @field_validator("body")
    @classmethod
    def validate_body(cls, v: str | None) -> str | None:
        if v is None:
            return None
        value = v.strip()
        return value or None

    @field_validator("template_id")
    @classmethod
    def validate_template_id(cls, v: str | None) -> str | None:
        if v is None:
            return None
        value = v.strip()
        return value or None

    @field_validator("template_context")
    @classmethod
    def validate_template_context(cls, v: dict[str, Any] | None) -> dict[str, Any] | None:
        if v is None:
            return None
        if not isinstance(v, Mapping):
            raise ValueError("template_context debe ser un objeto JSON")
        return dict(v)

    @model_validator(mode="after")
    def validate_content(self) -> "SendMailRequest":
        if self.template_id:
            if self.email_type != "html":
                raise ValueError("Los templates de email solo soportan email_type='html'")
            return self
        if not self.subject:
            raise ValueError("subject es requerido cuando no se usa template_id")
        if not self.body:
            raise ValueError("body es requerido cuando no se usa template_id")
        return self


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
    template_id: str | None = None
    inline_assets: int = Field(default=0, serialization_alias="inlineAssets")
    attachments: int = 0


class QueueStatusResponse(BaseModel):
    queue:        str
    length:       int
    jobs:         list[QueueJobItem]


class QueueClearResponse(BaseModel):
    queue:   str
    cleared: int
    message: str


class MailTemplateInfo(BaseModel):
    template_id: str = Field(serialization_alias="templateId")
    filename: str
    title: str
    description: str
    default_subject: str = Field(serialization_alias="defaultSubject")
    placeholders: list[str]


class MailTemplateListResponse(BaseModel):
    templates: list[MailTemplateInfo]


class MailTemplatePreviewRequest(BaseModel):
    template_id: str = Field(serialization_alias="templateId")
    template_context: dict[str, Any] = Field(default_factory=dict, serialization_alias="templateContext")
    subject: str | None = None


class MailTemplatePreviewResponse(BaseModel):
    template_id: str = Field(serialization_alias="templateId")
    subject: str
    html: str
    placeholders: list[str]
