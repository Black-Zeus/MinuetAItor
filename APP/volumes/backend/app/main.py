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


# ── Middlewares ───────────────────────────────────────
# Orden importante: se apilan de abajo hacia arriba
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

# ── Routers ───────────────────────────────────────────
from routers.v1.auth import router as auth_router
app.include_router(auth_router, prefix="/v1")

# ── Teams / Users ───────────────────────────────────────────
from routers.v1.teams import router as teams_router
app.include_router(teams_router, prefix="/v1")

# ── Clients ───────────────────────────────────────────
from routers.v1.clients import router as clients_router
app.include_router(clients_router, prefix="/v1")

# ── Projects ────────────────────────────────────────────
from routers.v1.projects import router as projects_router
app.include_router(projects_router, prefix="/v1")

# ── Dashboard Widgets ────────────────────────────────────
from routers.v1.dashboard_widgets import router as dashboard_widgets_router
app.include_router(dashboard_widgets_router, prefix="/v1")

# ── AI Profile Categories ─────────────────────────────────
from routers.v1.ai_profile_categories import router as ai_profile_categories_router
app.include_router(ai_profile_categories_router, prefix="/v1")

# ── AI Profiles ──────────────────────────────────────────
from routers.v1.ai_profiles import router as ai_profiles_router
app.include_router(ai_profiles_router, prefix="/v1")

# ── TagCategories ───────────────────────────────────────
from routers.v1.tag_categories import router as tag_categories_router
app.include_router(tag_categories_router, prefix="/v1")

# ── Tags ────────────────────────────────────────────────
from routers.v1.tags import router as tags_router
app.include_router(tags_router, prefix="/v1")

# ── AI Tags ─────────────────────────────────────────────
from routers.v1.ai_tags import router as ai_tags_router
app.include_router(ai_tags_router, prefix="/v1")

# ── AI Tag Conversions ──────────────────────────────────
from routers.v1.ai_tag_conversions import router as ai_tag_conversions_router
app.include_router(ai_tag_conversions_router, prefix="/v1")

# ── RecordTypes ──────────────────────────────────────────
from routers.v1.record_types import router as record_types_router
app.include_router(record_types_router, prefix="/v1")

# ── Roles ───────────────────────────────────────────────
from routers.v1.roles import router as roles_router
app.include_router(roles_router, prefix="/v1")

# ── Permissions ──────────────────────────────────────────
from routers.v1.permissions import router as permissions_router
app.include_router(permissions_router, prefix="/v1")

# ── User Roles ──────────────────────────────────────────
from routers.v1.user_roles import router as user_roles_router
app.include_router(user_roles_router, prefix="/v1")

# ── UserClients ──────────────────────────────────────────
from routers.v1.user_clients import router as user_clients_router
app.include_router(user_clients_router, prefix="/v1")

# ── UserClientAcl ─────────────────────────────────────────
from routers.v1.user_client_acl import router as user_client_acl_router
app.include_router(user_client_acl_router, prefix="/v1")

# ── UserProjectACL ───────────────────────────────────────
from routers.v1.user_project_acl import router as user_project_acl_router
app.include_router(user_project_acl_router, prefix="/v1")

# ── UserDashboardWidgets ─────────────────────────────────────────
from routers.v1.user_dashboard_widgets import router as user_dashboard_widgets_router
app.include_router(user_dashboard_widgets_router, prefix="/v1")

# ── UserProfiles ─────────────────────────────────────────
from routers.v1.user_profiles import router as user_profiles_router
app.include_router(user_profiles_router, prefix="/v1")

# ── RecordStatuses ───────────────────────────────────────
from routers.v1.record_statuses import router as record_statuses_router
app.include_router(record_statuses_router, prefix="/v1")

# ── Version Statuses ─────────────────────────────────────
from routers.v1.version_statuses import router as version_statuses_router
app.include_router(version_statuses_router, prefix="/v1")

# ── Artifact Types ────────────────────────────────────────
from routers.v1.artifact_types import router as artifact_types_router
app.include_router(artifact_types_router, prefix="/v1")

# ── Artifact States ───────────────────────────────────────
from routers.v1.artifact_states import router as artifact_states_router
app.include_router(artifact_states_router, prefix="/v1")

# ── Buckets ───────────────────────────────────────────────
from routers.v1.buckets import router as buckets_router
app.include_router(buckets_router, prefix="/v1")

# ── RecordTypeArtifactTypes ───────────────────────────────
from routers.v1.record_type_artifact_types import router as record_type_artifact_types_router
app.include_router(record_type_artifact_types_router, prefix="/v1")

# ── Objects ───────────────────────────────────────────────
from routers.v1.objects import router as objects_router
app.include_router(objects_router, prefix="/v1")

# ── Records ───────────────────────────────────────────
from routers.v1.records import router as records_router
app.include_router(records_router, prefix="/v1")

# ── RecordDrafts ─────────────────────────────────────────
from routers.v1.record_drafts import router as record_drafts_router
app.include_router(record_drafts_router, prefix="/v1")

# ── RecordVersions ──────────────────────────────────────
from routers.v1.record_versions import router as record_versions_router
app.include_router(record_versions_router, prefix="/v1")

# ── RecordVersionParticipants ──────────────────────────
from routers.v1.record_version_participants import router as record_version_participants_router
app.include_router(record_version_participants_router, prefix="/v1")

# ── RecordVersionTags ─────────────────────────────────────
from routers.v1.record_version_tags import router as record_version_tags_router
app.include_router(record_version_tags_router, prefix="/v1")

# ── RecordVersionAiTags ─────────────────────────────────
from routers.v1.record_version_ai_tags import router as record_version_ai_tags_router
app.include_router(record_version_ai_tags_router, prefix="/v1")

# ── Record Version Commits ───────────────────────────────
from routers.v1.record_version_commits import router as record_version_commits_router
app.include_router(record_version_commits_router, prefix="/v1")

# ── RecordArtifacts ──────────────────────────────────────────
from routers.v1.record_artifacts import router as record_artifacts_router
app.include_router(record_artifacts_router, prefix="/v1")

# ── Audit Logs ──────────────────────────────────────────
from routers.v1.audit_logs import router as audit_logs_router
app.include_router(audit_logs_router, prefix="/v1")

# ── MimeTypes ───────────────────────────────────────────
from routers.v1.mime_types import router as mime_types_router
app.include_router(mime_types_router, prefix="/v1")

# ── FileExtensions ───────────────────────────────────────
from routers.v1.file_extensions import router as file_extensions_router
app.include_router(file_extensions_router, prefix="/v1")

# ── MimeTypeExtensions ─────────────────────────────────────
from routers.v1.mime_type_extensions import router as mime_type_extensions_router
app.include_router(mime_type_extensions_router, prefix="/v1")

# ── ArtifactTypeMimeTypes ─────────────────────────────────
from routers.v1.artifact_type_mime_types import router as artifact_type_mime_types_router
app.include_router(artifact_type_mime_types_router, prefix="/v1")

# ── User Sessions ────────────────────────────────────────
from routers.v1.user_sessions import router as user_sessions_router
app.include_router(user_sessions_router, prefix="/v1")

# # ── System ───────────────────────────────────────────────
# from routers.v1.system import router as system_router
# app.include_router(system_router, prefix="/v1")

@app.get("/", tags=["System"])
def root(): return {"response":"consulte el endpoint correcto"}

@app.get("/health", tags=["System"])
def health(): return {"env": settings.env_name, "status": "running"}