# routers/v1/teams.py
from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import UserSession
from schemas.teams import (
    TeamCreateRequest,
    TeamFilterRequest,
    TeamListResponse,
    TeamResponse,
    TeamStatusRequest,
    TeamUpdateRequest,
)
from services.auth_service import get_current_user
from services.teams_service import (
    change_team_status,
    create_team_member,
    delete_team_member,
    get_team_member,
    list_team_members,
    update_team_member,
)

router = APIRouter(prefix="/teams", tags=["Teams"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


# ── GET /teams/{id} ───────────────────────────────────

@router.get(
    "/{team_id}",
    response_model=TeamResponse,
    status_code=status.HTTP_200_OK,
    summary="Obtener un team member por ID",
)
async def get_team_endpoint(
    team_id: str,
    session: UserSession = Depends(current_user_dep),
    db: Session = Depends(get_db),
):
    return get_team_member(db, team_id)


# ── POST /teams/list ──────────────────────────────────
# IMPORTANTE: este route debe ir ANTES de POST /teams
# para que FastAPI no confunda "list" con un {team_id}

@router.post(
    "/list",
    response_model=TeamListResponse,
    status_code=status.HTTP_200_OK,
    summary="Listar team members con filtros opcionales en el body",
)
async def list_teams_endpoint(
    filters: TeamFilterRequest = TeamFilterRequest(),
    session: UserSession = Depends(current_user_dep),
    db: Session = Depends(get_db),
):
    return list_team_members(db, filters)


# ── POST /teams ───────────────────────────────────────

@router.post(
    "",
    response_model=TeamResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear nuevo team member (genera password temporal automáticamente)",
)
async def create_team_endpoint(
    payload: TeamCreateRequest,
    session: UserSession = Depends(current_user_dep),
    db: Session = Depends(get_db),
):
    return create_team_member(db, payload, created_by_id=session.user_id)


# ── PUT /teams/{id} ───────────────────────────────────

@router.put(
    "/{team_id}",
    response_model=TeamResponse,
    status_code=status.HTTP_200_OK,
    summary="Actualizar team member (campos parciales)",
)
async def update_team_endpoint(
    team_id: str,
    payload: TeamUpdateRequest,
    session: UserSession = Depends(current_user_dep),
    db: Session = Depends(get_db),
):
    return update_team_member(db, team_id, payload, updated_by_id=session.user_id)


# ── PATCH /teams/{id}/status ──────────────────────────

@router.patch(
    "/{team_id}/status",
    response_model=TeamResponse,
    status_code=status.HTTP_200_OK,
    summary="Cambiar status activo/inactivo de un team member",
)
async def change_status_endpoint(
    team_id: str,
    payload: TeamStatusRequest,
    session: UserSession = Depends(current_user_dep),
    db: Session = Depends(get_db),
):
    return change_team_status(db, team_id, payload.status, updated_by_id=session.user_id)


# ── DELETE /teams/{id} ────────────────────────────────

@router.delete(
    "/{team_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar team member (soft delete)",
)
async def delete_team_endpoint(
    team_id: str,
    session: UserSession = Depends(current_user_dep),
    db: Session = Depends(get_db),
):
    delete_team_member(db, team_id, deleted_by_id=session.user_id)