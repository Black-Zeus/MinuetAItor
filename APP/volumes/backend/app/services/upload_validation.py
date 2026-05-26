from __future__ import annotations

from fastapi import HTTPException, status

IMAGE_EXTENSIONS_BY_TYPE = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}
GENERIC_UPLOAD_TYPES = {"", "application/octet-stream", "binary/octet-stream"}


def normalize_content_type(value: str | None) -> str:
    normalized = str(value or "").split(";", 1)[0].strip().lower()
    if normalized == "image/jpg":
        return "image/jpeg"
    return normalized


def detect_image_content_type(content: bytes) -> str | None:
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    if content.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    return None


def validate_uploaded_image(
    *,
    content: bytes,
    declared_content_type: str | None,
    allowed_types: set[str],
    label: str,
) -> tuple[str, str]:
    declared_type = normalize_content_type(declared_content_type)
    detected_type = detect_image_content_type(content)

    if not detected_type or detected_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato de {label} no soportado.",
        )

    if declared_type not in GENERIC_UPLOAD_TYPES and declared_type != detected_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El tipo declarado del {label} no coincide con el contenido real.",
        )

    return detected_type, IMAGE_EXTENSIONS_BY_TYPE[detected_type]


def safe_content_disposition(filename: str, *, disposition: str = "attachment") -> str:
    safe_name = str(filename or "archivo").replace("\\", "_").replace("/", "_")
    safe_name = safe_name.replace("\r", "").replace("\n", "").replace('"', "")
    safe_name = safe_name.strip() or "archivo"
    return f'{disposition}; filename="{safe_name}"'
