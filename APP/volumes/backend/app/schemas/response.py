# schemas/response.py
from typing import Any, Generic, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


# ── Bloques del contrato ──────────────────────────────

class RouteInfo(BaseModel):
    method: str
    path: str


class MetaSchema(BaseModel):
    request_id: str
    timestamp: str
    duration_ms: int
    route: RouteInfo


class ErrorDetail(BaseModel):
    field: str | None = None
    issue: str
    value: Any = None


class ErrorSchema(BaseModel):
    code: str
    message: str
    details: list[ErrorDetail] = []


class ApiResponse(BaseModel, Generic[T]):
    success: bool
    status: int
    result: T | None = None
    error: ErrorSchema | None = None
    meta: MetaSchema


# ── Helpers internos (usados por el middleware) ───────

def _build_response(
    *,
    success: bool,
    status: int,
    result: Any,
    error: ErrorSchema | None,
    meta: MetaSchema,
) -> ApiResponse:
    return ApiResponse(
        success=success,
        status=status,
        result=result,
        error=error,
        meta=meta,
    )


def ok(result: Any, meta: MetaSchema, status: int = 200) -> ApiResponse:
    return _build_response(success=True, status=status, result=result, error=None, meta=meta)


def fail(
    message: str,
    code: str,
    meta: MetaSchema,
    status: int = 500,
    details: list[ErrorDetail] | None = None,
) -> ApiResponse:
    return _build_response(
        success=False,
        status=status,
        result=None,
        error=ErrorSchema(code=code, message=message, details=details or []),
        meta=meta,
    )