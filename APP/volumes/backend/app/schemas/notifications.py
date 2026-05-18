from __future__ import annotations

from pydantic import BaseModel, Field


class NotificationActorResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class NotificationItemResponse(BaseModel):
    id: str
    notification_type: str = Field(..., serialization_alias="notificationType")
    level: str
    title: str
    message: str
    tags: list[str] = []
    scope_type: str | None = Field(None, serialization_alias="scopeType")
    scope_id: str | None = Field(None, serialization_alias="scopeId")
    action_url: str | None = Field(None, serialization_alias="actionUrl")
    actor: NotificationActorResponse | None = None
    metadata: dict = {}
    created_at: str = Field(..., serialization_alias="createdAt")
    is_read: bool = Field(..., serialization_alias="isRead")
    read_at: str | None = Field(None, serialization_alias="readAt")

    model_config = {"populate_by_name": True}


class NotificationListResponse(BaseModel):
    items: list[NotificationItemResponse]
    total: int
    unread_count: int = Field(..., serialization_alias="unreadCount")
    skip: int
    limit: int

    model_config = {"populate_by_name": True}


class NotificationUnreadCountResponse(BaseModel):
    count: int


class NotificationTagsResponse(BaseModel):
    items: list[str]
    total: int


class NotificationMarkReadResponse(BaseModel):
    notification_id: str = Field(..., serialization_alias="notificationId")
    is_read: bool = Field(..., serialization_alias="isRead")
    read_at: str | None = Field(None, serialization_alias="readAt")

    model_config = {"populate_by_name": True}


class NotificationMarkAllReadResponse(BaseModel):
    updated: int
    message: str


class NotificationHideResponse(BaseModel):
    notification_id: str = Field(..., serialization_alias="notificationId")
    is_hidden: bool = Field(..., serialization_alias="isHidden")
    hidden_at: str | None = Field(None, serialization_alias="hiddenAt")
    unread_count: int = Field(..., serialization_alias="unreadCount")

    model_config = {"populate_by_name": True}


class NotificationClearResponse(BaseModel):
    hidden: int
    message: str
    unread_count: int = Field(..., serialization_alias="unreadCount")
    notification_ids: list[str] = Field(default_factory=list, serialization_alias="notificationIds")

    model_config = {"populate_by_name": True}


class NotificationClearRequest(BaseModel):
    notification_ids: list[str] = Field(default_factory=list, serialization_alias="notificationIds")

    model_config = {"populate_by_name": True}


class InternalNotificationIngestRequest(BaseModel):
    notification_type: str = Field(..., serialization_alias="notificationType")
    title: str
    message: str
    level: str = "info"
    tags: list[str] = []
    recipient_user_ids: list[str] = Field(default_factory=list, serialization_alias="recipientUserIds")
    role_codes: list[str] = Field(default_factory=list, serialization_alias="roleCodes")
    scope_type: str | None = Field(None, serialization_alias="scopeType")
    scope_id: str | None = Field(None, serialization_alias="scopeId")
    action_url: str | None = Field(None, serialization_alias="actionUrl")
    actor_user_id: str | None = Field(None, serialization_alias="actorUserId")
    metadata: dict = {}

    model_config = {"populate_by_name": True}


class InternalNotificationIngestResponse(BaseModel):
    created_notifications: int = Field(..., serialization_alias="createdNotifications")
    recipient_count: int = Field(..., serialization_alias="recipientCount")
    message: str

    model_config = {"populate_by_name": True}
