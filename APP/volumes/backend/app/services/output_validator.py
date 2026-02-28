# services/output_validator.py  — VERSIÓN AMPLIADA
import json
import re
import logging
from pathlib import Path
import jsonschema

logger = logging.getLogger(__name__)

# Rutas a los schemas
_BASE = Path(__file__).parent.parent / "assets" / "schemas"
INPUT_SCHEMA_PATH  = _BASE / "AI_input_Schema.json"
OUTPUT_SCHEMA_PATH = _BASE / "AI_output_Schema.json"

_input_schema  = None
_output_schema = None


def _get_input_schema() -> dict:
    global _input_schema
    if _input_schema is None:
        _input_schema = json.loads(INPUT_SCHEMA_PATH.read_text(encoding="utf-8"))
    return _input_schema


def _get_output_schema() -> dict:
    global _output_schema
    if _output_schema is None:
        _output_schema = json.loads(OUTPUT_SCHEMA_PATH.read_text(encoding="utf-8"))
    return _output_schema


# ── VALIDACIÓN DE INPUT ──────────────────────────────────────────────────────

def validate_input(data: dict) -> None:
    """
    Valida el JSON recibido del frontend contra AI_input_Schema.json.
    Lanza ValueError con mensaje descriptivo si no cumple.
    """
    try:
        jsonschema.validate(instance=data, schema=_get_input_schema())
    except jsonschema.ValidationError as e:
        raise ValueError(f"Input inválido: {e.message} (ruta: {' → '.join(str(p) for p in e.path)})")
    
    logger.info("✅ Input validado contra schema correctamente")


# ── VALIDACIÓN DE OUTPUT ─────────────────────────────────────────────────────

def extract_json_from_response(text: str) -> dict:
    """Extrae el JSON de la respuesta aunque venga con markdown fences."""
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        text = match.group(1)
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(f"La IA no retornó JSON válido: {e}")


def check_no_injection(data: dict) -> None:
    """Verifica que el JSON no contenga scripts HTML inyectados."""
    dumped = json.dumps(data)
    for pattern in [r"<script", r"javascript:", r"onerror=", r"onload="]:
        if re.search(pattern, dumped, re.IGNORECASE):
            raise ValueError(f"Posible inyección detectada en output: '{pattern}'")


def validate_output(raw_text: str) -> dict:
    """Extrae, valida contra schema y verifica seguridad del output de la IA."""
    data = extract_json_from_response(raw_text)
    check_no_injection(data)
    try:
        jsonschema.validate(instance=data, schema=_get_output_schema())
    except jsonschema.ValidationError as e:
        raise ValueError(f"Output no cumple el schema: {e.message}")
    logger.info("✅ Output de IA validado correctamente")
    return data