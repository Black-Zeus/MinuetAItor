# routers/v1/auth.py
from fastapi import APIRouter, Depends, Request, status
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
)

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
async def forgot_password_endpoint(payload: ForgotPasswordRequest):
    # TODO: implementar flujo de recuperación (SMTP nativo o n8n)
    return {"message": "Si el email existe, recibirás instrucciones en breve"}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password_endpoint(payload: ResetPasswordRequest):
    # TODO: implementar validación de token y reset
    return {"message": "Contraseña restablecida correctamente"}