# core/internal_auth.py
"""
Autenticación para endpoints internos del backend.

Los endpoints /internal/* NO usan JWT de usuario. Son consumidos exclusivamente
por servicios dentro de la red Docker (worker, scheduler, etc.).

Mecanismo: header X-Internal-Secret con un valor compartido vía variable de entorno.
Nunca se expone por nginx — solo accesible dentro de la red 'internal'.

Uso en un router:
    from core.internal_auth import verify_internal_secret

    @router.post("/commit")
    def commit(
        body: CommitRequest,
        _: None = Depends(verify_internal_secret),
    ):
        ...
"""
from __future__ import annotations

import logging
import secrets

from fastapi import Depends, Header, HTTPException, status

from core.config import settings

logger = logging.getLogger(__name__)

_HEADER_NAME = "x-internal-secret"


def verify_internal_secret(
    x_internal_secret: str | None = Header(default=None, alias="x-internal-secret"),
) -> None:
    """
    Dependency de FastAPI que verifica el header X-Internal-Secret.

    - Si INTERNAL_API_SECRET no está configurado → bloquea siempre (fail-safe).
    - Usa comparación en tiempo constante (secrets.compare_digest) para evitar
      timing attacks aunque el endpoint sea interno.
    - Loguea intentos fallidos con la IP origen para auditoría.
    """
    configured_secret = settings.internal_api_secret

    # Fail-safe: si no hay secret configurado, bloquear todo
    if not configured_secret or configured_secret == "-":
        logger.error(
            "INTERNAL_API_SECRET no configurado — endpoint interno bloqueado"
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="internal_auth_not_configured",
        )

    if not x_internal_secret:
        logger.warning("Intento de acceso interno sin header X-Internal-Secret")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing_internal_secret",
        )

    # Comparación en tiempo constante
    if not secrets.compare_digest(
        configured_secret.encode("utf-8"),
        x_internal_secret.encode("utf-8"),
    ):
        logger.warning("Intento de acceso interno con secret inválido")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_internal_secret",
        )