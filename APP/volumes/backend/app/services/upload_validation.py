from __future__ import annotations

from io import BytesIO
import warnings

from fastapi import HTTPException, status
from PIL import Image, ImageOps, UnidentifiedImageError

IMAGE_EXTENSIONS_BY_TYPE = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}
GENERIC_UPLOAD_TYPES = {"", "application/octet-stream", "binary/octet-stream"}
MAX_SAFE_IMAGE_PIXELS = 16_000_000
Image.MAX_IMAGE_PIXELS = MAX_SAFE_IMAGE_PIXELS


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


def _image_has_alpha(image: Image.Image) -> bool:
    if image.mode in {"RGBA", "LA"}:
        return True
    if image.mode == "P" and "transparency" in image.info:
        return True
    return False


def sanitize_uploaded_image_content(
    *,
    content: bytes,
    declared_content_type: str | None,
    allowed_types: set[str],
    label: str,
    max_size: tuple[int, int] = (512, 512),
    square: bool = False,
) -> tuple[bytes, str, str]:
    """
    Re-encodea imagenes para eliminar metadata/EXIF y normalizar contenido.

    Retorna bytes nuevos, content-type final y extension final. Las imagenes con
    alpha se conservan como PNG; el resto se serializa como JPEG optimizado.
    """
    detected_type, _ = validate_uploaded_image(
        content=content,
        declared_content_type=declared_content_type,
        allowed_types=allowed_types,
        label=label,
    )

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(content)) as source:
                source.verify()

            with Image.open(BytesIO(content)) as source:
                image = ImageOps.exif_transpose(source)
                if square:
                    image = ImageOps.fit(image, max_size, method=Image.Resampling.LANCZOS)
                else:
                    image.thumbnail(max_size, Image.Resampling.LANCZOS)

                output = BytesIO()
                if detected_type == "image/png" and _image_has_alpha(image):
                    clean_image = image.convert("RGBA")
                    clean_image.save(output, format="PNG", optimize=True)
                    return output.getvalue(), "image/png", "png"

                clean_image = image.convert("RGB")
                clean_image.save(
                    output,
                    format="JPEG",
                    quality=88,
                    optimize=True,
                    progressive=True,
                )
                return output.getvalue(), "image/jpeg", "jpg"
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La imagen de {label} excede el tamano seguro permitido.",
        )
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No fue posible procesar la imagen de {label}.",
        )


def build_image_derivative(
    content: bytes,
    *,
    size: tuple[int, int],
    content_type: str | None = None,
    square: bool = True,
) -> tuple[bytes, str]:
    """Genera una derivada segura desde una imagen ya almacenada."""
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(content)) as source:
                image = ImageOps.exif_transpose(source)
                if square:
                    image = ImageOps.fit(image, size, method=Image.Resampling.LANCZOS)
                else:
                    image.thumbnail(size, Image.Resampling.LANCZOS)

                output = BytesIO()
                if normalize_content_type(content_type) == "image/png" and _image_has_alpha(image):
                    image.convert("RGBA").save(output, format="PNG", optimize=True)
                    return output.getvalue(), "image/png"

                image.convert("RGB").save(output, format="JPEG", quality=86, optimize=True, progressive=True)
                return output.getvalue(), "image/jpeg"
    except Exception:
        return content, content_type or "application/octet-stream"


def safe_content_disposition(filename: str, *, disposition: str = "attachment") -> str:
    safe_name = str(filename or "archivo").replace("\\", "_").replace("/", "_")
    safe_name = safe_name.replace("\r", "").replace("\n", "").replace('"', "")
    safe_name = safe_name.strip() or "archivo"
    return f'{disposition}; filename="{safe_name}"'
