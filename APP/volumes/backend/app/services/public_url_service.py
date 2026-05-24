from __future__ import annotations

import os

from sqlalchemy.orm import Session

from services.organization_settings_service import get_organization_public_base_url


def get_public_base_url(db: Session | None = None) -> str:
    configured = get_organization_public_base_url(db)
    if configured:
        return configured.rstrip("/")

    fallback = (
        os.environ.get("FRONTEND_BASE_URL")
        or os.environ.get("APP_BASE_URL")
        or ""
    )
    return str(fallback).strip().rstrip("/")


def build_public_url(db: Session | None, path: str) -> str:
    base = get_public_base_url(db)
    clean_path = f"/{str(path or '').lstrip('/')}"
    return f"{base}{clean_path}" if base else clean_path
