import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { toastError, toastInfo, toastSuccess } from "@/components/common/toast/toastHelpers";
import ActionButton from "@/components/ui/button/ActionButton";
import Icon from "@/components/ui/icon/iconManager";
import ModalManager from "@/components/ui/modal";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import notificationsService from "@/services/notificationsService";
import useNotificationsStore from "@/store/notificationsStore";
import { getNotificationTagLabel } from "@/utils/notificationTags";
import { openNotificationDetailModal } from "@/pages/notifications/NotificationDetailModal";
import { formatDateTime as formatUserDateTime } from "@/utils/formats";

const LIST_LIMIT = 20;
const NOTIFICATIONS_CENTER_EVENT = "notifications-center-updated";

const formatDateTime = (value) => {
  if (!value) return "—";
  return formatUserDateTime(value);
};

const levelAccent = {
  success: "border-emerald-300/70",
  warning: "border-amber-300/70",
  error: "border-red-300/70",
  info: "border-primary-300/70",
};

const unreadRowClass =
  "border-l-2 border-l-primary-400 bg-primary-500/[0.05] dark:border-l-primary-300 dark:bg-primary-400/[0.07]";

const selectionCheckboxClass =
  "h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800";

const NotificationsInbox = () => {
  const navigate = useNavigate();
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const markAllReadLocal = useNotificationsStore((s) => s.markAllReadLocal);
  const markReadLocal = useNotificationsStore((s) => s.markReadLocal);
  const updateReadStateLocal = useNotificationsStore((s) => s.updateReadStateLocal);
  const removeNotificationLocal = useNotificationsStore((s) => s.removeNotificationLocal);
  const removeNotificationsLocal = useNotificationsStore((s) => s.removeNotificationsLocal);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedTag, setSelectedTag] = useState("");
  const [availableTags, setAvailableTags] = useState([]);
  const [tagsTotal, setTagsTotal] = useState(0);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [error, setError] = useState("");
  const [busyNotificationId, setBusyNotificationId] = useState("");
  const [isClearing, setIsClearing] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("");
  const listRequestRef = useRef(0);
  const tagsRequestRef = useRef(0);
  const tagsTimerRef = useRef(null);

  useDocumentTitle("Notificaciones");

  const loadNotifications = async ({
    reset = true,
    forceUnreadOnly = unreadOnly,
    forceTag = selectedTag,
  } = {}) => {
    const requestId = Date.now();
    listRequestRef.current = requestId;
    const currentSkip = reset ? 0 : items.length;
    if (reset) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const result = await notificationsService.list({
        skip: currentSkip,
        limit: LIST_LIMIT,
        unreadOnly: forceUnreadOnly,
        tag: forceTag || null,
      });
      if (listRequestRef.current !== requestId) return null;
      setItems((prev) => (reset ? result.items : [...prev, ...result.items]));
      setTotal(result.total);
      setError("");
      return result;
    } catch (err) {
      if (listRequestRef.current !== requestId) return null;
      setError(err?.message ?? "No fue posible cargar la bandeja.");
      return null;
    } finally {
      if (listRequestRef.current === requestId) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  };

  const loadAvailableTags = async ({ delayMs = 0 } = {}) => {
    if (tagsTimerRef.current) {
      window.clearTimeout(tagsTimerRef.current);
      tagsTimerRef.current = null;
    }

    const run = async () => {
      const requestId = Date.now();
      tagsRequestRef.current = requestId;
      setIsLoadingTags(true);

      try {
        const result = await notificationsService.getTags();
        if (tagsRequestRef.current !== requestId) return;
        const tagItems = Array.isArray(result?.items) ? result.items : [];
        setAvailableTags(
          selectedTag && !tagItems.includes(selectedTag)
            ? [selectedTag, ...tagItems]
            : tagItems
        );
        setTagsTotal(Number(result?.total || 0));
      } catch {
        if (tagsRequestRef.current !== requestId) return;
        setAvailableTags((prev) =>
          selectedTag && !prev.includes(selectedTag) ? [selectedTag, ...prev] : prev
        );
      } finally {
        if (tagsRequestRef.current === requestId) {
          setIsLoadingTags(false);
        }
      }
    };

    if (delayMs > 0) {
      tagsTimerRef.current = window.setTimeout(run, delayMs);
      return;
    }

    await run();
  };

  useEffect(() => {
    let isCancelled = false;

    const hydrate = async () => {
      const result = await loadNotifications({
        reset: true,
        forceUnreadOnly: unreadOnly,
        forceTag: selectedTag,
      });
      if (isCancelled) return;
      if ((result?.total || 0) <= 0) {
        setAvailableTags(selectedTag ? [selectedTag] : []);
        setTagsTotal(selectedTag ? 1 : 0);
        return;
      }
      loadAvailableTags({ delayMs: 250 });
    };

    hydrate();

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTag, unreadOnly]);

  useEffect(() => {
    const handleExternalUpdate = () => {
      loadNotifications({ reset: true, forceUnreadOnly: unreadOnly, forceTag: selectedTag });
      loadAvailableTags({ delayMs: 500 });
    };
    window.addEventListener(NOTIFICATIONS_CENTER_EVENT, handleExternalUpdate);
    return () => window.removeEventListener(NOTIFICATIONS_CENTER_EVENT, handleExternalUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTag, unreadOnly]);

  useEffect(() => () => {
    if (tagsTimerRef.current) {
      window.clearTimeout(tagsTimerRef.current);
    }
  }, []);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => items.some((item) => item.id === id)));
  }, [items]);

  const handleOpen = (notification) => {
    if (!notification?.isRead) {
      markReadLocal(notification.id);
      if (unreadOnly) {
        setItems((prev) => prev.filter((item) => item.id !== notification.id));
        setTotal((prev) => Math.max(0, prev - 1));
      } else {
        setItems((prev) =>
          prev.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item))
        );
      }
    }

    openNotificationDetailModal({
      notification,
      onNavigate: (to) => navigate(to),
    });
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsService.markAllRead();
      markAllReadLocal();
      if (unreadOnly) {
        setItems([]);
        setTotal(0);
      } else {
        setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
      }
      await loadNotifications({ reset: true, forceUnreadOnly: unreadOnly, forceTag: selectedTag });
      loadAvailableTags({ delayMs: 0 });
    } catch (err) {
      setError(err?.message ?? "No fue posible marcar las notificaciones.");
    }
  };

  const visibleIds = items.map((item) => item.id).filter(Boolean);
  const selectedVisibleIds = selectedIds.filter((id) => visibleIds.includes(id));
  const selectedCount = selectedVisibleIds.length;
  const allVisibleSelected = visibleIds.length > 0 && selectedCount === visibleIds.length;
  const hasPartialSelection = selectedCount > 0 && !allVisibleSelected;

  const toggleSelection = (notificationId) => {
    setSelectedIds((prev) =>
      prev.includes(notificationId)
        ? prev.filter((id) => id !== notificationId)
        : [...prev, notificationId]
    );
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      if (allVisibleSelected) {
        return prev.filter((id) => !visibleIds.includes(id));
      }
      const next = new Set(prev);
      visibleIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  };

  const clearSelection = () => setSelectedIds([]);

  const handleBulkReadState = async (isRead) => {
    if (!selectedVisibleIds.length) return;
    setBulkAction(isRead ? "read" : "unread");
    try {
      const result = await notificationsService.updateReadState(selectedVisibleIds, isRead);
      updateReadStateLocal(result.notificationIds, result.isRead, result.unreadCount);
      if (unreadOnly && result.isRead) {
        const affectedIds = new Set(result.notificationIds || []);
        setItems((prev) => prev.filter((item) => !affectedIds.has(item.id)));
        setTotal((prev) => Math.max(0, prev - affectedIds.size));
      } else {
        setItems((prev) =>
          prev.map((item) =>
            result.notificationIds.includes(item.id)
              ? { ...item, isRead: result.isRead, readAt: result.isRead ? item.readAt || new Date().toISOString() : null }
              : item
          )
        );
      }
      clearSelection();
      await loadNotifications({ reset: true, forceUnreadOnly: unreadOnly, forceTag: selectedTag });
      loadAvailableTags({ delayMs: 0 });
      toastSuccess(
        isRead ? "Notificaciones marcadas como leídas" : "Notificaciones marcadas como no leídas",
        result.message || "La selección fue actualizada correctamente."
      );
    } catch (err) {
      toastError(
        isRead ? "No se pudo marcar como leídas" : "No se pudo marcar como no leídas",
        err?.message ?? "Intenta nuevamente."
      );
    } finally {
      setBulkAction("");
    }
  };

  const handleHide = async (event, notificationId) => {
    event.stopPropagation();
    if (!notificationId) return;

    const confirmed = await ModalManager.confirm({
      title: "Eliminar notificación",
      message: "¿Quieres eliminar esta notificación de tu bandeja?",
      description: "La acción se aplica sobre tu vista visible y mantiene trazabilidad interna.",
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      variant: "danger",
    });
    if (!confirmed) return;

    setBusyNotificationId(notificationId);
    try {
      const result = await notificationsService.hide(notificationId);
      removeNotificationLocal(result.notificationId, result.unreadCount);
      setItems((prev) => prev.filter((item) => item.id !== result.notificationId));
      setTotal((prev) => Math.max(0, prev - 1));
      loadAvailableTags({ delayMs: 300 });
      toastSuccess("Notificación eliminada", "La entrada fue eliminada de tu bandeja.");
    } catch (err) {
      toastError("No se pudo eliminar", err?.message ?? "La notificación sigue visible en tu bandeja.");
    } finally {
      setBusyNotificationId("");
    }
  };

  const handleClearInbox = async () => {
    const visibleIds = items.map((item) => item.id).filter(Boolean);
    if (!visibleIds.length) return;

    setIsClearing(true);
    try {
      const result = await notificationsService.clearInbox(visibleIds);
      removeNotificationsLocal(result.notificationIds, result.unreadCount);
      setItems((prev) => {
        const hiddenIds = new Set(result.notificationIds || []);
        return prev.filter((item) => !hiddenIds.has(item.id));
      });
      setTotal((prev) => Math.max(0, prev - result.hidden));
      loadAvailableTags({ delayMs: 300 });
      toastInfo("Bandeja limpiada", result.message || "Las entradas visibles fueron apartadas de tu bandeja.");
    } catch (err) {
      toastError("No se pudo limpiar la bandeja", err?.message ?? "Intenta nuevamente.");
    } finally {
      setIsClearing(false);
    }
  };

  const handleBulkClear = async () => {
    if (!selectedVisibleIds.length) return;

    const confirmed = await ModalManager.confirm({
      title: "Eliminar selección",
      message: "¿Quieres eliminar las notificaciones seleccionadas de tu bandeja?",
      description: "La acción se aplicará solo sobre la selección visible según tus filtros actuales.",
      confirmText: "Eliminar selección",
      cancelText: "Cancelar",
      variant: "danger",
    });
    if (!confirmed) return;

    setBulkAction("delete");
    try {
      const result = await notificationsService.clearInbox(selectedVisibleIds);
      const hiddenIds = new Set(result.notificationIds || []);
      removeNotificationsLocal(result.notificationIds, result.unreadCount);
      setItems((prev) => prev.filter((item) => !hiddenIds.has(item.id)));
      setTotal((prev) => Math.max(0, prev - result.hidden));
      clearSelection();
      loadAvailableTags({ delayMs: 300 });
      toastInfo("Selección eliminada", result.message || "Las notificaciones seleccionadas fueron eliminadas.");
    } catch (err) {
      toastError("No se pudo eliminar la selección", err?.message ?? "Intenta nuevamente.");
    } finally {
      setBulkAction("");
    }
  };

  const canLoadMore = items.length < total;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-semibold text-gray-900 dark:text-white">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
                <Icon name="FaBell" className="h-4 w-4" />
              </span>
              Bandeja de notificaciones
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Centro unificado para actividad de minutas, permisos, correo y eventos del sistema.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setUnreadOnly((prev) => !prev)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                unreadOnly
                  ? "border-primary-400 bg-primary-100/80 text-primary-800 dark:border-primary-500 dark:bg-primary-900/30 dark:text-primary-200"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700/60"
              }`}
            >
              <Icon name="FaFilter" className="h-3.5 w-3.5" />
              {unreadOnly ? "Mostrando solo no leidas" : "Filtrar no leidas"}
            </button>
            <ActionButton
              label="Actualizar"
              variant="soft"
              size="sm"
              icon={<Icon name="rotate" />}
              onClick={() => loadNotifications({ reset: true, forceUnreadOnly: unreadOnly, forceTag: selectedTag })}
            />
            <ActionButton
              label={`Marcar todo leido${unreadCount ? ` (${unreadCount})` : ""}`}
              variant="soft"
              size="sm"
              icon={<Icon name="FaCheck" />}
              onClick={handleMarkAllRead}
            />
            <ActionButton
              label="Limpiar bandeja"
              variant="soft"
              size="sm"
              icon={<Icon name="FaTrash" />}
              onClick={handleClearInbox}
              disabled={isClearing || items.length === 0}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-gray-100 pt-4 dark:border-gray-700">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Tags {tagsTotal > 0 ? `(${tagsTotal})` : ""}:
            </span>

              {availableTags.length > 0 ? (
              availableTags.slice(0, 24).map((tag) => {
                const isActive = tag === selectedTag;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag((prev) => (prev === tag ? "" : tag))}
                    className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      isActive
                        ? "border-primary-400 bg-primary-100/80 text-primary-800 dark:border-primary-500 dark:bg-primary-900/30 dark:text-primary-200"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700/60"
                    }`}
                  >
                    {getNotificationTagLabel(tag)}
                  </button>
                );
              })
            ) : (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {isLoadingTags ? "Cargando tags..." : "No hay tags disponibles en tu bandeja."}
              </span>
            )}

            {selectedTag ? (
              <button
                type="button"
                onClick={() => setSelectedTag("")}
                className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-1 text-xs font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              >
                <Icon name="FaXmark" className="h-3 w-3" />
                Quitar filtro
              </button>
            ) : null}
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Selecciona un tag para filtrar la bandeja por esa categoría.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                className={selectionCheckboxClass}
                checked={allVisibleSelected}
                ref={(element) => {
                  if (element) {
                    element.indeterminate = hasPartialSelection;
                  }
                }}
                onChange={toggleSelectAllVisible}
                disabled={items.length === 0}
              />
              Seleccionar visibles
            </label>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {selectedCount > 0
                ? `${selectedCount} seleccionada${selectedCount === 1 ? "" : "s"}`
                : "Selecciona filas para aplicar acciones masivas"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ActionButton
              label="Marcar leídas"
              variant="soft"
              size="sm"
              icon={<Icon name="FaCheck" />}
              onClick={() => handleBulkReadState(true)}
              disabled={selectedCount === 0 || bulkAction !== ""}
            />
            <ActionButton
              label="Marcar no leídas"
              variant="soft"
              size="sm"
              icon={<Icon name="FaEnvelope" />}
              onClick={() => handleBulkReadState(false)}
              disabled={selectedCount === 0 || bulkAction !== ""}
            />
            <ActionButton
              label="Eliminar"
              variant="soft"
              size="sm"
              icon={<Icon name="FaTrash" />}
              onClick={handleBulkClear}
              disabled={selectedCount === 0 || bulkAction !== ""}
            />
            <ActionButton
              label="Limpiar selección"
              variant="soft"
              size="sm"
              icon={<Icon name="FaXmark" />}
              onClick={clearSelection}
              disabled={selectedCount === 0 || bulkAction !== ""}
            />
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {isLoading ? (
          <div className="px-6 py-14 text-center text-sm text-gray-500 dark:text-gray-400">Cargando notificaciones...</div>
        ) : items.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500">
              <Icon name="FaInbox" className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">No hay notificaciones para mostrar.</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Cuando el sistema procese tareas o cambien tus permisos, apareceran aqui.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {items.map((notification) => (
              <div
                key={notification.id}
                className={`group flex gap-3 px-3 transition hover:bg-gray-50 dark:hover:bg-gray-700/40 ${
                  notification.isRead ? "" : unreadRowClass
                }`}
              >
                <div className="flex items-start pt-5 pl-2">
                  <input
                    type="checkbox"
                    className={selectionCheckboxClass}
                    checked={selectedIds.includes(notification.id)}
                    onChange={() => toggleSelection(notification.id)}
                    aria-label={`Seleccionar notificación ${notification.title}`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleOpen(notification)}
                  className="min-w-0 flex-1 px-3 py-5 text-left"
                >
                  <div className="flex gap-4">
                    <div
                      className={`mt-1 h-3.5 w-3.5 rounded-full border ${
                        notification.isRead
                          ? "border-gray-300 bg-transparent dark:border-gray-600"
                          : levelAccent[notification.level] || levelAccent.info
                      } ${notification.isRead ? "" : "bg-primary-400 dark:bg-primary-300"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <p className={`truncate text-sm font-semibold ${notification.isRead ? "text-gray-700 dark:text-gray-200" : "text-gray-900 dark:text-gray-100"}`}>
                            {notification.title}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
                            {notification.message}
                          </p>
                        </div>
                        <div className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                          {formatDateTime(notification.createdAt)}
                        </div>
                      </div>

                      {Array.isArray(notification.tags) && notification.tags.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {notification.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              title={tag}
                              className="inline-flex items-center rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400"
                            >
                              {getNotificationTagLabel(tag)}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </button>
                <div className="pt-5">
                  <button
                    type="button"
                    onClick={(event) => handleHide(event, notification.id)}
                    disabled={busyNotificationId === notification.id}
                    className="rounded-xl p-2 text-gray-400 transition hover:bg-white/70 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                    aria-label="Eliminar notificación"
                    title="Eliminar de la bandeja"
                  >
                    <Icon
                      name={busyNotificationId === notification.id ? "spinner" : "FaTrash"}
                      className={`h-4 w-4 ${busyNotificationId === notification.id ? "animate-spin" : ""}`}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {canLoadMore ? (
        <div className="flex justify-center">
          <ActionButton
            label={isLoadingMore ? "Cargando..." : "Cargar mas"}
            variant="soft"
            size="sm"
            icon={<Icon name="FaChevronDown" />}
            onClick={() => loadNotifications({ reset: false, forceUnreadOnly: unreadOnly, forceTag: selectedTag })}
            disabled={isLoadingMore}
          />
        </div>
      ) : null}
    </div>
  );
};

export default NotificationsInbox;
