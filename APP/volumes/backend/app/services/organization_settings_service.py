from __future__ import annotations

from datetime import datetime, timezone

from fastapi import UploadFile
from sqlalchemy import inspect
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session, joinedload

from core.datetime_utils import utc_now_db
from core.exceptions import BadRequestException
from models.organization_settings import OrganizationSetting
from schemas.organization_settings import OrganizationSettingsRequest
from services.organization_media_service import (
    get_organization_banner_url_if_exists,
    get_organization_logo_url_if_exists,
    read_organization_banner,
    read_organization_logo,
    remove_organization_banner,
    remove_organization_logo,
    save_organization_banner,
    save_organization_logo,
)

ORGANIZATION_SETTINGS_SINGLETON_ID = 1

DEFAULT_VALUES = {
    "name": None,
    "avatar_object_id": None,
    "banner_object_id": None,
    "legal_name": None,
    "tax_id": None,
    "description": None,
    "industry": None,
    "email": None,
    "phone": None,
    "website": None,
    "public_base_url": None,
    "address": None,
    "country": None,
    "region": None,
    "city": None,
    "postal_code": None,
    "contact_name": None,
    "contact_email": None,
    "contact_phone": None,
    "contact_position": None,
    "contact_department": None,
    "notes": None,
}

EXPECTED_ORGANIZATION_SETTINGS_COLUMNS = {
    "name",
    "avatar_object_id",
    "banner_object_id",
    "legal_name",
    "tax_id",
    "description",
    "industry",
    "email",
    "phone",
    "website",
    "public_base_url",
    "address",
    "country",
    "region",
    "city",
    "postal_code",
    "contact_name",
    "contact_email",
    "contact_phone",
    "contact_position",
    "contact_department",
    "notes",
}


def _utcnow() -> datetime:
    return utc_now_db()


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _is_missing_table_error(exc: Exception) -> bool:
    text_value = str(exc).lower()
    return (
        "organization_settings" in text_value
        and ("doesn't exist" in text_value or "does not exist" in text_value or "no such table" in text_value)
    )


def _read_organization_settings_columns(db: Session) -> set[str] | None:
    try:
        inspector = inspect(db.get_bind())
        return {str(column.get("name")) for column in inspector.get_columns(OrganizationSetting.__tablename__)}
    except Exception:
        return None


def ensure_organization_settings_schema_access(db: Session) -> None:
    db.query(OrganizationSetting.id).limit(1).first()
    existing_columns = _read_organization_settings_columns(db)
    if existing_columns is None:
        return

    missing_columns = sorted(EXPECTED_ORGANIZATION_SETTINGS_COLUMNS - existing_columns)
    if missing_columns:
        raise BadRequestException(
            "La configuración de organización quedó desfasada respecto del código actual. "
            "Aplica los scripts SQL 20260521_1400_schema_organization_settings.sql y "
            "20260521_1410_alter_organization_settings_media.sql y "
            "20260522_1459_alter_organization_settings_public_base_url.sql antes de usar este módulo."
        )


def _require_schema(db: Session) -> None:
    try:
        ensure_organization_settings_schema_access(db)
    except BadRequestException:
        raise
    except (OperationalError, ProgrammingError) as exc:
        if _is_missing_table_error(exc):
            raise BadRequestException(
                "La tabla de organización del sistema aún no está disponible. Aplica el esquema antes de usar este módulo."
            )
        raise


def _base_query(db: Session):
    return (
        db.query(OrganizationSetting)
        .options(
            joinedload(OrganizationSetting.avatar_object),
            joinedload(OrganizationSetting.banner_object),
            joinedload(OrganizationSetting.created_by_user),
            joinedload(OrganizationSetting.updated_by_user),
        )
    )


def _user_ref(user_obj) -> dict | None:
    if not user_obj:
        return None
    return {
        "id": str(user_obj.id),
        "username": getattr(user_obj, "username", None),
        "full_name": getattr(user_obj, "full_name", None),
    }


def _clean_text(value: object, max_length: int | None = None) -> str | None:
    text = str(value or "").strip()
    if max_length is not None:
        text = text[:max_length]
    return text or None


def _clean_public_base_url(value: object) -> str | None:
    text = _clean_text(value, 500)
    if not text:
        return None
    return text.rstrip("/")


def _get_singleton(db: Session, *, actor_user_id: str | None = None) -> OrganizationSetting:
    _require_schema(db)
    obj = _base_query(db).filter(OrganizationSetting.id == ORGANIZATION_SETTINGS_SINGLETON_ID).first()
    if obj:
        return obj

    now = _utcnow()
    obj = OrganizationSetting(
        id=ORGANIZATION_SETTINGS_SINGLETON_ID,
        created_at=now,
        updated_at=now,
        created_by=actor_user_id,
        updated_by=actor_user_id,
        **DEFAULT_VALUES,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _base_query(db).filter(OrganizationSetting.id == ORGANIZATION_SETTINGS_SINGLETON_ID).first()


def _build_response(obj: OrganizationSetting) -> dict:
    return {
        "id": int(obj.id),
        "name": obj.name,
        "logo_url": get_organization_logo_url_if_exists(obj),
        "banner_url": get_organization_banner_url_if_exists(obj),
        "legal_name": obj.legal_name,
        "tax_id": obj.tax_id,
        "description": obj.description,
        "industry": obj.industry,
        "email": obj.email,
        "phone": obj.phone,
        "website": obj.website,
        "public_base_url": obj.public_base_url,
        "address": obj.address,
        "country": obj.country,
        "region": obj.region,
        "city": obj.city,
        "postal_code": obj.postal_code,
        "contact_name": obj.contact_name,
        "contact_email": obj.contact_email,
        "contact_phone": obj.contact_phone,
        "contact_position": obj.contact_position,
        "contact_department": obj.contact_department,
        "notes": obj.notes,
        "created_at": _iso(obj.created_at),
        "updated_at": _iso(obj.updated_at),
        "created_by": _user_ref(obj.created_by_user),
        "updated_by": _user_ref(obj.updated_by_user),
    }


def get_organization_settings(db: Session) -> dict:
    return _build_response(_get_singleton(db))


def update_organization_settings(
    db: Session,
    body: OrganizationSettingsRequest,
    *,
    updated_by_id: str,
) -> dict:
    obj = _get_singleton(db, actor_user_id=updated_by_id)

    obj.name = _clean_text(body.name, 200)
    obj.legal_name = _clean_text(body.legal_name, 200)
    obj.tax_id = _clean_text(body.tax_id, 40)
    obj.description = _clean_text(body.description, 600)
    obj.industry = _clean_text(body.industry, 120)
    obj.email = _clean_text(body.email, 254)
    obj.phone = _clean_text(body.phone, 30)
    obj.website = _clean_text(body.website, 500)
    obj.public_base_url = _clean_public_base_url(body.public_base_url)
    obj.address = _clean_text(body.address, 400)
    obj.country = _clean_text(body.country, 120)
    obj.region = _clean_text(body.region, 120)
    obj.city = _clean_text(body.city, 120)
    obj.postal_code = _clean_text(body.postal_code, 40)
    obj.contact_name = _clean_text(body.contact_name, 200)
    obj.contact_email = _clean_text(body.contact_email, 254)
    obj.contact_phone = _clean_text(body.contact_phone, 30)
    obj.contact_position = _clean_text(body.contact_position, 120)
    obj.contact_department = _clean_text(body.contact_department, 120)
    obj.notes = _clean_text(body.notes)
    obj.updated_at = _utcnow()
    obj.updated_by = updated_by_id

    db.commit()
    db.refresh(obj)

    return _build_response(_base_query(db).filter(OrganizationSetting.id == ORGANIZATION_SETTINGS_SINGLETON_ID).first())


async def upload_organization_logo(
    db: Session,
    file: UploadFile,
    *,
    actor_user_id: str,
) -> dict:
    obj = _get_singleton(db, actor_user_id=actor_user_id)
    logo_url = await save_organization_logo(db, obj, file, actor_user_id=actor_user_id)
    return {"logo_url": logo_url}


def delete_organization_logo(
    db: Session,
    *,
    actor_user_id: str,
) -> dict:
    obj = _get_singleton(db, actor_user_id=actor_user_id)
    remove_organization_logo(db, obj, actor_user_id=actor_user_id)
    return {"logo_url": None}


def read_organization_logo_content(db: Session) -> tuple[bytes, str]:
    obj = _get_singleton(db)
    return read_organization_logo(obj)


async def upload_organization_banner(
    db: Session,
    file: UploadFile,
    *,
    actor_user_id: str,
) -> dict:
    obj = _get_singleton(db, actor_user_id=actor_user_id)
    banner_url = await save_organization_banner(db, obj, file, actor_user_id=actor_user_id)
    return {"banner_url": banner_url}


def delete_organization_banner(
    db: Session,
    *,
    actor_user_id: str,
) -> dict:
    obj = _get_singleton(db, actor_user_id=actor_user_id)
    remove_organization_banner(db, obj, actor_user_id=actor_user_id)
    return {"banner_url": None}


def read_organization_banner_content(db: Session) -> tuple[bytes, str]:
    obj = _get_singleton(db)
    return read_organization_banner(obj)


def get_organization_public_base_url(db: Session | None) -> str | None:
    if db is None:
        return None
    try:
        obj = _get_singleton(db)
    except Exception:
        return None
    return _clean_public_base_url(getattr(obj, "public_base_url", None))
