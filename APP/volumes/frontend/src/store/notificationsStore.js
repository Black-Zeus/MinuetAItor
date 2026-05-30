import { create } from "zustand";

import { parseAppDate } from "@/utils/formats";

const PREVIEW_LIMIT = 4;

const sortByCreatedAtDesc = (items = []) =>
  [...items].sort((left, right) => {
    const leftTs = parseAppDate(left?.createdAt || 0).getTime();
    const rightTs = parseAppDate(right?.createdAt || 0).getTime();
    return rightTs - leftTs;
  });

const mergeNotification = (items, nextItem) => {
  const map = new Map(items.map((item) => [item.id, item]));
  map.set(nextItem.id, { ...(map.get(nextItem.id) || {}), ...nextItem });
  return sortByCreatedAtDesc(Array.from(map.values())).slice(0, PREVIEW_LIMIT);
};

const useNotificationsStore = create((set, get) => ({
  previewItems: [],
  unreadCount: 0,
  lastSyncAt: null,

  setPreview: (items, unreadCount = null) =>
    set(() => ({
      previewItems: sortByCreatedAtDesc(Array.isArray(items) ? items : []).slice(0, PREVIEW_LIMIT),
      unreadCount: unreadCount == null ? get().unreadCount : Number(unreadCount || 0),
      lastSyncAt: new Date().toISOString(),
    })),

  prependNotification: (item, unreadCount = null) =>
    set((state) => ({
      previewItems: mergeNotification(state.previewItems, item),
      unreadCount: unreadCount == null ? state.unreadCount + 1 : Number(unreadCount || 0),
      lastSyncAt: new Date().toISOString(),
    })),

  upsertNotification: (item) =>
    set((state) => ({
      previewItems: mergeNotification(state.previewItems, item),
      lastSyncAt: new Date().toISOString(),
    })),

  markReadLocal: (notificationId, readAt = null) =>
    set((state) => {
      const current = state.previewItems.find((item) => item.id === notificationId);
      const alreadyRead = Boolean(current?.isRead);
      return {
        previewItems: state.previewItems.map((item) =>
          item.id === notificationId
            ? { ...item, isRead: true, readAt: readAt || item.readAt || new Date().toISOString() }
            : item
        ),
        unreadCount: alreadyRead ? state.unreadCount : Math.max(0, state.unreadCount - 1),
        lastSyncAt: new Date().toISOString(),
      };
    }),

  markUnreadLocal: (notificationId) =>
    set((state) => {
      const current = state.previewItems.find((item) => item.id === notificationId);
      const wasUnread = current ? !current.isRead : false;
      return {
        previewItems: state.previewItems.map((item) =>
          item.id === notificationId
            ? { ...item, isRead: false, readAt: null }
            : item
        ),
        unreadCount: wasUnread ? state.unreadCount : state.unreadCount + (current ? 1 : 0),
        lastSyncAt: new Date().toISOString(),
      };
    }),

  markAllReadLocal: () =>
    set((state) => ({
      previewItems: state.previewItems.map((item) => ({
        ...item,
        isRead: true,
        readAt: item.readAt || new Date().toISOString(),
      })),
      unreadCount: 0,
      lastSyncAt: new Date().toISOString(),
    })),

  updateReadStateLocal: (notificationIds = [], isRead = true, unreadCount = null) =>
    set((state) => {
      const visibleIds = new Set(
        (Array.isArray(notificationIds) ? notificationIds : [])
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      );
      if (!visibleIds.size) {
        return {
          lastSyncAt: new Date().toISOString(),
        };
      }

      const nextItems = state.previewItems.map((item) =>
        visibleIds.has(item.id)
          ? { ...item, isRead: Boolean(isRead), readAt: isRead ? item.readAt || new Date().toISOString() : null }
          : item
      );

      const nextUnreadCount =
        unreadCount == null
          ? nextItems.reduce((count, item) => count + (item.isRead ? 0 : 1), 0)
          : Math.max(0, Number(unreadCount || 0));

      return {
        previewItems: nextItems,
        unreadCount: nextUnreadCount,
        lastSyncAt: new Date().toISOString(),
      };
    }),

  removeNotificationLocal: (notificationId, unreadCount = null) =>
    set((state) => {
      const current = state.previewItems.find((item) => item.id === notificationId);
      const nextItems = state.previewItems.filter((item) => item.id !== notificationId);
      const nextUnreadCount =
        unreadCount == null
          ? current && !current.isRead
            ? Math.max(0, state.unreadCount - 1)
            : state.unreadCount
          : Math.max(0, Number(unreadCount || 0));

      return {
        previewItems: nextItems,
        unreadCount: nextUnreadCount,
        lastSyncAt: new Date().toISOString(),
      };
    }),

  removeNotificationsLocal: (notificationIds = [], unreadCount = null) =>
    set((state) => {
      const visibleIds = new Set(
        (Array.isArray(notificationIds) ? notificationIds : [])
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      );
      if (!visibleIds.size) {
        return {
          lastSyncAt: new Date().toISOString(),
        };
      }

      const removedUnread = state.previewItems.reduce(
        (count, item) => (visibleIds.has(item.id) && !item.isRead ? count + 1 : count),
        0
      );

      return {
        previewItems: state.previewItems.filter((item) => !visibleIds.has(item.id)),
        unreadCount:
          unreadCount == null
            ? Math.max(0, state.unreadCount - removedUnread)
            : Math.max(0, Number(unreadCount || 0)),
        lastSyncAt: new Date().toISOString(),
      };
    }),

  setUnreadCount: (count) =>
    set(() => ({
      unreadCount: Math.max(0, Number(count || 0)),
      lastSyncAt: new Date().toISOString(),
    })),

  clear: () =>
    set({
      previewItems: [],
      unreadCount: 0,
      lastSyncAt: null,
    }),
}));

export default useNotificationsStore;
