from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

UTC = timezone.utc
SANTIAGO_TZ = ZoneInfo("America/Santiago")


def utc_now() -> datetime:
    """
    Retorna el instante actual como datetime aware en UTC.

    Usar para comparaciones, serialización ISO y lógica temporal.
    """
    return datetime.now(UTC)


def utc_now_db() -> datetime:
    """
    Retorna el instante actual en UTC como datetime naive.

    Convención del proyecto:
    - Persistencia BD (MariaDB DATETIME sin tz): UTC naive
    - Presentación/logs operativos: hora local Santiago
    """
    return utc_now().replace(tzinfo=None)


def assume_utc(value: datetime | None) -> datetime | None:
    """
    Normaliza un datetime leído desde BD a aware UTC.

    Si llega naive, se interpreta como UTC por convención del proyecto.
    """
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def to_santiago(value: datetime | None) -> datetime | None:
    """
    Convierte un datetime del dominio a hora local de Santiago.
    """
    normalized = assume_utc(value)
    if normalized is None:
        return None
    return normalized.astimezone(SANTIAGO_TZ)
