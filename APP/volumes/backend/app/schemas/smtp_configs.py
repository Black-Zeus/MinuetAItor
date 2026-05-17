from __future__ import annotations

from pydantic import BaseModel, Field, field_validator, model_validator


def _strip_or_none(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class SmtpConfigFilterRequest(BaseModel):
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)
    is_active: bool | None = None
    search: str | None = None

    @field_validator("search")
    @classmethod
    def normalize_search(cls, v: str | None) -> str | None:
        return _strip_or_none(v)

    model_config = {"populate_by_name": True}


class SmtpConfigBasePayload(BaseModel):
    name: str
    host: str
    port: int = Field(587, ge=1, le=65535)
    username: str | None = None
    password: str | None = None
    from_name: str = Field(..., serialization_alias="fromName")
    from_email: str = Field(..., serialization_alias="fromEmail")
    use_tls: bool = Field(False, serialization_alias="useTls")
    use_ssl: bool = Field(False, serialization_alias="useSsl")
    timeout_seconds: int = Field(10, ge=1, le=120, serialization_alias="timeoutSeconds")
    is_active: bool = Field(False, serialization_alias="isActive")
    test_token: str = Field(..., serialization_alias="testToken")

    @field_validator("name", "host", "from_name", "from_email")
    @classmethod
    def require_text(cls, v: str) -> str:
        cleaned = str(v or "").strip()
        if not cleaned:
            raise ValueError("Este campo es obligatorio")
        return cleaned

    @field_validator("username", "password")
    @classmethod
    def normalize_optional_text(cls, v: str | None) -> str | None:
        return _strip_or_none(v)

    @field_validator("test_token")
    @classmethod
    def normalize_test_token(cls, v: str) -> str:
        cleaned = str(v or "").strip()
        if not cleaned:
            raise ValueError("Debes ejecutar una prueba válida antes de guardar")
        return cleaned

    @model_validator(mode="after")
    def validate_security_mode(self):
        if self.use_tls and self.use_ssl:
            raise ValueError("No puedes habilitar TLS y SSL al mismo tiempo")
        return self

    model_config = {"populate_by_name": True}


class SmtpConfigCreateRequest(SmtpConfigBasePayload):
    pass


class SmtpConfigUpdateRequest(BaseModel):
    name: str | None = None
    host: str | None = None
    port: int | None = Field(None, ge=1, le=65535)
    username: str | None = None
    password: str | None = None
    from_name: str | None = Field(None, serialization_alias="fromName")
    from_email: str | None = Field(None, serialization_alias="fromEmail")
    use_tls: bool | None = Field(None, serialization_alias="useTls")
    use_ssl: bool | None = Field(None, serialization_alias="useSsl")
    timeout_seconds: int | None = Field(None, ge=1, le=120, serialization_alias="timeoutSeconds")
    is_active: bool | None = Field(None, serialization_alias="isActive")
    test_token: str = Field(..., serialization_alias="testToken")

    @field_validator("name", "host", "from_name", "from_email")
    @classmethod
    def normalize_required_when_present(cls, v: str | None) -> str | None:
        if v is None:
            return None
        cleaned = str(v).strip()
        if not cleaned:
            raise ValueError("Este campo no puede estar vacío")
        return cleaned

    @field_validator("username", "password")
    @classmethod
    def normalize_optional_update_text(cls, v: str | None) -> str | None:
        return _strip_or_none(v)

    @field_validator("test_token")
    @classmethod
    def normalize_update_test_token(cls, v: str) -> str:
        cleaned = str(v or "").strip()
        if not cleaned:
            raise ValueError("Debes ejecutar una prueba válida antes de guardar")
        return cleaned

    @model_validator(mode="after")
    def validate_update_security_mode(self):
        if self.use_tls is True and self.use_ssl is True:
            raise ValueError("No puedes habilitar TLS y SSL al mismo tiempo")
        return self

    model_config = {"populate_by_name": True}


class SmtpConfigTestRequest(BaseModel):
    config_id: str | None = Field(None, serialization_alias="configId")
    name: str | None = None
    host: str | None = None
    port: int | None = Field(587, ge=1, le=65535)
    username: str | None = None
    password: str | None = None
    from_name: str | None = Field(None, serialization_alias="fromName")
    from_email: str | None = Field(None, serialization_alias="fromEmail")
    use_tls: bool | None = Field(False, serialization_alias="useTls")
    use_ssl: bool | None = Field(False, serialization_alias="useSsl")
    timeout_seconds: int | None = Field(10, ge=1, le=120, serialization_alias="timeoutSeconds")
    test_email: str = Field(..., serialization_alias="testEmail")

    @field_validator("config_id", "name", "host", "username", "password", "from_name", "from_email")
    @classmethod
    def normalize_optional_strings(cls, v: str | None) -> str | None:
        return _strip_or_none(v)

    @field_validator("test_email")
    @classmethod
    def require_test_email(cls, v: str) -> str:
        cleaned = str(v or "").strip()
        if not cleaned:
            raise ValueError("El correo de prueba es obligatorio")
        return cleaned

    @model_validator(mode="after")
    def validate_test_security_mode(self):
        if self.use_tls is True and self.use_ssl is True:
            raise ValueError("No puedes habilitar TLS y SSL al mismo tiempo")
        return self

    model_config = {"populate_by_name": True}


class SmtpConfigActivateRequest(BaseModel):
    is_active: bool = Field(True, serialization_alias="isActive")

    model_config = {"populate_by_name": True}


class SmtpConfigResponse(BaseModel):
    id: str
    name: str
    host: str
    port: int
    username: str | None = None
    has_password: bool = Field(..., serialization_alias="hasPassword")
    from_name: str = Field(..., serialization_alias="fromName")
    from_email: str = Field(..., serialization_alias="fromEmail")
    use_tls: bool = Field(..., serialization_alias="useTls")
    use_ssl: bool = Field(..., serialization_alias="useSsl")
    timeout_seconds: int = Field(..., serialization_alias="timeoutSeconds")
    is_active: bool = Field(..., serialization_alias="isActive")
    created_at: str | None = Field(None, serialization_alias="createdAt")
    updated_at: str | None = Field(None, serialization_alias="updatedAt")
    last_tested_at: str | None = Field(None, serialization_alias="lastTestedAt")
    created_by: UserRefResponse | None = Field(None, serialization_alias="createdBy")
    updated_by: UserRefResponse | None = Field(None, serialization_alias="updatedBy")
    last_tested_by: UserRefResponse | None = Field(None, serialization_alias="lastTestedBy")

    model_config = {"populate_by_name": True}


class SmtpConfigListResponse(BaseModel):
    items: list[SmtpConfigResponse]
    total: int
    skip: int
    limit: int

    model_config = {"populate_by_name": True}


class SmtpConfigTestResponse(BaseModel):
    ok: bool = True
    message: str
    test_token: str = Field(..., serialization_alias="testToken")
    expires_at: str = Field(..., serialization_alias="expiresAt")

    model_config = {"populate_by_name": True}
