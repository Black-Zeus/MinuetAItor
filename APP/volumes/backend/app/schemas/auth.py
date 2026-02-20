# schemas/auth.py
from pydantic import BaseModel, field_validator


class LoginRequest(BaseModel):
    credential: str
    password: str

    @field_validator("credential")
    @classmethod
    def credential_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("El campo no puede estar vacío")
        return v.strip().lower()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserSession(BaseModel):
    user_id:     str
    username:    str
    full_name:   str | None
    roles:       list[str]
    permissions: list[str]
    jti:         str


class UserProfileData(BaseModel):
    initials:   str | None = None
    color:      str | None = None
    position:   str | None = None
    department: str | None = None


class ConnectionInfo(BaseModel):
    ts:       str
    device:   str | None = None
    location: str | None = None
    ip_v4:    str | None = None
    ip_v6:    str | None = None


class MeResponse(BaseModel):
    user_id:           str
    username:          str
    full_name:         str | None
    description:       str | None
    job_title:         str | None
    phone:         str | None
    area:         str | None
    email:             str | None
    roles:             list[str]
    permissions:       list[str]
    is_active:         bool
    last_login_at:     str | None
    profile:           UserProfileData | None
    active_connection: ConnectionInfo | None = None
    last_connections:  list[ConnectionInfo] = []
    

class RefreshRequest(BaseModel):
    pass  # el token viene del header Bearer

class ValidateTokenResponse(BaseModel):
    valid: bool
    user_id: str | None = None
    expires_in: int | None = None  # segundos restantes

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password:     str
    revoke_sessions:  bool = False

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        return v

class ChangePasswordByAdminRequest(BaseModel):
    user_id:      str
    new_password: str
    reason:       str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        return v

    @field_validator("reason")
    @classmethod
    def reason_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("El motivo es requerido")
        return v.strip()

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token:        str
    new_password: str