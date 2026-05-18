import React, { useEffect, useMemo, useRef, useState } from "react";

import ActionButton from "@/components/ui/button/ActionButton";
import Icon from "@/components/ui/icon/iconManager";
import ModalManager from "@/components/ui/modal";
import notificationsService, { normalizeNotificationItem } from "@/services/notificationsService";
import useNotificationsStore from "@/store/notificationsStore";
import { getNotificationTagLabel } from "@/utils/notificationTags";

const formatDateTime = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
};

const levelMeta = {
  success: {
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    icon: "FaCircleCheck",
  },
  warning: {
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    icon: "FaCircleExclamation",
  },
  error: {
    badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    icon: "FaCircleXmark",
  },
  info: {
    badge: "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300",
    icon: "FaCircleInfo",
  },
};

const NotificationDetailModal = ({ notificationId, initialNotification = null, onNavigate }) => {
  const [detail, setDetail] = useState(initialNotification ? normalizeNotificationItem(initialNotification) : null);
  const [isLoading, setIsLoading] = useState(!initialNotification);
  const [error, setError] = useState("");
  const markReadLocal = useNotificationsStore((s) => s.markReadLocal);
  const upsertNotification = useNotificationsStore((s) => s.upsertNotification);
  const hasMarkedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const loadDetail = async () => {
      setIsLoading(true);
      try {
        const data = await notificationsService.getById(notificationId);
        if (!isMounted) return;
        setDetail(data);
        upsertNotification(data);
        setError("");
      } catch (err) {
        if (!isMounted) return;
        setError(err?.message ?? "No fue posible cargar la notificacion.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadDetail();
    return () => {
      isMounted = false;
    };
  }, [notificationId, upsertNotification]);

  useEffect(() => {
    if (!detail || detail.isRead || hasMarkedRef.current) return;
    hasMarkedRef.current = true;

    const run = async () => {
      try {
        const result = await notificationsService.markRead(notificationId);
        markReadLocal(notificationId, result.readAt);
        setDetail((current) =>
          current
            ? { ...current, isRead: true, readAt: result.readAt || current.readAt }
            : current
        );
      } catch {
        hasMarkedRef.current = false;
      }
    };

    run();
  }, [detail, markReadLocal, notificationId]);

  const meta = useMemo(() => levelMeta[detail?.level] || levelMeta.info, [detail?.level]);

  return (
    <div className="flex flex-col bg-transparent">
      <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${meta.badge}`}>
                <Icon name={meta.icon} className="w-3.5 h-3.5" />
                {detail?.level === "error" ? "Error" : detail?.level === "warning" ? "Advertencia" : detail?.level === "success" ? "Completada" : "Informativa"}
              </span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {detail?.title || "Detalle de notificacion"}
            </h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {detail?.createdAt ? `Recibida el ${formatDateTime(detail.createdAt)}` : "Cargando detalle..."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => ModalManager.closeAll?.()}
            className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            aria-label="Cerrar"
          >
            <Icon name="FaXmark" className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {isLoading ? (
          <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Cargando detalle...</div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">Origen:</span>{" "}
                  <span>{detail?.actor?.fullName || detail?.actor?.username || "Sistema"}</span>
                </p>
                <p className="break-all text-sm text-gray-700 dark:text-gray-200">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">Tipo:</span>{" "}
                  <span>{detail?.notificationType || "notification.info"}</span>
                </p>
              </div>

              <div className="text-sm leading-7 text-gray-700 dark:text-gray-200">
                {detail?.message || "Sin contenido adicional."}
              </div>

              {Array.isArray(detail?.tags) && detail.tags.length > 0 ? (
                <div className="border-t border-gray-200/80 pt-4 dark:border-gray-700">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {detail.tags.map((tag) => (
                      <span
                        key={tag}
                        title={tag}
                        className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 dark:border-gray-700 dark:text-gray-300"
                      >
                        {getNotificationTagLabel(tag)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4 dark:border-gray-700">
        <ActionButton label="Cerrar" variant="soft" size="sm" onClick={() => ModalManager.closeAll?.()} />
        {detail?.actionUrl ? (
          <ActionButton
            label="Abrir recurso"
            variant="primary"
            size="sm"
            icon={<Icon name="FaArrowUpRightFromSquare" />}
            onClick={() => {
              if (typeof onNavigate === "function") {
                onNavigate(detail.actionUrl);
              }
              ModalManager.closeAll?.();
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

export const openNotificationDetailModal = ({ notificationId, notification = null, onNavigate }) => {
  const resolvedId = String(notificationId || notification?.id || "").trim();
  if (!resolvedId) return;

  ModalManager.show({
    type: "custom",
    title: "Detalle de notificacion",
    size: "large",
    showHeader: false,
    showFooter: false,
    content: (
      <NotificationDetailModal
        notificationId={resolvedId}
        initialNotification={notification}
        onNavigate={onNavigate}
      />
    ),
  });
};

export default NotificationDetailModal;
