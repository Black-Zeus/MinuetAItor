# routers/v1/auth.py
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import (
    LoginRequest, TokenResponse, UserSession, MeResponse,
    ValidateTokenResponse, ChangePasswordRequest,
    ChangePasswordByAdminRequest, ForgotPasswordRequest, ResetPasswordRequest,
    ActiveSessionsResponse, LogoutSessionRequest, LogoutSessionResponse, LogoutAllSessionsResponse,
)
from schemas.personalization import (
    UserPersonalizationResponse,
    UserPersonalizationUpdateRequest,
)
from services.auth_service import (
    login, logout, get_current_user, get_me,
    refresh_token, validate_token,
    change_password, change_password_by_admin,
    forgot_password, reset_password,
    list_active_sessions, logout_session_by_jti, logout_all_other_sessions,
)
from services.session_events_service import auth_sse_headers, stream_session_events
from services.avatar_service import read_user_avatar, remove_user_avatar, save_user_avatar
from services.user_personalization_service import (
    get_user_personalization,
    update_user_personalization,
)

router = APIRouter(prefix="/auth", tags=["Auth"])
bearer = HTTPBearer()
sse_bearer = HTTPBearer(auto_error=False)


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


async def current_user_or_token_dep(
    credentials: HTTPAuthorizationCredentials = Depends(sse_bearer),
    token: str | None = Query(None, description="JWT para autenticación vía SSE"),
) -> UserSession:
    jwt = (credentials.credentials if credentials else None) or token
    if not jwt:
        raise HTTPException(status_code=401, detail="No se proporcionó token de autenticación.")
    return await get_current_user(jwt)


# ── Auth base ─────────────────────────────────────────

@router.post("/login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
async def login_endpoint(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    return await login(db, payload.credential, payload.password, request)


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout_endpoint(
    session: UserSession = Depends(current_user_dep),
    db: Session = Depends(get_db),
):
    await logout(session, db)
    return {"message": "Sesión cerrada"}


@router.get("/me/sessions", response_model=ActiveSessionsResponse, status_code=status.HTTP_200_OK)
async def my_active_sessions_endpoint(
    session: UserSession = Depends(current_user_dep),
    db: Session = Depends(get_db),
):
    return await list_active_sessions(session, db)


@router.post("/logout-session", response_model=LogoutSessionResponse, status_code=status.HTTP_200_OK)
async def logout_session_endpoint(
    payload: LogoutSessionRequest,
    session: UserSession = Depends(current_user_dep),
    db: Session = Depends(get_db),
):
    return await logout_session_by_jti(session, payload, db)


@router.post("/logout-all", response_model=LogoutAllSessionsResponse, status_code=status.HTTP_200_OK)
async def logout_all_other_sessions_endpoint(
    session: UserSession = Depends(current_user_dep),
    db: Session = Depends(get_db),
):
    return await logout_all_other_sessions(session, db)


@router.get("/session-events", summary="Stream SSE — escucha eventos de sesión", response_class=StreamingResponse)
async def session_events_endpoint(
    session: UserSession = Depends(current_user_or_token_dep),
):
    return StreamingResponse(
        stream_session_events(session),
        media_type="text/event-stream",
        headers=auth_sse_headers(),
    )


@router.get("/me", response_model=MeResponse, status_code=status.HTTP_200_OK)
async def me_endpoint(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
):
    return await get_me(credentials.credentials, db)


@router.get("/me/personalization", response_model=UserPersonalizationResponse, status_code=status.HTTP_200_OK)
async def get_my_personalization_endpoint(
    session: UserSession = Depends(current_user_dep),
    db: Session = Depends(get_db),
):
    return get_user_personalization(db, session.user_id)


@router.put("/me/personalization", response_model=UserPersonalizationResponse, status_code=status.HTTP_200_OK)
async def update_my_personalization_endpoint(
    payload: UserPersonalizationUpdateRequest,
    session: UserSession = Depends(current_user_dep),
    db: Session = Depends(get_db),
):
    normalized_widgets = [
        {
            "code": item.code,
            "enabled": item.enabled,
            "sort_order": item.sort_order,
        }
        for item in payload.dashboard_widgets
    ]
    return update_user_personalization(
        db,
        user_id=session.user_id,
        theme=payload.theme,
        density=payload.density,
        animations=payload.animations,
        sidebar_collapsed=payload.sidebar_collapsed,
        dashboard_widgets=normalized_widgets,
        actor_user_id=session.user_id,
    )


@router.post("/me/avatar", status_code=status.HTTP_200_OK)
async def upload_my_avatar_endpoint(
    file: UploadFile = File(...),
    session: UserSession = Depends(current_user_dep),
    db: Session = Depends(get_db),
):
    avatar_url = await save_user_avatar(db, session.user_id, file, actor_user_id=session.user_id)
    return {"avatar_url": avatar_url}


@router.delete("/me/avatar", status_code=status.HTTP_200_OK)
async def delete_my_avatar_endpoint(
    session: UserSession = Depends(current_user_dep),
    db: Session = Depends(get_db),
):
    remove_user_avatar(db, session.user_id, actor_user_id=session.user_id)
    return {"avatar_url": None}


@router.get("/users/{user_id}/avatar", status_code=status.HTTP_200_OK)
def user_avatar_endpoint(user_id: str, db: Session = Depends(get_db)):
    content, content_type = read_user_avatar(db, user_id)
    return Response(
        content=content,
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=300",
        },
    )


# ── Token ─────────────────────────────────────────────

@router.post("/refresh", response_model=TokenResponse, status_code=status.HTTP_200_OK)
async def refresh_endpoint(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
):
    return await refresh_token(credentials.credentials, db, request)


@router.get("/validate-token", response_model=ValidateTokenResponse, status_code=status.HTTP_200_OK)
async def validate_token_endpoint(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
):
    return await validate_token(credentials.credentials)


# ── Password ──────────────────────────────────────────

@router.post("/change-password", status_code=status.HTTP_200_OK)
async def change_password_endpoint(
    payload: ChangePasswordRequest,
    session: UserSession = Depends(current_user_dep),
    db: Session = Depends(get_db),
):
    await change_password(session, payload, db)
    return {"message": "Contraseña actualizada"}


@router.post("/change-password-by-admin", status_code=status.HTTP_200_OK)
async def change_password_by_admin_endpoint(
    payload: ChangePasswordByAdminRequest,
    session: UserSession = Depends(current_user_dep),
    db: Session = Depends(get_db),
):
    await change_password_by_admin(session, payload, db)
    return {"message": "Contraseña actualizada por administrador"}


# ── Recuperación (dummy por ahora) ────────────────────

@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password_endpoint(payload: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    await forgot_password(db, payload.email, request)
    return {"message": "Si el email existe, recibirás instrucciones en breve"}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password_endpoint(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    await reset_password(db, payload.token, payload.otp_code, payload.new_password)
    return {"message": "Contraseña restablecida correctamente"}
