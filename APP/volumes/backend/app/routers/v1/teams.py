# routers/v1/teams.py
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.authz import require_roles
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
from services.notification_center_service import create_in_app_notification
from services.teams_service import (
    change_team_status,
    create_team_member,
    delete_team_member,
    get_team_member,
    list_team_members,
    update_team_member,
)
from services.notification_service import enqueue_account_created_email

router = APIRouter(prefix="/teams", tags=["Teams"])


# ── GET /teams/{id} ───────────────────────────────────

@router.get(
    "/{team_id}",
    response_model=TeamResponse,
    status_code=status.HTTP_200_OK,
    summary="Obtener un team member por ID",
)
async def get_team_endpoint(
    team_id: str,
    session: UserSession = Depends(require_roles("ADMIN")),
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
    session: UserSession = Depends(require_roles("ADMIN")),
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
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    result = create_team_member(db, payload, created_by_id=session.user_id)
    await enqueue_account_created_email(
        db,
        result["id"],
        request_origin="teams.create",
    )
    await create_in_app_notification(
        db,
        notification_type="team.account.created",
        title="Cuenta creada",
        message="Se creó tu cuenta en MinuetAItor y ya puedes ingresar con las credenciales enviadas por correo.",
        level="success",
        tags=["team", "account", "access", "team.account.created"],
        recipient_user_ids=[result["id"]],
        scope_type="user",
        scope_id=result["id"],
        action_url="/login",
        actor_user_id=session.user_id,
        metadata={
            "targetUserId": result["id"],
            "username": result.get("username"),
            "email": result.get("email"),
            "systemRole": result.get("system_role"),
            "assignmentMode": result.get("assignment_mode"),
        },
    )
    return result


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
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    before = get_team_member(db, team_id)
    result = update_team_member(db, team_id, payload, updated_by_id=session.user_id)

    if payload.system_role is not None and before.get("system_role") != result.get("system_role"):
        await create_in_app_notification(
            db,
            notification_type="rbac.role.changed",
            title="Rol actualizado",
            message=f'Se actualizó tu rol de sistema a "{result.get("system_role")}".',
            level="info",
            tags=["rbac", "role", "permission", "rbac.role.changed"],
            recipient_user_ids=[team_id],
            scope_type="user",
            scope_id=team_id,
            action_url="/settings/userProfile",
            actor_user_id=session.user_id,
            metadata={
                "targetUserId": team_id,
                "previousSystemRole": before.get("system_role"),
                "nextSystemRole": result.get("system_role"),
            },
        )

    scope_changed = (
        (payload.assignment_mode is not None and before.get("assignment_mode") != result.get("assignment_mode"))
        or (payload.clients is not None and set(before.get("clients") or []) != set(result.get("clients") or []))
        or (payload.projects is not None and set(before.get("projects") or []) != set(result.get("projects") or []))
    )
    if scope_changed:
        await create_in_app_notification(
            db,
            notification_type="access.assignment.updated",
            title="Permisos de alcance actualizados",
            message="Se actualizó el alcance de clientes, proyectos o modalidad de asignación de tu cuenta.",
            level="info",
            tags=["access", "assignment", "permission", "access.assignment.updated"],
            recipient_user_ids=[team_id],
            scope_type="user",
            scope_id=team_id,
            action_url="/settings/userProfile",
            actor_user_id=session.user_id,
            metadata={
                "targetUserId": team_id,
                "previousAssignmentMode": before.get("assignment_mode"),
                "nextAssignmentMode": result.get("assignment_mode"),
                "clientsIncluded": payload.clients is not None,
                "projectsIncluded": payload.projects is not None,
            },
        )

    return result


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
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    before = get_team_member(db, team_id)
    result = change_team_status(db, team_id, payload.status, updated_by_id=session.user_id)
    is_active = payload.status == TeamStatus.active
    if before.get("status") != result.get("status"):
        await create_in_app_notification(
            db,
            notification_type="team.account.activated" if is_active else "team.account.deactivated",
            title="Cuenta activada" if is_active else "Cuenta desactivada",
            message=(
                "Se activó tu cuenta y vuelve a estar disponible para iniciar sesión."
                if is_active
                else "Tu cuenta fue desactivada y ya no podrá iniciar sesión hasta nuevo aviso."
            ),
            level="info" if is_active else "warning",
            tags=["team", "account", "status", "team.account.activated" if is_active else "team.account.deactivated"],
            recipient_user_ids=[team_id],
            scope_type="user",
            scope_id=team_id,
            action_url="/settings/userProfile",
            actor_user_id=session.user_id,
            metadata={
                "targetUserId": team_id,
                "previousStatus": before.get("status"),
                "status": result.get("status"),
            },
        )
    return result


# ── DELETE /teams/{id} ────────────────────────────────

@router.delete(
    "/{team_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar team member (soft delete)",
)
async def delete_team_endpoint(
    team_id: str,
    session: UserSession = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    delete_team_member(db, team_id, deleted_by_id=session.user_id)
