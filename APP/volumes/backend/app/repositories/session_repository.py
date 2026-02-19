# repositories/session_repository.py
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from models.user_session import UserSession


def create_session(db: Session, *, user_id: str, jti: str, ip_v4: str | None,
                   ip_v6: str | None, user_agent: str | None, device: str | None,
                   country_code: str | None, country_name: str | None,
                   city: str | None, location: str | None) -> UserSession:
    session = UserSession(
        id           = str(uuid.uuid4()),
        user_id      = user_id,
        jti          = jti,
        ip_v4        = ip_v4,
        ip_v6        = ip_v6,
        user_agent   = user_agent,
        device       = device,
        country_code = country_code,
        country_name = country_name,
        city         = city,
        location     = location,
        created_at   = datetime.now(timezone.utc),
    )
    db.add(session)
    db.commit()
    return session


def get_session_by_jti(db: Session, jti: str) -> UserSession | None:
    return db.query(UserSession).filter(UserSession.jti == jti).first()


def mark_logout(db: Session, jti: str) -> None:
    session = get_session_by_jti(db, jti)
    if session:
        session.logged_out_at = datetime.now(timezone.utc)
        db.commit()


def get_user_sessions(db: Session, user_id: str, limit: int = 10) -> list[UserSession]:
    return (
        db.query(UserSession)
        .filter(UserSession.user_id == user_id)
        .order_by(UserSession.created_at.desc())
        .limit(limit)
        .all()
    )

# Agrega al final de repositories/session_repository.py

def get_active_sessions(db: Session, user_id: str) -> list[UserSession]:
    """Sesiones sin logout explícito."""
    return (
        db.query(UserSession)
        .filter(
            UserSession.user_id == user_id,
            UserSession.logged_out_at.is_(None),
        )
        .all()
    )

def revoke_all_sessions(db: Session, user_id: str, exclude_jti: str | None = None) -> int:
    """Marca como logged_out todas las sesiones activas. Retorna cantidad revocada."""
    now = datetime.now(timezone.utc)
    query = db.query(UserSession).filter(
        UserSession.user_id == user_id,
        UserSession.logged_out_at.is_(None),
    )
    if exclude_jti:
        query = query.filter(UserSession.jti != exclude_jti)

    sessions = query.all()
    for s in sessions:
        s.logged_out_at = now
    db.commit()
    return len(sessions)