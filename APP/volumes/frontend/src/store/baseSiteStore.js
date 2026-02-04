// src/store/baseSiteStore.js
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const NAV_HISTORY_MAX = 3;

const useBaseSiteStore = create(
  persist(
    (set) => ({
      // === THEME ===
      theme: "light", // 'light' | 'dark'

      // === NAVIGATION HISTORY ===
      navigationHistory: [], // [{ name, path, icon, ts }]

      // === SIDEBAR STATE ===
      isSidebarCollapsed: false,

      // === NOTIFICATIONS ===
      notificationsEnabled: true,
      unreadNotificationsCount: 0,

      // === LANGUAGE ===
      language: "es", // 'es' | 'en'

      // === ACTIONS ===

      // Theme
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),

      // Navigation History
      addToNavigationHistory: ({ name, path, icon }) =>
        set((state) => {
          if (!path) return state; // hard guard
          const entry = { name, path, icon, ts: Date.now() };
          const next = [
            entry,
            ...state.navigationHistory.filter((h) => h.path !== path),
          ].slice(0, NAV_HISTORY_MAX);
          return { navigationHistory: next };
        }),

      clearNavigationHistory: () => set({ navigationHistory: [] }),

      // Sidebar
      toggleSidebar: () =>
        set((s) => ({ isSidebarCollapsed: !s.isSidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),

      // Notifications
      setNotificationsEnabled: (enabled) =>
        set({ notificationsEnabled: enabled }),
      setUnreadNotificationsCount: (count) =>
        set({ unreadNotificationsCount: count }),
      incrementUnreadNotifications: () =>
        set((s) => ({ unreadNotificationsCount: s.unreadNotificationsCount + 1 })),
      resetUnreadNotifications: () => set({ unreadNotificationsCount: 0 }),

      // Language
      setLanguage: (lang) => set({ language: lang }),

      // Reset all
      resetBaseSite: () =>
        set({
          theme: "light",
          navigationHistory: [],
          isSidebarCollapsed: false,
          notificationsEnabled: true,
          unreadNotificationsCount: 0,
          language: "es",
        }),
    }),
    {
      name: "minuteAItor-base-site", // localStorage key
      storage: createJSONStorage(() => localStorage), // explícito
      partialize: (state) => ({
        theme: state.theme,
        isSidebarCollapsed: state.isSidebarCollapsed,
        notificationsEnabled: state.notificationsEnabled,
        language: state.language,
        navigationHistory: state.navigationHistory, // ✅ AHORA SÍ PERSISTE
      }),
    }
  )
);

export default useBaseSiteStore;