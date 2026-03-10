/**
 * store/minuteNotificationStore.js
 *
 * Store Zustand (NO persistido) para rastrear minutas en procesamiento.
 * El hook useMinuteSSE observa este store para saber a qué transacciones suscribirse.
 */

import { create } from "zustand";

const useMinuteNotificationStore = create((set, get) => ({
  // Map<transactionId, { transactionId, recordId, title, addedAt }>
  pending: new Map(),

  addPending: (transactionId, recordId, title = "Minuta") => {
    if (!transactionId) return;
    set((s) => {
      const next = new Map(s.pending);
      next.set(transactionId, {
        transactionId,
        recordId:  recordId ?? null,
        title:     title   ?? "Minuta",
        addedAt:   new Date().toISOString(),
      });
      return { pending: next };
    });
  },

  removePending: (transactionId) => {
    if (!transactionId) return;
    set((s) => {
      const next = new Map(s.pending);
      next.delete(transactionId);
      return { pending: next };
    });
  },

  isPending: (transactionId) => get().pending.has(transactionId),

  getPendingList: () => Array.from(get().pending.values()),
}));

export default useMinuteNotificationStore;