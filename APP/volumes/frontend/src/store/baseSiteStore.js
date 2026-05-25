/**
 * store/baseSiteStore.js
 *
 * localStorage key: "site-storage"
 * Schema v1 (flat, sin double-wrap):
 * {
 *   theme, accent, language, sidebar, ui, dashboard, navigationHistory
 * }
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// ─── Defaults ─────────────────────────────────────────────────────────────────
const SIDEBAR_DEFAULT = { collapsed: false, activeModule: null };
const UI_DEFAULT      = { density: "comfortable", animations: true, defaultModuleView: "base" };

const WIDGETS_DEFAULT = {
  stats:                    { enabled: true, order: 1, category: "resumen"  },
  ultima_conexion:          { enabled: true, order: 2, category: "resumen"  },
  minutas_pendientes:       { enabled: true, order: 3, category: "minutas"  },
  minutas_participadas:     { enabled: true, order: 4, category: "minutas"  },
  clientes_confidenciales:  { enabled: true, order: 5, category: "accesos"  },
  proyectos_confidenciales: { enabled: true, order: 6, category: "accesos"  },
  tags_populares:           { enabled: true, order: 7, category: "resumen"  },
};

const LAYOUT_DEFAULT    = { columns: 2, breakpoints: { lg: 2, md: 2, sm: 1 } };
const NAV_HISTORY_MAX   = 10; // máximo de entradas en historial

const normalizeTheme = (theme) =>
  ["light", "dark", "system"].includes(theme) ? theme : "system";

const normalizeDensity = (density) =>
  ["compact", "comfortable"].includes(density) ? density : "comfortable";

const normalizeDefaultModuleView = (value) =>
  ["base", "list", "table"].includes(value) ? value : "base";

const mergeWidgetsWithDefaults = (widgetsInput = {}) => {
  const mergedWidgets = { ...WIDGETS_DEFAULT };

  for (const key of Object.keys(WIDGETS_DEFAULT)) {
    const widget = widgetsInput[key];
    if (widget && typeof widget === "object") {
      mergedWidgets[key] = { ...WIDGETS_DEFAULT[key], ...widget };
    }
  }

  return mergedWidgets;
};

const buildDashboardWidgetsPayload = (widgets = {}) =>
  Object.entries(mergeWidgetsWithDefaults(widgets))
    .map(([code, widget]) => ({
      code,
      enabled: Boolean(widget?.enabled),
      sortOrder: Number(widget?.order ?? 0) || null,
    }))
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));

const normalizeRemoteWidgets = (dashboardWidgets = []) => {
  const nextWidgets = { ...WIDGETS_DEFAULT };

  for (const item of Array.isArray(dashboardWidgets) ? dashboardWidgets : []) {
    const code = String(item?.code || "").trim();
    if (!code || !nextWidgets[code]) continue;

    nextWidgets[code] = {
      ...nextWidgets[code],
      enabled: Boolean(item?.enabled),
      order: Number(item?.sortOrder ?? item?.sort_order ?? nextWidgets[code].order),
    };
  }

  return nextWidgets;
};

const initialState = {
  theme:    "system",
  accent:   "#6366f1",
  language: "es-CL",
  sidebar:  { ...SIDEBAR_DEFAULT },
  ui:       { ...UI_DEFAULT },
  dashboard: {
    widgets: { ...WIDGETS_DEFAULT },
    layout:  { ...LAYOUT_DEFAULT },
  },
  navigationHistory: [],  // [{ name, path, icon, ts, meta }]  meta: datos extra ej { id, title }
};

// ─── Store ────────────────────────────────────────────────────────────────────
const useBaseSiteStore = create(
  persist(
    (set) => ({
      ...initialState,

      // ── Theme ──────────────────────────────────────────────────────────────
      setTheme: (theme) => {
        if (!["light", "dark", "system"].includes(theme)) return;
        set({ theme });
      },
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),

      // ── Accent ─────────────────────────────────────────────────────────────
      setAccent: (accent) => {
        if (typeof accent !== "string") return;
        set({ accent });
      },

      // ── Language ───────────────────────────────────────────────────────────
      setLanguage: (language) => {
        if (typeof language !== "string") return;
        set({ language });
      },

      // ── Sidebar ────────────────────────────────────────────────────────────
      toggleSidebar: () =>
        set((s) => ({ sidebar: { ...s.sidebar, collapsed: !s.sidebar.collapsed } })),
      setSidebarCollapsed: (collapsed) =>
        set((s) => ({ sidebar: { ...s.sidebar, collapsed: !!collapsed } })),
      setActiveModule: (activeModule) =>
        set((s) => ({ sidebar: { ...s.sidebar, activeModule: activeModule ?? null } })),

      // ── Navigation history ────────────────────────────────────────────────
      // Registra las últimas NAV_HISTORY_MAX páginas visitadas.
      // Se llama desde el Sidebar al hacer click en un módulo.
      // Entries: { name, path, icon, ts }
      addToNavigationHistory: ({ name, path, icon, meta = null }) =>
        set((s) => {
          if (!path) return s;
          const entry = { name, path, icon: icon ?? null, ts: Date.now(), meta: meta ?? null };
          const next  = [
            entry,
            ...(Array.isArray(s.navigationHistory) ? s.navigationHistory : []).filter((h) => h.path !== path), // sin duplicados
          ].slice(0, NAV_HISTORY_MAX);
          return { navigationHistory: next };
        }),

      clearNavigationHistory: () => set({ navigationHistory: [] }),

      // Actualiza name y meta de una entry existente por path.
      // Usado por useNavEntryUpdate en páginas con rutas dinámicas
      // (ej: reemplaza "Edición" con el título real de la minuta)
      updateNavigationEntry: (path, { name, meta }) =>
        set((s) => ({
          navigationHistory: s.navigationHistory.map((h) =>
            h.path === path
              ? { ...h, name: name ?? h.name, meta: meta ? { ...h.meta, ...meta } : h.meta }
              : h
          ),
        })),

      // ── UI ─────────────────────────────────────────────────────────────────
      setDensity: (density) => {
        if (!["compact", "comfortable"].includes(density)) return;
        set((s) => ({ ui: { ...s.ui, density } }));
      },
      setAnimations: (animations) =>
        set((s) => ({ ui: { ...s.ui, animations: !!animations } })),
      setDefaultModuleView: (defaultModuleView) =>
        set((s) => ({
          ui: { ...s.ui, defaultModuleView: normalizeDefaultModuleView(defaultModuleView) },
        })),

      // ── Dashboard widgets ──────────────────────────────────────────────────
      toggleWidget: (key) =>
        set((s) => {
          const w = s.dashboard.widgets[key];
          if (!w) return s;
          return { dashboard: { ...s.dashboard, widgets: { ...s.dashboard.widgets, [key]: { ...w, enabled: !w.enabled } } } };
        }),

      setWidgetEnabled: (key, enabled) =>
        set((s) => {
          const w = s.dashboard.widgets[key];
          if (!w) return s;
          return { dashboard: { ...s.dashboard, widgets: { ...s.dashboard.widgets, [key]: { ...w, enabled: !!enabled } } } };
        }),

      enableAllWidgets: () =>
        set((s) => ({
          navigationHistory: Array.isArray(s.navigationHistory) ? s.navigationHistory : [],
          dashboard: {
            ...s.dashboard,
            widgets: Object.fromEntries(
              Object.entries(s.dashboard.widgets).map(([k, v]) => [k, { ...v, enabled: true }])
            ),
          },
        })),

      disableAllWidgets: () =>
        set((s) => ({
          navigationHistory: Array.isArray(s.navigationHistory) ? s.navigationHistory : [],
          dashboard: {
            ...s.dashboard,
            widgets: Object.fromEntries(
              Object.entries(s.dashboard.widgets).map(([k, v]) => [k, { ...v, enabled: false }])
            ),
          },
        })),

      resetWidgets: () =>
        set((s) => ({ dashboard: { ...s.dashboard, widgets: { ...WIDGETS_DEFAULT } } })),

      setWidgetOrder: (key, order) =>
        set((s) => {
          const w = s.dashboard.widgets[key];
          if (!w) return s;
          return { dashboard: { ...s.dashboard, widgets: { ...s.dashboard.widgets, [key]: { ...w, order } } } };
        }),

      // ── Dashboard layout ───────────────────────────────────────────────────
      setLayoutColumns: (columns) =>
        set((s) => ({ dashboard: { ...s.dashboard, layout: { ...s.dashboard.layout, columns } } })),

      setLayoutBreakpoints: (breakpoints) =>
        set((s) => ({
          navigationHistory: Array.isArray(s.navigationHistory) ? s.navigationHistory : [],
          dashboard: {
            ...s.dashboard,
            layout: { ...s.dashboard.layout, breakpoints: { ...s.dashboard.layout.breakpoints, ...breakpoints } },
          },
        })),

      resetDashboardLayout: () =>
        set((s) => ({ dashboard: { ...s.dashboard, layout: { ...LAYOUT_DEFAULT } } })),

      hydratePersonalization: (personalization = {}) =>
        set((s) => ({
          theme: normalizeTheme(personalization?.theme ?? s.theme),
          sidebar: {
            ...s.sidebar,
            collapsed: Boolean(
              personalization?.sidebarCollapsed ??
              personalization?.sidebar_collapsed ??
              s.sidebar?.collapsed
            ),
          },
          ui: {
            ...s.ui,
            density: normalizeDensity(personalization?.density ?? s.ui?.density),
            animations: Boolean(
              personalization?.animations ?? s.ui?.animations
            ),
            defaultModuleView: normalizeDefaultModuleView(
              personalization?.defaultModuleView ??
              personalization?.default_module_view ??
              s.ui?.defaultModuleView
            ),
          },
          dashboard: {
            ...s.dashboard,
            widgets: normalizeRemoteWidgets(
              personalization?.dashboardWidgets ?? personalization?.dashboard_widgets ?? []
            ),
          },
        })),

      getPersonalizationSnapshot: () => {
        const state = useBaseSiteStore.getState();
        return {
          theme: normalizeTheme(state.theme),
          density: normalizeDensity(state.ui?.density),
          animations: Boolean(state.ui?.animations),
          sidebarCollapsed: Boolean(state.sidebar?.collapsed),
          defaultModuleView: normalizeDefaultModuleView(state.ui?.defaultModuleView),
          dashboardWidgets: buildDashboardWidgetsPayload(state.dashboard?.widgets ?? {}),
        };
      },

      // ── Reset total ────────────────────────────────────────────────────────
      resetSitePrefs: () => set({ ...initialState }),
    }),

    {
      name:    "site-storage",
      storage: createJSONStorage(() => localStorage),
      version: 1,

      // FIX: NO wrappear en { state, version } — Zustand persist ya lo hace.
      // El double-wrap causaba site-storage = { state: { state:{...}, version:1 }, version:1 }
      partialize: (state) => ({
        theme:     state.theme,
        accent:    state.accent,
        language:  state.language,
        sidebar:   { collapsed: Boolean(state.sidebar?.collapsed) },
        ui:        state.ui,
        dashboard:         state.dashboard,
        navigationHistory: state.navigationHistory,
      }),

      // merge recibe directamente el objeto de partialize (flat)
      merge: (persisted, current) => {
        const s = persisted ?? {};

        // Merge seguro de widgets: conservar keys conocidas
        return {
          ...current,
          theme:    normalizeTheme(s.theme ?? initialState.theme),
          accent:   s.accent   ?? initialState.accent,
          language: s.language ?? initialState.language,
          sidebar: {
            collapsed:    s.sidebar?.collapsed    ?? false,
            activeModule: s.sidebar?.activeModule ?? null,
          },
          ui: {
            density:    normalizeDensity(s.ui?.density ?? "comfortable"),
            animations: s.ui?.animations ?? true,
            defaultModuleView: normalizeDefaultModuleView(
              s.ui?.defaultModuleView ?? UI_DEFAULT.defaultModuleView
            ),
          },
          navigationHistory: Array.isArray(s.navigationHistory) ? s.navigationHistory : [],
          dashboard: {
            widgets: mergeWidgetsWithDefaults(s.dashboard?.widgets ?? {}),
            layout: {
              columns: s.dashboard?.layout?.columns ?? 2,
              breakpoints: {
                lg: s.dashboard?.layout?.breakpoints?.lg ?? 2,
                md: s.dashboard?.layout?.breakpoints?.md ?? 2,
                sm: s.dashboard?.layout?.breakpoints?.sm ?? 1,
              },
            },
          },
        };
      },
    }
  )
);

// ─── Selectors ────────────────────────────────────────────────────────────────
export const siteSelectors = {
  theme:              (s) => s.theme,
  accent:             (s) => s.accent,
  language:           (s) => s.language,
  sidebar:            (s) => s.sidebar,
  isSidebarCollapsed: (s) => s.sidebar?.collapsed ?? false,
  activeModule:       (s) => s.sidebar?.activeModule ?? null,
  ui:                 (s) => s.ui,
  density:            (s) => s.ui?.density ?? "comfortable",
  animations:         (s) => s.ui?.animations ?? true,
  defaultModuleView:  (s) => normalizeDefaultModuleView(s.ui?.defaultModuleView),
  dashboard:          (s) => s.dashboard,
  widgets:            (s) => s.dashboard?.widgets ?? {},
  layout:             (s) => s.dashboard?.layout ?? LAYOUT_DEFAULT,
  navigationHistory:  (s) => s.navigationHistory ?? [],
  navEntryByPath:     (path) => (s) => (s.navigationHistory ?? []).find((h) => h.path === path) ?? null,
};

export const useTheme      = () => useBaseSiteStore(siteSelectors.theme);
export const useSidebar    = () => useBaseSiteStore(siteSelectors.sidebar);
export const useWidgets    = () => useBaseSiteStore(siteSelectors.widgets);
export const useDashLayout = () => useBaseSiteStore(siteSelectors.layout);

export default useBaseSiteStore;
