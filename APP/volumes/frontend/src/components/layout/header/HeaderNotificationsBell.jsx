import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { toastError, toastSuccess } from "@/components/common/toast/toastHelpers";
import ActionButton from "@/components/ui/button/ActionButton";
import Icon from "@/components/ui/icon/iconManager";
import ModalManager from "@/components/ui/modal";
import notificationsService from "@/services/notificationsService";
import useNotificationsStore from "@/store/notificationsStore";
import { openNotificationDetailModal } from "@/pages/notifications/NotificationDetailModal";
import { formatNullableDateTime as formatDateTime } from "@/utils/formats";

const unreadRowClass =
  "border-l-2 border-l-primary-400 bg-primary-500/[0.05] dark:border-l-primary-300 dark:bg-primary-400/[0.07]";

const HeaderNotificationsBell = () => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [busyNotificationId, setBusyNotificationId] = useState("");
  const previewItems = useNotificationsStore((s) => s.previewItems);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const setPreview = useNotificationsStore((s) => s.setPreview);
  const markReadLocal = useNotificationsStore((s) => s.markReadLocal);
  const removeNotificationLocal = useNotificationsStore((s) => s.removeNotificationLocal);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const refreshPreview = async () => {
    setIsBusy(true);
    try {
      const snapshot = await notificationsService.list({ limit: 4 });
      setPreview(snapshot.items, snapshot.unreadCount);
    } catch {
      // Mantener el dropdown usable aunque falle la recarga manual.
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggle = async () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) {
      await refreshPreview();
    }
  };

  const handleOpenNotification = (notification) => {
    if (!notification?.isRead) {
      markReadLocal(notification.id);
    }
    setIsOpen(false);
    openNotificationDetailModal({
      notification,
      onNavigate: (to) => navigate(to),
    });
  };

  const handleHideNotification = async (event, notificationId) => {
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
      toastSuccess("Notificación eliminada", "La entrada fue eliminada de tu bandeja.");
    } catch (err) {
      toastError("No se pudo eliminar", err?.message ?? "La notificación sigue visible en tu bandeja.");
    } finally {
      setBusyNotificationId("");
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
        aria-label="Abrir notificaciones"
        aria-expanded={isOpen}
      >
        <Icon name="FaBell" className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-full z-50 mt-3 w-[24rem] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4 dark:border-gray-700">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Notificaciones</p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Ultimas 4 entradas del sistema
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={refreshPreview}
                className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                aria-label="Actualizar notificaciones"
              >
                <Icon name="rotate" className={`h-3.5 w-3.5 ${isBusy ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {previewItems.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500">
                <Icon name="FaInbox" className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Sin notificaciones recientes</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Aqui apareceran los eventos que te impacten.
              </p>
            </div>
          ) : (
            <div className="max-h-[28rem] overflow-y-auto">
              {previewItems.map((notification) => (
                <div
                  key={notification.id}
                  className={`group flex items-start gap-2 border-b border-gray-100 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40 ${
                    notification.isRead ? "" : unreadRowClass
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleOpenNotification(notification)}
                    className="min-w-0 flex-1 px-4 py-4 text-left"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 h-2.5 w-2.5 rounded-full ${notification.isRead ? "bg-gray-300 dark:bg-gray-600" : "bg-primary-400 dark:bg-primary-300"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className={`truncate text-sm font-semibold ${notification.isRead ? "text-gray-700 dark:text-gray-200" : "text-gray-900 dark:text-gray-100"}`}>
                            {notification.title}
                          </p>
                          <span className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">
                            {formatDateTime(notification.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                          {notification.message}
                        </p>
                      </div>
                    </div>
                  </button>
                  <div className="pr-3 pt-3">
                    <button
                      type="button"
                      onClick={(event) => handleHideNotification(event, notification.id)}
                      disabled={isBusy || busyNotificationId === notification.id}
                      className="rounded-xl p-2 text-gray-400 transition hover:bg-white/70 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                      aria-label="Eliminar notificación"
                      title="Eliminar de la bandeja"
                    >
                      <Icon
                        name={busyNotificationId === notification.id ? "spinner" : "FaTrash"}
                        className={`h-3.5 w-3.5 ${busyNotificationId === notification.id ? "animate-spin" : ""}`}
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 px-4 py-3 dark:border-gray-700">
            <ActionButton
              label="Ver todas"
              variant="primary"
              size="sm"
              icon={<Icon name="FaInbox" />}
              onClick={() => {
                setIsOpen(false);
                navigate("/notifications");
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default HeaderNotificationsBell;
