from __future__ import annotations

from sqlalchemy.orm import Session


def get_catalog_id(db: Session, model, code: str):
    obj = db.query(model).filter_by(code=code).first()
    if not obj:
        raise RuntimeError(
            f"Catalog '{model.__tablename__}' with code='{code}' not found. Verify seeds."
        )
    return obj.id

