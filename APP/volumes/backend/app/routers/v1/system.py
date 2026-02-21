# routers/v1/system.py
from __future__ import annotations

from fastapi import APIRouter

from core.config import settings  # ajusta el import según tu proyecto

router = APIRouter(prefix="/system", tags=["System"])


@router.get("/", include_in_schema=False)
def root():
    return {"response": "consulte el endpoint correcto"}


@router.get("/health")
def health():
    return {"env": settings.env_name, "status": "running"}


@router.get("/ready")
def ready():
    return {"env": settings.env_name, "status": "ready"}

