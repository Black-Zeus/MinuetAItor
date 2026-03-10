/**
 * hooks/useMinuteSSE.js
 *
 * Hook global de notificaciones SSE para minutas.
 * Se monta UNA VEZ en Layout.jsx. No requiere props.
 *
 * Flujo:
 *  - Observa useMinuteNotificationStore.pending (Map de transacciones en vuelo).
 *  - Por cada transacción nueva abre un EventSource a:
 *      GET /api/v1/minutes/{transactionId}/events?token={jwt}
 *  - Al recibir "completed" → toast de éxito + refresca lista si estamos en /minutes.
 *  - Al recibir "failed"    → toast de error.
 *  - Al recibir "keepalive" → ignorado.
 *  - Cierra el EventSource y llama removePending() al recibir evento terminal.
 *
 * NOTA: EventSource no soporta headers custom → token se pasa como ?token=...
 * El backend (minutes.py) lee ese param como fallback a Authorization header.
 */

import { useEffect, useRef } from "react";
import useMinuteNotificationStore from "@/store/minuteNotificationStore";
import useAuthStore from "@/store/authStore";
import { toastSuccess, toastError } from "@/components/common/toast/toastHelpers";

const SSE_BASE = "/api/v1/minutes";

export const useMinuteSSE = () => {
  const getPendingList = useMinuteNotificationStore((s) => s.getPendingList);
  const removePending  = useMinuteNotificationStore((s) => s.removePending);
  const pending        = useMinuteNotificationStore((s) => s.pending);
  const accessToken    = useAuthStore((s) => s.accessToken);

  // Mapa de EventSource activos: transactionId → EventSource
  const sourcesRef = useRef(new Map());

  useEffect(() => {
    if (!accessToken) return;

    const pendingList   = getPendingList();
    const activeSources = sourcesRef.current;

    // ── Abrir nuevas conexiones ───────────────────────────────────────────────
    for (const entry of pendingList) {
      const { transactionId, title } = entry;

      if (activeSources.has(transactionId)) continue;

      const url = `${SSE_BASE}/${transactionId}/events?token=${encodeURIComponent(accessToken)}`;
      const es  = new EventSource(url);

      es.addEventListener("completed", () => {
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
      });

      es.addEventListener("failed", (e) => {
        let errorMsg = "";
        try {
          const data = JSON.parse(e.data ?? "{}");
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
      });

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
        es.close();
        activeSources.delete(txId);
      }
    }
  }, [pending, accessToken, getPendingList, removePending]);

  // Cleanup definitivo al desmontar Layout (logout / cierre de tab)
  useEffect(() => {
    return () => {
      for (const es of sourcesRef.current.values()) {
        es.close();
      }
      sourcesRef.current.clear();
    };
  }, []);
};