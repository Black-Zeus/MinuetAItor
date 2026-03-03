# queues/__init__.py
"""
Registro de todas las colas y sus handlers.

Para agregar una nueva cola:
    1. Crear handlers/mi_handler.py con async def handle_mi_job(payload)
    2. Agregar aquí:  registry.register("queue:mi_cola", "mi_tipo", handle_mi_job)

El orden en QUEUE_PRIORITY define la prioridad en el BLPOP:
el worker consume primero de la cola con mayor índice de prioridad.
"""
from core import registry
from handlers.email_handler       import handle_email_job
from handlers.maintenance_handler import handle_maintenance_job
from handlers.minutes_handler     import handle_minutes_job


def register_all() -> None:
    """
    Registra todos los handlers.
    Llamar una vez al arranque del worker, antes del loop principal.
    """
    # ── Cola: minutas (prioridad alta — flujo principal del producto) ─────────
    registry.register("queue:minutes",     "minutes",         handle_minutes_job)

    # ── Cola: email ───────────────────────────────────────────────────────────
    registry.register("queue:email",       "email",           handle_email_job)

    # ── Cola: mantenimiento ───────────────────────────────────────────────────
    registry.register("queue:maintenance", "db_backup",          handle_maintenance_job)
    registry.register("queue:maintenance", "cleanup_sessions",   handle_maintenance_job)
    registry.register("queue:maintenance", "cleanup_temp_files", handle_maintenance_job)


# Prioridad de consumo: el BLPOP los consume de izquierda a derecha.
# Poner las colas más críticas primero.
QUEUE_PRIORITY: list[str] = [
    "queue:minutes",      # alta prioridad — flujo de usuario activo
    "queue:email",        # media
    "queue:maintenance",  # baja — tareas de background
]