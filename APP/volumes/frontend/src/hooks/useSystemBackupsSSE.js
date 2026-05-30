import { useEffect, useRef } from "react";

import { toastError, toastInfo, toastSuccess, toastWarn } from "@/components/common/toast/toastHelpers";
import useAuthStore from "@/store/authStore";
import useSessionStore from "@/store/sessionStore";
import { createAuthorizedEventStream } from "@/utils/authorizedEventStream";
import { isAdmin as isAdminAuthz } from "@/utils/authz";

export const SYSTEM_BACKUPS_RUNTIME_EVENT = "system-backups-runtime-update";

const SYSTEM_BACKUPS_EVENTS_URL = "/api/v1/system/backups/events";

const SCOPE_LABELS = {
  database: "Base de datos",
  objects: "Adjuntos",
  full: "Respaldo completo",
  all: "Respaldos",
};

const ACTION_LABELS = {
  db_backup: "Respaldo de base de datos",
  object_backup: "Respaldo de adjuntos",
  full_backup: "Respaldo completo",
  backup_purge: "Limpieza de respaldos",
  restore_backup: "Restauración de respaldo",
};

const STATUS_HANDLERS = {
  queued: toastInfo,
  running: toastWarn,
  success: toastSuccess,
  error: toastError,
  cancelled: toastInfo,
};

const parseEventPayload = (event) => {
  try {
    return JSON.parse(event?.data ?? "{}");
  } catch {
    return {};
  }
};

const buildToastCopy = (payload) => {
  const actionLabel = ACTION_LABELS[payload?.action] ?? SCOPE_LABELS[payload?.scope] ?? "Respaldos";
  const message = payload?.message || "Se recibió una actualización del módulo de respaldos.";
  const isManualArtifactPurge =
    payload?.action === "backup_purge" && payload?.metadata?.purgeMode === "manual_artifact";

  if (payload?.status === "running") {
    return { title: `${actionLabel} en ejecución`, message };
  }

  if (payload?.status === "success") {
    if (isManualArtifactPurge) {
      return { title: "Respaldo eliminado", message };
    }
    return { title: `${actionLabel} completado`, message };
  }

  if (payload?.status === "error") {
    if (isManualArtifactPurge) {
      return { title: "Eliminación fallida", message };
    }
    return { title: `${actionLabel} con error`, message };
  }

  if (payload?.status === "cancelled") {
    return { title: `${actionLabel} cancelado`, message };
  }

  return { title: actionLabel, message };
};

export const useSystemBackupsSSE = () => {
  const accessToken = useAuthStore((s) => s.accessToken);
  const authz = useSessionStore((s) => s.authz);
  const sourceRef = useRef(null);
  const isAdmin = isAdminAuthz(authz);

  useEffect(() => {
    if (sourceRef.current) {
      sourceRef.current.close("effect_recreate");
      sourceRef.current = null;
    }

    if (!accessToken || !isAdmin) return;

    const url = SYSTEM_BACKUPS_EVENTS_URL;
    const source = createAuthorizedEventStream(url, accessToken);
    sourceRef.current = source;

    const handleUpdate = (event) => {
      const payload = parseEventPayload(event);

      window.dispatchEvent(
        new CustomEvent(SYSTEM_BACKUPS_RUNTIME_EVENT, {
          detail: payload,
        })
      );

      const toastFn = STATUS_HANDLERS[payload?.status];
      if (!toastFn) return;

      const copy = buildToastCopy(payload);
      toastFn(copy.title, copy.message, {
        autoClose: payload?.status === "error" ? 9000 : 5000,
        toastId: `backup:${payload?.status}:${payload?.operation_id ?? payload?.job_id ?? payload?.ts ?? "event"}`,
      });
    };

    source.addEventListener("backup_update", handleUpdate);
    source.addEventListener("keepalive", () => {});
    source.onerror = () => {
      // EventSource reintenta automáticamente.
    };

    return () => {
      source.close("unmount");
      if (sourceRef.current === source) {
        sourceRef.current = null;
      }
    };
  }, [accessToken, isAdmin]);
};
