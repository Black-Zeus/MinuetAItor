# models/__init__.py
# ── Orden importante: dependencias antes que los modelos que las referencian ──

# ── Core / Auth ───────────────────────────────────────────────────────────────
from models.user import User
from models.user_profiles import UserProfile
from models.user_notification_preferences import UserNotificationPreference
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
from models.ai_provider_configs import AiProviderConfig
from models.ai_model_pricing import AiModelPricing
from models.ai_usage_events import AiUsageEvent
from models.notifications import Notification
from models.notification_recipients import NotificationRecipient
from models.email_delivery_events import EmailDeliveryEvent
from models.organization_settings import OrganizationSetting
from models.smtp_configs import SmtpConfig
from models.system_maintenance_setting import SystemMaintenanceSetting

# ── Entidades de negocio ──────────────────────────────────────────────────────
from models.clients import Client
from models.projects import Project
from models.participant import Participant
from models.participant_email import ParticipantEmail
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
from models.minute_transaction import MinuteTransaction
from models.record_drafts import RecordDraft
from models.record_versions import RecordVersion
from models.record_status_transitions import RecordStatusTransition
from models.record_artifacts import RecordArtifact
from models.record_version_tags import RecordVersionTag
from models.record_version_ai_tags import RecordVersionAiTag
from models.record_version_agreements import RecordVersionAgreement
from models.record_version_requirements import RecordVersionRequirement
from models.record_version_commits import RecordVersionCommit
from models.record_version_participant import RecordVersionParticipant
from models.visitor_access_request import VisitorAccessRequest
from models.visitor_session import VisitorSession
from models.record_version_observation import RecordVersionObservation

# ── Tablas relacionales ───────────────────────────────────────────────────────
from models.artifact_type_mime_types import ArtifactTypeMimeType   # ← verificar nombre clase
from models.record_type_artifact_types import RecordTypeArtifactType  # ← verificar nombre clase
from models.user_clients import UserClient                           # ← verificar nombre clase
from models.user_client_acl import UserClientAcl                    # ← verificar nombre clase
from models.user_project_acl import UserProjectACL
from models.user_dashboard_widgets import UserDashboardWidget        # ← verificar nombre clase


__all__ = [
    # Auth
    "User", "UserProfile", "UserNotificationPreference", "Role", "Permission", "UserRole", "RolePermission",
    # Catálogos
    "Bucket", "FileExtension", "MimeType", "MimeTypeExtension",
    "TagCategory", "ArtifactType", "ArtifactState",
    "RecordType", "RecordStatus", "VersionStatus",
    "DashboardWidget", "AiProfileCategory",
    "AiProviderConfig", "AiModelPricing", "AiUsageEvent",
    "Notification", "NotificationRecipient", "EmailDeliveryEvent",
    "OrganizationSetting",
    "SmtpConfig",
    "SystemMaintenanceSetting",
    # Negocio
    "Client", "Project", "Object", "AiProfile", "AuditLog",
    "Participant", "ParticipantEmail",
    # Tags
    "Tag", "AITag", "AiTagConversion",
    # Records
    "Record", "MinuteTransaction", "RecordDraft", "RecordVersion", "RecordStatusTransition", "RecordArtifact",
    "RecordVersionTag", "RecordVersionAiTag", "RecordVersionCommit",
    "RecordVersionAgreement", "RecordVersionRequirement",
    "RecordVersionParticipant", "VisitorAccessRequest", "VisitorSession",
    "RecordVersionObservation",
    # Relacionales
    "ArtifactTypeMimeType", "RecordTypeArtifactType",
    "UserClient", "UserClientAcl", "UserProjectACL", "UserDashboardWidget",
]
