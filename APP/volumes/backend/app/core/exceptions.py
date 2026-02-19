# core/exceptions.py
from fastapi import status
from schemas.response import ErrorDetail


class AppException(Exception):
    """Base de todas las excepciones de dominio."""

    def __init__(
        self,
        message: str,
        code: str,
        status_code: int,
        details: list[ErrorDetail] | None = None,
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or []
        super().__init__(message)


class NotFoundException(AppException):
    def __init__(self, message: str = "Recurso no encontrado", details: list[ErrorDetail] | None = None):
        super().__init__(message=message, code="NOT_FOUND", status_code=status.HTTP_404_NOT_FOUND, details=details)


class UnauthorizedException(AppException):
    def __init__(self, message: str = "No autorizado", details: list[ErrorDetail] | None = None):
        super().__init__(message=message, code="UNAUTHORIZED", status_code=status.HTTP_401_UNAUTHORIZED, details=details)


class ForbiddenException(AppException):
    def __init__(self, message: str = "Acceso denegado", details: list[ErrorDetail] | None = None):
        super().__init__(message=message, code="FORBIDDEN", status_code=status.HTTP_403_FORBIDDEN, details=details)


class ConflictException(AppException):
    def __init__(self, message: str = "Conflicto con el estado actual", details: list[ErrorDetail] | None = None):
        super().__init__(message=message, code="CONFLICT", status_code=status.HTTP_409_CONFLICT, details=details)


class BadRequestException(AppException):
    def __init__(self, message: str = "Solicitud inválida", details: list[ErrorDetail] | None = None):
        super().__init__(message=message, code="BAD_REQUEST", status_code=status.HTTP_400_BAD_REQUEST, details=details)


class UnprocessableException(AppException):
    def __init__(self, message: str = "No se puede procesar la entidad", details: list[ErrorDetail] | None = None):
        super().__init__(message=message, code="UNPROCESSABLE", status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, details=details)