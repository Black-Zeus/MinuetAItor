from __future__ import annotations

import html
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, StrictUndefined, meta, select_autoescape

from schemas.sendmail import InlineAsset, MailTemplateInfo

EMAIL_TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "assets" / "email_templates"
TAG_RE = re.compile(r"<[^>]+>")


@dataclass(frozen=True)
class EmailTemplateDefinition:
    template_id: str
    filename: str
    title: str
    description: str
    default_subject: str


@dataclass(frozen=True)
class RenderedEmailTemplate:
    template_id: str
    subject: str
    html: str
    placeholders: list[str]

    @property
    def text(self) -> str:
        return html_to_text(self.html)


TEMPLATE_DEFINITIONS: dict[str, EmailTemplateDefinition] = {
    "access_granted_revoked_scope": EmailTemplateDefinition(
        template_id="access_granted_revoked_scope",
        filename="access_granted_revoked_scope.html",
        title="Acceso otorgado o revocado",
        description="Notifica cambios de acceso y alcance sobre recursos confidenciales.",
        default_subject="Actualizacion de acceso y alcance",
    ),
    "account_created_set_password": EmailTemplateDefinition(
        template_id="account_created_set_password",
        filename="account_created_set_password.html",
        title="Cuenta creada",
        description="Invita al usuario a definir su contrasena inicial con OTP.",
        default_subject="Tu cuenta fue creada en {{ APP_NAME }}",
    ),
    "ai_processed_ready_for_manual_review": EmailTemplateDefinition(
        template_id="ai_processed_ready_for_manual_review",
        filename="ai_processed_ready_for_manual_review.html",
        title="Borrador IA listo para revision",
        description="Informa que una minuta procesada por IA requiere validacion humana.",
        default_subject="Minuta procesada por IA lista para revision",
    ),
    "minute_officialized_approved": EmailTemplateDefinition(
        template_id="minute_officialized_approved",
        filename="minute_officialized_approved.html",
        title="Minuta oficializada",
        description="Confirma que la minuta ya fue aprobada y oficializada.",
        default_subject="Minuta oficializada y aprobada",
    ),
    "recoverPass": EmailTemplateDefinition(
        template_id="recoverPass",
        filename="recoverPass.html",
        title="Recuperacion de contrasena",
        description="Entrega OTP y enlace para recuperar o cambiar contrasena.",
        default_subject="Recuperacion de contrasena en {{ APP_NAME }}",
    ),
    "reminder_processed_not_published": EmailTemplateDefinition(
        template_id="reminder_processed_not_published",
        filename="reminder_processed_not_published.html",
        title="Recordatorio de publicacion",
        description="Recuerda que existe una minuta procesada aun no publicada.",
        default_subject="Recordatorio: minuta procesada pendiente de publicacion",
    ),
    "responseApproveConfidential": EmailTemplateDefinition(
        template_id="responseApproveConfidential",
        filename="responseApproveConfidential.html",
        title="Respuesta aprobada de confidencialidad",
        description="Confirma aprobacion de solicitud asociada a acceso confidencial.",
        default_subject="Solicitud confidencial aprobada",
    ),
    "responseDeniedConfidential": EmailTemplateDefinition(
        template_id="responseDeniedConfidential",
        filename="responseDeniedConfidential.html",
        title="Respuesta rechazada de confidencialidad",
        description="Informa rechazo de solicitud asociada a acceso confidencial.",
        default_subject="Solicitud confidencial rechazada",
    ),
    "sendMinute": EmailTemplateDefinition(
        template_id="sendMinute",
        filename="sendMinute.html",
        title="Envio de minuta para revision",
        description="Envia minuta generada para revision y aprobacion.",
        default_subject="Minuta disponible para revision",
    ),
    "sendOwerConfidential": EmailTemplateDefinition(
        template_id="sendOwerConfidential",
        filename="sendOwerConfidential.html",
        title="Solicitud a owner confidencial",
        description="Solicita al owner revision de acceso confidencial.",
        default_subject="Solicitud de aprobacion confidencial",
    ),
}

_env: Environment | None = None
DEFAULT_LOGO_CID = "minuetaitor-logo"


def _build_env() -> Environment:
    return Environment(
        loader=FileSystemLoader(str(EMAIL_TEMPLATES_DIR)),
        autoescape=select_autoescape(["html", "xml"]),
        undefined=StrictUndefined,
        trim_blocks=True,
        lstrip_blocks=True,
    )


def _get_env() -> Environment:
    global _env
    if _env is None:
        _env = _build_env()
    return _env


def _default_context() -> dict[str, str]:
    app_name = os.environ.get("APP_NAME") or os.environ.get("FRONTEND_NAME") or "MinuetAItor"
    app_version = (
        os.environ.get("APP_VERSION")
        or os.environ.get("FRONTEND_VERSION")
        or os.environ.get("ENV_NAME")
        or "dev"
    )
    support_email = os.environ.get("SUPPORT_EMAIL") or os.environ.get("SMTP_FROM_EMAIL") or "soporte@minuetaitor.cl"
    developer_email = os.environ.get("DEVELOPER_EMAIL") or support_email
    developer_name = os.environ.get("DEVELOPER_NAME") or app_name
    tz_name = os.environ.get("TZ") or "America/Santiago"
    return {
        "APP_NAME": app_name,
        "APP_VERSION": app_version,
        "SUPPORT_EMAIL": support_email,
        "DEVELOPER_EMAIL": developer_email,
        "DEVELOPER_NAME": developer_name,
        "TZ": tz_name,
    }


def _default_logo_asset() -> InlineAsset:
    return InlineAsset(
        cid=DEFAULT_LOGO_CID,
        path=os.environ.get("EMAIL_INLINE_LOGO_PATH", "/app/email_assets/minuetaitor-logo.jpg"),
        mime_type=os.environ.get("EMAIL_INLINE_LOGO_MIME_TYPE", "image/jpeg"),
    )


def get_template_definition(template_id: str) -> EmailTemplateDefinition:
    definition = TEMPLATE_DEFINITIONS.get(template_id)
    if definition is None:
        raise ValueError(f"Template de email no reconocido: {template_id}")
    return definition


def list_email_templates() -> list[MailTemplateInfo]:
    templates: list[MailTemplateInfo] = []
    for definition in TEMPLATE_DEFINITIONS.values():
        placeholders = extract_placeholders(definition.template_id)
        templates.append(
            MailTemplateInfo(
                template_id=definition.template_id,
                filename=definition.filename,
                title=definition.title,
                description=definition.description,
                default_subject=definition.default_subject,
                placeholders=placeholders,
            )
        )
    return templates


def load_template_source(template_id: str) -> str:
    definition = get_template_definition(template_id)
    path = EMAIL_TEMPLATES_DIR / definition.filename
    if not path.exists():
        raise ValueError(f"Template no encontrado en disco: {definition.filename}")
    return path.read_text(encoding="utf-8")


def extract_placeholders(template_id: str) -> list[str]:
    definition = get_template_definition(template_id)
    env = _get_env()
    template_source = load_template_source(template_id)
    template_ast = env.parse(template_source)
    names = set(meta.find_undeclared_variables(template_ast))
    subject_ast = env.parse(definition.default_subject)
    names.update(meta.find_undeclared_variables(subject_ast))
    return sorted(names)


def render_email_template(
    template_id: str,
    context: dict[str, Any] | None = None,
    *,
    subject_override: str | None = None,
) -> RenderedEmailTemplate:
    definition = get_template_definition(template_id)
    env = _get_env()
    merged_context = _default_context()
    if context:
        merged_context.update({str(key): value for key, value in context.items()})

    try:
        html_body = env.get_template(definition.filename).render(**merged_context)
        subject_template = env.from_string(subject_override or definition.default_subject)
        subject = subject_template.render(**merged_context)
    except Exception as exc:
        raise ValueError(f"No se pudo renderizar el template '{template_id}': {exc}") from exc

    return RenderedEmailTemplate(
        template_id=template_id,
        subject=subject,
        html=html_body,
        placeholders=extract_placeholders(template_id),
    )


def get_inline_assets_for_html(raw_html: str) -> list[InlineAsset]:
    assets: list[InlineAsset] = []
    if f"cid:{DEFAULT_LOGO_CID}" in raw_html:
        assets.append(_default_logo_asset())
    return assets


def html_to_text(raw_html: str) -> str:
    text = raw_html
    for tag in ("</p>", "</div>", "</tr>", "</li>", "<br>", "<br/>", "<br />"):
        text = text.replace(tag, f"{tag}\n")
    text = TAG_RE.sub("", text)
    text = html.unescape(text)
    text = re.sub(r"\n\s*\n\s*\n+", "\n\n", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    return text.strip()
