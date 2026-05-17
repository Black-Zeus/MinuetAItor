from __future__ import annotations


def normalize_secret(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


def store_secret(value: str | None) -> str | None:
    # Centralizado para permitir cifrado real más adelante sin cambiar el contrato.
    return normalize_secret(value)


def read_secret(value: str | None) -> str | None:
    return normalize_secret(value)


def mask_secret(value: str | None) -> str | None:
    secret = normalize_secret(value)
    if not secret:
        return None
    if len(secret) <= 6:
        return f"{secret[:3]}*****{secret[-3:]}"
    return f"{secret[:3]}*****{secret[-3:]}"
