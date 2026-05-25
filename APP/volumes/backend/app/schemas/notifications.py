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


class NotificationBulkReadStateRequest(BaseModel):
    notification_ids: list[str] = Field(
        default_factory=list,
        validation_alias="notificationIds",
        serialization_alias="notificationIds",
    )
    is_read: bool = Field(
        ...,
        validation_alias="isRead",
        serialization_alias="isRead",
    )

    model_config = {"populate_by_name": True}


class NotificationBulkReadStateResponse(BaseModel):
    updated: int
    message: str
    unread_count: int = Field(..., serialization_alias="unreadCount")
    notification_ids: list[str] = Field(default_factory=list, serialization_alias="notificationIds")
    is_read: bool = Field(..., serialization_alias="isRead")

    model_config = {"populate_by_name": True}


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
    notification_ids: list[str] = Field(
        default_factory=list,
        validation_alias="notificationIds",
        serialization_alias="notificationIds",
    )

    model_config = {"populate_by_name": True}


class InternalNotificationIngestRequest(BaseModel):
    notification_type: str = Field(
        ...,
        validation_alias="notificationType",
        serialization_alias="notificationType",
    )
    title: str
    message: str
    level: str = "info"
    tags: list[str] = []
    recipient_user_ids: list[str] = Field(
        default_factory=list,
        validation_alias="recipientUserIds",
        serialization_alias="recipientUserIds",
    )
    role_codes: list[str] = Field(
        default_factory=list,
        validation_alias="roleCodes",
        serialization_alias="roleCodes",
    )
    scope_type: str | None = Field(
        None,
        validation_alias="scopeType",
        serialization_alias="scopeType",
    )
    scope_id: str | None = Field(
        None,
        validation_alias="scopeId",
        serialization_alias="scopeId",
    )
    action_url: str | None = Field(
        None,
        validation_alias="actionUrl",
        serialization_alias="actionUrl",
    )
    actor_user_id: str | None = Field(
        None,
        validation_alias="actorUserId",
        serialization_alias="actorUserId",
    )
    metadata: dict = {}
    email_enabled: bool = Field(
        False,
        validation_alias="emailEnabled",
        serialization_alias="emailEnabled",
    )
    email_to: list[str] = Field(
        default_factory=list,
        validation_alias="emailTo",
        serialization_alias="emailTo",
    )
    email_template_id: str | None = Field(
        None,
        validation_alias="emailTemplateId",
        serialization_alias="emailTemplateId",
    )
    email_subject: str | None = Field(
        None,
        validation_alias="emailSubject",
        serialization_alias="emailSubject",
    )
    email_context: dict = Field(
        default_factory=dict,
        validation_alias="emailContext",
        serialization_alias="emailContext",
    )

    model_config = {"populate_by_name": True}


class InternalNotificationIngestResponse(BaseModel):
    created_notifications: int = Field(..., serialization_alias="createdNotifications")
    recipient_count: int = Field(..., serialization_alias="recipientCount")
    message: str

    model_config = {"populate_by_name": True}


class NotificationPreferenceItemResponse(BaseModel):
    key: str
    title: str
    description: str
    is_enabled: bool = Field(..., serialization_alias="isEnabled")
    is_editable: bool = Field(..., serialization_alias="isEditable")
    is_mandatory: bool = Field(..., serialization_alias="isMandatory")
    receives_notifications: bool = Field(..., serialization_alias="receivesNotifications")
    disabled_reason: str | None = Field(None, serialization_alias="disabledReason")
    type_prefixes: list[str] = Field(default_factory=list, serialization_alias="typePrefixes")

    model_config = {"populate_by_name": True}


class NotificationPreferenceSectionResponse(BaseModel):
    key: str
    title: str
    description: str
    items: list[NotificationPreferenceItemResponse] = Field(default_factory=list)


class NotificationPreferencesResponse(BaseModel):
    global_enabled: bool = Field(..., serialization_alias="globalEnabled")
    sections: list[NotificationPreferenceSectionResponse] = Field(default_factory=list)
    total_items: int = Field(..., serialization_alias="totalItems")

    model_config = {"populate_by_name": True}


class NotificationPreferenceUpdateItemRequest(BaseModel):
    key: str
    is_enabled: bool = Field(
        ...,
        validation_alias="isEnabled",
        serialization_alias="isEnabled",
    )

    model_config = {"populate_by_name": True}


class NotificationPreferencesUpdateRequest(BaseModel):
    global_enabled: bool | None = Field(
        None,
        validation_alias="globalEnabled",
        serialization_alias="globalEnabled",
    )
    items: list[NotificationPreferenceUpdateItemRequest] = Field(default_factory=list)

    model_config = {"populate_by_name": True}
