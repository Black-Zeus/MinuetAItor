# _data/seed_admin.py
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Asegurar que el root del proyecto esté en el path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from db.session import SessionLocal
from db.base import Base
from core.security import hash_password
from models.user import User, UserRole, UserProfile, Role

# ── Configuración del admin a crear ──────────────────
ADMIN_USERNAME = "admin"
ADMIN_EMAIL    = "admin@minuetaitor.local"
ADMIN_PASSWORD = "Admin1234!"
ADMIN_FULLNAME = "Administrador del Sistema"


def seed_admin() -> None:
    db = SessionLocal()

    try:
        # Verificar que no exista ya
        existing = db.query(User).filter(User.username == ADMIN_USERNAME).first()
        if existing:
            print(f"⚠️  El usuario '{ADMIN_USERNAME}' ya existe — abortando.")
            return

        # Verificar que el rol ADMIN exista
        role = db.query(Role).filter(Role.code == "ADMIN").first()
        if not role:
            print("❌  Rol ADMIN no encontrado — ejecuta primero los seeds SQL.")
            return

        now     = datetime.now(timezone.utc)
        user_id = str(uuid.uuid4())

        # Crear usuario
        user = User(
            id            = user_id,
            username      = ADMIN_USERNAME,
            email         = ADMIN_EMAIL,
            password_hash = hash_password(ADMIN_PASSWORD),
            full_name     = ADMIN_FULLNAME,
            is_active     = True,
            created_at    = now,
            created_by    = None,  # bootstrap: no hay actor previo
        )
        db.add(user)
        db.flush()  # obtener id antes de las relaciones

        # Asignar rol ADMIN
        user_role = UserRole(
            user_id    = user_id,
            role_id    = role.id,
            created_at = now,
            created_by = user_id,  # se auto-asigna
        )
        db.add(user_role)

        # Crear perfil base
        profile = UserProfile(
            user_id  = user_id,
            initials = "AD",
            color    = "#6366f1",
            position = "Administrador",
        )
        db.add(profile)

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