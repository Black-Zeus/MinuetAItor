# core/security.py
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from core.config import settings
from core.exceptions import UnauthorizedException

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Password ──────────────────────────────────────────
def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── JWT ───────────────────────────────────────────────
def create_access_token(subject: Any, expires_delta: timedelta | None = None, extra: dict = {}) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.jwt_expire_minutes)
    )
    payload = {"sub": str(subject), "exp": expire, **extra}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    """Retorna el payload completo como dict, no solo el sub."""
    try:
        payload: dict = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if not payload.get("sub"):
            raise UnauthorizedException()
        return payload
    except JWTError:
        raise UnauthorizedException()