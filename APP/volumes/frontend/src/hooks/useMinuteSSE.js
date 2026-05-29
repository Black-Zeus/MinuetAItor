/**
 * hooks/useMinuteSSE.js
 *
 * Hook global de notificaciones SSE para minutas.
 * Se monta UNA VEZ en Layout.jsx. No requiere props.
 *
 * Flujo:
 *  - Observa useMinuteNotificationStore.pending (Map de transacciones en vuelo).
 *  - Por cada transacción nueva abre un stream SSE autenticado a:
 *      GET /api/v1/minutes/{transactionId}/events
 *  - Al recibir "completed" → toast de éxito + refresca lista si estamos en /minutes.
 *  - Al recibir "failed"    → toast de error.
 *  - Al recibir "keepalive" → ignorado.
 *  - Cierra el EventSource y llama removePending() al recibir evento terminal.
 *
 * El stream usa fetch para enviar Authorization sin exponer el JWT en la URL.
 */

import { useEffect, useRef } from "react";
import useMinuteNotificationStore from "@/store/minuteNotificationStore";
import useAuthStore from "@/store/authStore";
import { toastSuccess, toastError } from "@/components/common/toast/toastHelpers";
import { createAuthorizedEventStream } from "@/utils/authorizedEventStream";
import { getMinuteStatus } from "@/services/minutesService";

const SSE_BASE = "/api/v1/minutes";

export const useMinuteSSE = (enabled = true) => {
  const getPendingList = useMinuteNotificationStore((s) => s.getPendingList);
  const removePending  = useMinuteNotificationStore((s) => s.removePending);
  const pending        = useMinuteNotificationStore((s) => s.pending);
  const accessToken    = useAuthStore((s) => s.accessToken);

  // Mapa de EventSource activos: transactionId → EventSource
  const sourcesRef = useRef(new Map());

  useEffect(() => {
    if (!enabled || !accessToken) {
      for (const es of sourcesRef.current.values()) {
        es.close("disabled_or_logged_out");
      }
      sourcesRef.current.clear();
      return;
    }

    const pendingList   = getPendingList();
    const activeSources = sourcesRef.current;

    // ── Abrir nuevas conexiones ───────────────────────────────────────────────
    for (const entry of pendingList) {
      const { transactionId, title } = entry;

      if (activeSources.has(transactionId)) continue;

      const handleCompleted = () => {
        toastSuccess(
          "Minuta lista para edición",
          `"${title}" fue procesada correctamente.`,
          { autoClose: 8000 }
        );
        es.close();
        activeSources.delete(transactionId);
        removePending(transactionId);

        // Refrescar lista de minutas si el usuario está en esa página
        if (typeof window.__minutesRefresh === "function") {
          window.__minutesRefresh();
        }
      };

      const handleFailed = (e = null) => {
        let errorMsg = "";
        try {
          const data = JSON.parse(e?.data ?? "{}");
          errorMsg = data.error ?? "";
        } catch { /* ignorar */ }

        toastError(
          "Error al procesar minuta",
          errorMsg
            ? `"${title}": ${errorMsg}`
            : `La minuta "${title}" no pudo ser procesada. Revisa el estado en el listado.`,
          { autoClose: 10000 }
        );
        es.close();
        activeSources.delete(transactionId);
        removePending(transactionId);

        // Refrescar también en error para actualizar el estado de la card
        if (typeof window.__minutesRefresh === "function") {
          window.__minutesRefresh();
        }
      };

      const reconcileTransaction = async () => {
        try {
          const status = await getMinuteStatus(transactionId);
          const currentStatus = String(status?.status || "").trim().toLowerCase();
          if (currentStatus === "completed") handleCompleted();
          if (currentStatus === "failed" || currentStatus === "cancelled") {
            handleFailed({ data: JSON.stringify({ error: status?.errorMessage || "" }) });
          }
        } catch {
          // El stream conserva su política de retry; la reconciliación es best-effort.
        }
      };

      const url = `${SSE_BASE}/${transactionId}/events`;
      const es = createAuthorizedEventStream(url, accessToken, {
        onreconnect: reconcileTransaction,
      });

      es.addEventListener("completed", handleCompleted);
      es.addEventListener("failed", handleFailed);
      es.addEventListener("cancelled", handleFailed);

      es.addEventListener("keepalive", () => { /* ping del servidor, ignorar */ });

      es.onerror = () => {
        // EventSource reintenta automáticamente.
        // Se puede añadir un contador de reintentos si se necesita límite.
      };

      activeSources.set(transactionId, es);
    }

    // ── Cerrar conexiones huérfanas ───────────────────────────────────────────
    for (const [txId, es] of activeSources.entries()) {
      if (!pending.has(txId)) {
        es.close("orphaned_pending_removed");
        activeSources.delete(txId);
      }
    }
  }, [enabled, pending, accessToken, getPendingList, removePending]);

  // Cleanup definitivo al desmontar Layout (logout / cierre de tab)
  useEffect(() => {
    return () => {
      for (const es of sourcesRef.current.values()) {
        es.close("unmount");
      }
      sourcesRef.current.clear();
    };
  }, []);
};
