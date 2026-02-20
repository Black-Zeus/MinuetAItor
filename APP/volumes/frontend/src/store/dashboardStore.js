/**
 * store/dashboardStore.js
 *
 * Responsabilidades (post-normalización Feb-2026):
 *  - Datos de sesión activa para el dashboard UI (last_access, device, etc.)
 *  - Historial de conexiones en formato UI (normalizado desde sessionStore)
 *
 * IMPORTANTE:
 *  - Los widgets y layout ahora viven en baseSiteStore ("site-storage").
 *  - Este store ya NO maneja widgets ni fake data.
 *  - Se hidratan desde sessionStore.connections (fuente de verdad).
 *
 * localStorage key: "minuteAItor-dashboard"
 * (mantenido para no romper datos existentes — en limpieza futura puede renombrarse)
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizeConnection = (conn) => {
  if (!conn || typeof conn !== "object") return null;
  return {
    ts:       conn.ts       ?? null,
    device:   conn.device   ?? "Desconocido",
    location: conn.location ?? "Desconocido",
    ip_v4:    conn.ip_v4    ?? null,
    ip_v6:    conn.ip_v6    ?? null,
  };
};

// ─── Estado inicial ───────────────────────────────────────────────────────────
const SESSION_DEFAULT = {
  // Campos de display para el widget de última conexión
  lastAccess:   null,
  lastDevice:   null,
  lastLocation: null,
  lastIp:       null,
  lastIpV6:     null,

  // Historial completo (sin truncar — la UI decide cuántos mostrar)
  lastConnections: [],
};

// ─── Store ────────────────────────────────────────────────────────────────────
const useDashboardStore = create(
  persist(
    (set, get) => ({
      session: { ...SESSION_DEFAULT },

      // ── Hidratación desde sessionStore ─────────────────────────────────────
      /**
       * Sincroniza los datos de conexión desde sessionStore.
       * Llamar después de que sessionStore.loadFromApi() resuelva.
       *
       * Uso típico en App.jsx o en el componente Dashboard:
       *   useEffect(() => {
       *     useDashboardStore.getState().syncFromSession(
       *       useSessionStore.getState().connections
       *     );
       *   }, [connections]);
       *
       * @param {{ active, last }} connections - de sessionStore.connections
       */
      syncFromSession: ({ active, last } = {}) => {
        const activeConn = normalizeConnection(active);
        const lastConns  = Array.isArray(last)
          ? last.map(normalizeConnection).filter(Boolean)
          : [];

        // La conexión más reciente: active_connection tiene prioridad
        const latest = activeConn ?? lastConns[0] ?? null;

        set({
          session: {
            lastAccess:      latest?.ts       ?? null,
            lastDevice:      latest?.device   ?? null,
            lastLocation:    latest?.location ?? null,
            lastIp:          latest?.ip_v4    ?? null,
            lastIpV6:        latest?.ip_v6    ?? null,
            lastConnections: lastConns,
          },
        });
      },

      // ── Registro manual de acceso (opcional, si necesitas actualizar live) ──
      registerAccess: ({ device, location, ip, ip_v6, ts } = {}) =>
        set((s) => {
          const entry = {
            ts:       ts       ?? new Date().toISOString(),
            device:   device   ?? s.session.lastDevice   ?? "Desconocido",
            location: location ?? s.session.lastLocation ?? "Desconocido",
            ip_v4:    ip       ?? s.session.lastIp       ?? null,
            ip_v6:    ip_v6    ?? s.session.lastIpV6     ?? null,
          };

          return {
            session: {
              ...s.session,
              lastAccess:      entry.ts,
              lastDevice:      entry.device,
              lastLocation:    entry.location,
              lastIp:          entry.ip_v4,
              lastIpV6:        entry.ip_v6,
              lastConnections: [entry, ...(s.session.lastConnections ?? [])],
            },
          };
        }),

      // ── Clear ─────────────────────────────────────────────────────────────
      clearSession: () => set({ session: { ...SESSION_DEFAULT } }),

      resetDashboard: () => set({ session: { ...SESSION_DEFAULT } }),
    }),
    {
      name: "minuteAItor-dashboard",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ session: state.session }),
    }
  )
);

export default useDashboardStore;