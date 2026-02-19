# core/middleware.py
import json
import time
import uuid
from datetime import datetime, timezone

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from core.config import settings
from core.exceptions import AppException
from schemas.response import ErrorDetail, MetaSchema, RouteInfo, fail, ok
from utils.geo import get_geo, _is_private_ip
from utils.network import get_client_ip


# ── Helpers ───────────────────────────────────────────

def _build_meta(request: Request, duration_ms: int) -> MetaSchema:
    return MetaSchema(
        request_id=f"req_{uuid.uuid4().hex[:24]}",
        timestamp=datetime.now(timezone.utc).isoformat(),
        duration_ms=duration_ms,
        route=RouteInfo(method=request.method, path=request.url.path),
    )


def _json_response(status_code: int, body: dict) -> JSONResponse:
    return JSONResponse(status_code=status_code, content=body)


# ── GeoBlock ──────────────────────────────────────────

class GeoBlockMiddleware(BaseHTTPMiddleware):
    EXCLUDE = {"/health", "/docs", "/redoc", "/openapi.json", "/favicon.ico"}

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.url.path in self.EXCLUDE:
            return await call_next(request)

        if not settings.geo_block_enabled:
            return await call_next(request)

        ip_v4, ip_v6 = get_client_ip(request)
        ip = ip_v4 or ip_v6

        # IPs privadas siempre pasan (docker, localhost)
        if ip and _is_private_ip(ip):
            return await call_next(request)

        if ip:
            geo = get_geo(ip)
            country_code = geo.get("country_code")

            if country_code and country_code not in settings.geo_allowed_countries:
                duration_ms = 0
                meta = _build_meta(request, duration_ms)
                body = fail(
                    message=f"Acceso no permitido desde {geo.get('country_name', country_code)}",
                    code="GEO_BLOCKED",
                    status=status.HTTP_403_FORBIDDEN,
                    meta=meta,
                ).model_dump()
                return _json_response(status.HTTP_403_FORBIDDEN, body)

        return await call_next(request)


# ── Contract ──────────────────────────────────────────

class ResponseContractMiddleware(BaseHTTPMiddleware):
    EXCLUDE = {"/docs", "/redoc", "/openapi.json", "/favicon.ico"}

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.url.path in self.EXCLUDE:
            return await call_next(request)

        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = int((time.perf_counter() - start) * 1000)
        meta = _build_meta(request, duration_ms)

        if "application/json" not in response.headers.get("content-type", ""):
            return response

        body_bytes = b""
        async for chunk in response.body_iterator:
            body_bytes += chunk

        try:
            payload = json.loads(body_bytes)
        except Exception:
            return response

        # Si ya viene con el contrato (errores del handler), no re-envolver
        if isinstance(payload, dict) and "success" in payload:
            return JSONResponse(status_code=response.status_code, content=payload)

        wrapped = ok(result=payload, meta=meta, status=response.status_code)
        return JSONResponse(status_code=response.status_code, content=wrapped.model_dump())


# ── Exception handlers ────────────────────────────────

def register_exception_handlers(app: FastAPI) -> None:

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        meta = _build_meta(request, 0)
        body = fail(message=exc.message, code=exc.code, status=exc.status_code,
                    details=exc.details, meta=meta).model_dump()
        return JSONResponse(status_code=exc.status_code, content=body)

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError):
        meta = _build_meta(request, 0)
        details = [
            ErrorDetail(
                field=" -> ".join(str(l) for l in e["loc"] if l != "body"),
                issue=e["msg"],
                value=e.get("input"),
            )
            for e in exc.errors()
        ]
        body = fail(message="Error de validación", code="VALIDATION_ERROR",
                    status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    details=details, meta=meta).model_dump()
        return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=body)

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception):
        meta = _build_meta(request, 0)
        body = fail(message="Error interno del servidor", code="INTERNAL_ERROR",
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR, meta=meta).model_dump()
        return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=body)