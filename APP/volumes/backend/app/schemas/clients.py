# schemas/clients.py
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Referencia de usuario (sin cambios) ───────────────────────────────────────

class UserRefResponse(BaseModel):
    id: str
    username: Optional[str] = None
    full_name: Optional[str] = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


# ── Requests ──────────────────────────────────────────────────────────────────

class ClientCreateRequest(BaseModel):
    # Empresa
    name:        str            = Field(..., min_length=1, max_length=200)
    legal_name:  Optional[str]  = Field(None, max_length=200)
    description: Optional[str]  = Field(None, max_length=600)
    industry:    Optional[str]  = Field(None, max_length=120)
    email:       Optional[str]  = Field(None, max_length=254)
    phone:       Optional[str]  = Field(None, max_length=30)
    website:     Optional[str]  = Field(None, max_length=500)
    address:     Optional[str]  = Field(None, max_length=400)

    # Contacto
    contact_name:       Optional[str] = Field(None, max_length=200)
    contact_email:      Optional[str] = Field(None, max_length=254)
    contact_phone:      Optional[str] = Field(None, max_length=30)
    contact_position:   Optional[str] = Field(None, max_length=120)
    contact_department: Optional[str] = Field(None, max_length=120)

    # Clasificación
    status:   Optional[str] = Field("activo", max_length=20)
    priority: Optional[str] = Field("media",  max_length=20)

    # Contenido libre
    notes: Optional[str] = None
    tags:  Optional[str] = Field(None, max_length=500)

    # Gobernanza
    is_confidential: bool = False
    is_active:       bool = True

    model_config = {"populate_by_name": True}


class ClientUpdateRequest(BaseModel):
    # Empresa
    name:        Optional[str] = Field(None, min_length=1, max_length=200)
    legal_name:  Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=600)
    industry:    Optional[str] = Field(None, max_length=120)
    email:       Optional[str] = Field(None, max_length=254)
    phone:       Optional[str] = Field(None, max_length=30)
    website:     Optional[str] = Field(None, max_length=500)
    address:     Optional[str] = Field(None, max_length=400)

    # Contacto
    contact_name:       Optional[str] = Field(None, max_length=200)
    contact_email:      Optional[str] = Field(None, max_length=254)
    contact_phone:      Optional[str] = Field(None, max_length=30)
    contact_position:   Optional[str] = Field(None, max_length=120)
    contact_department: Optional[str] = Field(None, max_length=120)

    # Clasificación
    status:   Optional[str] = Field(None, max_length=20)
    priority: Optional[str] = Field(None, max_length=20)

    # Contenido libre
    notes: Optional[str] = None
    tags:  Optional[str] = Field(None, max_length=500)

    # Gobernanza
    is_confidential: Optional[bool] = None
    is_active:       Optional[bool] = None

    model_config = {"populate_by_name": True}


class ClientStatusRequest(BaseModel):
    is_active: bool
    model_config = {"populate_by_name": True}


class ClientFilterRequest(BaseModel):
    skip:  int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=200)

    name:             Optional[str]  = None
    industry:         Optional[str]  = None
    status:           Optional[str]  = None
    priority:         Optional[str]  = None
    is_confidential:  Optional[bool] = None
    is_active:        Optional[bool] = None

    model_config = {"populate_by_name": True}


# ── Response ──────────────────────────────────────────────────────────────────

class ClientResponse(BaseModel):
    id:   str
    name: str

    # Empresa
    legal_name:  Optional[str] = Field(None, serialization_alias="legalName")
    description: Optional[str] = None
    industry:    Optional[str] = None
    email:       Optional[str] = None
    phone:       Optional[str] = None
    website:     Optional[str] = None
    address:     Optional[str] = None

    # Contacto
    contact_name:       Optional[str] = Field(None, serialization_alias="contactName")
    contact_email:      Optional[str] = Field(None, serialization_alias="contactEmail")
    contact_phone:      Optional[str] = Field(None, serialization_alias="contactPhone")
    contact_position:   Optional[str] = Field(None, serialization_alias="contactPosition")
    contact_department: Optional[str] = Field(None, serialization_alias="contactDepartment")

    # Clasificación
    status:   Optional[str] = None
    priority: Optional[str] = None

    # Contenido libre
    notes: Optional[str] = None
    tags:  Optional[str] = None

    # Gobernanza
    is_confidential: bool = Field(..., serialization_alias="isConfidential")
    is_active:       bool = Field(..., serialization_alias="isActive")

    # Auditoría
    created_at: Optional[datetime] = Field(None, serialization_alias="createdAt")
    updated_at: Optional[datetime] = Field(None, serialization_alias="updatedAt")
    deleted_at: Optional[datetime] = Field(None, serialization_alias="deletedAt")

    created_by: Optional[UserRefResponse] = Field(None, serialization_alias="createdBy")
    updated_by: Optional[UserRefResponse] = Field(None, serialization_alias="updatedBy")
    deleted_by: Optional[UserRefResponse] = Field(None, serialization_alias="deletedBy")

    model_config = {"populate_by_name": True}


class ClientListResponse(BaseModel):
    items: list[ClientResponse]
    total: int
    skip:  int
    limit: int

    model_config = {"populate_by_name": True}