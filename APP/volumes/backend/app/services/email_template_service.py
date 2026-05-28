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
UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
URL_RE = re.compile(r"^https?://", re.IGNORECASE)

TEMPLATE_AUDIT_EVENT_LABELS = {
    "access_granted_revoked_scope": "Cambio de acceso",
    "access_request_ack": "Solicitud de acceso recibida",
    "access_request_admin": "Solicitud de acceso",
    "account_created_set_password": "Cuenta creada",
    "ai_processed_ready_for_manual_review": "Minuta procesada",
    "minute_guest_observation_received": "Observación de invitado",
    "minute_officialized_approved": "Minuta publicada",
    "minute_view_otp": "Código de acceso a minuta",
    "password_changed_confirmation": "Cambio de contraseña",
    "recoverPass": "Recuperación de contraseña",
    "reminder_processed_not_published": "Recordatorio de publicación",
    "responseApproveConfidential": "Solicitud confidencial aprobada",
    "responseDeniedConfidential": "Solicitud confidencial rechazada",
    "sendMinute": "Envío de minuta",
    "sendOwerConfidential": "Solicitud confidencial",
    "smtp_config_test": "Prueba de envío SMTP",
    "system_backup_result": "Resultado de respaldo",
    "system_queue_alert": "Alerta de colas",
    "system_queue_recovered": "Cola normalizada",
}

TECHNICAL_ORIGIN_LABELS = {
    "internal-worker": "Procesamiento interno",
    "worker": "Procesamiento interno",
    "scheduler": "Proceso programado",
    "system": "Sistema",
    "test-suite": "Prueba del sistema",
    "user-client-acl": "Gestión de accesos",
    "user-project-acl": "Gestión de accesos",
    "minutes.transition.pending-preview": "Cambio de estado de minuta",
    "minute.reprocess": "Reproceso de minuta",
}


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
    "access_request_admin": EmailTemplateDefinition(
        template_id="access_request_admin",
        filename="access_request_admin.html",
        title="Nueva solicitud de alta",
        description="Notifica a administradores que una persona solicitó alta desde el login.",
        default_subject="Nueva solicitud de alta · {{ REQUESTER_NAME }}",
    ),
    "access_request_ack": EmailTemplateDefinition(
        template_id="access_request_ack",
        filename="access_request_ack.html",
        title="Solicitud de alta recibida",
        description="Confirma al solicitante que su alta fue recibida y será atendida por un administrador.",
        default_subject="Solicitud de alta recibida en {{ APP_NAME }}",
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
    "minute_guest_observation_received": EmailTemplateDefinition(
        template_id="minute_guest_observation_received",
        filename="minute_guest_observation_received.html",
        title="Observación de invitado recibida",
        description="Avisa al responsable que un invitado dejó una observación en la minuta.",
        default_subject="Nueva observacion de invitado {{ PROJECT_NAME }} / {{ MINUTE_TITLE }}",
    ),
    "minute_view_otp": EmailTemplateDefinition(
        template_id="minute_view_otp",
        filename="minute_view_otp.html",
        title="Codigo de acceso a minuta",
        description="Entrega un OTP de un solo uso para acceso visitante a la minuta.",
        default_subject="Codigo de acceso {{ PROJECT_NAME }} / {{ MINUTE_TITLE }}",
    ),
    "password_changed_confirmation": EmailTemplateDefinition(
        template_id="password_changed_confirmation",
        filename="password_changed_confirmation.html",
        title="Confirmacion de cambio de contrasena",
        description="Confirma que la contrasena fue cambiada y orienta al usuario ante actividad no reconocida.",
        default_subject="Tu contrasena fue cambiada correctamente",
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
    "smtp_config_test": EmailTemplateDefinition(
        template_id="smtp_config_test",
        filename="smtp_config_test.html",
        title="Prueba de configuracion SMTP",
        description="Valida una configuracion SMTP con un correo HTML real.",
        default_subject="Prueba SMTP · {{ APP_NAME }}",
    ),
    "system_backup_result": EmailTemplateDefinition(
        template_id="system_backup_result",
        filename="system_backup_result.html",
        title="Resultado de respaldo",
        description="Informa el resultado final de una tarea de respaldo, restauración o limpieza.",
        default_subject="{{ BACKUP_SUBJECT }}",
    ),
    "system_queue_alert": EmailTemplateDefinition(
        template_id="system_queue_alert",
        filename="system_queue_alert.html",
        title="Alerta operativa de colas",
        description="Advierte que una cola operativa superó su umbral de observabilidad.",
        default_subject="Alerta operativa · {{ QUEUE_LABEL }} superó umbral",
    ),
    "system_queue_recovered": EmailTemplateDefinition(
        template_id="system_queue_recovered",
        filename="system_queue_recovered.html",
        title="Normalización operativa de colas",
        description="Informa que una cola volvió a un nivel normal tras una alerta previa.",
        default_subject="Normalización operativa · {{ QUEUE_LABEL }} volvió a nivel normal",
    ),
}

EMAIL_TEMPLATE_PRESENTATION: dict[str, dict[str, str]] = {
    "access_granted_revoked_scope": {
        "subtitle": "Gobernanza de acceso · RBAC · Auditoría",
        "badge_text": "Acceso",
        "badge_bg": "#f8fafc",
        "badge_color": "#6b7280",
        "badge_border": "#e5e7eb",
        "footer_subtitle": "Gestión documental · Minutas · Trazabilidad",
        "footer_message": "Este correo fue generado automáticamente como parte del registro y trazabilidad de cambios de acceso.",
        "footer_help": "Si no reconoces esta modificación, contacta a soporte de inmediato.",
    },
    "access_request_admin": {
        "subtitle": "Administración de acceso · Solicitudes · Auditoría",
        "badge_text": "Revisión",
        "badge_bg": "#eef2ff",
        "badge_color": "#3730a3",
        "badge_border": "#e0e7ff",
    },
    "access_request_ack": {
        "subtitle": "Administración de acceso · Solicitudes · Auditoría",
        "badge_text": "Recibida",
        "badge_bg": "#ecfdf5",
        "badge_color": "#047857",
        "badge_border": "#a7f3d0",
    },
    "account_created_set_password": {
        "subtitle": "Entorno autenticado y auditado · Operación y trazabilidad",
        "badge_text": "Seguridad",
        "badge_bg": "#f8fafc",
        "badge_color": "#6b7280",
        "badge_border": "#e5e7eb",
    },
    "ai_processed_ready_for_manual_review": {
        "subtitle": "Gestión documental y seguimiento de minutas",
        "badge_text": "Revisión requerida",
        "badge_bg": "#eef2ff",
        "badge_color": "#3730a3",
        "badge_border": "#e0e7ff",
    },
    "minute_officialized_approved": {
        "subtitle": "Gestión documental y seguimiento de minutas",
        "badge_text": "Publicada",
        "badge_bg": "#ecfdf5",
        "badge_color": "#047857",
        "badge_border": "#a7f3d0",
    },
    "minute_guest_observation_received": {
        "subtitle": "Gestión documental y seguimiento de minutas",
        "badge_text": "Observación",
        "badge_bg": "#eff6ff",
        "badge_color": "#1d4ed8",
        "badge_border": "#bfdbfe",
    },
    "minute_view_otp": {
        "subtitle": "Acceso externo · Validación temporal",
        "badge_text": "OTP",
        "badge_bg": "#f8fafc",
        "badge_color": "#6b7280",
        "badge_border": "#e5e7eb",
    },
    "password_changed_confirmation": {
        "subtitle": "Seguridad de cuenta · Auditoría · Trazabilidad",
        "badge_text": "Seguridad",
        "badge_bg": "#f8fafc",
        "badge_color": "#6b7280",
        "badge_border": "#e5e7eb",
    },
    "recoverPass": {
        "subtitle": "Entorno autenticado y auditado · Operación y trazabilidad",
        "badge_text": "Seguridad",
        "badge_bg": "#f8fafc",
        "badge_color": "#6b7280",
        "badge_border": "#e5e7eb",
    },
    "reminder_processed_not_published": {
        "subtitle": "Gestión documental y seguimiento de minutas",
        "badge_text": "Recordatorio",
        "badge_bg": "#fffbeb",
        "badge_color": "#92400e",
        "badge_border": "#fde68a",
    },
    "responseApproveConfidential": {
        "subtitle": "Control de acceso · Confidencialidad · Auditoría",
        "badge_text": "Aprobada",
        "badge_bg": "#ecfdf5",
        "badge_color": "#047857",
        "badge_border": "#a7f3d0",
    },
    "responseDeniedConfidential": {
        "subtitle": "Control de acceso · Confidencialidad · Auditoría",
        "badge_text": "Rechazada",
        "badge_bg": "#fef2f2",
        "badge_color": "#b91c1c",
        "badge_border": "#fecaca",
    },
    "sendMinute": {
        "subtitle": "Gestión documental y seguimiento de minutas",
        "badge_text": "Revisión",
        "badge_bg": "#eef2ff",
        "badge_color": "#3730a3",
        "badge_border": "#e0e7ff",
    },
    "sendOwerConfidential": {
        "subtitle": "Control de acceso · Confidencialidad · Auditoría",
        "badge_text": "Requiere acción",
        "badge_bg": "#fffbeb",
        "badge_color": "#92400e",
        "badge_border": "#fde68a",
    },
    "smtp_config_test": {
        "subtitle": "Entorno autenticado y auditado · Operación y trazabilidad",
        "badge_text": "Seguridad",
        "badge_bg": "#f8fafc",
        "badge_color": "#6b7280",
        "badge_border": "#e5e7eb",
    },
    "system_backup_result": {
        "subtitle": "Sistema · Respaldos automatizados",
        "badge_text": "Sistema",
        "badge_bg": "#f8fafc",
        "badge_color": "#6b7280",
        "badge_border": "#e5e7eb",
    },
    "system_queue_alert": {
        "subtitle": "Observabilidad técnica · Alerta de colas",
        "badge_text": "Alerta",
        "badge_bg": "#fffbeb",
        "badge_color": "#92400e",
        "badge_border": "#fde68a",
    },
    "system_queue_recovered": {
        "subtitle": "Observabilidad técnica · Recuperación de colas",
        "badge_text": "Normalizada",
        "badge_bg": "#ecfdf5",
        "badge_color": "#047857",
        "badge_border": "#a7f3d0",
    },
}

_env: Environment | None = None
DEFAULT_LOGO_CID = "minuetaitor-logo"


def resolve_default_logo_path() -> str:
    candidates = [
        os.environ.get("EMAIL_INLINE_LOGO_PATH"),
        "/app/assets/images/chinchinAItor_64.jpg",
        "/app/email_assets/minuetaitor-logo.jpg",
    ]
    for candidate in candidates:
        if not candidate:
            continue
        if Path(candidate).exists():
            return candidate
    return "/app/assets/images/chinchinAItor_64.jpg"


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


def _default_context() -> dict[str, Any]:
    app_name = os.environ.get("APP_NAME") or os.environ.get("FRONTEND_NAME") or "MinuetAItor"
    app_version = os.environ.get("APP_VERSION")
    if not app_version:
        raise RuntimeError("APP_VERSION environment variable is required for email templates.")
    support_email = os.environ.get("SUPPORT_EMAIL") or "soporte@minuetaitor.cl"
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
        "APP_LOGO_CID": DEFAULT_LOGO_CID,
        "HAS_APP_LOGO": True,
        "ORGANIZATION_NAME": app_name,
        "ORGANIZATION_LOGO_CID": "organization-logo",
        "HAS_ORGANIZATION_LOGO": False,
        "CLIENT_LOGO_CID": "client-logo",
        "HAS_CLIENT_LOGO": False,
        "REQUEST_ORIGIN": "-",
    }


def _default_logo_asset() -> InlineAsset:
    return InlineAsset(
        cid=DEFAULT_LOGO_CID,
        path=resolve_default_logo_path(),
        mime_type=os.environ.get("EMAIL_INLINE_LOGO_MIME_TYPE", "image/jpeg"),
    )


def _looks_technical(value: str) -> bool:
    clean = value.strip()
    if not clean or clean == "-":
        return True
    if URL_RE.match(clean):
        return False
    if UUID_RE.match(clean):
        return True
    return any(char in clean for char in ("_", ".")) or clean.lower() == clean and "-" in clean


def _footer_event_label(template_id: str, raw_value: Any) -> str:
    raw = str(raw_value or "").strip()
    if raw and not _looks_technical(raw):
        return raw
    return TEMPLATE_AUDIT_EVENT_LABELS.get(template_id, "Evento registrado")


def _footer_origin_label(raw_value: Any) -> str:
    raw = str(raw_value or "").strip()
    if raw in TECHNICAL_ORIGIN_LABELS:
        return TECHNICAL_ORIGIN_LABELS[raw]
    if raw and not _looks_technical(raw):
        return raw
    return "Sistema"


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
    presentation = EMAIL_TEMPLATE_PRESENTATION.get(template_id, {})
    merged_context.update(
        {
            "EMAIL_HEADER_SUBTITLE": presentation.get("subtitle", "Gestión documental y seguimiento de minutas"),
            "EMAIL_BADGE_TEXT": presentation.get("badge_text", "Información"),
            "EMAIL_BADGE_BG": presentation.get("badge_bg", "#f8fafc"),
            "EMAIL_BADGE_COLOR": presentation.get("badge_color", "#6b7280"),
            "EMAIL_BADGE_BORDER": presentation.get("badge_border", "#e5e7eb"),
            "EMAIL_FOOTER_SUBTITLE": presentation.get("footer_subtitle", "Gestión documental · Minutas · Trazabilidad"),
            "EMAIL_FOOTER_MESSAGE": presentation.get(
                "footer_message",
                "Este correo fue generado automáticamente por MinuetAItor.",
            ),
            "EMAIL_FOOTER_HELP_TEXT": presentation.get(
                "footer_help",
                "Si no reconoces esta actividad, contacta a soporte de inmediato.",
            ),
        }
    )
    if context:
        merged_context.update({str(key): value for key, value in context.items()})
    raw_audit_event = (
        merged_context.get("AUDIT_EVENT_ID")
        or merged_context.get("REQUEST_ID")
        or merged_context.get("ACCESS_REQUEST_ID")
        or "-"
    )
    merged_context["EMAIL_AUDIT_EVENT_ID"] = _footer_event_label(template_id, raw_audit_event)
    merged_context["REQUEST_ORIGIN"] = _footer_origin_label(merged_context.get("REQUEST_ORIGIN"))
    if template_id == "access_granted_revoked_scope" and merged_context.get("ACCESS_ACTION"):
        merged_context["EMAIL_BADGE_TEXT"] = f"Acceso: {merged_context['ACCESS_ACTION']}"

    try:
        html_body = env.get_template(definition.filename).render(**merged_context)
        if subject_override is not None:
            subject = str(subject_override).strip()
            if not subject:
                subject_template = env.from_string(definition.default_subject)
                subject = subject_template.render(**merged_context)
        else:
            subject_template = env.from_string(definition.default_subject)
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
