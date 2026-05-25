import { useEffect, useRef } from "react";

import { toastError, toastInfo, toastSuccess, toastWarn } from "@/components/common/toast/toastHelpers";
import useAuthStore from "@/store/authStore";
import useNotificationsStore from "@/store/notificationsStore";
import notificationsService, { normalizeNotificationItem } from "@/services/notificationsService";

const NOTIFICATIONS_EVENTS_URL = "/api/v1/notifications/events";
const NOTIFICATIONS_CENTER_EVENT = "notifications-center-updated";
const NOTIFICATIONS_PAGE_PATH = "/notifications";

const toastByLevel = {
  success: toastSuccess,
  warning: toastWarn,
  error: toastError,
  info: toastInfo,
};

const SUPPRESSED_TOAST_NOTIFICATION_TYPES = new Set([
  "minute.analysis.completed",
  "minute.analysis.failed",
  "system.backup.completed",
  "system.backup.failed",
  "system.backup.cancelled",
]);

const SUPPRESSED_TOAST_NOTIFICATION_TAGS = new Set([
  "minute.analysis.email.sent",
]);

const shouldToastNotification = (item = {}) => {
  const notificationType = String(item?.notificationType || "").trim();
  if (SUPPRESSED_TOAST_NOTIFICATION_TYPES.has(notificationType)) {
    return false;
  }

  const tags = Array.isArray(item?.tags) ? item.tags : [];
  return !tags.some((tag) => SUPPRESSED_TOAST_NOTIFICATION_TAGS.has(String(tag || "").trim()));
};

const parseEventPayload = (event) => {
  try {
    return JSON.parse(event?.data ?? "{}");
  } catch {
    return {};
  }
};

export const useNotificationsSSE = () => {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setPreview = useNotificationsStore((s) => s.setPreview);
  const prependNotification = useNotificationsStore((s) => s.prependNotification);
  const markReadLocal = useNotificationsStore((s) => s.markReadLocal);
  const markAllReadLocal = useNotificationsStore((s) => s.markAllReadLocal);
  const updateReadStateLocal = useNotificationsStore((s) => s.updateReadStateLocal);
  const removeNotificationLocal = useNotificationsStore((s) => s.removeNotificationLocal);
  const removeNotificationsLocal = useNotificationsStore((s) => s.removeNotificationsLocal);
  const clear = useNotificationsStore((s) => s.clear);
  const sourceRef = useRef(null);

  useEffect(() => {
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }

    if (!accessToken) {
      clear();
      return;
    }

    let isCancelled = false;

    const hydratePreview = async () => {
      const currentPath = window.location?.pathname || "";
      if (currentPath === NOTIFICATIONS_PAGE_PATH) {
        return;
      }
      try {
        const snapshot = await notificationsService.list({ limit: 4 });
        if (!isCancelled) {
          setPreview(snapshot.items, snapshot.unreadCount);
        }
      } catch {
        if (!isCancelled) {
          clear();
        }
      }
    };

    hydratePreview();

    const url = `${NOTIFICATIONS_EVENTS_URL}?token=${encodeURIComponent(accessToken)}`;
    const source = new EventSource(url);
    sourceRef.current = source;

    const notifyUi = (payload = {}) => {
      window.dispatchEvent(
        new CustomEvent(NOTIFICATIONS_CENTER_EVENT, {
          detail: payload,
        })
      );
    };

    source.addEventListener("notification_created", (event) => {
      const payload = parseEventPayload(event);
      const item = normalizeNotificationItem(payload?.notification || {});
      if (!item.id) return;

      prependNotification(item, payload?.unread_count ?? payload?.unreadCount ?? null);
      notifyUi(payload);

      if (!shouldToastNotification(item)) {
        return;
      }

      const toastFn = toastByLevel[item.level] || toastInfo;
      toastFn(item.title, item.message, {
        autoClose: item.level === "error" ? 9000 : 6000,
        toastId: `notification-created:${item.id}`,
      });
    });

    source.addEventListener("notification_read", (event) => {
      const payload = parseEventPayload(event);
      const notificationId = payload?.notification_id ?? payload?.notificationId;
      if (!notificationId) return;
      markReadLocal(notificationId, payload?.read_at ?? payload?.readAt ?? null);
      notifyUi(payload);
    });

    source.addEventListener("notifications_read_all", (event) => {
      const payload = parseEventPayload(event);
      markAllReadLocal();
      notifyUi(payload);
    });

    source.addEventListener("notifications_read_state_updated", (event) => {
      const payload = parseEventPayload(event);
      updateReadStateLocal(
        payload?.notification_ids ?? payload?.notificationIds ?? [],
        payload?.is_read ?? payload?.isRead ?? true,
        payload?.unread_count ?? payload?.unreadCount ?? null
      );
      notifyUi(payload);
    });

    source.addEventListener("notification_hidden", (event) => {
      const payload = parseEventPayload(event);
      const notificationId = payload?.notification_id ?? payload?.notificationId;
      if (!notificationId) return;
      removeNotificationLocal(notificationId, payload?.unread_count ?? payload?.unreadCount ?? null);
      notifyUi(payload);
    });

    source.addEventListener("notifications_cleared", (event) => {
      const payload = parseEventPayload(event);
      removeNotificationsLocal(
        payload?.notification_ids ?? payload?.notificationIds ?? [],
        payload?.unread_count ?? payload?.unreadCount ?? 0
      );
      notifyUi(payload);
    });

    source.addEventListener("keepalive", () => {});
    source.onerror = () => {};

    return () => {
      isCancelled = true;
      source.close();
      if (sourceRef.current === source) {
        sourceRef.current = null;
      }
    };
  }, [
    accessToken,
    clear,
    markAllReadLocal,
    markReadLocal,
    prependNotification,
    removeNotificationLocal,
    removeNotificationsLocal,
    setPreview,
    updateReadStateLocal,
  ]);
};
