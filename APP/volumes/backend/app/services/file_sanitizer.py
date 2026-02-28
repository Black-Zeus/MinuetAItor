# services/file_sanitizer.py
"""
Valida archivos de usuario SIN modificar su contenido.
Solo verifica que sea texto plano seguro de procesar.
"""
import hashlib
import logging

logger = logging.getLogger(__name__)

ALLOWED_MIME_TYPES = {
    "text/plain", "text/html", "text/csv",
    "application/pdf", "application/json",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}

MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50MB default, sobreescribir desde config


class FileSanitizationError(Exception):
    pass


def verify_sha256(content: bytes, expected_hash: str) -> None:
    """Verifica que el hash SHA256 del contenido coincide con el declarado."""
    actual = hashlib.sha256(content).hexdigest()
    if actual != expected_hash:
        raise FileSanitizationError(
            f"SHA256 mismatch: esperado={expected_hash}, calculado={actual}"
        )


def verify_not_binary(content: bytes, filename: str) -> None:
    """
    Detecta si el archivo es binario comprobando bytes nulos.
    PDFs y DOCX son binarios válidos — se eximen por extensión.
    """
    binary_safe_extensions = {".pdf", ".docx", ".doc"}
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    
    if ext in binary_safe_extensions:
        return  # Formatos binarios permitidos explícitamente

    # Para texto plano: no debe contener bytes nulos
    if b"\x00" in content:
        raise FileSanitizationError(
            f"Archivo '{filename}' contiene bytes nulos — posible archivo binario"
        )


def verify_utf8_for_text(content: bytes, mime_type: str, filename: str) -> None:
    """Verifica encoding UTF-8 para archivos de texto plano."""
    text_mimes = {"text/plain", "text/html", "text/csv", "application/json"}
    if mime_type in text_mimes:
        try:
            content.decode("utf-8")
        except UnicodeDecodeError:
            raise FileSanitizationError(
                f"Archivo '{filename}' no es UTF-8 válido"
            )


def verify_size(content: bytes, filename: str, max_bytes: int = MAX_FILE_SIZE_BYTES) -> None:
    if len(content) > max_bytes:
        raise FileSanitizationError(
            f"Archivo '{filename}' excede el límite de {max_bytes // 1024 // 1024}MB"
        )


def sanitize_file(
    content: bytes,
    filename: str,
    mime_type: str,
    expected_sha256: str,
    max_bytes: int = MAX_FILE_SIZE_BYTES,
) -> bytes:
    """
    Punto de entrada principal. Valida el archivo y retorna el contenido
    ORIGINAL sin ninguna modificación.
    
    Raises FileSanitizationError si algo no pasa la validación.
    Returns el mismo `content` sin cambios.
    """
    if mime_type not in ALLOWED_MIME_TYPES:
        raise FileSanitizationError(f"Tipo MIME no permitido: {mime_type}")
    
    verify_size(content, filename, max_bytes)
    verify_sha256(content, expected_sha256)
    verify_not_binary(content, filename)
    verify_utf8_for_text(content, mime_type, filename)
    
    logger.info(f"✅ Archivo validado: {filename} ({len(content)} bytes, sha256={expected_sha256[:8]}...)")
    return content  # SIN MODIFICACIONES