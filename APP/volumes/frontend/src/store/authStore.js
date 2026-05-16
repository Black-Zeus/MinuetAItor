/**
 * store/authStore.js
 *
 * localStorage key: "auth-storage"
 * Schema v1:
 * {
 *   state: {
 *     accessToken, tokenType, expiresAt, isAuthenticated,
 *     loginTimestamp, logoutTimestamp, lastAuthError,
 *     refresh: { enabled, lastRefreshAt, nextRefreshAt }
 *   },
 *   version: 1
 * }
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { shouldLog } from "@/utils/environment";

// ─── JWT helpers ──────────────────────────────────────────────────────────────
const decodeJwtExp = (token) => {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    const padded = pad ? b64 + "=".repeat(4 - pad) : b64;
    return JSON.parse(atob(padded))?.exp ?? null;
  } catch {
    return null;
  }
};

const expToIso           = (exp) => exp ? new Date(exp * 1000).toISOString() : null;
const computeNextRefresh = (exp, leadSeconds = 120) =>
  exp ? new Date((exp - leadSeconds) * 1000).toISOString() : null;

// ─── Estado inicial ───────────────────────────────────────────────────────────
const initialState = {
  accessToken:     null,
  tokenType:       "Bearer",
  expiresAt:       null,
  isAuthenticated: false,
  loginTimestamp:  null,
  logoutTimestamp: null,
  lastAuthError:   null,
  refresh: {
    enabled:       true,
    lastRefreshAt: null,
    nextRefreshAt: null,
  },
  remoteLogoutNotice: null,
  // Runtime — no persistido
  isLoading:     false,
  isInitialized: false,
};

// ─── Store ────────────────────────────────────────────────────────────────────
const useAuthStore = create(
  persist(
    (set, get) => ({
      ...initialState,

      // ── Login ───────────────────────────────────────────────────────────────
      login: (tokenResponse) => {
        const { access_token, token_type, expires_in } = tokenResponse ?? {};
        if (!access_token) throw new Error("Invalid login response: missing access_token");

        const now = new Date().toISOString();
        const exp = decodeJwtExp(access_token) ??
          (expires_in ? Math.floor(Date.now() / 1000) + expires_in : null);

        set({
          accessToken:     access_token,
          tokenType:       token_type ?? "bearer",
          expiresAt:       expToIso(exp),
          isAuthenticated: true,
          isLoading:       false,
          loginTimestamp:  now,
          logoutTimestamp: null,
          lastAuthError:   null,
          remoteLogoutNotice: null,
          refresh: {
            enabled:       true,
            lastRefreshAt: null,
            nextRefreshAt: computeNextRefresh(exp),
          },
        });

        if (shouldLog()) console.log("✅ authStore.login — token almacenado");

        // Cargar sesión en sessionStore (import dinámico para evitar ciclo)
        get()._loadSession();
      },

      // ── Logout ──────────────────────────────────────────────────────────────
      // FIX: require() no funciona en módulos ES — usar import() dinámico
      logout: (reason = "Manual logout") => {
        if (shouldLog()) console.log(`🚪 authStore.logout: ${reason}`);

        // Limpiar sessionStore de forma no bloqueante
        import("@/store/sessionStore")
          .then(({ default: useSessionStore }) => {
            useSessionStore.getState().clearSession();
          })
          .catch(() => { /* sessionStore puede no estar disponible */ });

        set({
          ...initialState,
          isInitialized:   true,
          logoutTimestamp: new Date().toISOString(),
        });
      },

      openRemoteLogoutNotice: (payload = {}) => {
        const current = get().remoteLogoutNotice;
        if (current?.isOpen) return;

        set({
          remoteLogoutNotice: {
            isOpen: true,
            title: payload.title ?? "Esta sesión fue cerrada",
            message:
              payload.message ??
              "Detectamos que esta sesión fue cerrada desde otro dispositivo o por un cambio de seguridad. Para continuar, vuelve a iniciar sesión. Si no esperabas este cierre, solicita acceso o revisa con una persona administradora.",
            source: payload.source ?? "unknown",
            detectedAt: new Date().toISOString(),
          },
        });
      },

      closeRemoteLogoutNotice: () => set({ remoteLogoutNotice: null }),

      // ── Update tokens (refresh silencioso) ───────────────────────────────────
      updateTokens: ({ access_token }) => {
        if (!access_token) return;
        const exp = decodeJwtExp(access_token);
        const now = new Date().toISOString();
        set((s) => ({
          accessToken:     access_token,
          expiresAt:       expToIso(exp),
          isAuthenticated: true,
          lastAuthError:   null,
          remoteLogoutNotice: null,
          refresh: {
            ...s.refresh,
            lastRefreshAt: now,
            nextRefreshAt: computeNextRefresh(exp),
          },
        }));
        if (shouldLog()) console.log("🔄 authStore.updateTokens — token refrescado");
      },

      // ── Auth error ───────────────────────────────────────────────────────────
      setAuthError: (code, message) =>
        set({
          lastAuthError: {
            code:    code ?? "UNKNOWN",
            message: message ?? "Error de autenticación",
            at:      new Date().toISOString(),
          },
        }),

      clearAuthError: () => set({ lastAuthError: null }),

      // ── Init ────────────────────────────────────────────────────────────────
      initFromStorage: async () => {
        const { accessToken } = get();

        // Compat: migrar legacy localStorage.access_token si existe
        if (!accessToken) {
          const legacy = localStorage.getItem("access_token");
          if (legacy) {
            const exp = decodeJwtExp(legacy);
            set({
              accessToken:     legacy,
              expiresAt:       expToIso(exp),
              isAuthenticated: true,
              refresh: {
                enabled:       true,
                lastRefreshAt: null,
                nextRefreshAt: computeNextRefresh(exp),
              },
            });
            localStorage.removeItem("access_token");
            if (shouldLog()) console.log("🔄 authStore: token legacy migrado");
          }
        }

        set({ isInitialized: true });

        if (get().accessToken) get()._loadSession();
      },

      // ── Cargar sesión (interno) ──────────────────────────────────────────────
      _loadSession: async () => {
        try {
          const { default: useSessionStore } = await import("@/store/sessionStore");
          await useSessionStore.getState().loadFromApi();
        } catch (e) {
          if (shouldLog()) console.error("❌ authStore._loadSession:", e?.message);
        }
      },

      // ── Setters runtime ──────────────────────────────────────────────────────
      setLoading:        (isLoading) => set({ isLoading }),
      setRefreshEnabled: (enabled)   => set((s) => ({ refresh: { ...s.refresh, enabled } })),
    }),

    {
      name:    "auth-storage",
      storage: createJSONStorage(() => localStorage),
      version: 1,

      // FIX: NO wrappear en { state, version } — Zustand persist ya agrega su propio
      // wrapper. El double-wrap producía { state: { state:{...}, version:1 }, version:1 }
      // y el merge leía persisted.state como el objeto inner, dejando todo undefined.
      partialize: (state) => ({
        accessToken:     state.accessToken,
        tokenType:       state.tokenType,
        expiresAt:       state.expiresAt,
        isAuthenticated: state.isAuthenticated,
        loginTimestamp:  state.loginTimestamp,
        logoutTimestamp: state.logoutTimestamp,
        lastAuthError:   state.lastAuthError,
        refresh:         state.refresh,
      }),

      // merge recibe directamente lo que guardó partialize (sin wrapper adicional)
      merge: (persisted, current) => {
        const s = persisted ?? {};
        return {
          ...current,
          accessToken:     s.accessToken     ?? null,
          tokenType:       s.tokenType       ?? "Bearer",
          expiresAt:       s.expiresAt       ?? null,
          isAuthenticated: s.isAuthenticated ?? false,
          loginTimestamp:  s.loginTimestamp  ?? null,
          logoutTimestamp: s.logoutTimestamp ?? null,
          lastAuthError:   s.lastAuthError   ?? null,
          refresh: {
            enabled:       s.refresh?.enabled       ?? true,
            lastRefreshAt: s.refresh?.lastRefreshAt ?? null,
            nextRefreshAt: s.refresh?.nextRefreshAt ?? null,
          },
        };
      },
    }
  )
);

// ─── Selectors ────────────────────────────────────────────────────────────────
export const authSelectors = {
  isAuthenticated: (s) => s.isAuthenticated,
  accessToken:     (s) => s.accessToken,
  isLoading:       (s) => s.isLoading,
  expiresAt:       (s) => s.expiresAt,
  loginTimestamp:  (s) => s.loginTimestamp,
  lastAuthError:   (s) => s.lastAuthError,
  refresh:         (s) => s.refresh,
  needsLogin:      (s) => !s.isAuthenticated || !s.accessToken,
};

export const useIsAuthenticated = () => useAuthStore(authSelectors.isAuthenticated);
export const useAccessToken     = () => useAuthStore(authSelectors.accessToken);
export const useAuthError       = () => useAuthStore(authSelectors.lastAuthError);

export default useAuthStore;
