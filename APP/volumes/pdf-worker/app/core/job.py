# core/job.py
from __future__ import annotations
import json, uuid
from dataclasses import dataclass, field
from typing import Any

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
        data = json.loads(raw)
        if "payload" not in data:
            job_type = data.pop("type", "unknown")
            return cls(job_id=data.pop("job_id", str(uuid.uuid4())),
                       type=job_type, queue=queue,
                       attempt=data.pop("attempt", 1), payload=data)
        return cls(job_id=data.get("job_id", str(uuid.uuid4())),
                   type=data["type"], queue=data.get("queue", queue),
                   attempt=data.get("attempt", 1), payload=data["payload"])

    def next_attempt(self) -> "JobEnvelope":
        return JobEnvelope(job_id=self.job_id, type=self.type,
                           queue=self.queue, attempt=self.attempt + 1,
                           payload=self.payload)