# services/email_service.py
"""
Módulo SMTP para envío de correos electrónicos.
Toda la configuración se lee desde variables de entorno.

Variables requeridas:
  SMTP_HOST           - servidor SMTP (ej: smtp.gmail.com / 127.0.0.1 para mailpit)
  SMTP_PORT           - puerto (ej: 587 / 1025)
  SMTP_USER           - usuario / email remitente
  SMTP_PASSWORD       - contraseña o app password
  SMTP_FROM_NAME      - nombre visible del remitente (ej: "MinuetAItor")
  SMTP_FROM_EMAIL     - email remitente (si difiere de SMTP_USER)
  SMTP_USE_TLS        - "true" / "false"  (STARTTLS en puerto 587)
  SMTP_USE_SSL        - "true" / "false"  (SSL directo en puerto 465)
  SMTP_TIMEOUT        - segundos timeout conexión (default: 10)
"""

import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from typing import Optional

logger = logging.getLogger(__name__)


class SMTPConfig:
    """Lee configuración SMTP desde variables de entorno."""

    def __init__(self):
        self.host: str       = os.environ["SMTP_HOST"]
        self.port: int       = int(os.environ.get("SMTP_PORT", "587"))
        self.user: str       = os.environ["SMTP_USER"]
        self.password: str   = os.environ["SMTP_PASSWORD"]
        self.from_name: str  = os.environ.get("SMTP_FROM_NAME", "MinuetAItor")
        self.from_email: str = os.environ.get("SMTP_FROM_EMAIL", self.user)
        self.use_tls: bool   = os.environ.get("SMTP_USE_TLS", "true").lower() == "true"
        self.use_ssl: bool   = os.environ.get("SMTP_USE_SSL", "false").lower() == "true"
        self.timeout: int    = int(os.environ.get("SMTP_TIMEOUT", "10"))

    @property
    def sender(self) -> str:
        """Formato: "Nombre <email>"."""
        return formataddr((self.from_name, self.from_email))


class EmailService:
    """
    Servicio de envío de emails por SMTP.
    
    Uso básico:
        svc = EmailService()
        svc.send(
            to=["user@example.com"],
            subject="Hola",
            body="<h1>Hola mundo</h1>",
            type="html",
        )
    """

    def __init__(self):
        self.config = SMTPConfig()

    def send(
        self,
        to: list[str],
        subject: str,
        body: str,
        *,
        cc: Optional[list[str]] = None,
        bcc: Optional[list[str]] = None,
        type: str = "html",          # "html" | "text"
        reply_to: Optional[str] = None,
    ) -> None:
        """
        Envía un correo electrónico.

        Args:
            to:       Lista de destinatarios principales.
            subject:  Asunto del correo.
            body:     Cuerpo del mensaje.
            cc:       Copia (opcional).
            bcc:      Copia oculta (opcional).
            type:     "html" o "text" (default: "html").
            reply_to: Email de respuesta (opcional).

        Raises:
            smtplib.SMTPException: Si el envío falla.
            ValueError:            Si `to` está vacío.
        """
        if not to:
            raise ValueError("El destinatario 'to' no puede estar vacío.")

        cfg = self.config
        msg = MIMEMultipart("alternative")

        msg["Subject"] = subject
        msg["From"]    = cfg.sender
        msg["To"]      = ", ".join(to)

        if cc:
            msg["Cc"] = ", ".join(cc)
        if reply_to:
            msg["Reply-To"] = reply_to

        # Subtype MIME
        subtype = "html" if type == "html" else "plain"
        msg.attach(MIMEText(body, subtype, "utf-8"))

        # Todos los destinatarios reales (To + Cc + Bcc)
        all_recipients = list(to)
        if cc:
            all_recipients.extend(cc)
        if bcc:
            all_recipients.extend(bcc)

        try:
            if cfg.use_ssl:
                smtp_cls = smtplib.SMTP_SSL
                conn = smtp_cls(cfg.host, cfg.port, timeout=cfg.timeout)
            else:
                conn = smtplib.SMTP(cfg.host, cfg.port, timeout=cfg.timeout)
                if cfg.use_tls:
                    conn.starttls()

            with conn:
                if cfg.user and cfg.password:
                    conn.login(cfg.user, cfg.password)
                conn.sendmail(cfg.from_email, all_recipients, msg.as_string())

            logger.info(
                "Email enviado | subject=%s | to=%s | cc=%s | bcc=%s",
                subject, to, cc, bcc,
            )

        except smtplib.SMTPException as e:
            logger.error("Error SMTP al enviar email | subject=%s | error=%s", subject, e)
            raise


# Instancia singleton (opcional, para uso simple)
_email_service: Optional[EmailService] = None


def get_email_service() -> EmailService:
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service