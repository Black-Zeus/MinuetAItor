# models/__init__.py
# ── Orden importante: dependencias antes que los modelos que las referencian ──

# ── Core / Auth ───────────────────────────────────────────────────────────────
from models.user import User
from models.user_profiles import UserProfile
from models.roles import Role
from models.permissions import Permission
from models.user_roles import UserRole
from models.role_permissions import RolePermission

# ── Catálogos simples (sin dependencias entre sí) ─────────────────────────────
from models.buckets import Bucket
from models.file_extensions import FileExtension
from models.mime_types import MimeType
from models.mime_type_extensions import MimeTypeExtension
from models.tag_categories import TagCategory
from models.artifact_types import ArtifactType
from models.artifact_states import ArtifactState
from models.record_types import RecordType
from models.record_statuses import RecordStatus
from models.version_statuses import VersionStatus
from models.dashboard_widgets import DashboardWidget
from models.ai_profile_categories import AiProfileCategory

# ── Entidades de negocio ──────────────────────────────────────────────────────
from models.clients import Client
from models.projects import Project
from models.objects import Object
from models.ai_profiles import AiProfile
from models.audit_logs import AuditLog

# ── Tags / AI Tags (ANTES de las tablas que los referencian) ──────────────────
from models.tags import Tag                          # ← debe existir models/tags.py
from models.ai_tags import AITag                     # ← clase se llama AITag, no AiTag

# ── Tablas relacionales que dependen de Tags / AITags ─────────────────────────
from models.ai_tag_conversions import AiTagConversion   # referencia "AITag" → CORREGIR

# ── Records ───────────────────────────────────────────────────────────────────
from models.records import Record
from models.record_drafts import RecordDraft
from models.record_versions import RecordVersion
from models.record_artifacts import RecordArtifact
from models.record_version_tags import RecordVersionTag
from models.record_version_ai_tags import RecordVersionAiTag
from models.record_version_commits import RecordVersionCommit
from models.record_version_participant import RecordVersionParticipant

# ── Tablas relacionales ───────────────────────────────────────────────────────
from models.artifact_type_mime_types import ArtifactTypeMimeType   # ← verificar nombre clase
from models.record_type_artifact_types import RecordTypeArtifactType  # ← verificar nombre clase
from models.user_clients import UserClient                           # ← verificar nombre clase
from models.user_client_acl import UserClientAcl                    # ← verificar nombre clase
from models.user_project_acl import UserProjectACL
from models.user_dashboard_widgets import UserDashboardWidget        # ← verificar nombre clase


__all__ = [
    # Auth
    "User", "UserProfile", "Role", "Permission", "UserRole", "RolePermission",
    # Catálogos
    "Bucket", "FileExtension", "MimeType", "MimeTypeExtension",
    "TagCategory", "ArtifactType", "ArtifactState",
    "RecordType", "RecordStatus", "VersionStatus",
    "DashboardWidget", "AiProfileCategory",
    # Negocio
    "Client", "Project", "Object", "AiProfile", "AuditLog",
    # Tags
    "Tag", "AITag", "AiTagConversion",
    # Records
    "Record", "RecordDraft", "RecordVersion", "RecordArtifact",
    "RecordVersionTag", "RecordVersionAiTag", "RecordVersionCommit",
    "RecordVersionParticipant",
    # Relacionales
    "ArtifactTypeMimeType", "RecordTypeArtifactType",
    "UserClient", "UserClientAcl", "UserProjectACL", "UserDashboardWidget",
]