import json
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import HTMLResponse, JSONResponse
from sqlalchemy import text

from core.config import settings
from core.middleware import (
    GeoBlockMiddleware,
    RequestDateTimeNormalizationMiddleware,
    ResponseContractMiddleware,
    register_exception_handlers,
)
from core.security import decode_access_token
from db.schema_compat import ensure_projects_auto_send_columns
from db.session import SessionLocal, engine
from db.redis import close_redis

logger = logging.getLogger(__name__)

_OPERATION_STATE_CACHE_TTL_SEC = 3.0
_OPERATION_STATE_DB_ERROR_CACHE_TTL_SEC = 1.0
_OPERATION_STATE_DB_ERROR_LOG_INTERVAL_SEC = 30.0
_operation_state_cache: dict[str, object] = {
    "expires_at": 0.0,
    "marker": None,
    "source": "empty",
}
_last_operation_state_db_error_log_at = 0.0


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_projects_auto_send_columns(engine)
    try:
        from services.system_maintenance_service import ensure_initial_commissioning_state

        db = SessionLocal()
        try:
            ensure_initial_commissioning_state(db)
        finally:
            db.close()
    except Exception as exc:
        logger.warning("No se pudo asegurar el estado inicial de puesta en marcha: %s", exc)
    from events.pdf_dispatch import register_listeners
    register_listeners()
    yield
    await close_redis()


app = FastAPI(
    title="MinuetAItor API",
    version="1.0.0",
    docs_url=None,
    redoc_url="/v1/redoc" if settings.env_name != "prod" else None,
    openapi_url="/v1/openapi.json" if settings.env_name != "prod" else None,
    servers=[{"url": "/api", "description": "API Gateway (nginx)"}],  # ← agregar esto
    lifespan=lifespan,
)

# ── Middlewares ───────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.env_name == "dev" else settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GeoBlockMiddleware)
app.add_middleware(RequestDateTimeNormalizationMiddleware)
app.add_middleware(ResponseContractMiddleware)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if settings.env_name == "prod":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response


def _is_read_only_safe_request(request: Request) -> bool:
    method = request.method.upper()
    path = request.url.path

    if method in {"GET", "HEAD", "OPTIONS"}:
        return True

    if method != "POST":
        return False

    safe_suffixes = (
        "/list",
        "/summary",
        "/status",
        "/catalog",
        "/lookup",
    )
    safe_prefixes = (
        "/v1/reports/management/",
        "/v1/reports/audit/",
        "/v1/ai-usage-events/",
    )
    safe_exact_paths = {
        "/v1/auth/login",
        "/v1/auth/logout",
        "/v1/participants/resolve",
    }

    return (
        path in safe_exact_paths
        or path.endswith(safe_suffixes)
        or any(path.startswith(prefix) for prefix in safe_prefixes)
    )


def _has_admin_bearer(request: Request) -> bool:
    authorization = request.headers.get("Authorization") or ""
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return False
    try:
        payload = decode_access_token(token.strip())
    except Exception:
        return False
    return "ADMIN" in {str(role or "").upper() for role in payload.get("roles", [])}


def _is_request_method_safe(request: Request) -> bool:
    return request.method.upper() in {"GET", "HEAD", "OPTIONS"}


def _is_maintenance_bypass_path(path: str) -> bool:
    if path in {"/", "/health", "/v1/docs", "/v1/openapi.json", "/v1/redoc"}:
        return True
    return (
        path.startswith("/internal/")
        or path.startswith("/api/internal/")
        or path.startswith("/static/")
        or path.startswith("/assets/")
        or path.startswith("/favicon")
    )


def _get_operation_state_cache(now: float) -> tuple[bool, dict | None]:
    if float(_operation_state_cache.get("expires_at") or 0.0) <= now:
        return False, None
    marker = _operation_state_cache.get("marker")
    return True, marker if isinstance(marker, dict) else None


def _set_operation_state_cache(marker: dict | None, *, source: str, ttl_sec: float) -> None:
    _operation_state_cache["expires_at"] = time.monotonic() + max(0.1, ttl_sec)
    _operation_state_cache["marker"] = marker if isinstance(marker, dict) else None
    _operation_state_cache["source"] = source


def _clear_operation_state_cache() -> None:
    _operation_state_cache["expires_at"] = 0.0
    _operation_state_cache["marker"] = None
    _operation_state_cache["source"] = "cleared"


def _log_operation_state_db_error(exc: Exception) -> None:
    global _last_operation_state_db_error_log_at
    now = time.monotonic()
    if now - _last_operation_state_db_error_log_at < _OPERATION_STATE_DB_ERROR_LOG_INTERVAL_SEC:
        return
    _last_operation_state_db_error_log_at = now
    logger.warning("No se pudo leer estado operativo desde DB en middleware: %s", exc)


def _read_marker_state(marker_path: Path) -> dict | None:
    if not marker_path.is_file():
        return None
    try:
        marker = json.loads(marker_path.read_text(encoding="utf-8"))
        return marker if isinstance(marker, dict) else {}
    except Exception:
        return {}


def _read_db_operation_state() -> tuple[dict | None, bool]:
    try:
        db = SessionLocal()
        try:
            row = db.execute(
                text(
                    """
                    SELECT mode, operation_id, operation_type, reason
                    FROM system_operation_state
                    WHERE id = 1
                    LIMIT 1
                    """
                )
            ).mappings().first()
            return (dict(row) if row else None), False
        finally:
            db.close()
    except Exception as exc:
        _log_operation_state_db_error(exc)
        return None, True


def _effective_operation_marker(marker_path: Path, *, use_cache: bool = True) -> dict | None:
    now = time.monotonic()
    if use_cache:
        cache_hit, cached_marker = _get_operation_state_cache(now)
        if cache_hit:
            return cached_marker

    marker = _read_marker_state(marker_path)
    db_state, db_error = _read_db_operation_state()
    db_mode = str((db_state or {}).get("mode") or "normal")
    marker_mode = str((marker or {}).get("mode") or "")

    if db_mode in {"read_only", "maintenance", "commissioning"}:
        effective = {
            "mode": db_mode,
            "operationId": (db_state or {}).get("operation_id"),
            "operationType": (db_state or {}).get("operation_type"),
            "status": "running",
            "source": "database",
        }
        _set_operation_state_cache(effective, source="database", ttl_sec=_OPERATION_STATE_CACHE_TTL_SEC)
        return effective

    if marker_mode in {"read_only", "maintenance", "commissioning"}:
        if not db_error:
            logger.warning(
                "Divergencia conservadora DB/marker: DB normal pero marker restringido | marker_mode=%s marker_operation_id=%s",
                marker_mode,
                (marker or {}).get("operationId"),
            )
        effective = {
            **(marker or {}),
            "source": "db_unavailable_marker_fallback" if db_error else "marker_file_inconsistent",
        }
        _set_operation_state_cache(
            effective,
            source=str(effective.get("source") or "marker"),
            ttl_sec=_OPERATION_STATE_DB_ERROR_CACHE_TTL_SEC if db_error else _OPERATION_STATE_CACHE_TTL_SEC,
        )
        return effective

    if db_error:
        _set_operation_state_cache(None, source="db_unavailable_no_marker", ttl_sec=_OPERATION_STATE_DB_ERROR_CACHE_TTL_SEC)
    else:
        _set_operation_state_cache(None, source="normal", ttl_sec=_OPERATION_STATE_CACHE_TTL_SEC)
    return None


@app.middleware("http")
async def maintenance_marker_read_only_middleware(request: Request, call_next):
    marker_path = Path(settings.maintenance_state_file)
    path = request.url.path
    is_operation_state_endpoint = path.startswith("/v1/system/maintenance/operation-state")
    is_system_maintenance_endpoint = request.url.path.startswith("/v1/system/maintenance")
    is_system_backups_endpoint = request.url.path.startswith("/v1/system/backups")
    is_login_endpoint = request.url.path == "/v1/auth/login"

    if _is_maintenance_bypass_path(path) or _is_request_method_safe(request) or is_operation_state_endpoint:
        response = await call_next(request)
        if is_operation_state_endpoint and request.method.upper() in {"POST", "PUT", "PATCH", "DELETE"}:
            _clear_operation_state_cache()
        return response

    marker = _effective_operation_marker(marker_path)
    if marker:
        operation_type = str(marker.get("operationType") or marker.get("operation_type") or "")
        mode = marker.get("mode") or "maintenance"
        if mode == "read_only" and _is_read_only_safe_request(request):
            response = await call_next(request)
            response.headers["X-System-Maintenance"] = "read_only"
            return response
        if mode == "commissioning" and (
            is_login_endpoint
            or is_system_maintenance_endpoint
            or is_system_backups_endpoint
            or _has_admin_bearer(request)
        ):
            response = await call_next(request)
            response.headers["X-System-Maintenance"] = "commissioning"
            return response
        if operation_type.startswith("manual_") and (is_login_endpoint or is_system_backups_endpoint):
            response = await call_next(request)
            response.headers["X-System-Maintenance"] = str(mode)
            return response
        message_by_mode = {
            "maintenance": "El sistema está en modo mantenimiento.",
            "read_only": "El sistema está en modo solo lectura.",
            "commissioning": "El sistema está en puesta en marcha. Solo administradores pueden escribir en este estado.",
        }
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "message": message_by_mode.get(mode, "El sistema está en modo operativo restringido."),
                "maintenance": {
                    "mode": mode,
                    "operationId": marker.get("operationId"),
                    "artifactId": marker.get("artifactId"),
                    "scope": marker.get("scope"),
                    "status": marker.get("status") or "running",
                },
            },
            headers={"Retry-After": "30"},
        )
    response = await call_next(request)
    if marker:
        response.headers["X-System-Maintenance"] = str(marker.get("mode") or "restore")
    return response


register_exception_handlers(app)


# ═════════════════════════════════════════════════════════════════════════════
# ROUTERS — orden alfabético
# Leyenda:
#   [ACTIVO]     → registrado y funcional
#   [DESACTIVADO]→ comentado; revisar antes de migrar a producción
#   TODO [RBAC]  → activo pero requiere restricción por rol al implementar RBAC
# ═════════════════════════════════════════════════════════════════════════════

# ── AI Profile Categories (catálogo) ──────────────────────────────────────────
# [ACTIVO] RBAC: lectura autenticada, mutaciones solo ADMIN
from routers.v1.ai_profile_categories import router as ai_profile_categories_router
app.include_router(ai_profile_categories_router, prefix="/v1")

# ── AI Profiles ────────────────────────────────────────────────────────────────
# [ACTIVO]
from routers.v1.ai_profiles import router as ai_profiles_router
app.include_router(ai_profiles_router, prefix="/v1")

# ── AI Provider Configs ───────────────────────────────────────────────────────
# [ACTIVO] RBAC: solo ADMIN
from routers.v1.ai_provider_configs import router as ai_provider_configs_router
app.include_router(ai_provider_configs_router, prefix="/v1")

# ── AI Usage Events ───────────────────────────────────────────────────────────
# [ACTIVO] RBAC: requiere audit.read y aplica scope por cliente/proyecto
from routers.v1.ai_usage_events import router as ai_usage_events_router
app.include_router(ai_usage_events_router, prefix="/v1")

# ── AI Tag Conversions ────────────────────────────────────────────────────────
# [ACTIVO]
from routers.v1.ai_tag_conversions import router as ai_tag_conversions_router
app.include_router(ai_tag_conversions_router, prefix="/v1")

# ── AI Tags ───────────────────────────────────────────────────────────────────
# [ACTIVO]
from routers.v1.ai_tags import router as ai_tags_router
app.include_router(ai_tags_router, prefix="/v1")

# ── Artifact States (catálogo) ────────────────────────────────────────────────
# [ACTIVO] RBAC: lectura autenticada, mutaciones solo ADMIN
from routers.v1.artifact_states import router as artifact_states_router
app.include_router(artifact_states_router, prefix="/v1")

# ── Artifact Type MIME Types (catálogo relacional de sistema) ─────────────────
# [ACTIVO] RBAC: lectura autenticada, mutaciones solo ADMIN
from routers.v1.artifact_type_mime_types import router as artifact_type_mime_types_router
app.include_router(artifact_type_mime_types_router, prefix="/v1")

# ── Artifact Types (catálogo) ─────────────────────────────────────────────────
# [ACTIVO] RBAC: lectura autenticada, mutaciones solo ADMIN
from routers.v1.artifact_types import router as artifact_types_router
app.include_router(artifact_types_router, prefix="/v1")

# ── Auth ──────────────────────────────────────────────────────────────────────
# [ACTIVO]
from routers.v1.auth import router as auth_router
app.include_router(auth_router, prefix="/v1")

# ── Buckets (configuración de storage) ───────────────────────────────────────
# [ACTIVO] RBAC: lectura autenticada, mutaciones solo ADMIN
from routers.v1.buckets import router as buckets_router
app.include_router(buckets_router, prefix="/v1")

# ── Clients ───────────────────────────────────────────────────────────────────
# [ACTIVO]
from routers.v1.clients import router as clients_router
app.include_router(clients_router, prefix="/v1")

# ── Dashboard Widgets (catálogo) ───────────────────────────────────────────────
# [ACTIVO] RBAC: lectura autenticada, mutaciones solo ADMIN
from routers.v1.dashboard_widgets import router as dashboard_widgets_router
app.include_router(dashboard_widgets_router, prefix="/v1")

# Dashboard
from routers.v1.dashboard import router as dashboard_router
app.include_router(dashboard_router, prefix="/v1")

# ── File Extensions (catálogo de sistema) ─────────────────────────────────────
# [ACTIVO] RBAC: lectura autenticada, mutaciones solo ADMIN
from routers.v1.file_extensions import router as file_extensions_router
app.include_router(file_extensions_router, prefix="/v1")

# ── MIME Type Extensions (catálogo relacional de sistema) ─────────────────────
# [ACTIVO] RBAC: lectura autenticada, mutaciones solo ADMIN
from routers.v1.mime_type_extensions import router as mime_type_extensions_router
app.include_router(mime_type_extensions_router, prefix="/v1")

# ── MIME Types (catálogo de sistema) ──────────────────────────────────────────
# [ACTIVO] RBAC: lectura autenticada, mutaciones solo ADMIN
from routers.v1.mime_types import router as mime_types_router
app.include_router(mime_types_router, prefix="/v1")

# ── Objects ───────────────────────────────────────────────────────────────────
# [ACTIVO]
from routers.v1.objects import router as objects_router
app.include_router(objects_router, prefix="/v1")

# ── Notifications ─────────────────────────────────────────────────────────────
# [ACTIVO]
from routers.v1.notifications import router as notifications_router
app.include_router(notifications_router, prefix="/v1")

# ── Permissions ───────────────────────────────────────────────────────────────
# [DESACTIVADO] Los permisos son configuración del sistema gestionada por seeds/migraciones.
# No deben ser modificables desde la API pública.
# TODO: [RBAC] Si se requiere lectura, exponer solo GET/LIST restringido a rol admin.
# from routers.v1.permissions import router as permissions_router
# app.include_router(permissions_router, prefix="/v1")

# ── Participants ──────────────────────────────────────────────────────────────
# [ACTIVO]
from routers.v1.participants import router as participants_router
app.include_router(participants_router, prefix="/v1")

# ── Projects ──────────────────────────────────────────────────────────────────
# [ACTIVO]
from routers.v1.projects import router as projects_router
app.include_router(projects_router, prefix="/v1")

# ── Record Artifacts ──────────────────────────────────────────────────────────
# [ACTIVO]
from routers.v1.record_artifacts import router as record_artifacts_router
app.include_router(record_artifacts_router, prefix="/v1")

# ── Record Drafts ─────────────────────────────────────────────────────────────
# [ACTIVO]
from routers.v1.record_drafts import router as record_drafts_router
app.include_router(record_drafts_router, prefix="/v1")

# ── Record Statuses (catálogo) ────────────────────────────────────────────────
# [ACTIVO] RBAC: lectura autenticada, mutaciones solo ADMIN
from routers.v1.record_statuses import router as record_statuses_router
app.include_router(record_statuses_router, prefix="/v1")

# ── Record Type Artifact Types (catálogo relacional) ──────────────────────────
# [ACTIVO] RBAC: lectura autenticada, mutaciones solo ADMIN
from routers.v1.record_type_artifact_types import router as record_type_artifact_types_router
app.include_router(record_type_artifact_types_router, prefix="/v1")

# ── Record Types (catálogo) ───────────────────────────────────────────────────
# [ACTIVO] RBAC: lectura autenticada, mutaciones solo ADMIN
from routers.v1.record_types import router as record_types_router
app.include_router(record_types_router, prefix="/v1")

# ── Record Version AI Tags ────────────────────────────────────────────────────
# [ACTIVO]
from routers.v1.record_version_ai_tags import router as record_version_ai_tags_router
app.include_router(record_version_ai_tags_router, prefix="/v1")

# ── Record Version Commits ────────────────────────────────────────────────────
# [ACTIVO]
from routers.v1.record_version_commits import router as record_version_commits_router
app.include_router(record_version_commits_router, prefix="/v1")

# ── Record Version Participants ───────────────────────────────────────────────
# [ACTIVO]
from routers.v1.record_version_participants import router as record_version_participants_router
app.include_router(record_version_participants_router, prefix="/v1")

# ── Record Version Tags ───────────────────────────────────────────────────────
# [ACTIVO]
from routers.v1.record_version_tags import router as record_version_tags_router
app.include_router(record_version_tags_router, prefix="/v1")

# ── Record Versions ───────────────────────────────────────────────────────────
# [ACTIVO]
from routers.v1.record_versions import router as record_versions_router
app.include_router(record_versions_router, prefix="/v1")

# ── Records ───────────────────────────────────────────────────────────────────
# [ACTIVO]
from routers.v1.records import router as records_router
app.include_router(records_router, prefix="/v1")

# ── Reports ───────────────────────────────────────────────────────────────────
# [ACTIVO]
from routers.v1.reports import router as reports_router
app.include_router(reports_router, prefix="/v1")

# ── Role Permissions ──────────────────────────────────────────────────────────
# [DESACTIVADO] Tabla pivote roles ↔ permisos. Modificar vía API compromete el
# modelo de seguridad completo.
# TODO: Gestionar solo por seeds o panel de super-admin.
#       Eliminar definitivamente antes de producción si no se implementa panel.
# from routers.v1.role_permissions import router as role_permissions_router
# app.include_router(role_permissions_router, prefix="/v1")

# ── Roles ─────────────────────────────────────────────────────────────────────
# [DESACTIVADO] Los roles del sistema (admin/write/read) son configuración gestionada
# por seeds/migraciones. Crear o eliminar roles vía API permite escalar privilegios.
# TODO: [RBAC] Si se requiere lectura, exponer solo GET/LIST restringido a rol admin.
# from routers.v1.roles import router as roles_router
# app.include_router(roles_router, prefix="/v1")

# ── System ────────────────────────────────────────────────────────────────────
# [DESACTIVADO] Endpoints de infraestructura (/health, /ready). Actualmente
# servidos directamente en main. Activar si se migra a router dedicado.
# from routers.v1.system import router as system_router
# app.include_router(system_router, prefix="/v1")

# ── Tag Categories (catálogo) ──────────────────────────────────────────────────
# [ACTIVO] RBAC: lectura autenticada, mutaciones solo ADMIN
from routers.v1.tag_categories import router as tag_categories_router
app.include_router(tag_categories_router, prefix="/v1")

# ── Tags ──────────────────────────────────────────────────────────────────────
# [ACTIVO]
from routers.v1.tags import router as tags_router
app.include_router(tags_router, prefix="/v1")

# ── Teams ─────────────────────────────────────────────────────────────────────
# [ACTIVO]
from routers.v1.teams import router as teams_router
app.include_router(teams_router, prefix="/v1")

# ── User Client ACL ───────────────────────────────────────────────────────────
# [ACTIVO] Permisos granulares usuario ↔ cliente (read/edit/owner)
from routers.v1.user_client_acl import router as user_client_acl_router
app.include_router(user_client_acl_router, prefix="/v1")

# ── User Clients ──────────────────────────────────────────────────────────────
# [ACTIVO] Asignación básica usuario ↔ cliente (pertenencia)
from routers.v1.user_clients import router as user_clients_router
app.include_router(user_clients_router, prefix="/v1")

# ── User Dashboard Widgets ────────────────────────────────────────────────────
# [ACTIVO]
from routers.v1.user_dashboard_widgets import router as user_dashboard_widgets_router
app.include_router(user_dashboard_widgets_router, prefix="/v1")

# ── User Profiles ─────────────────────────────────────────────────────────────
# [DESACTIVADO] El perfil se gestiona a través de /teams y /auth/me.
# Un CRUD separado crea una vía paralela inconsistente para los mismos datos.
# TODO: Evaluar si se requiere un GET de solo lectura para uso interno del frontend.
# from routers.v1.user_profiles import router as user_profiles_router
# app.include_router(user_profiles_router, prefix="/v1")

# ── User Project ACL ──────────────────────────────────────────────────────────
# [ACTIVO]
from routers.v1.user_project_acl import router as user_project_acl_router
app.include_router(user_project_acl_router, prefix="/v1")

# ── User Roles ────────────────────────────────────────────────────────────────
# [ACTIVO]
from routers.v1.user_roles import router as user_roles_router
app.include_router(user_roles_router, prefix="/v1")

# ── User Sessions ─────────────────────────────────────────────────────────────
# [DESACTIVADO] Las sesiones se gestionan exclusivamente a través de /auth.
# Exponer CRUD público permite consultar o manipular sesiones ajenas.
# TODO: [RBAC] Si se necesita consulta, exponer solo GET /list filtrado por
#       session.user_id y eliminar POST/PUT/DELETE.
# from routers.v1.user_sessions import router as user_sessions_router
# app.include_router(user_sessions_router, prefix="/v1")

# ── Version Statuses (catálogo) ───────────────────────────────────────────────
# [ACTIVO] RBAC: lectura autenticada, mutaciones solo ADMIN
from routers.v1.version_statuses import router as version_statuses_router
app.include_router(version_statuses_router, prefix="/v1")

# ── Sendmail (Dev) ───────────────────────────────────────
from routers.v1.sendmail import router as sendmail_router
app.include_router(sendmail_router, prefix="/v1")

# ── SMTP Configs ──────────────────────────────────────────────────────────────
# [ACTIVO]
from routers.v1.smtp_configs import router as smtp_configs_router
app.include_router(smtp_configs_router, prefix="/v1")

# ── System Organization ───────────────────────────────────────────────────────
# [ACTIVO] Datos institucionales base de la instancia
from routers.v1.organization_settings import router as organization_settings_router
app.include_router(organization_settings_router, prefix="/v1")

# ── System Maintenance ────────────────────────────────────────────────────────
# [ACTIVO] Configuración administrativa del submódulo de mantenimiento
from routers.v1.system_maintenance import router as system_maintenance_router
app.include_router(system_maintenance_router, prefix="/v1")

# ── System Backups ────────────────────────────────────────────────────────────
# [ACTIVO] Configuración, historial y encolado de respaldos
from routers.v1.system_backups import router as system_backups_router
app.include_router(system_backups_router, prefix="/v1")

# ── System Queues ─────────────────────────────────────────────────────────────
# [ACTIVO] Snapshot administrativo de colas Redis y su carga operativa
from routers.v1.system_queues import router as system_queues_router
app.include_router(system_queues_router, prefix="/v1")

# Añadir en main.py junto a los otros routers:
from routers.v1.minutes import router as minutes_router
app.include_router(minutes_router, prefix="/v1")

# ── Minute Views (acceso visitante) ───────────────────────────────────────────
# [ACTIVO]
from routers.v1.minute_views import router as minute_views_router
app.include_router(minute_views_router, prefix="/v1")

# ── Internal API (worker → backend, sin JWT, con X-Internal-Secret) ───────────
# [ACTIVO] Solo accesible dentro de la red Docker interna — nunca expuesto por nginx
from routers.internal.minutes import router as internal_minutes_router
app.include_router(internal_minutes_router)
from routers.internal.maintenance import router as internal_maintenance_router
app.include_router(internal_maintenance_router)
from routers.internal.notifications import router as internal_notifications_router
app.include_router(internal_notifications_router)
from routers.internal.backups import router as internal_backups_router
app.include_router(internal_backups_router)


# ── System endpoints ──────────────────────────────────────────────────────────
@app.get("/", tags=["System"])
def root():
    return {"response": "consulte el endpoint correcto"}


@app.get("/health", tags=["System"])
def health():
    return {"env": settings.env_name, "status": "running"}

@app.get("/v1/docs", include_in_schema=False)
async def custom_swagger_ui():
    if settings.env_name == "prod":
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    return get_swagger_ui_html(
        openapi_url="/api/v1/openapi.json",
        title="MinuetAItor API - Swagger UI",
    )
