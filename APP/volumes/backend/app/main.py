# main.py
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from core.middleware import ResponseContractMiddleware, GeoBlockMiddleware, register_exception_handlers
from db.redis import close_redis


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_redis()


app = FastAPI(
    title="MinuetAItor API",
    version="1.0.0",
    docs_url="/docs" if settings.env_name != "prod" else None,
    redoc_url="/redoc" if settings.env_name != "prod" else None,
    openapi_url="/openapi.json" if settings.env_name != "prod" else None,
    lifespan=lifespan,
)

# ── Middlewares ───────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.env_name == "dev" else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GeoBlockMiddleware)
app.add_middleware(ResponseContractMiddleware)

register_exception_handlers(app)


# ═════════════════════════════════════════════════════════════════════════════
# ROUTERS — orden alfabético
# Leyenda:
#   [ACTIVO]     → registrado y funcional
#   [DESACTIVADO]→ comentado; revisar antes de migrar a producción
#   TODO [RBAC]  → activo pero requiere restricción por rol al implementar RBAC
# ═════════════════════════════════════════════════════════════════════════════

# ── AI Profile Categories (catálogo) ──────────────────────────────────────────
# [ACTIVO] TODO: [RBAC] Restringir POST/PUT/DELETE/PATCH a rol admin
from routers.v1.ai_profile_categories import router as ai_profile_categories_router
app.include_router(ai_profile_categories_router, prefix="/v1")

# ── AI Profiles ────────────────────────────────────────────────────────────────
# [ACTIVO]
from routers.v1.ai_profiles import router as ai_profiles_router
app.include_router(ai_profiles_router, prefix="/v1")

# ── AI Tag Conversions ────────────────────────────────────────────────────────
# [ACTIVO]
from routers.v1.ai_tag_conversions import router as ai_tag_conversions_router
app.include_router(ai_tag_conversions_router, prefix="/v1")

# ── AI Tags ───────────────────────────────────────────────────────────────────
# [ACTIVO]
from routers.v1.ai_tags import router as ai_tags_router
app.include_router(ai_tags_router, prefix="/v1")

# ── Artifact States (catálogo) ────────────────────────────────────────────────
# [ACTIVO] TODO: [RBAC] Restringir POST/PUT/DELETE/PATCH a rol admin
from routers.v1.artifact_states import router as artifact_states_router
app.include_router(artifact_states_router, prefix="/v1")

# ── Artifact Type MIME Types (catálogo relacional de sistema) ─────────────────
# [ACTIVO] TODO: [RBAC] Restringir POST/PUT/DELETE/PATCH a rol admin
from routers.v1.artifact_type_mime_types import router as artifact_type_mime_types_router
app.include_router(artifact_type_mime_types_router, prefix="/v1")

# ── Artifact Types (catálogo) ─────────────────────────────────────────────────
# [ACTIVO] TODO: [RBAC] Restringir POST/PUT/DELETE/PATCH a rol admin
from routers.v1.artifact_types import router as artifact_types_router
app.include_router(artifact_types_router, prefix="/v1")

# ── Auth ──────────────────────────────────────────────────────────────────────
# [ACTIVO]
from routers.v1.auth import router as auth_router
app.include_router(auth_router, prefix="/v1")

# ── Buckets (configuración de storage) ───────────────────────────────────────
# [ACTIVO] TODO: [RBAC] Restringir POST/PUT/DELETE/PATCH a rol admin
from routers.v1.buckets import router as buckets_router
app.include_router(buckets_router, prefix="/v1")

# ── Clients ───────────────────────────────────────────────────────────────────
# [ACTIVO]
from routers.v1.clients import router as clients_router
app.include_router(clients_router, prefix="/v1")

# ── Dashboard Widgets (catálogo) ───────────────────────────────────────────────
# [ACTIVO] TODO: [RBAC] Restringir POST/PUT/DELETE/PATCH a rol admin
from routers.v1.dashboard_widgets import router as dashboard_widgets_router
app.include_router(dashboard_widgets_router, prefix="/v1")

# ── File Extensions (catálogo de sistema) ─────────────────────────────────────
# [ACTIVO] TODO: [RBAC] Restringir POST/PUT/DELETE/PATCH a rol admin
from routers.v1.file_extensions import router as file_extensions_router
app.include_router(file_extensions_router, prefix="/v1")

# ── MIME Type Extensions (catálogo relacional de sistema) ─────────────────────
# [ACTIVO] TODO: [RBAC] Restringir POST/PUT/DELETE/PATCH a rol admin
from routers.v1.mime_type_extensions import router as mime_type_extensions_router
app.include_router(mime_type_extensions_router, prefix="/v1")

# ── MIME Types (catálogo de sistema) ──────────────────────────────────────────
# [ACTIVO] TODO: [RBAC] Restringir POST/PUT/DELETE/PATCH a rol admin
from routers.v1.mime_types import router as mime_types_router
app.include_router(mime_types_router, prefix="/v1")

# ── Objects ───────────────────────────────────────────────────────────────────
# [ACTIVO]
from routers.v1.objects import router as objects_router
app.include_router(objects_router, prefix="/v1")

# ── Permissions ───────────────────────────────────────────────────────────────
# [DESACTIVADO] Los permisos son configuración del sistema gestionada por seeds/migraciones.
# No deben ser modificables desde la API pública.
# TODO: [RBAC] Si se requiere lectura, exponer solo GET/LIST restringido a rol admin.
# from routers.v1.permissions import router as permissions_router
# app.include_router(permissions_router, prefix="/v1")

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
# [ACTIVO] TODO: [RBAC] Restringir POST/PUT/DELETE/PATCH a rol admin
from routers.v1.record_statuses import router as record_statuses_router
app.include_router(record_statuses_router, prefix="/v1")

# ── Record Type Artifact Types (catálogo relacional) ──────────────────────────
# [ACTIVO] TODO: [RBAC] Restringir POST/PUT/DELETE/PATCH a rol admin
from routers.v1.record_type_artifact_types import router as record_type_artifact_types_router
app.include_router(record_type_artifact_types_router, prefix="/v1")

# ── Record Types (catálogo) ───────────────────────────────────────────────────
# [ACTIVO] TODO: [RBAC] Restringir POST/PUT/DELETE/PATCH a rol admin
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
# [ACTIVO] TODO: [RBAC] Restringir POST/PUT/DELETE/PATCH a rol admin
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
# [ACTIVO] TODO: [RBAC] Restringir POST/PUT/DELETE/PATCH a rol admin
from routers.v1.version_statuses import router as version_statuses_router
app.include_router(version_statuses_router, prefix="/v1")

# ── Sendmail (Dev) ───────────────────────────────────────
from routers.v1.sendmail import router as sendmail_router
app.include_router(sendmail_router, prefix="/v1")

# ── System endpoints ──────────────────────────────────────────────────────────
@app.get("/", tags=["System"])
def root():
    return {"response": "consulte el endpoint correcto"}


@app.get("/health", tags=["System"])
def health():
    return {"env": settings.env_name, "status": "running"}