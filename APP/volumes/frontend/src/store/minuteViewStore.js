import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const useMinuteViewStore = create(
  persist(
    (set, get) => ({
      sessionsByRecord: {},

      saveSession: (recordId, sessionData) =>
        set((state) => ({
          sessionsByRecord: {
            ...state.sessionsByRecord,
            [recordId]: {
              accessToken: sessionData?.accessToken ?? sessionData?.access_token ?? null,
              expiresAt: sessionData?.expiresAt ?? sessionData?.expires_at ?? null,
              visitor: sessionData?.visitor ?? null,
            },
          },
        })),

      clearSession: (recordId) =>
        set((state) => {
          const next = { ...state.sessionsByRecord };
          delete next[recordId];
          return { sessionsByRecord: next };
        }),

      getSession: (recordId) => get().sessionsByRecord?.[recordId] ?? null,
    }),
    {
      name: "minute-view-store",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({ sessionsByRecord: state.sessionsByRecord }),
    }
  )
);

export default useMinuteViewStore;
