from __future__ import annotations

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.exceptions import ForbiddenException
from schemas.auth import UserSession
from services.auth_service import get_current_user

bearer = HTTPBearer()


def normalize_role(role: str | None) -> str:
    return role.strip().upper() if role and role.strip() else ""


def normalize_permission(permission: str | None) -> str:
    return permission.strip() if permission and permission.strip() else ""


def has_role(session: UserSession, role: str) -> bool:
    expected = normalize_role(role)
    if not expected:
        return False
    return any(normalize_role(user_role) == expected for user_role in (session.roles or []))


def has_any_role(session: UserSession, roles: set[str] | list[str] | tuple[str, ...]) -> bool:
    normalized = {normalize_role(role) for role in roles if normalize_role(role)}
    if not normalized:
        return False
    return any(normalize_role(user_role) in normalized for user_role in (session.roles or []))


def has_permission(session: UserSession, permission: str) -> bool:
    expected = normalize_permission(permission)
    if not expected:
        return False
    return any(
        normalize_permission(user_permission) == expected
        for user_permission in (session.permissions or [])
    )


def has_any_permission(
    session: UserSession,
    permissions: set[str] | list[str] | tuple[str, ...],
) -> bool:
    normalized = {
        normalize_permission(permission) for permission in permissions if normalize_permission(permission)
    }
    if not normalized:
        return False
    return any(
        normalize_permission(user_permission) in normalized
        for user_permission in (session.permissions or [])
    )


async def current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> UserSession:
    return await get_current_user(credentials.credentials)


def require_roles(*required_roles: str):
    normalized_required = {normalize_role(role) for role in required_roles if normalize_role(role)}

    async def dependency(
        session: UserSession = Depends(current_user_dep),
    ) -> UserSession:
        if not normalized_required:
            return session

        user_roles = {normalize_role(role) for role in (session.roles or []) if normalize_role(role)}
        if user_roles.isdisjoint(normalized_required):
            raise ForbiddenException("No tienes los roles requeridos para esta operación")
        return session

    return dependency


def require_permissions(*required_permissions: str, require_all: bool = True):
    normalized_required = {
        normalize_permission(permission)
        for permission in required_permissions
        if normalize_permission(permission)
    }

    async def dependency(
        session: UserSession = Depends(current_user_dep),
    ) -> UserSession:
        if not normalized_required:
            return session

        user_permissions = {
            normalize_permission(permission)
            for permission in (session.permissions or [])
            if normalize_permission(permission)
        }

        has_access = (
            normalized_required.issubset(user_permissions)
            if require_all
            else not user_permissions.isdisjoint(normalized_required)
        )
        if not has_access:
            raise ForbiddenException("No tienes los permisos requeridos para esta operación")
        return session

    return dependency
