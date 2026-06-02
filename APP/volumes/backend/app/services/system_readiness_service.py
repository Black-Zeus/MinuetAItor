from __future__ import annotations

import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from core.config import settings
from core.datetime_utils import utc_isoformat_z, utc_now
from db.minio_client import REQUIRED_MINIO_BUCKETS, ensure_minio_buckets
from db.redis import get_redis
from services.email_template_service import EMAIL_TEMPLATES_DIR, TEMPLATE_DEFINITIONS
from services.system_maintenance_service import get_system_operation_state

CRITICAL_TABLES = (
    "users",
    "roles",
    "permissions",
    "role_permissions",
    "user_roles",
    "organization_settings",
    "smtp_configs",
    "ai_provider_configs",
    "ai_provider_bindings",
    "system_maintenance_settings",
    "system_backup_settings",
    "system_operation_state",
    "records",
    "record_versions",
)

QUEUE_NAMES = (
    "queue:minutes",
    "queue:email",
    "queue:pdf",
    "queue:maintenance",
    "queue:dlq",
)

REQUIRED_AI_BINDINGS = (
    {
        "purpose": "minute_analysis",
        "label": "Análisis de minuta",
        "agent": "Minuta",
        "requires_dimensions": False,
    },
    {
        "purpose": "context_embeddings",
        "label": "Vectorización",
        "agent": "Contexto",
        "requires_dimensions": True,
    },
    {
        "purpose": "context_answering",
        "label": "Respuesta contextual",
        "agent": "Contexto",
        "requires_dimensions": False,
    },
)

WEAK_SECRET_FRAGMENTS = (
    "change_me",
    "changeme",
    "__change_me",
    "cambia_esto",
    "minioadmin_change_me",
    "root_change_me",
    "change_me_super_secret",
    "sk-fake",
    "admin1234",
    "password",
)


def _utc_iso() -> str:
    return utc_isoformat_z(utc_now())


def _check(
    checks: list[dict[str, Any]],
    *,
    check_id: str,
    category: str,
    title: str,
    status: str,
    message: str,
    blocking: bool = True,
    details: dict[str, Any] | None = None,
) -> None:
    checks.append(
        {
            "id": check_id,
            "category": category,
            "title": title,
            "status": status,
            "blocking": bool(blocking),
            "message": message,
            "details": details or {},
        }
    )


def _count(db: Session, sql: str, params: dict[str, Any] | None = None) -> int:
    return int(db.execute(text(sql), params or {}).scalar() or 0)


def _last_commissioning_started_at(db: Session, operation_state: dict[str, Any]) -> Any | None:
    try:
        value = db.execute(
            text(
                """
                SELECT MAX(event_at)
                FROM audit_log
                WHERE action = 'system_commissioning_enabled'
                  AND entity_type = 'system_operation_state'
                """
            )
        ).scalar()
        if value is not None:
            return value
    except Exception:
        pass

    if str(operation_state.get("mode") or "").strip() == "commissioning":
        started_at = operation_state.get("startedAt") or operation_state.get("started_at")
        if started_at:
            if isinstance(started_at, str):
                try:
                    parsed = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
                    if parsed.tzinfo is not None:
                        return parsed.astimezone(timezone.utc).replace(tzinfo=None)
                    return parsed
                except ValueError:
                    return started_at
            return started_at
    return None


def _table_exists(db: Session, table_name: str) -> bool:
    return bool(
        db.execute(
            text(
                """
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = DATABASE()
                  AND table_name = :table_name
                """
            ),
            {"table_name": table_name},
        ).scalar()
    )


def _url_has_scheme(value: str | None) -> bool:
    clean = str(value or "").strip().lower()
    return clean.startswith("https://") or clean.startswith("http://")


def _http_check(url: str, timeout: float = 2.0) -> tuple[bool, str]:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            status_code = int(getattr(response, "status", 0) or 0)
            return 200 <= status_code < 500, f"HTTP {status_code}"
    except Exception as exc:
        return False, str(exc)


def _secret_file_check(path: str | None) -> dict[str, Any]:
    clean_path = str(path or "").strip()
    return {
        "configured": bool(clean_path),
        "exists": bool(clean_path and Path(clean_path).is_file()),
    }


def _is_strong_secret(value: str | None, *, min_length: int = 32) -> bool:
    clean = str(value or "").strip()
    if len(clean) < min_length:
        return False
    lowered = clean.lower()
    return not any(fragment in lowered for fragment in WEAK_SECRET_FRAGMENTS)


def _ai_binding_readiness(db: Session) -> dict[str, Any]:
    rows = db.execute(
        text(
            """
            SELECT
              b.purpose,
              b.provider_config_id,
              b.model_name,
              b.embedding_dimensions,
              p.name AS provider_name,
              p.provider_type,
              p.is_active AS provider_is_active,
              p.validation_status
            FROM ai_provider_bindings b
            LEFT JOIN ai_provider_configs p
              ON p.id = b.provider_config_id
             AND p.deleted_at IS NULL
            WHERE b.deleted_at IS NULL
              AND b.is_active = 1
            """
        )
    ).mappings().all()
    by_purpose = {str(row.get("purpose") or ""): row for row in rows}

    items: list[dict[str, Any]] = []
    missing: list[str] = []
    incomplete: list[dict[str, Any]] = []
    for expected in REQUIRED_AI_BINDINGS:
        purpose = expected["purpose"]
        row = by_purpose.get(purpose)
        if not row:
            missing.append(purpose)
            items.append({**expected, "status": "missing"})
            continue

        problems: list[str] = []
        if not str(row.get("provider_config_id") or "").strip():
            problems.append("provider")
        if not bool(row.get("provider_is_active")):
            problems.append("provider_inactive")
        if str(row.get("validation_status") or "").strip() != "valid":
            problems.append("provider_not_validated")
        if not str(row.get("model_name") or "").strip():
            problems.append("model")
        if expected["requires_dimensions"] and not int(row.get("embedding_dimensions") or 0):
            problems.append("embedding_dimensions")

        item = {
            **expected,
            "status": "ok" if not problems else "incomplete",
            "providerConfigId": row.get("provider_config_id"),
            "providerName": row.get("provider_name"),
            "providerType": row.get("provider_type"),
            "providerIsActive": bool(row.get("provider_is_active")),
            "providerValidationStatus": row.get("validation_status"),
            "modelName": row.get("model_name"),
            "embeddingDimensions": row.get("embedding_dimensions"),
            "problems": problems,
        }
        items.append(item)
        if problems:
            incomplete.append(item)

    return {
        "items": items,
        "missing": missing,
        "incomplete": incomplete,
        "ready": not missing and not incomplete,
    }


def _describe_ai_binding_problems(item: dict[str, Any]) -> str:
    if item.get("status") == "missing":
        return "asignación del agente"

    problems = set(item.get("problems") or [])
    messages: list[str] = []
    if "provider" in problems:
        messages.append("provider")
    if "provider_inactive" in problems:
        messages.append("provider activo")
    if "provider_not_validated" in problems:
        messages.append("provider validado")
    if "model" in problems:
        messages.append("modelo")
    if "embedding_dimensions" in problems:
        messages.append("dimensiones de embeddings")
    if not messages:
        return "configuración completa"
    return ", ".join(messages)


async def get_system_readiness(db: Session) -> dict[str, Any]:
    checks: list[dict[str, Any]] = []

    operation_state = get_system_operation_state(db)

    try:
        db.execute(text("SELECT 1")).scalar()
        _check(
            checks,
            check_id="db.accessible",
            category="Base de datos",
            title="Base de datos accesible",
            status="ok",
            message="La conexión de aplicación con la base de datos responde.",
        )
    except Exception as exc:
        _check(
            checks,
            check_id="db.accessible",
            category="Base de datos",
            title="Base de datos accesible",
            status="failed",
            message="No fue posible ejecutar una consulta básica contra la base de datos.",
            details={"validationError": True},
        )

    missing_tables = [table for table in CRITICAL_TABLES if not _table_exists(db, table)]
    _check(
        checks,
        check_id="db.schema",
        category="Base de datos",
        title="Estructura base disponible",
        status="failed" if missing_tables else "ok",
        message="Faltan tablas críticas del sistema." if missing_tables else "Las tablas críticas esperadas están presentes.",
        details={"missingTables": len(missing_tables)},
    )

    try:
        catalog_counts = {
            "recordStatuses": _count(db, "SELECT COUNT(*) FROM record_statuses WHERE deleted_at IS NULL"),
            "roles": _count(db, "SELECT COUNT(*) FROM roles WHERE deleted_at IS NULL AND is_active = 1"),
            "permissions": _count(db, "SELECT COUNT(*) FROM permissions WHERE deleted_at IS NULL AND is_active = 1"),
            "buckets": _count(db, "SELECT COUNT(*) FROM buckets WHERE deleted_at IS NULL AND is_active = 1"),
        }
        has_catalogs = all(value > 0 for value in catalog_counts.values())
        _check(
            checks,
            check_id="db.catalogs",
            category="Base de datos",
            title="Catálogos mínimos",
            status="ok" if has_catalogs else "failed",
            message="Los catálogos base están cargados." if has_catalogs else "Faltan catálogos mínimos para operar.",
            details={
                "catalogGroups": len(catalog_counts),
                "readyCatalogGroups": sum(1 for value in catalog_counts.values() if value > 0),
            },
        )
    except Exception as exc:
        _check(checks, check_id="db.catalogs", category="Base de datos", title="Catálogos mínimos", status="failed", message="No fue posible validar catálogos mínimos.", details={"validationError": True})

    try:
        admin_count = _count(
            db,
            """
            SELECT COUNT(DISTINCT u.id)
            FROM users u
            JOIN user_roles ur ON ur.user_id = u.id AND ur.deleted_at IS NULL
            JOIN roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
            WHERE u.deleted_at IS NULL AND u.is_active = 1 AND UPPER(r.code) = 'ADMIN'
            """,
        )
        _check(
            checks,
            check_id="security.admin",
            category="Seguridad",
            title="Administrador productivo",
            status="ok" if admin_count > 0 else "failed",
            message="Existe al menos un administrador activo." if admin_count > 0 else "No existe un administrador activo para operar el sistema.",
            details={"adminCount": admin_count},
        )
    except Exception as exc:
        _check(checks, check_id="security.admin", category="Seguridad", title="Administrador productivo", status="failed", message="No fue posible validar administradores.", details={"validationError": True})

    try:
        rbac_counts = {
            "rolePermissions": _count(db, "SELECT COUNT(*) FROM role_permissions WHERE deleted_at IS NULL"),
            "adminPermissions": _count(
                db,
                """
                SELECT COUNT(*)
                FROM role_permissions rp
                JOIN roles r ON r.id = rp.role_id
                WHERE rp.deleted_at IS NULL AND r.deleted_at IS NULL AND UPPER(r.code) = 'ADMIN'
                """,
            ),
        }
        has_rbac = rbac_counts["rolePermissions"] > 0 and rbac_counts["adminPermissions"] > 0
        _check(
            checks,
            check_id="security.rbac",
            category="Seguridad",
            title="Permisos base",
            status="ok" if has_rbac else "failed",
            message="Los permisos base están asociados a roles." if has_rbac else "La matriz de permisos no tiene asociaciones suficientes para operar.",
            details=rbac_counts,
        )
    except Exception as exc:
        _check(checks, check_id="security.rbac", category="Seguridad", title="Permisos base", status="failed", message="No fue posible validar los permisos base.", details={"validationError": True})

    try:
        organization = db.execute(
            text("SELECT name, public_base_url FROM organization_settings WHERE id = 1")
        ).mappings().first()
        public_base_url = str((organization or {}).get("public_base_url") or "").strip()
        organization_name = str((organization or {}).get("name") or "").strip()
        _check(
            checks,
            check_id="organization.configured",
            category="Organización",
            title="Organización configurada",
            status="ok" if organization_name and _url_has_scheme(public_base_url) else "failed",
            message="La organización y la URL pública están configuradas." if organization_name and _url_has_scheme(public_base_url) else "Falta nombre de organización o URL pública con http/https.",
            details={"nameConfigured": bool(organization_name), "publicBaseUrlConfigured": bool(public_base_url)},
        )
    except Exception as exc:
        _check(checks, check_id="organization.configured", category="Organización", title="Organización configurada", status="failed", message="No fue posible validar la organización.", details={"validationError": True})

    try:
        smtp_active = _count(db, "SELECT COUNT(*) FROM smtp_configs WHERE deleted_at IS NULL AND is_active = 1")
        smtp_tested = _count(db, "SELECT COUNT(*) FROM smtp_configs WHERE deleted_at IS NULL AND is_active = 1 AND last_tested_at IS NOT NULL")
        _check(
            checks,
            check_id="smtp.configured",
            category="Correo",
            title="SMTP configurado",
            status="ok" if smtp_active > 0 else "failed",
            message="Existe una configuración SMTP activa." if smtp_active > 0 else "No hay configuración SMTP activa.",
            details={"activeConfigs": smtp_active},
        )
        _check(
            checks,
            check_id="smtp.tested",
            category="Correo",
            title="Prueba SMTP registrada",
            status="ok" if smtp_tested > 0 else "warning",
            blocking=False,
            message="La configuración SMTP activa tiene una prueba registrada." if smtp_tested > 0 else "Ejecuta una prueba de envío SMTP desde Integraciones antes de abrir operación.",
            details={"testedActiveConfigs": smtp_tested},
        )
    except Exception as exc:
        _check(checks, check_id="smtp.configured", category="Correo", title="SMTP configurado", status="failed", message="No fue posible validar SMTP.", details={"validationError": True})

    ai_total = 0
    ai_active = 0
    ai_valid = 0
    try:
        ai_total = _count(db, "SELECT COUNT(*) FROM ai_provider_configs WHERE deleted_at IS NULL")
        ai_active = _count(db, "SELECT COUNT(*) FROM ai_provider_configs WHERE deleted_at IS NULL AND is_active = 1")
        ai_valid = _count(db, "SELECT COUNT(*) FROM ai_provider_configs WHERE deleted_at IS NULL AND is_active = 1 AND validation_status = 'valid'")
        _check(
            checks,
            check_id="ai.providers.active",
            category="IA",
            title="Provider AI activo",
            status="ok" if ai_active > 0 else "failed",
            message=(
                "Existe al menos un provider AI activo para asignar a agentes."
                if ai_active > 0
                else "Activa al menos un provider AI antes de configurar Uso AI."
            ),
            details={
                "totalProviders": ai_total,
                "activeProviders": ai_active,
                "validatedActiveProviders": ai_valid,
            },
        )
    except Exception as exc:
        _check(
            checks,
            check_id="ai.providers.active",
            category="IA",
            title="Provider AI activo",
            status="failed",
            message="No fue posible validar si existe un provider AI activo.",
            details={"validationError": True},
        )

    try:
        binding_readiness = _ai_binding_readiness(db)
        by_purpose = {item["purpose"]: item for item in binding_readiness["items"]}
        for expected in REQUIRED_AI_BINDINGS:
            item = by_purpose.get(expected["purpose"], {**expected, "status": "missing"})
            is_ready = item.get("status") == "ok"
            problem_text = _describe_ai_binding_problems(item)
            _check(
                checks,
                check_id=f"ai.binding.{expected['purpose']}",
                category="IA",
                title=f"Uso AI: {expected['label']}",
                status="ok" if is_ready else "failed",
                message=(
                    f"{expected['label']} tiene provider activo, validado y modelo configurado."
                    if is_ready
                    else f"Configura Uso AI para {expected['label']}. Pendiente: {problem_text}."
                ),
                details={
                    "totalProviders": ai_total,
                    "activeProviders": ai_active,
                    "validatedActiveProviders": ai_valid,
                    "binding": item,
                },
            )
    except Exception as exc:
        for expected in REQUIRED_AI_BINDINGS:
            _check(
                checks,
                check_id=f"ai.binding.{expected['purpose']}",
                category="IA",
                title=f"Uso AI: {expected['label']}",
                status="failed",
                message="No fue posible validar esta asignación AI.",
                details={"validationError": True, "purpose": expected["purpose"]},
            )

    prompt_dir = Path(settings.prompt_path_base)
    prompt_file = prompt_dir / settings.openai_system_prompt
    _check(
        checks,
        check_id="ai.prompts",
        category="IA",
        title="Prompts disponibles",
        status="ok" if prompt_dir.is_dir() and prompt_file.is_file() else "failed",
        message="El prompt principal está disponible." if prompt_dir.is_dir() and prompt_file.is_file() else "No se encuentra el prompt principal configurado.",
        details={"promptConfigured": prompt_file.is_file(), "promptDirectoryAvailable": prompt_dir.is_dir()},
    )

    gotenberg_ok, gotenberg_message = _http_check("http://gotenberg:3000/health")
    _check(
        checks,
        check_id="pdf.gotenberg",
        category="PDF",
        title="PDF operativo",
        status="ok" if gotenberg_ok else "failed",
        message="El servicio de generación de documentos responde correctamente." if gotenberg_ok else "No fue posible validar el servicio de generación de documentos.",
        details={"reachable": gotenberg_ok},
    )

    try:
        minio_client = ensure_minio_buckets()
        missing_buckets = [bucket for bucket in REQUIRED_MINIO_BUCKETS if not minio_client.bucket_exists(bucket)]
        minio_status = "failed" if missing_buckets else "ok"
        _check(
            checks,
            check_id="storage.minio",
            category="Almacenamiento",
            title="Almacenamiento operativo",
            status=minio_status,
            message="El almacenamiento de objetos responde y los espacios requeridos están disponibles." if minio_status == "ok" else "No fue posible preparar todos los espacios de almacenamiento requeridos.",
            details={"missingStorageAreas": len(missing_buckets)},
        )
    except Exception as exc:
        _check(checks, check_id="storage.minio", category="Almacenamiento", title="Almacenamiento operativo", status="failed", message="No fue posible validar el almacenamiento de objetos.", details={"validationError": True})

    try:
        redis = get_redis()
        await redis.ping()
        queue_sizes = {queue: int(await redis.llen(queue)) for queue in QUEUE_NAMES}
        dlq_size = queue_sizes.get("queue:dlq", 0)
        _check(
            checks,
            check_id="redis.connection",
            category="Procesos",
            title="Mensajería operativa",
            status="ok",
            message="El servicio de mensajería operativa responde correctamente.",
        )
        _check(
            checks,
            check_id="queues.health",
            category="Procesos",
            title="Trabajos en segundo plano",
            status="warning" if dlq_size > 0 else "ok",
            blocking=False,
            message="Hay trabajos con error que conviene revisar." if dlq_size > 0 else "Los trabajos críticos en segundo plano no presentan acumulación de errores.",
            details={"failedJobs": dlq_size},
        )
    except Exception as exc:
        _check(checks, check_id="redis.connection", category="Procesos", title="Mensajería operativa", status="failed", message="El servicio de mensajería operativa no respondió.", details={"validationError": True})

    try:
        backup_settings = db.execute(text("SELECT policies_json FROM system_backup_settings WHERE id = 1")).scalar()
        backup_policies = {}
        backup_policies = json.loads(backup_settings or "{}")
    except Exception:
        backup_policies = {}
    enabled_backup_scopes = [
        scope for scope, policy in backup_policies.items()
        if isinstance(policy, dict) and bool(policy.get("enabled"))
    ]
    _check(
        checks,
        check_id="backups.configured",
        category="Respaldos",
        title="Backups configurados",
        status="ok" if enabled_backup_scopes else "failed",
        message="Existe al menos una política de respaldo activa." if enabled_backup_scopes else "No hay políticas de respaldo activas.",
        details={"enabledScopes": enabled_backup_scopes},
    )
    commissioning_started_at = _last_commissioning_started_at(db, operation_state)
    if commissioning_started_at is not None:
        manual_backup_count = _count(
            db,
            """
            SELECT COUNT(*)
            FROM system_backup_artifacts
            WHERE deleted_at IS NULL
              AND status = 'available'
              AND origin_type = 'manual'
              AND created_at >= :commissioning_started_at
            """,
            {"commissioning_started_at": commissioning_started_at},
        )
    else:
        manual_backup_count = _count(
            db,
            """
            SELECT COUNT(*)
            FROM system_backup_artifacts
            WHERE deleted_at IS NULL
              AND status = 'available'
              AND origin_type = 'manual'
            """,
        )
    _check(
        checks,
        check_id="backups.dry_run",
        category="Respaldos",
        title="Prueba de backup",
        status="ok" if manual_backup_count > 0 else "warning",
        blocking=False,
        message=(
            "Existe al menos un respaldo manual disponible desde la última entrada a puesta en marcha."
            if manual_backup_count > 0
            else (
                "Ejecuta un backup manual de prueba posterior a la última entrada a puesta en marcha y valida su resultado antes de salir."
                if commissioning_started_at is not None
                else "Ejecuta un backup manual de prueba y valida su resultado antes de salir de puesta en marcha."
            )
        ),
        details={
            "manualAvailableBackups": manual_backup_count,
            "requiredSince": str(commissioning_started_at) if commissioning_started_at is not None else None,
        },
    )
    completed_restore_count = _count(
        db,
        """
        SELECT COUNT(*)
        FROM system_backup_operations
        WHERE operation_type = 'restore_backup'
          AND status IN ('success', 'completed')
        """,
    )
    _check(
        checks,
        check_id="restore.sanity",
        category="Respaldos",
        title="Validación de restauración",
        status="warning" if completed_restore_count > 0 else "ok",
        blocking=False,
        message=(
            "Se detectó al menos un restore completado. Valida un recorrido funcional mínimo antes de normalizar."
            if completed_restore_count > 0
            else "No se detectan restores completados que requieran validación funcional adicional."
        ),
        details={"completedRestores": completed_restore_count},
    )

    missing_templates = [
        definition.filename
        for definition in TEMPLATE_DEFINITIONS.values()
        if not (EMAIL_TEMPLATES_DIR / definition.filename).is_file()
    ]
    _check(
        checks,
        check_id="email.templates",
        category="Correo",
        title="Plantillas de correo",
        status="ok" if not missing_templates else "failed",
        message="Las plantillas de correo requeridas están disponibles." if not missing_templates else "Faltan plantillas de correo requeridas.",
        details={"missingTemplates": len(missing_templates)},
    )

    _check(
        checks,
        check_id="sse.notifications",
        category="Operación",
        title="Actualizaciones en vivo",
        status="ok",
        message="El canal administrativo de actualización en vivo está disponible.",
    )
    _check(
        checks,
        check_id="operation.modes",
        category="Operación",
        title="Modos operativos",
        status="ok",
        message="Están disponibles los modos normal, solo lectura, mantenimiento y puesta en marcha.",
        details={"currentMode": operation_state.get("mode")},
    )
    _check(
        checks,
        check_id="security.headers",
        category="Infraestructura",
        title="Headers de seguridad",
        status="ok",
        message="La aplicación define headers de seguridad base en cada respuesta.",
    )
    _check(
        checks,
        check_id="infra.manual",
        category="Infraestructura",
        title="Validaciones de despliegue",
        status="manual",
        blocking=False,
        message="Revisión operacional manual: confirma que la publicación, los accesos auxiliares, los permisos de ejecución y la entrega del sitio estén alineados con el entorno objetivo.",
    )

    secret_file_status = {
        "baseDatos": _secret_file_check(settings.mariadb_password_file),
        "almacenamiento": _secret_file_check(settings.minio_root_password_file),
        "sesiones": _secret_file_check(settings.jwt_secret_file),
        "integracionInterna": _secret_file_check(settings.internal_api_secret_file),
    }
    weak_secret_labels = [
        label
        for label, value in (
            ("baseDatos", settings.mariadb_password),
            ("almacenamiento", settings.minio_root_password),
            ("sesiones", settings.jwt_secret),
            ("integracionInterna", settings.internal_api_secret),
        )
        if not _is_strong_secret(value)
    ]
    missing_secret_files = [
        label
        for label, status in secret_file_status.items()
        if not status["configured"] or not status["exists"]
    ]
    secrets_ready = not weak_secret_labels and not missing_secret_files
    _check(
        checks,
        check_id="secrets.normalized",
        category="Seguridad",
        title="Secretos normalizados",
        status="ok" if secrets_ready else "warning",
        blocking=False,
        message=(
            "Los secretos críticos están normalizados y no presentan valores débiles conocidos."
            if secrets_ready
            else "Hay secretos críticos pendientes de normalización o con valores débiles/conocidos."
        ),
        details={
            "secretFiles": secret_file_status,
            "missingSecretFiles": missing_secret_files,
            "weakSecrets": weak_secret_labels,
        },
    )
    _check(
        checks,
        check_id="audit.logs",
        category="Auditoría",
        title="Auditoría y logs",
        status="ok",
        message="Las acciones sensibles de este módulo registran auditoría y eventos operativos.",
    )
    _check(
        checks,
        check_id="timezone.utc",
        category="Auditoría",
        title="Zona horaria y UTC",
        status="ok",
        message="La aplicación persiste timestamps operativos en UTC y presenta hora local en UI.",
    )
    _check(
        checks,
        check_id="healthchecks",
        category="Infraestructura",
        title="Healthchecks",
        status="ok",
        message="La verificación básica de salud está disponible para monitoreo operativo.",
    )
    _check(
        checks,
        check_id="scheduler.worker",
        category="Procesos",
        title="Procesos operativos",
        status="manual",
        blocking=False,
        message="Revisión operacional manual: confirma que los procesos programados, las tareas en segundo plano y la generación de documentos estén operativos.",
    )

    summary = {
        "ok": sum(1 for item in checks if item["status"] == "ok"),
        "info": sum(1 for item in checks if item["status"] == "info"),
        "manual": sum(1 for item in checks if item["status"] == "manual"),
        "warning": sum(1 for item in checks if item["status"] == "warning"),
        "failed": sum(1 for item in checks if item["status"] == "failed"),
        "blockingFailed": sum(1 for item in checks if item["status"] == "failed" and item["blocking"]),
        "total": len(checks),
    }

    return {
        "generatedAt": _utc_iso(),
        "operationState": operation_state,
        "summary": summary,
        "canActivateProduction": summary["blockingFailed"] == 0,
        "checks": checks,
    }
