# routers/v1/auth.py
from fastapi import APIRouter, Depends, File, Request, Response, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.auth import (
    LoginRequest, TokenResponse, UserSession, MeResponse,
    ValidateTokenResponse, ChangePasswordRequest,
    ChangePasswordByAdminRequest, ForgotPasswordRequest, ResetPasswordRequest,
)
from services.auth_service import (
    login, logout, get_current_user, get_me,
    refresh_token, validate_token,
    change_password, change_password_by_admin,
    forgot_password, reset_password,
)
from services.avatar_service import read_user_avatar, remove_user_avatar, save_user_avatar

router = APIRouter(prefix="/auth", tags=["Auth"])
bearer = HTTPBearer()


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


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


@router.get("/me", response_model=MeResponse, status_code=status.HTTP_200_OK)
async def me_endpoint(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
):
    return await get_me(credentials.credentials, db)


@router.post("/me/avatar", status_code=status.HTTP_200_OK)
async def upload_my_avatar_endpoint(
    file: UploadFile = File(...),
    session: UserSession = Depends(current_user_dep),
):
    avatar_url = await save_user_avatar(session.user_id, file)
    return {"avatar_url": avatar_url}


@router.delete("/me/avatar", status_code=status.HTTP_200_OK)
async def delete_my_avatar_endpoint(
    session: UserSession = Depends(current_user_dep),
):
    remove_user_avatar(session.user_id)
    return {"avatar_url": None}


@router.get("/users/{user_id}/avatar", status_code=status.HTTP_200_OK)
def user_avatar_endpoint(user_id: str):
    content, content_type = read_user_avatar(user_id)
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
