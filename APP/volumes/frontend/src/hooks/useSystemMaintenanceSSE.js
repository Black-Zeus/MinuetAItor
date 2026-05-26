import { useEffect, useRef } from "react";

import { toastError, toastInfo, toastSuccess, toastWarn } from "@/components/common/toast/toastHelpers";
import useAuthStore from "@/store/authStore";
import useSessionStore from "@/store/sessionStore";
import { createAuthorizedEventStream } from "@/utils/authorizedEventStream";

const SYSTEM_MAINTENANCE_EVENTS_URL = "/api/v1/system/maintenance/events";
const SYSTEM_MAINTENANCE_RUNTIME_EVENT = "system-maintenance-runtime-update";
export const SYSTEM_MAINTENANCE_SSE_STATE_EVENT = "system-maintenance-sse-state";

const SCOPE_LABELS = {
  session_cleanup: "Limpieza de sesiones",
  temp_cleanup: "Limpieza de temporales",
};

const STATUS_HANDLERS = {
  queued: toastInfo,
  running: toastWarn,
  success: toastSuccess,
  error: toastError,
};

const parseEventPayload = (event) => {
  try {
    return JSON.parse(event?.data ?? "{}");
  } catch {
    return {};
  }
};

const buildToastCopy = (payload) => {
  const scopeLabel = SCOPE_LABELS[payload?.scope] ?? "Rutina de mantenimiento";
  const message = payload?.message || "Se recibió una actualización de mantenimiento.";
  const affectedCount = typeof payload?.affected_count === "number" ? payload.affected_count : null;

  if (payload?.status === "queued") {
    return {
      title: `${scopeLabel} en cola`,
      message,
    };
  }

  if (payload?.status === "running") {
    return {
      title: `${scopeLabel} en ejecución`,
      message,
    };
  }

  if (payload?.status === "success") {
    return {
      title: `${scopeLabel} completada`,
      message:
        affectedCount == null
          ? message
          : `${message} Registros afectados: ${affectedCount}.`,
    };
  }

  if (payload?.status === "error") {
    return {
      title: `${scopeLabel} con error`,
      message,
    };
  }

  return {
    title: scopeLabel,
    message,
  };
};

const dispatchConnectionState = (connected) => {
  window.dispatchEvent(
    new CustomEvent(SYSTEM_MAINTENANCE_SSE_STATE_EVENT, {
      detail: { connected: Boolean(connected) },
    })
  );
};

export const useSystemMaintenanceSSE = () => {
  const accessToken = useAuthStore((s) => s.accessToken);
  const roles = useSessionStore((s) => s.authz?.roles ?? []);
  const sourceRef = useRef(null);
  const isAdmin = roles.some((role) => String(role || "").toUpperCase() === "ADMIN");

  useEffect(() => {
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }

    if (!accessToken || !isAdmin) return;

    const url = SYSTEM_MAINTENANCE_EVENTS_URL;
    const source = createAuthorizedEventStream(url, accessToken, {
      onopen: () => dispatchConnectionState(true),
      onerror: () => dispatchConnectionState(false),
    });
    sourceRef.current = source;

    const handleUpdate = (event) => {
      const payload = parseEventPayload(event);

      window.dispatchEvent(
        new CustomEvent(SYSTEM_MAINTENANCE_RUNTIME_EVENT, {
          detail: payload,
        })
      );

      const toastFn = STATUS_HANDLERS[payload?.status];
      if (!toastFn) return;

      // La cola manual ya avisa localmente al disparar "run now".
      if (payload?.status === "queued" && payload?.trigger === "manual") return;

      const copy = buildToastCopy(payload);
      toastFn(copy.title, copy.message, {
        autoClose: payload?.status === "error" ? 9000 : 5000,
        toastId: `${payload?.status}:${payload?.scope}:${payload?.job_id ?? payload?.ts ?? "maintenance"}`,
      });
    };

    source.addEventListener("maintenance_update", handleUpdate);
    source.addEventListener("keepalive", () => {});
    return () => {
      source.close();
      dispatchConnectionState(false);
      if (sourceRef.current === source) {
        sourceRef.current = null;
      }
    };
  }, [accessToken, isAdmin]);
};
