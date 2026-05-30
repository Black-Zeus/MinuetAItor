from __future__ import annotations

from datetime import datetime, timezone
import re
from zoneinfo import ZoneInfo

UTC = timezone.utc
SANTIAGO_TZ = ZoneInfo("America/Santiago")
ISO_DATETIME_RE = re.compile(
    r"^\d{4}-\d{2}-\d{2}"
    r"[T ]"
    r"\d{2}:\d{2}"
    r"(?::\d{2}(?:\.\d{1,6})?)?"
    r"(?:Z|[+-]\d{2}:\d{2})?$"
)


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


def utc_isoformat_z(value: datetime | None) -> str | None:
    """
    Serializa instantes como ISO-8601 UTC con sufijo Z.

    MariaDB DATETIME no conserva tz. Por convención, un datetime naive leído
    desde BD se interpreta como UTC antes de exponerlo al exterior.
    """
    normalized = assume_utc(value)
    if normalized is None:
        return None
    return normalized.isoformat().replace("+00:00", "Z")


def parse_datetime_to_utc(value: str | datetime | None) -> datetime | None:
    """
    Convierte entradas del front a datetime aware UTC.

    - ISO con Z/offset: respeta el offset y convierte a UTC.
    - ISO sin tz: se asume UTC por contrato de aplicación.
    - date-only no se trata como instante.
    """
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return assume_utc(value)
    if not isinstance(value, str):
        return None

    raw = value.strip()
    if not ISO_DATETIME_RE.match(raw):
        return None
    normalized = raw.replace(" ", "T")
    if normalized.endswith("Z"):
        normalized = f"{normalized[:-1]}+00:00"
    parsed = datetime.fromisoformat(normalized)
    return assume_utc(parsed)


def parse_datetime_to_utc_db(value: str | datetime | None) -> datetime | None:
    """
    Convierte entradas del front a UTC naive para columnas DATETIME.
    """
    parsed = parse_datetime_to_utc(value)
    return parsed.replace(tzinfo=None) if parsed else None


def normalize_datetime_strings_to_utc_z(value):
    """
    Normaliza recursivamente strings ISO datetime a UTC con Z.

    Se usa en el contrato HTTP para que toda respuesta y request JSON maneje
    instantes de forma inequívoca. No toca fechas calendario YYYY-MM-DD.
    """
    if isinstance(value, dict):
        return {key: normalize_datetime_strings_to_utc_z(item) for key, item in value.items()}
    if isinstance(value, list):
        return [normalize_datetime_strings_to_utc_z(item) for item in value]
    if isinstance(value, tuple):
        return [normalize_datetime_strings_to_utc_z(item) for item in value]
    if isinstance(value, datetime):
        return utc_isoformat_z(value)
    if isinstance(value, str):
        parsed = parse_datetime_to_utc(value)
        return utc_isoformat_z(parsed) if parsed else value
    return value


def to_santiago(value: datetime | None) -> datetime | None:
    """
    Convierte un datetime del dominio a hora local de Santiago.
    """
    normalized = assume_utc(value)
    if normalized is None:
        return None
    return normalized.astimezone(SANTIAGO_TZ)
