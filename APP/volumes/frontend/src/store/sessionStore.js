/**
 * store/sessionStore.js
 *
 * localStorage key: "session-store"
 * Schema v1:
 * {
 *   user: { user_id, username, full_name, description, job_title, email, is_active, last_login_at },
 *   authz: { roles, permissions },
 *   profile: { initials, color, department },
 *   connections: {
 *     active: { ts, device, location, ip_v4, ip_v6 },
 *     last: [{ ts, device, location, ip_v4, ip_v6 }]
 *   },
 *   meta: { fetched_at, request_id, source, schema_version }
 * }
 *
 * Responsabilidades:
 *  - Datos de usuario autenticado (de /auth/me)
 *  - Roles y permisos
 *  - Perfil básico e initials/color
 *  - Conexiones activa e historial
 *
 * Reemplaza: userStore.js (eliminado)
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { shouldLog } from "@/utils/environment";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Transforma la respuesta de GET /auth/me al schema de session-store.
 * Maneja el shape exacto del backend:
 * { user_id, username, full_name, email, roles, permissions, is_active,
 *   last_login_at, profile, active_connection, last_connections }
 */
const mapMeToSession = (meData, meta = {}) => {
  if (!meData) return null;

  return {
    user: {
      user_id: meData.user_id,
      username: meData.username,
      full_name: meData.full_name ?? null,
      description: meData.description ?? null,
      job_title: meData.job_title ?? null,
      phone: meData.phone ?? null,
      area: meData.area ?? null,
      email: meData.email ?? null,
      is_active: meData.is_active ?? true,
      last_login_at: meData.last_login_at ?? null,
    },
    authz: {
      roles: Array.isArray(meData.roles) ? meData.roles : [],
      permissions: Array.isArray(meData.permissions) ? meData.permissions : [],
    },
    profile: {
      initials: meData.profile?.initials ?? null,
      color: meData.profile?.color ?? null,
      department: meData.profile?.department ?? null,
    },
    connections: {
      active: meData.active_connection
        ? {
          ts: meData.active_connection.ts,
          device: meData.active_connection.device ?? null,
          location: meData.active_connection.location ?? null,
          ip_v4: meData.active_connection.ip_v4 ?? null,
          ip_v6: meData.active_connection.ip_v6 ?? null,
        }
        : null,
      last: Array.isArray(meData.last_connections)
        ? meData.last_connections.map((c) => ({
          ts: c.ts,
          device: c.device ?? null,
          location: c.location ?? null,
          ip_v4: c.ip_v4 ?? null,
          ip_v6: c.ip_v6 ?? null,
        }))
        : [],
    },
    meta: {
      fetched_at: new Date().toISOString(),
      request_id: meta.request_id ?? null,
      source: "auth/me",
      schema_version: 1,
    },
  };
};

// ─── Estado inicial ───────────────────────────────────────────────────────────
const initialSession = {
  user: null,  // { user_id, username, full_name, description, job_title, email, is_active, last_login_at }
  authz: { roles: [], permissions: [] },
  profile: { initials: null, color: null, department: null },
  connections: { active: null, last: [] },
  meta: { fetched_at: null, request_id: null, source: "auth/me", schema_version: 1 },
};

const initialState = {
  // Session data (schema)
  ...initialSession,

  // Runtime (no persistido)
  isLoading: false,
  loadError: null,
  lastFetchAt: null,
};

// ─── Store ────────────────────────────────────────────────────────────────────
const useSessionStore = create(
  persist(
    (set, get) => ({
      ...initialState,

      // ── Cargar desde API ─────────────────────────────────────────────────────
      /**
       * Llama GET /auth/me y actualiza el store.
       * Se llama automáticamente desde authStore.login() y authStore.initFromStorage().
       *
       * @param {boolean} forceRefresh - ignora cache de 5 min
       */
      loadFromApi: async (forceRefresh = false) => {
        // Cache: 5 minutos
        if (!forceRefresh && get().lastFetchAt) {
          const elapsed = Date.now() - new Date(get().lastFetchAt).getTime();
          if (elapsed < 5 * 60 * 1000) {
            if (shouldLog()) console.log("👤 sessionStore: usando cache (/auth/me)");
            return;
          }
        }

        if (get().isLoading) return;

        set({ isLoading: true, loadError: null });

        try {
          const { getMe } = await import("@/services/authService");
          const meData = await getMe(); // MeResponse

          const session = mapMeToSession(meData);

          set({
            ...session,
            isLoading: false,
            loadError: null,
            lastFetchAt: new Date().toISOString(),
          });

          if (shouldLog()) console.log("✅ sessionStore: sesión cargada —", meData.username);
        } catch (error) {
          if (shouldLog()) console.error("❌ sessionStore.loadFromApi:", error?.message);
          set({ isLoading: false, loadError: error?.message ?? "Error al cargar sesión" });
        }
      },

      // ── Hidratación manual (si ya tienes la respuesta del login) ─────────────
      /**
       * Útil si en el futuro el endpoint de login devuelve el user embebido.
       * Por ahora no se usa (login solo devuelve token).
       */
      hydrateFromMeResponse: (meData, responseMeta = {}) => {
        if (!meData) return;
        const session = mapMeToSession(meData, responseMeta);
        set({
          ...session,
          isLoading: false,
          loadError: null,
          lastFetchAt: new Date().toISOString(),
        });
        if (shouldLog()) console.log("✅ sessionStore: hidratado manualmente —", meData.username);
      },

      // ── Clear ────────────────────────────────────────────────────────────────
      clearSession: () => {
        set({ ...initialState });
        if (shouldLog()) console.log("🧹 sessionStore: sesión limpiada");
      },

      // ── Getters computados ───────────────────────────────────────────────────

      /** Devuelve datos para mostrar en UI (nombre, initials, color) */
      getDisplayData: () => {
        const { user, profile } = get();
        if (!user) return null;

        const fullName = user.full_name || user.username || "Usuario";
        const parts = fullName.trim().split(" ");
        const defaultInitials =
          parts.length >= 2
            ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
            : fullName.substring(0, 2).toUpperCase();

        return {
          userId: user.user_id,
          username: user.username,
          fullName,
          email: user.email,
          isActive: user.is_active,
          initials: profile.initials ?? defaultInitials,
          color: profile.color ?? null,
          department: profile.department ?? null,
          job_title: user.job_title ?? null,
          description: user.description ?? null,
          phone: user.phone ?? null,
          area: user.area ?? null,
        };
      },

      /** Verifica si el usuario tiene un permiso específico */
      hasPermission: (permission) => {
        const { authz } = get();
        return Array.isArray(authz.permissions) && authz.permissions.includes(permission);
      },

      /** Verifica si el usuario tiene un rol específico */
      hasRole: (role) => {
        const { authz } = get();
        return Array.isArray(authz.roles) && authz.roles.includes(role);
      },
    }),

    {
      name: "session-store",
      storage: createJSONStorage(() => localStorage),
      version: 1,

      // Persistir solo el schema de sesión — NO runtime (isLoading, loadError)
      partialize: (state) => ({
        user: state.user,
        authz: state.authz,
        profile: state.profile,
        connections: state.connections,
        meta: state.meta,
      }),

      // Merge del schema persistido
      merge: (persisted, current) => ({
        ...current,
        user: persisted?.user ?? null,
        authz: persisted?.authz ?? { roles: [], permissions: [] },
        profile: persisted?.profile ?? { initials: null, color: null, department: null },
        connections: persisted?.connections ?? { active: null, last: [] },
        meta: persisted?.meta ?? { fetched_at: null, request_id: null, source: "auth/me", schema_version: 1 },
      }),
    }
  )
);

// ─── Selectors ────────────────────────────────────────────────────────────────
export const sessionSelectors = {
  user: (s) => s.user,
  authz: (s) => s.authz,
  profile: (s) => s.profile,
  connections: (s) => s.connections,
  roles: (s) => s.authz?.roles ?? [],
  permissions: (s) => s.authz?.permissions ?? [],
  activeConn: (s) => s.connections?.active ?? null,
  lastConnections: (s) => s.connections?.last ?? [],
  isLoading: (s) => s.isLoading,
  loadError: (s) => s.loadError,
  isLoaded: (s) => !!s.user,
};

// ─── Hooks helpers ────────────────────────────────────────────────────────────
export const useSessionUser = () => useSessionStore(sessionSelectors.user);
export const useSessionAuthz = () => useSessionStore(sessionSelectors.authz);
export const useSessionProfile = () => useSessionStore(sessionSelectors.profile);
export const useConnections = () => useSessionStore(sessionSelectors.connections);
export const usePermissions = () => useSessionStore(sessionSelectors.permissions);
export const useRoles = () => useSessionStore(sessionSelectors.roles);

export default useSessionStore;