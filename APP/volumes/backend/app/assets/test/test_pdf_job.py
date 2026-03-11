"""
test_pdf_job.py
Encola un job de prueba en queue:pdf y espera el resultado en MinIO.

Uso:
    python test_pdf_job.py                      # template opc_01, sin watermark
    python test_pdf_job.py --template opc_02    # cambiar template
    python test_pdf_job.py --watermark          # con marca BORRADOR
    python test_pdf_job.py --all                # prueba los 4 templates

Requiere:
    pip install redis minio
"""
import argparse
import json
import time
import uuid

import redis
from minio import Minio

# ── Config (ajusta si tus puertos son distintos) ───────────────────────────────
REDIS_HOST  = "redis"
REDIS_PORT  = 6379
MINIO_HOST  = "minio:9000"
MINIO_USER  = "minioadmin"       # igual a MINIO_ROOT_USER en tu .env
MINIO_PASS  = "minioadmin_change_me"       # igual a MINIO_ROOT_PASSWORD en tu .env
BUCKET      = "minuetaitor-published"

# ── Datos de prueba (mismo shape que el JSON de la IA) ────────────────────────
SAMPLE_DATA = {
    "general_info": {
        "client":               "Clínica Santa Aurora S.A.",
        "project":              "Desarrollo Web Corporativo",
        "subject":              "Reunión de Seguimiento Semanal",
        "meeting_date":         "2026-03-10",
        "scheduled_start_time": "09:00",
        "scheduled_end_time":   "10:00",
        "actual_start_time":    "09:05",
        "actual_end_time":      "10:10",
        "location":             "Microsoft Teams",
        "prepared_by":          "Juan Pérez",
    },
    "participants": {
        "invited":          [{"full_name": "Pedro Sánchez",   "initials": "PS"}],
        "attendees":        [
            {"full_name": "Juan Pérez",       "initials": "JP"},
            {"full_name": "María González",   "initials": "MG"},
            {"full_name": "Carlos Rodríguez", "initials": "CR"},
        ],
        "copy_recipients":  [{"full_name": "Ana Martínez", "initials": "AM"}],
    },
    "ai_tags": [
        {"name": "Autenticación",      "description": ""},
        {"name": "Seguimiento Semanal","description": ""},
        {"name": "Desarrollo Web",     "description": ""},
    ],
    "scope": {
        "sections": [
            {
                "section_id":    "SCOPE-001",
                "section_title": "Introducción",
                "section_type":  "introduction",
                "content": {
                    "summary": "Revisión semanal del proyecto de Desarrollo Web Corporativo.",
                    "topics_list": [
                        "Estado del módulo de autenticación",
                        "Próximos pasos en desarrollo",
                        "Bloqueos del proyecto",
                    ],
                },
            },
            {
                "section_id":    "SCOPE-002",
                "section_title": "Estado del módulo de autenticación",
                "section_type":  "topic",
                "content": {
                    "summary": "Discusión sobre avances y problemas del módulo de autenticación.",
                    "details": [
                        {"label": "En curso",  "description": "El módulo SSO está en fase de pruebas finales."},
                        {"label": "Bloqueo",   "description": "Problema con sincronización de usuarios detectado."},
                    ],
                },
            },
            {
                "section_id":    "SCOPE-003",
                "section_title": "Próximos pasos",
                "section_type":  "topic",
                "content": {
                    "summary": "Planificación de actividades para el desarrollo del proyecto web.",
                    "details": [
                        {"label": "Pendiente", "description": "Definir cronograma para implementación de nuevos módulos."},
                    ],
                },
            },
        ]
    },
    "agreements": {
        "items": [
            {
                "agreement_id": "AGR-001",
                "subject":      "Resolver bloqueo de sincronización",
                "body":         "Juan Pérez trabajará en resolver el problema de sincronización antes del viernes.",
                "responsible":  "Juan Pérez",
                "due_date":     "2026-03-14",
                "status":       "pending",
            },
            {
                "agreement_id": "AGR-002",
                "subject":      "Planificación de nuevos módulos",
                "body":         "María González coordinará la definición del cronograma.",
                "responsible":  "María González",
                "due_date":     None,
                "status":       "pending",
            },
        ]
    },
    "requirements": {
        "items": [
            {
                "requirement_id": "REQ-001",
                "entity":         "Dirección",
                "body":           "Aprobación del presupuesto para continuar con el desarrollo.",
                "responsible":    None,
                "priority":       "medium",
                "status":         "open",
            }
        ]
    },
    "upcoming_meetings": {
        "items": [
            {
                "meeting_id":     "MEET-001",
                "scheduled_date": "2026-03-17",
                "agenda":         "Revisión de resultados del deploy y avance del módulo de agenda médica.",
                "attendees":      ["Juan Pérez", "María González", "Carlos Rodríguez"],
            }
        ]
    },
    "pdf_format": {
        "cover_page":      {"enabled": True,  "subtitle": "Documento de seguimiento operacional"},
        "summary_sheet":   {"enabled": True},
        "version_control": {"enabled": True},
        "signature_page":  {
            "enabled": True,
            "signatories": [
                {"full_name": "Juan Pérez",       "role": "Preparador / Líder técnico"},
                {"full_name": "María González",   "role": "Responsable de desarrollo"},
                {"full_name": "Carlos Rodríguez", "role": "DevOps / Infraestructura"},
                {"full_name": "Ana Martínez",     "role": "Calidad / QA"},
            ],
        },
    },
}


def enqueue_job(template: str, watermark: bool) -> str:
    record_id  = str(uuid.uuid4())[:8]
    job_id     = str(uuid.uuid4())
    output_key = f"draft/{record_id}/test_{template}.pdf"

    job = {
        "job_id":          job_id,
        "type":            "minute_pdf",
        "queue":           "queue:pdf",
        "attempt":         1,
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
            "data": SAMPLE_DATA,
        },
    }

    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
    r.rpush("queue:pdf", json.dumps(job))
    print(f"✅ Job encolado | template={template} watermark={watermark}")
    print(f"   job_id     : {job_id}")
    print(f"   record_id  : {record_id}")
    print(f"   output_key : {BUCKET}/{output_key}")
    return output_key


def wait_for_pdf(output_key: str, timeout: int = 30) -> bool:
    """Espera hasta que el PDF aparezca en MinIO."""
    client = Minio(MINIO_HOST, access_key=MINIO_USER, secret_key=MINIO_PASS, secure=False)

    # Crear bucket si no existe (dev)
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


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--template",  default="opc_01",
                        choices=["opc_01","opc_02","opc_03","opc_04",
                                 "standard","executive","technical","governance"])
    parser.add_argument("--watermark", action="store_true")
    parser.add_argument("--all",       action="store_true",
                        help="Prueba los 4 templates en secuencia")
    args = parser.parse_args()

    templates = ["opc_01","opc_02","opc_03","opc_04"] if args.all else [args.template]

    for tpl in templates:
        print(f"\n{'='*55}")
        print(f"  Template: {tpl}")
        print(f"{'='*55}")
        key = enqueue_job(tpl, args.watermark)
        ok  = wait_for_pdf(key, timeout=30)
        if ok:
            local = f"test_output_{tpl}.pdf"
            download_pdf(key, local)
            print(f"   Abre: {local}")
        else:
            print("   ⚠️  El PDF no apareció en 30s — revisa logs del pdf-worker")
            print(f"   docker logs MinuetAItor-pdf-worker --tail 40")