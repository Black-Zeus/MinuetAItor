# _data/seed_admin.py
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Asegurar que el root del proyecto esté en el path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from db.session import SessionLocal
from core.security import hash_password
from models.user import User, UserRole, UserProfile, Role

# ── Configuración del admin a crear ──────────────────
ADMIN_USERNAME = "admin"
ADMIN_EMAIL    = "admin@minuetaitor.local"
ADMIN_PASSWORD = "Admin1234!"
ADMIN_FULLNAME = "Administrador del Sistema"
ADMIN_JOBTITLE = "Administrador Inicial (Bootstrap)"
ADMIN_DESCRIPTION = (
    "Administrador inicial del sistema (bootstrap). "
    "Cuenta creada para la configuración y validación inicial del entorno. "
    "Uso restringido a tareas de administración; rotar credenciales tras el primer inicio de sesión."
)
ADMIN_PHONE = "+56 9 1234 5678"
ADMIN_AREA  = "IT"


def _confirm(prompt: str) -> bool:
    """
    Confirmación simple por consola.
    Acepta: s/si/sí/y/yes (case-insensitive).
    """
    try:
        ans = input(f"{prompt} [s/N]: ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        print("\n⚠️  Entrada cancelada. Abortando.")
        return False
    return ans in {"s", "si", "sí", "y", "yes"}


def seed_admin() -> None:
    db = SessionLocal()

    try:
        now = datetime.now(timezone.utc)

        # Verificar que el rol ADMIN exista
        role_admin = db.query(Role).filter(Role.code == "ADMIN").first()
        if not role_admin:
            print("❌  Rol ADMIN no encontrado — ejecuta primero los seeds SQL.")
            return

        # Verificar si ya existe el usuario
        existing = db.query(User).filter(User.username == ADMIN_USERNAME).first()
        if existing:
            print(f"⚠️  El usuario '{ADMIN_USERNAME}' ya existe (ID: {existing.id}).")

            if _confirm("¿Deseas resetear la contraseña a los valores por defecto (solo DEV)?"):
                existing.password_hash = hash_password(ADMIN_PASSWORD)
                # Opcional: si manejas auditoría
                existing.updated_at = now if hasattr(existing, "updated_at") else getattr(existing, "updated_at", None)
                existing.updated_by = existing.id if hasattr(existing, "updated_by") else getattr(existing, "updated_by", None)

                if getattr(existing, "description", None) in (None, ""):
                    existing.description = ADMIN_DESCRIPTION
                
                if getattr(existing, "job_title", None) in (None, ""):
                    existing.job_title = ADMIN_JOBTITLE
                
                if getattr(existing, "phone", None) in (None, ""):
                    existing.phone = ADMIN_PHONE
                
                if getattr(existing, "area", None) in (None, ""):
                    existing.area = ADMIN_AREA

                # (Opcional) Asegurar que tenga rol ADMIN
                has_admin = (
                    db.query(UserRole)
                    .filter(UserRole.user_id == existing.id, UserRole.role_id == role_admin.id)
                    .first()
                )
                if not has_admin:
                    db.add(UserRole(
                        user_id=existing.id,
                        role_id=role_admin.id,
                        created_at=now,
                        created_by=existing.id,
                    ))

                db.commit()
                print("✅  Contraseña reseteada correctamente.")
                print(f"    Username: {ADMIN_USERNAME}")
                print(f"    Password: {ADMIN_PASSWORD}")
            else:
                print("ℹ️  No se realizaron cambios.")
            return

        # ── Crear usuario ─────────────────────────────────────────────
        user_id = str(uuid.uuid4())

        user = User(
            id            = user_id,
            username      = ADMIN_USERNAME,
            email         = ADMIN_EMAIL,
            password_hash = hash_password(ADMIN_PASSWORD),
            job_title      = ADMIN_JOBTITLE,
            full_name     = ADMIN_FULLNAME,
            description   = ADMIN_DESCRIPTION,
            phone         = ADMIN_PHONE,
            area          = ADMIN_AREA,
            is_active     = True,
            created_at    = now,
            created_by    = None,  # bootstrap: no hay actor previo
        )
        db.add(user)
        db.flush()

        # Asignar rol ADMIN
        db.add(UserRole(
            user_id    = user_id,
            role_id    = role_admin.id,
            created_at = now,
            created_by = user_id,  # se auto-asigna
        ))

        # Crear perfil base (si aplica)
        db.add(UserProfile(
            user_id  = user_id,
            initials = "AD",
            color    = "#6366f1",
            position = "Administrador",
        ))

        db.commit()

        print("✅  Usuario ADMIN creado exitosamente")
        print(f"    ID:       {user_id}")
        print(f"    Username: {ADMIN_USERNAME}")
        print(f"    Email:    {ADMIN_EMAIL}")
        print(f"    Password: {ADMIN_PASSWORD}")
        print()
        print("⚠️  Cambia la contraseña después del primer login.")

    except Exception as e:
        db.rollback()
        print(f"❌  Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_admin()
