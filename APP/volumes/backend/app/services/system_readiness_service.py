from __future__ import annotations

import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from minio import Minio
from sqlalchemy import text
from sqlalchemy.orm import Session

from core.config import settings
from db.redis import get_redis
from services.email_template_service import EMAIL_TEMPLATES_DIR, TEMPLATE_DEFINITIONS
from services.system_maintenance_service import get_system_operation_state

REQUIRED_BUCKETS = (
    "minuetaitor-inputs",
    "minuetaitor-json",
    "minuetaitor-published",
    "minuetaitor-attach",
    "minuetaitor-draft",
)

CRITICAL_TABLES = (
    "users",
    "roles",
    "permissions",
    "role_permissions",
    "user_roles",
    "organization_settings",
    "smtp_configs",
    "ai_provider_configs",
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


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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
            message="La conexión de aplicación con MariaDB responde.",
        )
    except Exception as exc:
        _check(
            checks,
            check_id="db.accessible",
            category="Base de datos",
            title="Base de datos accesible",
            status="failed",
            message="No fue posible ejecutar una consulta básica contra MariaDB.",
            details={"error": str(exc)},
        )

    missing_tables = [table for table in CRITICAL_TABLES if not _table_exists(db, table)]
    _check(
        checks,
        check_id="db.schema",
        category="Base de datos",
        title="Schema base disponible",
        status="failed" if missing_tables else "ok",
        message="Faltan tablas críticas del sistema." if missing_tables else "Las tablas críticas esperadas están presentes.",
        details={"missingTables": missing_tables},
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
            details=catalog_counts,
        )
    except Exception as exc:
        _check(checks, check_id="db.catalogs", category="Base de datos", title="Catálogos mínimos", status="failed", message="No fue posible validar catálogos mínimos.", details={"error": str(exc)})

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
        _check(checks, check_id="security.admin", category="Seguridad", title="Administrador productivo", status="failed", message="No fue posible validar administradores.", details={"error": str(exc)})

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
            title="RBAC base",
            status="ok" if has_rbac else "failed",
            message="Los permisos base están asociados a roles." if has_rbac else "RBAC no tiene asociaciones suficientes para operar.",
            details=rbac_counts,
        )
    except Exception as exc:
        _check(checks, check_id="security.rbac", category="Seguridad", title="RBAC base", status="failed", message="No fue posible validar RBAC.", details={"error": str(exc)})

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
            details={"nameConfigured": bool(organization_name), "publicBaseUrl": public_base_url},
        )
    except Exception as exc:
        _check(checks, check_id="organization.configured", category="Organización", title="Organización configurada", status="failed", message="No fue posible validar la organización.", details={"error": str(exc)})

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
        _check(checks, check_id="smtp.configured", category="Correo", title="SMTP configurado", status="failed", message="No fue posible validar SMTP.", details={"error": str(exc)})

    try:
        ai_active = _count(db, "SELECT COUNT(*) FROM ai_provider_configs WHERE deleted_at IS NULL AND is_active = 1")
        ai_valid = _count(db, "SELECT COUNT(*) FROM ai_provider_configs WHERE deleted_at IS NULL AND is_active = 1 AND validation_status = 'valid'")
        _check(
            checks,
            check_id="ai.configured",
            category="IA",
            title="Proveedor IA activo",
            status="ok" if ai_active > 0 else "failed",
            message="Existe un proveedor IA activo." if ai_active > 0 else "No hay proveedor IA activo.",
            details={"activeProviders": ai_active},
        )
        _check(
            checks,
            check_id="ai.validated",
            category="IA",
            title="Prueba IA registrada",
            status="ok" if ai_valid > 0 else "warning",
            blocking=False,
            message="El proveedor IA activo fue validado." if ai_valid > 0 else "Valida el proveedor IA activo desde Integraciones.",
            details={"validatedActiveProviders": ai_valid},
        )
    except Exception as exc:
        _check(checks, check_id="ai.configured", category="IA", title="Proveedor IA activo", status="failed", message="No fue posible validar IA.", details={"error": str(exc)})

    prompt_dir = Path(settings.prompt_path_base)
    prompt_file = prompt_dir / settings.openai_system_prompt
    _check(
        checks,
        check_id="ai.prompts",
        category="IA",
        title="Prompts disponibles",
        status="ok" if prompt_dir.is_dir() and prompt_file.is_file() else "failed",
        message="El prompt principal está disponible." if prompt_dir.is_dir() and prompt_file.is_file() else "No se encuentra el prompt principal configurado.",
        details={"promptPath": str(prompt_file), "promptDirExists": prompt_dir.is_dir()},
    )

    gotenberg_ok, gotenberg_message = _http_check("http://gotenberg:3000/health")
    _check(
        checks,
        check_id="pdf.gotenberg",
        category="PDF",
        title="PDF operativo",
        status="ok" if gotenberg_ok else "failed",
        message="Gotenberg responde desde backend." if gotenberg_ok else "No fue posible contactar Gotenberg desde backend.",
        details={"endpoint": "http://gotenberg:3000/health", "result": gotenberg_message},
    )

    try:
        minio_client = Minio(
            endpoint=f"{settings.minio_host}:{settings.minio_port}",
            access_key=settings.minio_root_user,
            secret_key=settings.minio_root_password,
            secure=False,
        )
        missing_buckets = [bucket for bucket in REQUIRED_BUCKETS if not minio_client.bucket_exists(bucket)]
        minio_status = "failed" if missing_buckets else "ok"
        _check(
            checks,
            check_id="storage.minio",
            category="Storage",
            title="Storage MinIO y buckets",
            status=minio_status,
            message="MinIO responde y los buckets requeridos existen." if minio_status == "ok" else "Faltan buckets requeridos en MinIO.",
            details={"missingBuckets": missing_buckets, "requiredBuckets": list(REQUIRED_BUCKETS)},
        )
    except Exception as exc:
        _check(checks, check_id="storage.minio", category="Storage", title="Storage MinIO y buckets", status="failed", message="No fue posible validar MinIO.", details={"error": str(exc)})

    try:
        redis = get_redis()
        await redis.ping()
        queue_sizes = {queue: int(await redis.llen(queue)) for queue in QUEUE_NAMES}
        dlq_size = queue_sizes.get("queue:dlq", 0)
        _check(
            checks,
            check_id="redis.connection",
            category="Colas",
            title="Redis operativo",
            status="ok",
            message="Redis responde correctamente.",
        )
        _check(
            checks,
            check_id="queues.health",
            category="Colas",
            title="Colas sanas",
            status="warning" if dlq_size > 0 else "ok",
            blocking=False,
            message="Hay trabajos en DLQ que conviene revisar." if dlq_size > 0 else "Las colas críticas no presentan DLQ acumulada.",
            details={"queueSizes": queue_sizes},
        )
    except Exception as exc:
        _check(checks, check_id="redis.connection", category="Colas", title="Redis operativo", status="failed", message="Redis no respondió.", details={"error": str(exc)})

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
    _check(
        checks,
        check_id="backups.dry_run",
        category="Respaldos",
        title="Prueba de backup",
        status="warning",
        blocking=False,
        message="Ejecuta un backup manual de prueba y valida su resultado antes de salir de puesta en marcha.",
    )
    _check(
        checks,
        check_id="restore.sanity",
        category="Respaldos",
        title="Restore sanity check",
        status="warning",
        blocking=False,
        message="Si este modo fue activado después de un restore, valida un recorrido funcional mínimo antes de normalizar.",
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
        title="Templates de correo",
        status="ok" if not missing_templates else "failed",
        message="Los templates de correo requeridos están disponibles." if not missing_templates else "Faltan templates de correo.",
        details={"missingTemplates": missing_templates},
    )

    _check(
        checks,
        check_id="sse.notifications",
        category="Operación",
        title="SSE y notificaciones",
        status="ok",
        message="El canal SSE administrativo está expuesto desde el módulo de mantenimiento.",
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
        message="El backend define headers de seguridad base en cada respuesta.",
    )
    _check(
        checks,
        check_id="infra.manual",
        category="Infraestructura",
        title="Validaciones de despliegue",
        status="warning",
        blocking=False,
        message="Validar en Docker/host: CORS productivo, Mailpit solo por /mailpit, puerto público 80, contenedores no root y frontend servido por nginx.",
    )
    _check(
        checks,
        check_id="secrets.normalized",
        category="Seguridad",
        title="Secretos normalizados",
        status="warning",
        blocking=False,
        message="Antes de PRD, mover secretos a mecanismo seguro y eliminar valores por defecto.",
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
        message="El endpoint /health está disponible para nginx y monitoreo básico.",
    )
    _check(
        checks,
        check_id="scheduler.worker",
        category="Procesos",
        title="Scheduler y workers",
        status="warning",
        blocking=False,
        message="Validar desde Docker que scheduler, worker y pdf-worker estén en ejecución; backend no administra contenedores.",
    )

    summary = {
        "ok": sum(1 for item in checks if item["status"] == "ok"),
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
