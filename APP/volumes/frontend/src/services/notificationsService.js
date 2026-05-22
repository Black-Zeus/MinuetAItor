import axiosInstance from "@/services/axiosInterceptor";
import { extractErrorMessage } from "@/utils/errors";

const BASE = "/v1/notifications";
const REQUEST_TIMEOUT_MS = 60000;

const isTimeoutError = (error) =>
  error?.code === "ECONNABORTED" ||
  String(error?.message || "").toLowerCase().includes("timeout");

const toNotificationError = (error, fallbackMessage) => {
  if (error?.response?.data) {
    return new Error(extractErrorMessage(error.response.data, fallbackMessage));
  }

  if (isTimeoutError(error)) {
    return new Error("La bandeja de notificaciones tardó demasiado en responder. Intenta nuevamente.");
  }

  if (error?.code === "ERR_NETWORK" || !error?.response) {
    return new Error("No fue posible conectar con el centro de notificaciones.");
  }

  return new Error(fallbackMessage);
};

const request = async (config, fallbackMessage) => {
  try {
    return await axiosInstance({
      timeout: REQUEST_TIMEOUT_MS,
      ...config,
    });
  } catch (error) {
    throw toNotificationError(error, fallbackMessage);
  }
};

const unwrap = (res) => {
  const data = res?.data ?? {};
  return data?.result ?? data;
};

export const normalizeNotificationItem = (item = {}) => {
  const actor = item?.actor || null;
  return {
    id: String(item?.id || ""),
    notificationType: item?.notificationType ?? item?.notification_type ?? "notification.info",
    level: String(item?.level || "info"),
    title: String(item?.title || "Notificacion"),
    message: String(item?.message || ""),
    tags: Array.isArray(item?.tags) ? item.tags : [],
    scopeType: item?.scopeType ?? item?.scope_type ?? null,
    scopeId: item?.scopeId ?? item?.scope_id ?? null,
    actionUrl: item?.actionUrl ?? item?.action_url ?? null,
    actor: actor
      ? {
          id: actor?.id ?? null,
          username: actor?.username ?? null,
          fullName: actor?.fullName ?? actor?.full_name ?? null,
        }
      : null,
    metadata: item?.metadata && typeof item.metadata === "object" ? item.metadata : {},
    createdAt: item?.createdAt ?? item?.created_at ?? null,
    isRead: Boolean(item?.isRead ?? item?.is_read),
    readAt: item?.readAt ?? item?.read_at ?? null,
  };
};

const normalizeListPayload = (payload = {}) => ({
  items: Array.isArray(payload?.items) ? payload.items.map(normalizeNotificationItem) : [],
  total: Number(payload?.total || 0),
  unreadCount: Number(payload?.unreadCount ?? payload?.unread_count ?? 0),
  skip: Number(payload?.skip || 0),
  limit: Number(payload?.limit || 0),
});

const normalizeNotificationPreferenceItem = (item = {}) => ({
  key: String(item?.key || ""),
  title: String(item?.title || ""),
  description: String(item?.description || ""),
  isEnabled: Boolean(item?.isEnabled ?? item?.is_enabled),
  isEditable: Boolean(item?.isEditable ?? item?.is_editable),
  isMandatory: Boolean(item?.isMandatory ?? item?.is_mandatory),
  receivesNotifications: Boolean(item?.receivesNotifications ?? item?.receives_notifications),
  disabledReason: item?.disabledReason ?? item?.disabled_reason ?? null,
  typePrefixes: Array.isArray(item?.typePrefixes ?? item?.type_prefixes)
    ? (item?.typePrefixes ?? item?.type_prefixes).map((value) => String(value || "").trim()).filter(Boolean)
    : [],
});

const normalizeNotificationPreferences = (payload = {}) => ({
  globalEnabled: Boolean(payload?.globalEnabled ?? payload?.global_enabled ?? true),
  sections: Array.isArray(payload?.sections)
    ? payload.sections.map((section) => ({
        key: String(section?.key || ""),
        title: String(section?.title || ""),
        description: String(section?.description || ""),
        items: Array.isArray(section?.items) ? section.items.map(normalizeNotificationPreferenceItem) : [],
      }))
    : [],
  totalItems: Number(payload?.totalItems ?? payload?.total_items ?? 0),
});

const notificationsService = {
  async list({ skip = 0, limit = 20, unreadOnly = false, tag = null } = {}) {
    const res = await request(
      {
        url: BASE,
        method: "get",
        params: {
          skip,
          limit,
          unreadOnly,
          ...(tag ? { tag } : {}),
        },
      },
      "No fue posible cargar la bandeja de notificaciones."
    );
    return normalizeListPayload(unwrap(res));
  },

  async getUnreadCount() {
    const res = await request(
      {
        url: `${BASE}/unread-count`,
        method: "get",
      },
      "No fue posible consultar el contador de notificaciones."
    );
    const data = unwrap(res);
    return Number(data?.count || 0);
  },

  async getTags() {
    const res = await request(
      {
        url: `${BASE}/tags`,
        method: "get",
      },
      "No fue posible cargar los tags de la bandeja."
    );
    const data = unwrap(res);
    return {
      items: Array.isArray(data?.items) ? data.items.map((item) => String(item || "").trim()).filter(Boolean) : [],
      total: Number(data?.total || 0),
    };
  },

  async getById(notificationId) {
    const res = await request(
      {
        url: `${BASE}/${encodeURIComponent(notificationId)}`,
        method: "get",
      },
      "No fue posible cargar el detalle de la notificación."
    );
    return normalizeNotificationItem(unwrap(res));
  },

  async markRead(notificationId) {
    const res = await request(
      {
        url: `${BASE}/${encodeURIComponent(notificationId)}/read`,
        method: "post",
      },
      "No fue posible marcar la notificación como leída."
    );
    const data = unwrap(res);
    return {
      notificationId: data?.notificationId ?? data?.notification_id ?? notificationId,
      isRead: Boolean(data?.isRead ?? data?.is_read ?? true),
      readAt: data?.readAt ?? data?.read_at ?? null,
    };
  },

  async markAllRead() {
    const res = await request(
      {
        url: `${BASE}/read-all`,
        method: "post",
      },
      "No fue posible marcar todas las notificaciones como leídas."
    );
    const data = unwrap(res);
    return {
      updated: Number(data?.updated || 0),
      message: String(data?.message || ""),
    };
  },

  async updateReadState(notificationIds = [], isRead = true) {
    const res = await request(
      {
        url: `${BASE}/read-state`,
        method: "post",
        data: {
          notificationIds: Array.isArray(notificationIds) ? notificationIds : [],
          isRead: Boolean(isRead),
        },
      },
      `No fue posible marcar las notificaciones como ${isRead ? "leídas" : "no leídas"}.`
    );
    const data = unwrap(res);
    return {
      updated: Number(data?.updated || 0),
      message: String(data?.message || ""),
      unreadCount: Number(data?.unreadCount ?? data?.unread_count ?? 0),
      notificationIds: Array.isArray(data?.notificationIds ?? data?.notification_ids)
        ? data?.notificationIds ?? data?.notification_ids
        : [],
      isRead: Boolean(data?.isRead ?? data?.is_read ?? isRead),
    };
  },

  async hide(notificationId) {
    const res = await request(
      {
        url: `${BASE}/${encodeURIComponent(notificationId)}/hide`,
        method: "post",
      },
      "No fue posible eliminar la notificación de la bandeja."
    );
    const data = unwrap(res);
    return {
      notificationId: data?.notificationId ?? data?.notification_id ?? notificationId,
      isHidden: Boolean(data?.isHidden ?? data?.is_hidden ?? true),
      hiddenAt: data?.hiddenAt ?? data?.hidden_at ?? null,
      unreadCount: Number(data?.unreadCount ?? data?.unread_count ?? 0),
    };
  },

  async clearInbox(notificationIds = []) {
    const res = await request(
      {
        url: `${BASE}/clear`,
        method: "post",
        data: {
          notificationIds: Array.isArray(notificationIds) ? notificationIds : [],
        },
      },
      "No fue posible limpiar la bandeja de notificaciones."
    );
    const data = unwrap(res);
    return {
      hidden: Number(data?.hidden || 0),
      message: String(data?.message || ""),
      unreadCount: Number(data?.unreadCount ?? data?.unread_count ?? 0),
      notificationIds: Array.isArray(data?.notificationIds ?? data?.notification_ids)
        ? data?.notificationIds ?? data?.notification_ids
        : [],
    };
  },

  async getPreferences() {
    const res = await request(
      {
        url: `${BASE}/preferences`,
        method: "get",
      },
      "No fue posible cargar tus preferencias de notificaciones."
    );
    return normalizeNotificationPreferences(unwrap(res));
  },

  async updatePreferences({ globalEnabled, items = [] } = {}) {
    const res = await request(
      {
        url: `${BASE}/preferences`,
        method: "put",
        data: {
          globalEnabled: Boolean(globalEnabled),
          items: Array.isArray(items)
            ? items.map((item) => ({
                key: String(item?.key || "").trim(),
                isEnabled: Boolean(item?.isEnabled ?? item?.is_enabled),
              })).filter((item) => item.key)
            : [],
        },
      },
      "No fue posible guardar tus preferencias de notificaciones."
    );
    return normalizeNotificationPreferences(unwrap(res));
  },
};

export default notificationsService;
