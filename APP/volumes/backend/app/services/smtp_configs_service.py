from __future__ import annotations

import base64
import hashlib
import hmac
import json
import mimetypes
import os
import socket
import smtplib
import time
import uuid
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session, joinedload

from core.config import settings
from core.datetime_utils import utc_now, utc_now_db
from core.exceptions import BadRequestException
from models.smtp_configs import SmtpConfig
from services.email_template_service import render_email_template, resolve_default_logo_path
from schemas.smtp_configs import (
    SmtpConfigCreateRequest,
    SmtpConfigFilterRequest,
    SmtpConfigTestRequest,
    SmtpConfigUpdateRequest,
)

TEST_TOKEN_TTL_SECONDS = 15 * 60


def _utcnow() -> datetime:
    return utc_now()


def _is_missing_table_error(exc: Exception) -> bool:
    text = str(exc).lower()
    return (
        "smtp_configs" in text
        and ("doesn't exist" in text or "does not exist" in text or "no such table" in text)
    )


def _require_smtp_schema(db: Session) -> None:
    try:
        ensure_smtp_config_schema_access(db)
    except (OperationalError, ProgrammingError) as exc:
        if _is_missing_table_error(exc):
            raise BadRequestException(
                "La tabla de configuraciones SMTP aún no está disponible. Aplica el esquema antes de administrar SMTP."
            )
        raise


def _get_or_404(db: Session, config_id: str) -> SmtpConfig:
    obj = (
        db.query(SmtpConfig)
        .options(
            joinedload(SmtpConfig.created_by_user),
            joinedload(SmtpConfig.updated_by_user),
            joinedload(SmtpConfig.last_tested_by_user),
        )
        .filter(SmtpConfig.id == config_id, SmtpConfig.deleted_at.is_(None))
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="RECURSO_NOT_FOUND")
    return obj


def _user_ref(u) -> dict[str, Any] | None:
    if not u:
        return None
    return {
        "id": str(u.id),
        "username": getattr(u, "username", None),
        "full_name": getattr(u, "full_name", None),
    }


def _build_response_dict(obj: SmtpConfig) -> dict[str, Any]:
    return {
        "id": str(obj.id),
        "name": obj.name,
        "host": obj.host,
        "port": int(obj.port),
        "username": obj.username,
        "has_password": bool(obj.password),
        "from_name": obj.from_name,
        "from_email": obj.from_email,
        "use_tls": bool(obj.use_tls),
        "use_ssl": bool(obj.use_ssl),
        "timeout_seconds": int(obj.timeout_seconds),
        "is_active": bool(obj.is_active),
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
        "last_tested_at": obj.last_tested_at.isoformat() if obj.last_tested_at else None,
        "created_by": _user_ref(obj.created_by_user),
        "updated_by": _user_ref(obj.updated_by_user),
        "last_tested_by": _user_ref(obj.last_tested_by_user),
    }


def ensure_smtp_config_schema_access(db: Session) -> None:
    db.query(SmtpConfig.id).limit(1).first()


def _check_unique_name(db: Session, name: str, exclude_id: str | None = None) -> None:
    q = db.query(SmtpConfig).filter(
        SmtpConfig.name == name,
        SmtpConfig.deleted_at.is_(None),
    )
    if exclude_id:
        q = q.filter(SmtpConfig.id != exclude_id)
    if db.query(q.exists()).scalar():
        raise HTTPException(status_code=409, detail="SMTP_CONFIG_NAME_ALREADY_EXISTS")


def _config_values_from_obj(obj: SmtpConfig) -> dict[str, Any]:
    return {
        "name": obj.name,
        "host": obj.host,
        "port": int(obj.port),
        "username": obj.username,
        "password": obj.password,
        "from_name": obj.from_name,
        "from_email": obj.from_email,
        "use_tls": bool(obj.use_tls),
        "use_ssl": bool(obj.use_ssl),
        "timeout_seconds": int(obj.timeout_seconds),
        "is_active": bool(obj.is_active),
    }


def _merge_effective_values(
    payload: dict[str, Any],
    existing: SmtpConfig | None = None,
) -> dict[str, Any]:
    data = _config_values_from_obj(existing) if existing else {}
    for field in (
        "name",
        "host",
        "port",
        "username",
        "from_name",
        "from_email",
        "use_tls",
        "use_ssl",
        "timeout_seconds",
        "is_active",
    ):
        if payload.get(field) is not None:
            data[field] = payload[field]

    if existing is None:
        data["password"] = payload.get("password")
    elif payload.get("password") is not None:
        data["password"] = payload.get("password")

    if not data.get("host"):
        raise BadRequestException("El host SMTP es obligatorio")
    if not data.get("from_name"):
        raise BadRequestException("El nombre remitente es obligatorio")
    if not data.get("from_email"):
        raise BadRequestException("El correo remitente es obligatorio")
    if not data.get("name"):
        raise BadRequestException("El nombre de la configuración es obligatorio")
    if bool(data.get("use_tls")) and bool(data.get("use_ssl")):
        raise BadRequestException("No puedes habilitar TLS y SSL al mismo tiempo")

    return data


def _b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("utf-8").rstrip("=")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")


def _signature_payload(config_values: dict[str, Any]) -> dict[str, Any]:
    return {
        "host": str(config_values.get("host") or "").strip(),
        "port": int(config_values.get("port") or 0),
        "username": str(config_values.get("username") or "").strip(),
        "password": str(config_values.get("password") or "").strip(),
        "from_name": str(config_values.get("from_name") or "").strip(),
        "from_email": str(config_values.get("from_email") or "").strip(),
        "use_tls": bool(config_values.get("use_tls")),
        "use_ssl": bool(config_values.get("use_ssl")),
        "timeout_seconds": int(config_values.get("timeout_seconds") or 0),
    }


def _fingerprint_config(config_values: dict[str, Any]) -> str:
    payload = _signature_payload(config_values)
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _sign_payload(raw_payload: bytes) -> bytes:
    return hmac.new(
        settings.jwt_secret.encode("utf-8"),
        raw_payload,
        hashlib.sha256,
    ).digest()


def _issue_test_token(config_values: dict[str, Any]) -> tuple[str, str]:
    expires_at = int(time.time()) + TEST_TOKEN_TTL_SECONDS
    payload = {
        "fingerprint": _fingerprint_config(config_values),
        "exp": expires_at,
    }
    raw_payload = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    token = f"{_b64url_encode(raw_payload)}.{_b64url_encode(_sign_payload(raw_payload))}"
    expires_iso = datetime.fromtimestamp(expires_at, tz=timezone.utc).isoformat()
    return token, expires_iso


def _verify_test_token(token: str, config_values: dict[str, Any]) -> None:
    try:
        payload_part, sig_part = token.split(".", 1)
        raw_payload = _b64url_decode(payload_part)
        raw_sig = _b64url_decode(sig_part)
        expected_sig = _sign_payload(raw_payload)
        if not hmac.compare_digest(raw_sig, expected_sig):
            raise BadRequestException("La validación de prueba no es válida")

        payload = json.loads(raw_payload.decode("utf-8"))
    except BadRequestException:
        raise
    except Exception:
        raise BadRequestException("La validación de prueba no es válida")

    exp = int(payload.get("exp") or 0)
    if exp < int(time.time()):
        raise BadRequestException("La validación de prueba expiró. Ejecuta la prueba nuevamente.")

    expected_fingerprint = _fingerprint_config(config_values)
    if payload.get("fingerprint") != expected_fingerprint:
        raise BadRequestException("La configuración cambió después de la prueba. Ejecuta la prueba nuevamente.")


def _open_smtp_client(config_values: dict[str, Any]) -> smtplib.SMTP:
    host = config_values["host"]
    port = int(config_values["port"])
    timeout_seconds = int(config_values["timeout_seconds"])

    if config_values.get("use_ssl"):
        return smtplib.SMTP_SSL(host=host, port=port, timeout=timeout_seconds)

    client = smtplib.SMTP(host=host, port=port, timeout=timeout_seconds)
    if config_values.get("use_tls"):
        client.starttls()
    return client


def _smtp_security_label(config_values: dict[str, Any]) -> str:
    if config_values.get("use_ssl"):
        return "SSL"
    if config_values.get("use_tls"):
        return "TLS"
    return "Sin cifrado"


def _build_test_email_text(
    config_values: dict[str, Any],
    test_email: str,
    generated_at: datetime,
) -> str:
    generated_label = generated_at.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    return (
        "MinuetAItor hizo una prueba real sobre tu configuracion SMTP.\n\n"
        "Si recibiste este mensaje, la conexion, el transporte y la entrega respondieron bien.\n\n"
        f"Configuracion: {config_values['name']}\n"
        f"Host: {config_values['host']}:{config_values['port']}\n"
        f"Seguridad: {_smtp_security_label(config_values)}\n"
        f"Remitente: {config_values['from_name']} <{config_values['from_email']}>\n"
        f"Destino de prueba: {test_email}\n"
        f"Fecha de prueba: {generated_label}\n\n"
        "Si estas usando MailPit, ver este correo ahi tambien cuenta como una prueba correcta.\n"
    )


def _build_test_email_context(
    config_values: dict[str, Any],
    test_email: str,
    generated_at: datetime,
) -> dict[str, str]:
    return {
        "CONFIG_NAME": str(config_values.get("name") or "Configuración SMTP"),
        "SMTP_HOST": str(config_values["host"]),
        "SMTP_PORT": str(config_values["port"]),
        "SMTP_SECURITY": _smtp_security_label(config_values),
        "SMTP_FROM_NAME": str(config_values["from_name"]),
        "SMTP_FROM_EMAIL": str(config_values["from_email"]),
        "TEST_EMAIL": str(test_email),
        "GENERATED_AT": generated_at.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
    }


def _attach_inline_logo_if_needed(msg: EmailMessage, html_body: str) -> None:
    if "cid:minuetaitor-logo" not in html_body or not msg.is_multipart():
        return

    logo_path = Path(resolve_default_logo_path())
    if not logo_path.exists():
        return

    mime_type = str(os.environ.get("EMAIL_INLINE_LOGO_MIME_TYPE", "")).strip()
    if not mime_type:
        mime_type = mimetypes.guess_type(logo_path.name)[0] or "image/jpeg"

    maintype, subtype = mime_type.split("/", 1) if "/" in mime_type else ("image", "jpeg")
    html_part = msg.get_payload()[-1]
    with logo_path.open("rb") as fh:
        html_part.add_related(
            fh.read(),
            maintype=maintype,
            subtype=subtype,
            cid="<minuetaitor-logo>",
            filename=logo_path.name,
        )


def _send_test_email(config_values: dict[str, Any], test_email: str) -> None:
    generated_at = _utcnow()
    rendered = render_email_template(
        "smtp_config_test",
        context=_build_test_email_context(config_values, test_email, generated_at),
    )

    msg = EmailMessage()
    msg["Subject"] = rendered.subject
    msg["From"] = f'{config_values["from_name"]} <{config_values["from_email"]}>'
    msg["To"] = test_email
    msg.set_content(rendered.text or _build_test_email_text(config_values, test_email, generated_at))
    msg.add_alternative(rendered.html, subtype="html")
    _attach_inline_logo_if_needed(msg, rendered.html)

    server = _open_smtp_client(config_values)
    try:
        if (
            config_values.get("username")
            and config_values.get("password")
            and str(config_values["host"]).lower() != "mailpit"
        ):
            server.login(config_values["username"], config_values["password"])
        server.send_message(msg, to_addrs=[test_email])
    finally:
        try:
            server.quit()
        except (smtplib.SMTPServerDisconnected, OSError):
            try:
                server.close()
            except Exception:
                pass


def _reload_with_relations(db: Session, config_id: str) -> SmtpConfig:
    return _get_or_404(db, config_id)


def _deactivate_other_configs(db: Session, keep_id: str | None, updated_by_id: str | None) -> None:
    items = (
        db.query(SmtpConfig)
        .filter(SmtpConfig.deleted_at.is_(None), SmtpConfig.is_active.is_(True))
        .all()
    )
    for item in items:
        if keep_id and item.id == keep_id:
            continue
        item.is_active = False
        item.updated_by = updated_by_id


def get_smtp_config(db: Session, config_id: str) -> dict[str, Any]:
    _require_smtp_schema(db)
    return _build_response_dict(_get_or_404(db, config_id))


def list_smtp_configs(db: Session, filters: SmtpConfigFilterRequest) -> dict[str, Any]:
    try:
        ensure_smtp_config_schema_access(db)
    except (OperationalError, ProgrammingError) as exc:
        if _is_missing_table_error(exc):
            return {
                "items": [],
                "total": 0,
                "skip": int(filters.skip),
                "limit": int(filters.limit),
            }
        raise

    q = db.query(SmtpConfig).filter(SmtpConfig.deleted_at.is_(None))

    if filters.is_active is not None:
        q = q.filter(SmtpConfig.is_active.is_(bool(filters.is_active)))

    if filters.search:
        like = f"%{filters.search.strip()}%"
        q = q.filter(
            or_(
                SmtpConfig.name.ilike(like),
                SmtpConfig.host.ilike(like),
                SmtpConfig.from_email.ilike(like),
                SmtpConfig.username.ilike(like),
            )
        )

    total = q.with_entities(func.count(SmtpConfig.id)).scalar() or 0
    items = (
        q.options(
            joinedload(SmtpConfig.created_by_user),
            joinedload(SmtpConfig.updated_by_user),
            joinedload(SmtpConfig.last_tested_by_user),
        )
        .order_by(SmtpConfig.is_active.desc(), SmtpConfig.updated_at.desc(), SmtpConfig.created_at.desc())
        .offset(filters.skip)
        .limit(filters.limit)
        .all()
    )

    return {
        "items": [_build_response_dict(item) for item in items],
        "total": int(total),
        "skip": int(filters.skip),
        "limit": int(filters.limit),
    }


def test_smtp_config(db: Session, body: SmtpConfigTestRequest) -> dict[str, Any]:
    if body.config_id:
        _require_smtp_schema(db)

    current = _get_or_404(db, body.config_id) if body.config_id else None
    values = _merge_effective_values(body.model_dump(exclude_unset=True), current)
    try:
        _send_test_email(values, body.test_email)
    except (smtplib.SMTPException, socket.gaierror, TimeoutError, OSError) as exc:
        raise BadRequestException(
            f"No fue posible conectar o enviar usando SMTP hacia {values['host']}:{values['port']}. "
            f"Detalle técnico: {str(exc) or exc.__class__.__name__}"
        )
    token, expires_at = _issue_test_token(values)
    return {
        "ok": True,
        "message": f"Prueba SMTP exitosa. Se envió un correo a {body.test_email}.",
        "test_token": token,
        "expires_at": expires_at,
    }


def create_smtp_config(db: Session, body: SmtpConfigCreateRequest, created_by_id: str) -> dict[str, Any]:
    _require_smtp_schema(db)
    payload = body.model_dump(exclude_unset=True)
    values = _merge_effective_values(payload, existing=None)
    _verify_test_token(body.test_token, values)
    _check_unique_name(db, values["name"])

    obj = SmtpConfig(
        id=str(uuid.uuid4()),
        name=values["name"],
        host=values["host"],
        port=int(values["port"]),
        username=values.get("username"),
        password=values.get("password"),
        from_name=values["from_name"],
        from_email=values["from_email"],
        use_tls=bool(values.get("use_tls")),
        use_ssl=bool(values.get("use_ssl")),
        timeout_seconds=int(values["timeout_seconds"]),
        is_active=bool(values.get("is_active")),
        last_tested_at=utc_now_db(),
        last_tested_by=created_by_id,
        created_by=created_by_id,
        updated_by=None,
    )

    if obj.is_active:
        _deactivate_other_configs(db, keep_id=None, updated_by_id=created_by_id)

    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _build_response_dict(_reload_with_relations(db, obj.id))


def update_smtp_config(db: Session, config_id: str, body: SmtpConfigUpdateRequest, updated_by_id: str) -> dict[str, Any]:
    _require_smtp_schema(db)
    obj = _get_or_404(db, config_id)

    payload = body.model_dump(exclude_unset=True)
    values = _merge_effective_values(payload, existing=obj)
    _verify_test_token(body.test_token, values)

    next_name = values["name"]
    _check_unique_name(db, next_name, exclude_id=obj.id)

    if bool(values.get("is_active")):
        _deactivate_other_configs(db, keep_id=obj.id, updated_by_id=updated_by_id)

    obj.name = values["name"]
    obj.host = values["host"]
    obj.port = int(values["port"])
    obj.username = values.get("username")
    obj.password = values.get("password")
    obj.from_name = values["from_name"]
    obj.from_email = values["from_email"]
    obj.use_tls = bool(values.get("use_tls"))
    obj.use_ssl = bool(values.get("use_ssl"))
    obj.timeout_seconds = int(values["timeout_seconds"])
    if values.get("is_active") is not None:
        obj.is_active = bool(values["is_active"])
    obj.updated_by = updated_by_id
    obj.last_tested_at = utc_now_db()
    obj.last_tested_by = updated_by_id

    db.commit()
    db.refresh(obj)
    return _build_response_dict(_reload_with_relations(db, obj.id))


def activate_smtp_config(db: Session, config_id: str, updated_by_id: str) -> dict[str, Any]:
    _require_smtp_schema(db)
    obj = _get_or_404(db, config_id)
    _deactivate_other_configs(db, keep_id=obj.id, updated_by_id=updated_by_id)
    obj.is_active = True
    obj.updated_by = updated_by_id
    db.commit()
    db.refresh(obj)
    return _build_response_dict(_reload_with_relations(db, obj.id))


def delete_smtp_config(db: Session, config_id: str, deleted_by_id: str) -> dict[str, Any]:
    _require_smtp_schema(db)
    obj = _get_or_404(db, config_id)

    replacement = None
    if obj.is_active:
        replacement = (
            db.query(SmtpConfig)
            .filter(
                SmtpConfig.deleted_at.is_(None),
                SmtpConfig.id != obj.id,
            )
            .order_by(SmtpConfig.updated_at.desc(), SmtpConfig.created_at.desc())
            .first()
        )
        if replacement:
            _deactivate_other_configs(db, keep_id=replacement.id, updated_by_id=deleted_by_id)
            replacement.is_active = True
            replacement.updated_by = deleted_by_id

    obj.deleted_at = utc_now_db()
    obj.deleted_by = deleted_by_id
    obj.updated_by = deleted_by_id
    obj.is_active = False

    db.commit()
    return {
        "ok": True,
        "replacement_id": str(replacement.id) if replacement else None,
    }
