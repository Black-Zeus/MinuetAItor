"""
test_pdf_job.py
Encola un job de prueba en queue:pdf y espera el resultado en MinIO.

Lee los datos desde output.json (misma carpeta que este script).
Si output.json no existe, detiene la ejecución con error claro.

Uso:
    python test_pdf_job.py                      # template opc_01, sin watermark
    python test_pdf_job.py --template opc_02    # cambiar template
    python test_pdf_job.py --watermark          # con marca BORRADOR
    python test_pdf_job.py --all                # prueba los 4 templates
    python test_pdf_job.py --all --watermark    # prueba los 4 templates con marca de Agua
"""
import argparse
import json
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path

import redis
from minio import Minio

# ── Config ─────────────────────────────────────────────────────────────────────
REDIS_HOST = "redis"
REDIS_PORT = 6379
MINIO_HOST = "minio:9000"
MINIO_USER = "minioadmin"
MINIO_PASS = "minioadmin_change_me"
BUCKET     = "minuetaitor-published"

# output.json debe estar en la misma carpeta que este script
OUTPUT_JSON = Path(__file__).parent / "output.json"


# ── Carga de datos ──────────────────────────────────────────────────────────────

def load_output_json() -> dict:
    """
    Lee output.json desde la misma carpeta del script.
    El JSON viene en formato camelCase (output del LLM) y se normaliza
    a snake_case igual que hace pdf_job_builder.py en el backend.
    Detiene la ejecución si el archivo no existe o no es JSON válido.
    """
    if not OUTPUT_JSON.exists():
        print(f"\n❌ ERROR: No se encontró output.json")
        print(f"   Ruta esperada: {OUTPUT_JSON.resolve()}")
        print(f"   Crea el archivo con el JSON de respuesta del LLM antes de ejecutar este script.")
        sys.exit(1)

    try:
        raw = OUTPUT_JSON.read_text(encoding="utf-8")
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"\n❌ ERROR: output.json no es JSON válido")
        print(f"   {e}")
        sys.exit(1)

    if not isinstance(data, dict):
        print(f"\n❌ ERROR: output.json no contiene un objeto JSON (dict)")
        print(f"   Tipo recibido: {type(data).__name__}")
        sys.exit(1)

    print(f"✅ output.json cargado | {OUTPUT_JSON.stat().st_size} bytes")
    return _normalize(data)


def _normalize(data: dict) -> dict:
    """
    Normaliza el JSON camelCase del LLM al snake_case que esperan los templates Jinja2.
    Misma lógica que pdf_job_builder.py para garantizar coherencia.
    """
    gi  = data.get("generalInfo", data.get("general_info", {}))
    p   = data.get("participants", {})
    s   = data.get("scope", {})
    agr = data.get("agreements", {})
    req = data.get("requirements", {})
    upm = data.get("upcomingMeetings", data.get("upcoming_meetings", {}))
    tags = data.get("aiSuggestedTags", data.get("ai_tags", []))

    return {
        "general_info": {
            "client":               gi.get("client", ""),
            "project":              gi.get("project", ""),
            "subject":              gi.get("subject", ""),
            "meeting_date":         gi.get("meetingDate",        gi.get("meeting_date", "")),
            "prepared_by":          gi.get("preparedBy",         gi.get("prepared_by", "")),
            "location":             gi.get("location", ""),
            "scheduled_start_time": gi.get("scheduledStartTime", gi.get("scheduled_start_time", "")),
            "scheduled_end_time":   gi.get("scheduledEndTime",   gi.get("scheduled_end_time", "")),
            "actual_start_time":    gi.get("actualStartTime",    gi.get("actual_start_time", "")),
            "actual_end_time":      gi.get("actualEndTime",      gi.get("actual_end_time", "")),
        },
        "participants": {
            "invited":         [_person(x) for x in p.get("invited", [])],
            "attendees":       [_person(x) for x in p.get("attendees", [])],
            "copy_recipients": [_person(x) for x in p.get("copyRecipients",
                                                           p.get("copy_recipients", []))],
        },
        "scope": {
            "sections": [_section(x) for x in s.get("sections", [])],
        },
        "agreements": {
            "items": [_agreement(x) for x in agr.get("items", [])],
        },
        "requirements": {
            "items": [_requirement(x) for x in req.get("items", [])],
        },
        "upcoming_meetings": {
            "items": [_upcoming(x) for x in upm.get("items", [])],
        },
        "ai_tags": tags,
        "pdf_format": data.get("pdf_format", {
            "cover_page":      {"enabled": True,  "subtitle": ""},
            "summary_sheet":   {"enabled": True},
            "version_control": {"enabled": True},
            "signature_page":  {"enabled": False},
        }),
    }


def _person(x: dict) -> dict:
    return {
        "full_name": x.get("fullName", x.get("full_name", "")),
        "initials":  x.get("initials", ""),
        "role":      x.get("role", ""),
    }


def _section(x: dict) -> dict:
    c = x.get("content", {})
    return {
        "section_id":    x.get("sectionId",    x.get("section_id", "")),
        "section_title": x.get("sectionTitle", x.get("section_title", "")),
        "section_type":  x.get("sectionType",  x.get("section_type", "")),
        "content": {
            "summary":     c.get("summary", ""),
            "topics_list": c.get("topicsList", c.get("topics_list", [])),
            "details":     c.get("details", []),
        },
    }


def _agreement(x: dict) -> dict:
    return {
        "subject":     x.get("subject", ""),
        "body":        x.get("body", ""),
        "responsible": x.get("responsible", ""),
        "due_date":    x.get("dueDate", x.get("due_date", "")),
        "status":      x.get("status", "pending"),
    }


def _requirement(x: dict) -> dict:
    return {
        "entity":      x.get("entity", ""),
        "body":        x.get("body", ""),
        "responsible": x.get("responsible", ""),
        "priority":    x.get("priority", "medium"),
        "status":      x.get("status", "open"),
    }


def _upcoming(x: dict) -> dict:
    return {
        "scheduled_date": x.get("scheduledDate", x.get("scheduled_date", "")),
        "agenda":         x.get("agenda", ""),
        "attendees":      x.get("attendees", []),
    }


# ── Redis / MinIO ───────────────────────────────────────────────────────────────

def enqueue_job(template: str, watermark: bool, data: dict) -> tuple[str, str]:
    record_id  = str(uuid.uuid4())[:8]
    job_id     = str(uuid.uuid4())
    timestamp  = datetime.now().strftime("%Y%m%d_%H%M%S")

    template_num = template.split("_")[1] if "_" in template else template
    filename     = f"template_{template_num}_{timestamp}.pdf"
    output_key   = f"draft/{record_id}/{filename}"

    job = {
        "job_id":  job_id,
        "type":    "minute_pdf",
        "queue":   "queue:pdf",
        "attempt": 1,
        "payload": {
            "record_id":        record_id,
            "version_id":       str(uuid.uuid4())[:8],
            "version_label":    "v1.0-test",
            "template":         template,
            "minio_output_key": output_key,
            "minio_bucket":     BUCKET,
            "options": {
                "watermark": watermark,
                "paper":     "A4",
            },
            "data": data,
        },
    }

    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
    r.rpush("queue:pdf", json.dumps(job))

    print(f"✅ Job encolado | template={template} watermark={watermark}")
    print(f"   job_id     : {job_id}")
    print(f"   record_id  : {record_id}")
    print(f"   output_key : {BUCKET}/{output_key}")
    print(f"   filename   : {filename}")
    return output_key, filename


def wait_for_pdf(output_key: str, timeout: int = 30) -> bool:
    client = Minio(MINIO_HOST, access_key=MINIO_USER, secret_key=MINIO_PASS, secure=False)

    if not client.bucket_exists(BUCKET):
        client.make_bucket(BUCKET)
        print(f"   Bucket '{BUCKET}' creado.")

    print(f"   Esperando PDF en MinIO", end="", flush=True)
    for _ in range(timeout):
        try:
            client.stat_object(BUCKET, output_key)
            print(" ✅")
            return True
        except Exception:
            print(".", end="", flush=True)
            time.sleep(1)

    print(" ❌ timeout")
    return False


def download_pdf(output_key: str, local_path: str):
    client = Minio(MINIO_HOST, access_key=MINIO_USER, secret_key=MINIO_PASS, secure=False)
    client.fget_object(BUCKET, output_key, local_path)
    print(f"   PDF descargado → {local_path}")


# ── Main ────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--template",  default="opc_01",
                        choices=["opc_01", "opc_02", "opc_03", "opc_04",
                                 "standard", "executive", "technical", "governance"])
    parser.add_argument("--watermark", action="store_true")
    parser.add_argument("--all",       action="store_true",
                        help="Prueba los 4 templates en secuencia")
    args = parser.parse_args()

    # Cargar datos desde output.json — detiene si no existe
    data = load_output_json()

    templates = ["opc_01", "opc_02", "opc_03", "opc_04"] if args.all else [args.template]

    if args.all:
        print(f"\n📋 Generando todos los templates")

    downloaded_files = []

    for tpl in templates:
        print(f"\n{'='*55}")
        print(f"  Template: {tpl}")
        print(f"{'='*55}")

        key, filename = enqueue_job(tpl, args.watermark, data)
        ok = wait_for_pdf(key, timeout=30)

        if ok:
            download_pdf(key, filename)
            downloaded_files.append(filename)
            print(f"   Abre: {filename}")
        else:
            print("   ⚠️  El PDF no apareció en 30s — revisa logs del pdf-worker")
            print(f"   docker logs MinuetAItor-pdf-worker --tail 40")

    if len(downloaded_files) > 1:
        print(f"\n{'='*55}")
        print("📊 Resumen de archivos generados:")
        print(f"{'='*55}")
        for file in downloaded_files:
            print(f"   • {file}")
        print(f"\n   Total: {len(downloaded_files)} PDFs generados")