# core/job.py
"""
Modelo base de un Job.

Todo mensaje que entra por cualquier cola DEBE cumplir este contrato.
Los handlers reciben un JobEnvelope ya validado — nunca dicts crudos.

Formato mínimo en Redis (JSON):
{
    "job_id":   "uuid-v4",          ← generado por quien encola
    "type":     "email",            ← discriminador para el dispatcher
    "queue":    "queue:email",      ← cola de origen (informativo)
    "attempt":  1,                  ← incrementado en cada reintento
    "payload":  { ... }             ← datos específicos del job type
}
"""
from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from typing import Any


@dataclass
class JobEnvelope:
    job_id:  str
    type:    str
    queue:   str
    payload: dict[str, Any]
    attempt: int = 1

    # ── Serialización ─────────────────────────────────────────────────────────

    def to_json(self) -> str:
        return json.dumps({
            "job_id":  self.job_id,
            "type":    self.type,
            "queue":   self.queue,
            "attempt": self.attempt,
            "payload": self.payload,
        })

    @classmethod
    def from_raw(cls, raw: str, queue: str) -> "JobEnvelope":
        """
        Parsea un string JSON crudo desde Redis.
        Soporta el formato legado (sin job_id / sin payload wrapper)
        para no romper jobs existentes en la cola.

        Formato nuevo:  { job_id, type, queue, attempt, payload }
        Formato legado: { type, to, subject, body, ... }
        """
        data = json.loads(raw)

        # Detectar formato legado: no tiene clave "payload"
        if "payload" not in data:
            # Migrar: todo menos "type" va al payload
            job_type = data.pop("type", "unknown")
            envelope = cls(
                job_id  = data.pop("job_id", str(uuid.uuid4())),
                type    = job_type,
                queue   = queue,
                attempt = data.pop("attempt", 1),
                payload = data,   # lo que queda son los campos del job
            )
        else:
            envelope = cls(
                job_id  = data.get("job_id", str(uuid.uuid4())),
                type    = data["type"],
                queue   = data.get("queue", queue),
                attempt = data.get("attempt", 1),
                payload = data["payload"],
            )

        return envelope

    def next_attempt(self) -> "JobEnvelope":
        """Devuelve una copia con attempt+1 para reencolar en reintento."""
        return JobEnvelope(
            job_id  = self.job_id,
            type    = self.type,
            queue   = self.queue,
            attempt = self.attempt + 1,
            payload = self.payload,
        )

    def __repr__(self) -> str:
        return (
            f"JobEnvelope(job_id={self.job_id!r}, type={self.type!r}, "
            f"queue={self.queue!r}, attempt={self.attempt})"
        )