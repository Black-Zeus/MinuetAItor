/**
 * store/userStore.js
 *
 * ⚠️  DEPRECADO — eliminado en la normalización de stores (Feb-2026)
 *
 * Sus responsabilidades fueron redistribuidas:
 *  - Datos de usuario (me, roles, permisos, conexiones) → sessionStore.js
 *  - Preferencias UI (theme, sidebar, language)        → baseSiteStore.js
 *  - Token y estado de auth                            → authStore.js
 *
 * Este archivo es un stub temporal para evitar errores de import en
 * componentes que aún no hayan sido migrados.
 * Eliminar una vez que todos los imports estén actualizados.
 */

import useSessionStore from "@/store/sessionStore";
import useBaseSiteStore from "@/store/baseSiteStore";

// ── Facade de compatibilidad ──────────────────────────────────────────────────
// Re-exporta lo estrictamente necesario para que el código viejo no rompa.
// No agregar lógica nueva aquí.

export const userSelectors = {
  // Datos de usuario → sessionStore
  me:          (s) => s.user,
  ui:          () => useBaseSiteStore.getState().ui ?? {},
  theme:       () => useBaseSiteStore.getState().theme,
  language:    () => useBaseSiteStore.getState().language,
  isSidebarCollapsed: () => useBaseSiteStore.getState().sidebar?.collapsed ?? false,
};

// Hook dummy: devuelve null y loguea aviso en dev
const useUserStore = () => {
  if (process.env.NODE_ENV === "development") {
    console.warn(
      "⚠️  useUserStore está deprecado. Migrar a useSessionStore y/o useBaseSiteStore."
    );
  }
  return {
    me: useSessionStore.getState().user,
    ui: { ...useBaseSiteStore.getState().ui, theme: useBaseSiteStore.getState().theme },
  };
};

export default useUserStore;