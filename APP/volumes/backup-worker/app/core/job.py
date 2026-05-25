from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class JobEnvelope:
    job_id: str
    type: str
    queue: str
    payload: dict[str, Any]
    attempt: int = 1

    @classmethod
    def from_raw(cls, raw: str, queue: str) -> "JobEnvelope":
        data = json.loads(raw)
        if "payload" not in data:
            job_type = data.pop("type", "unknown")
            return cls(
                job_id=data.pop("job_id", str(uuid.uuid4())),
                type=job_type,
                queue=data.pop("queue", queue),
                attempt=int(data.pop("attempt", 1)),
                payload=data,
            )

        return cls(
            job_id=str(data.get("job_id") or uuid.uuid4()),
            type=str(data["type"]),
            queue=str(data.get("queue") or queue),
            attempt=int(data.get("attempt") or 1),
            payload=dict(data.get("payload") or {}),
        )

    def to_json(self) -> str:
        return json.dumps(
            {
                "job_id": self.job_id,
                "type": self.type,
                "queue": self.queue,
                "attempt": self.attempt,
                "payload": self.payload,
            },
            ensure_ascii=False,
        )

    def next_attempt(self) -> "JobEnvelope":
        return JobEnvelope(
            job_id=self.job_id,
            type=self.type,
            queue=self.queue,
            payload=self.payload,
            attempt=self.attempt + 1,
        )
