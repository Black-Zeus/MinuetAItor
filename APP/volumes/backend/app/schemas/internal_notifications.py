from __future__ import annotations

from pydantic import BaseModel


class TriggerPendingPublicationRemindersResponse(BaseModel):
    sent: int
    message: str = "Reminder batch processed"
