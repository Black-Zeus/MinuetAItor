"""
events/pdf_dispatch.py

Hook SQLAlchemy that listens for status changes on Record
and enqueues a PDF job in queue:pdf when the new status matches
a configured trigger.

Registro en main.py:
    from events.pdf_dispatch import register_listeners
    register_listeners()
"""

from __future__ import annotations

import json
import logging

from sqlalchemy import event
from sqlalchemy.orm.attributes import get_history


from sqlalchemy.orm import Session, joinedload
from models.records import Record

logger = logging.getLogger(__name__)


def register_listeners() -> None:
    """
    Registra el listener after_update en Record.
    Llamar UNA sola vez desde main.py al iniciar la aplicación.
    """
    

    event.listen(Record, "after_update", _on_status_change)
    logger.info("pdf_dispatch: listener registrado en Record")


# ---------------------------------------------------------------------------
# Listener
# ---------------------------------------------------------------------------

def _on_status_change(mapper, connection, target) -> None:
    """
    Detecta cambios de status en Record y encola job PDF si aplica.
    Nunca propaga excepciones — audit-over-rollback.
    """
    try:
        new_status = _get_new_status(target)
        if new_status is None:
            return

        from services.pdf_job_builder import get_trigger_config
        config = get_trigger_config(new_status)
        if config is None:
            return

        logger.info(
            "pdf_dispatch: status='%s' record_id=%s → encolando job PDF",
            new_status, target.id,
        )

        record = _ensure_relations(target, connection)

        from services.pdf_job_builder import build_pdf_job
        envelope = build_pdf_job(record=record, trigger_config=config)

        _enqueue(envelope)

        logger.info(
            "pdf_dispatch: job_id=%s encolado | record_id=%s trigger=%s",
            envelope["job_id"], target.id, config["trigger"],
        )

    except Exception as exc:
        logger.error(
            "pdf_dispatch: error al encolar PDF para record_id=%s: %s",
            getattr(target, "id", "unknown"), exc,
            exc_info=True,
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_new_status(target) -> str | None:
    """Retorna el code del nuevo status si el campo status_id cambió, o None."""
    history = get_history(target, "status_id")
    if not history.added:
        return None
    # La relación status (lazy=select) se carga automáticamente al accederla
    status_obj = getattr(target, "status", None)
    if status_obj:
        return status_obj.code
    return None


def _ensure_relations(target, connection):
    """
    Recarga el record con joinedload si las relaciones no están en memoria.
    Abre una sesión nueva sobre la misma conexión para no interferir con
    la sesión activa que disparó el evento.
    """
    needs_reload = (
        not _attr_loaded(target, "project")
        or not _attr_loaded(target, "created_by_user")
    )

    if not needs_reload:
        return target


    logger.debug("pdf_dispatch: recargando relaciones para record_id=%s", target.id)

    session = Session(bind=connection)
    try:
        return (
            session.query(Record)
            .options(
                joinedload(Record.project).joinedload("client"),
                joinedload(Record.created_by_user),
            )
            .filter(Record.id == target.id)
            .one()
        )
    finally:
        session.close()


def _attr_loaded(target, attr: str) -> bool:
    """True si el atributo está cargado y no es None."""
    try:
        return getattr(target, attr, None) is not None
    except Exception:
        return False


def _enqueue(envelope: dict) -> None:
    """Serializa el envelope y lo empuja a queue:pdf en Redis."""
    import redis as redis_sync
    from core.config import settings

    client = redis_sync.Redis(
        host=settings.redis_host,
        port=settings.redis_port,
        db=getattr(settings, "redis_db", 0),
        decode_responses=False,
    )
    try:
        client.rpush("queue:pdf", json.dumps(envelope))
    finally:
        client.close()