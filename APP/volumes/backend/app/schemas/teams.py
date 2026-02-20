# schemas/teams.py
from __future__ import annotations

from enum import Enum
from typing import Any
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, field_validator


# ── Enums ─────────────────────────────────────────────

class TeamStatus(str, Enum):
    active   = "active"
    inactive = "inactive"

class TeamSystemRole(str, Enum):
    """Mapea a códigos en la tabla roles."""
    admin = "admin"
    write = "write"
    read  = "read"

class TeamAssignmentMode(str, Enum):
    all      = "all"
    specific = "specific"

class TeamDepartment(str, Enum):
    operations = "operations"
    it         = "it"
    sales      = "sales"
    marketing  = "marketing"
    finance    = "finance"
    hr         = "hr"


# ── Request schemas ───────────────────────────────────

class TeamCreateRequest(BaseModel):
    """
    Crea un User + UserProfile + asigna rol.
    Sin password: se genera hash temporal internamente.
    clients/projects: ignorados por ahora (arrays vacíos).
    """
    # ── User fields ──
    username:  str      = Field(..., min_length=3, max_length=80)
    email:     EmailStr
    full_name: str      = Field(..., min_length=2, max_length=200, alias="name")
    phone:     str | None = Field(None, max_length=20)

    # ── UserProfile fields ──
    position:   str            = Field(..., max_length=120)
    department: TeamDepartment
    initials:   str            = Field(..., min_length=1, max_length=10)
    color:      str            = Field(..., max_length=20)
    notes:      str | None     = Field(None, max_length=600)

    # ── Sistema ──
    status:          TeamStatus         = TeamStatus.active
    system_role:     TeamSystemRole     = Field(TeamSystemRole.read, alias="systemRole")
    assignment_mode: TeamAssignmentMode = Field(TeamAssignmentMode.specific, alias="assignmentMode")

    # ── Ignorados por ahora ──
    clients:  list[Any] = Field(default_factory=list)
    projects: list[Any] = Field(default_factory=list)

    model_config = {"populate_by_name": True}

    @field_validator("initials")
    @classmethod
    def initials_upper(cls, v: str) -> str:
        return v.upper()


class TeamUpdateRequest(BaseModel):
    """
    Actualiza User y/o UserProfile.
    Solo se modifican los campos presentes en el body.
    """
    # ── User fields ──
    username:  str | None      = Field(None, min_length=3, max_length=80)
    email:     EmailStr | None = None
    full_name: str | None      = Field(None, min_length=2, max_length=200, alias="name")
    phone:     str | None      = Field(None, max_length=20)

    # ── UserProfile fields ──
    position:   str | None            = Field(None, max_length=120)
    department: TeamDepartment | None = None
    initials:   str | None            = Field(None, min_length=1, max_length=10)
    color:      str | None            = Field(None, max_length=20)
    notes:      str | None            = Field(None, max_length=600)

    # ── Sistema ──
    system_role:     TeamSystemRole | None     = Field(None, alias="systemRole")
    assignment_mode: TeamAssignmentMode | None = Field(None, alias="assignmentMode")

    # ── Ignorados por ahora ──
    clients:  list[Any] | None = None
    projects: list[Any] | None = None

    model_config = {"populate_by_name": True}

    @field_validator("initials")
    @classmethod
    def initials_upper(cls, v: str | None) -> str | None:
        return v.upper() if v else v


class TeamStatusRequest(BaseModel):
    status: TeamStatus


class TeamFilterRequest(BaseModel):
    """Filtros en body del POST /teams/list."""
    search:      str | None            = None   # busca en full_name, email, username, position
    department:  TeamDepartment | None = None
    system_role: TeamSystemRole | None = Field(None, alias="systemRole")
    status:      TeamStatus | None     = None
    skip:        int                   = Field(0, ge=0)
    limit:       int                   = Field(50, ge=1, le=200)

    model_config = {"populate_by_name": True}


# ── Response schemas ──────────────────────────────────

class TeamResponse(BaseModel):
    """Shape que espera el frontend. Construido desde User + UserProfile + Role."""
    id:              str
    name:            str        # ← user.full_name
    username:        str
    email:           str
    position:        str | None
    phone:           str | None
    department:      str | None
    status:          str        # "active" | "inactive"
    system_role:     str        = Field(serialization_alias="systemRole")
    initials:        str | None
    color:           str | None
    assignment_mode: str        = Field(serialization_alias="assignmentMode")
    clients:         list[Any]  # siempre []
    projects:        list[Any]  # siempre []
    notes:           str | None
    created_at:      str        = Field(serialization_alias="createdAt")
    last_activity:   datetime | None = Field(None, serialization_alias="lastActivity")


    model_config = {"populate_by_name": True}


class TeamListResponse(BaseModel):
    teams: list[TeamResponse]
    total: int
    skip:  int
    limit: int