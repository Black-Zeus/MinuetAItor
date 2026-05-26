# core/job.py
from __future__ import annotations
import json
import re
import uuid
from dataclasses import dataclass
from typing import Any

MAX_ATTEMPT = 20
SAFE_TOKEN_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,80}$")


def _clean_queue(value: Any) -> str:
    if isinstance(value, bytes):
        value = value.decode("utf-8", errors="strict")
    queue = str(value or "").strip()
    if not SAFE_TOKEN_RE.fullmatch(queue):
        raise ValueError("Cola de Redis inválida.")
    return queue


def _clean_type(value: Any) -> str:
    job_type = str(value or "").strip()
    if not SAFE_TOKEN_RE.fullmatch(job_type):
        raise ValueError("Tipo de job inválido.")
    return job_type


def _clean_attempt(value: Any) -> int:
    attempt = int(value or 1)
    if attempt < 1 or attempt > MAX_ATTEMPT:
        raise ValueError("Intento de job fuera de rango.")
    return attempt


@dataclass
class JobEnvelope:
    job_id:  str
    type:    str
    queue:   str
    payload: dict[str, Any]
    attempt: int = 1

    def to_json(self) -> str:
        return json.dumps({"job_id": self.job_id, "type": self.type,
                           "queue": self.queue, "attempt": self.attempt,
                           "payload": self.payload})

    @classmethod
    def from_raw(cls, raw: str, queue: str) -> "JobEnvelope":
        queue_name = _clean_queue(queue)
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise ValueError("El job debe ser un objeto JSON.")
        if "payload" not in data:
            job_type = data.pop("type", "unknown")
            return cls(job_id=data.pop("job_id", str(uuid.uuid4())),
                       type=_clean_type(job_type), queue=queue_name,
                       attempt=_clean_attempt(data.pop("attempt", 1)), payload=data)
        payload = data["payload"]
        if not isinstance(payload, dict):
            raise ValueError("El payload del job debe ser un objeto JSON.")
        return cls(job_id=data.get("job_id", str(uuid.uuid4())),
                   type=_clean_type(data["type"]), queue=queue_name,
                   attempt=_clean_attempt(data.get("attempt", 1)), payload=payload)

    def next_attempt(self) -> "JobEnvelope":
        return JobEnvelope(job_id=self.job_id, type=self.type,
                           queue=self.queue, attempt=self.attempt + 1,
                           payload=self.payload)
