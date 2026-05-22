from __future__ import annotations

import base64
import logging
import os
from dataclasses import dataclass
from typing import Any

from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session, joinedload

from models.clients import Client
from models.organization_settings import OrganizationSetting
from schemas.sendmail import InlineAsset
from services.client_logo_service import read_client_logo
from services.email_template_service import DEFAULT_LOGO_CID
from services.organization_media_service import read_organization_logo

logger = logging.getLogger(__name__)

ORGANIZATION_SETTINGS_SINGLETON_ID = 1
ORGANIZATION_LOGO_CID = "organization-logo"
CLIENT_LOGO_CID = "client-logo"


@dataclass(frozen=True)
class EmailBrandingBundle:
    context: dict[str, Any]
    inline_assets: list[InlineAsset]


def build_email_branding_bundle(
    db: Session | None,
    *,
    client: Client | None = None,
    include_organization_logo: bool = True,
    include_client_logo: bool = False,
) -> EmailBrandingBundle:
    app_name = os.environ.get("APP_NAME") or os.environ.get("FRONTEND_NAME") or "MinuetAItor"
    context: dict[str, Any] = {
        "APP_LOGO_CID": DEFAULT_LOGO_CID,
        "HAS_APP_LOGO": True,
        "ORGANIZATION_NAME": app_name,
        "ORGANIZATION_LOGO_CID": ORGANIZATION_LOGO_CID,
        "HAS_ORGANIZATION_LOGO": False,
        "CLIENT_LOGO_CID": CLIENT_LOGO_CID,
        "HAS_CLIENT_LOGO": False,
    }
    inline_assets: list[InlineAsset] = []

    if db is None:
        return EmailBrandingBundle(context=context, inline_assets=inline_assets)

    organization = _load_organization_settings(db)
    if organization is not None:
        organization_name = str(getattr(organization, "name", "") or "").strip()
        if organization_name:
            context["ORGANIZATION_NAME"] = organization_name

        if include_organization_logo:
            inline_asset = _organization_logo_inline_asset(organization)
            if inline_asset is not None:
                inline_assets.append(inline_asset)
                context["HAS_ORGANIZATION_LOGO"] = True

    if include_client_logo and client is not None:
        inline_asset = _client_logo_inline_asset(db, client)
        if inline_asset is not None:
            inline_assets.append(inline_asset)
            context["HAS_CLIENT_LOGO"] = True

    return EmailBrandingBundle(context=context, inline_assets=inline_assets)


def _load_organization_settings(db: Session) -> OrganizationSetting | None:
    try:
        return (
            db.query(OrganizationSetting)
            .options(joinedload(OrganizationSetting.avatar_object))
            .filter(OrganizationSetting.id == ORGANIZATION_SETTINGS_SINGLETON_ID)
            .first()
        )
    except (OperationalError, ProgrammingError) as exc:
        logger.debug("No se pudo cargar configuración de organización para branding email | err=%s", exc)
        return None
    except Exception as exc:
        logger.warning("Error inesperado cargando organización para branding email | err=%s", exc)
        return None


def _organization_logo_inline_asset(organization: OrganizationSetting) -> InlineAsset | None:
    try:
        content, mime_type = read_organization_logo(organization)
        return _inline_asset_from_bytes(ORGANIZATION_LOGO_CID, content, mime_type)
    except Exception as exc:
        logger.debug("Logo de organización no disponible para email | err=%s", exc)
        return None


def _client_logo_inline_asset(db: Session, client: Client) -> InlineAsset | None:
    try:
        content, mime_type = read_client_logo(db, client)
        return _inline_asset_from_bytes(CLIENT_LOGO_CID, content, mime_type)
    except Exception as exc:
        logger.debug("Logo de cliente no disponible para email | client=%s err=%s", getattr(client, "id", None), exc)
        return None


def _inline_asset_from_bytes(cid: str, content: bytes, mime_type: str | None) -> InlineAsset:
    return InlineAsset(
        cid=cid,
        content_base64=base64.b64encode(content).decode("ascii"),
        mime_type=str(mime_type or "application/octet-stream").strip() or "application/octet-stream",
    )
