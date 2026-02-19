/**
 * dashboardStore.js
 * Store Zustand para el Dashboard.
 * Persiste en localStorage igual que baseSiteStore.
 *
 * ── Responsabilidades ─────────────────────────────────────────────────────────
 *  - Preferencias de widgets (qué secciones muestra el dashboard)
 *  - Info de sesión del usuario actual (nombre, rol, avatar, último acceso)
 *  - Historial de conexiones (lastConnections) cargado desde fake data
 *
 * Nota:
 *  - El historial NO se limita a X registros en el store.
 *  - La UI puede mostrar "últimas 5", pero aquí se guarda todo.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// ✅ Fake data (seed)
import dataUserProfile from "@/data/dataUserProfile.json";

// ─── Definición maestra de widgets ────────────────────────────────────────────
export const DASHBOARD_WIDGETS_DEFAULT = {
    stats: {
        enabled: true,
        label: "Stats generales",
        description: "KPIs principales: minutas este mes, generadas y equipos activos.",
        icon: "FaChartLine",
        category: "resumen",
        order: 1,
    },
    ultima_conexion: {
        enabled: true,
        label: "Última conexión",
        description: "Información de la última sesión iniciada y dispositivo utilizado.",
        icon: "FaClock",
        category: "resumen",
        order: 2,
    },
    minutas_pendientes: {
        enabled: true,
        label: "Minutas pendientes de aprobación",
        description: "Minutas en estado pendiente que requieren revisión o aprobación.",
        icon: "FaClipboardCheck",
        category: "minutas",
        order: 3,
    },
    minutas_participadas: {
        enabled: true,
        label: "Minutas donde participé",
        description: "Últimas minutas registradas con tu participación.",
        icon: "FaUserCheck",
        category: "minutas",
        order: 4,
    },
    clientes_confidenciales: {
        enabled: true,
        label: "Clientes confidenciales con acceso",
        description: "Clientes marcados como confidenciales a los cuales tienes visibilidad.",
        icon: "FaUserShield",
        category: "accesos",
        order: 5,
    },
    proyectos_confidenciales: {
        enabled: true,
        label: "Proyectos confidenciales con acceso",
        description: "Proyectos confidenciales donde tu usuario tiene permisos.",
        icon: "FaFolderClosed",
        category: "accesos",
        order: 6,
    },
    tags_populares: {
        enabled: true,
        label: "Etiquetas populares",
        description: "Tags más utilizadas en minutas del período actual.",
        icon: "FaTag",
        category: "resumen",
        order: 7,
    },
};

// ─── Definición de sesión por defecto ─────────────────────────────────────────
const SESSION_DEFAULT = {
    userId: null,
    fullName: "John Doe",
    email: "",
    role: "user", // "admin" | "editor" | "user"
    avatar: null,

    // Compatibilidad UI actual:
    lastAccess: null,
    lastDevice: "Desconocido",
    lastLocation: "Desconocido",
    lastIp: null,
    lastIpV6: null, // ✅ NUEVO

    // Auth fake
    isLoggedIn: false,

    // ✅ Historial completo de conexiones (NO truncado)
    // Cada item: { ts, device, location, ip, ip_v6 }
    lastConnections: [],
};

// ─── Helpers seed / normalización ────────────────────────────────────────────
const isBlank = (v) => v == null || String(v).trim() === "";

const isPlaceholder = (v) => {
    const s = String(v ?? "").trim().toLowerCase();
    return (
        s === "" ||
        s === "desconocido" ||
        s === "sin registro" ||
        s === "—" ||
        s === "-" ||
        s === "null"
    );
};

const pickValue = (...candidates) => {
    for (const c of candidates) {
        if (!isBlank(c) && !isPlaceholder(c)) return c;
    }
    return null;
};

const pickFirstUser = (seed) => {
    if (seed?.user && typeof seed.user === "object") return seed.user;
    if (Array.isArray(seed?.users) && seed.users.length) return seed.users[0];
    return null;
};

const normalizeWidgets = (seedWidgets) => {
    const base = { ...DASHBOARD_WIDGETS_DEFAULT };
    if (!seedWidgets || typeof seedWidgets !== "object") return base;

    for (const key of Object.keys(base)) {
        const incoming = seedWidgets[key];
        if (incoming && typeof incoming === "object") {
            base[key] = { ...base[key], ...incoming };
            if (typeof incoming.enabled === "boolean") base[key].enabled = incoming.enabled;
        }
    }
    return base;
};

const normalizeConnections = (rawConnections) => {
    if (!Array.isArray(rawConnections)) return [];

    return rawConnections
        .filter((x) => x && typeof x === "object")
        .map((x) => ({
            ts: x.ts ?? x.lastAccess ?? x.date ?? null,
            device: x.device ?? x.lastDevice ?? "Desconocido",
            location: x.location ?? x.lastLocation ?? "Desconocido",
            ip: x.ip ?? x.lastIp ?? null,
            ip_v6: x.ip_v6 ?? x.lastIpV6 ?? null, // ✅ NUEVO
        }))
        .sort((a, b) => {
            const ta = a.ts ? Date.parse(a.ts) : 0;
            const tb = b.ts ? Date.parse(b.ts) : 0;
            return tb - ta;
        });
};

const connectionToCompatSession = (conn, fallback = {}) => {
    if (!conn || typeof conn !== "object") return fallback;

    return {
        lastAccess: conn.ts ?? fallback.lastAccess ?? null,
        lastDevice: conn.device ?? fallback.lastDevice ?? "Desconocido",
        lastLocation: conn.location ?? fallback.lastLocation ?? "Desconocido",
        lastIp: conn.ip ?? fallback.lastIp ?? null,
        lastIpV6: conn.ip_v6 ?? fallback.lastIpV6 ?? null, // ✅ NUEVO
    };
};

const normalizeSession = (seedUser) => {
    const dash = seedUser?.dashboard ?? {};
    const raw = dash?.session ?? seedUser?.session ?? {};
    const nowIso = new Date().toISOString();

    const rawConnections =
        raw?.lastConnections ??
        dash?.lastConnections ??
        seedUser?.lastConnections ??
        [];

    const lastConnections = normalizeConnections(rawConnections);

    // ✅ Prioridad: activeConnection > lastConnections[0] > fallback compat
    const activeConn = raw?.activeConnection ?? null;
    const compatFromHistory = activeConn
        ? connectionToCompatSession(activeConn)
        : lastConnections.length
            ? connectionToCompatSession(lastConnections[0])
            : null;

    return {
        ...SESSION_DEFAULT,
        ...raw,
        userId: raw?.userId ?? seedUser?.userId ?? SESSION_DEFAULT.userId,
        fullName: raw?.fullName ?? seedUser?.profile?.fullName ?? SESSION_DEFAULT.fullName,
        email: raw?.email ?? seedUser?.profile?.email ?? SESSION_DEFAULT.email,
        role: raw?.role ?? seedUser?.profile?.role ?? SESSION_DEFAULT.role,
        avatar: raw?.avatar ?? seedUser?.profile?.avatar ?? SESSION_DEFAULT.avatar,
        isLoggedIn: typeof raw?.isLoggedIn === "boolean" ? raw.isLoggedIn : true,

        lastConnections, // ✅ historial completo

        lastAccess:
            compatFromHistory?.lastAccess ?? raw?.lastAccess ?? nowIso,
        lastDevice:
            compatFromHistory?.lastDevice ?? raw?.lastDevice ?? "Web (fake)",
        lastLocation:
            compatFromHistory?.lastLocation ?? raw?.lastLocation ?? "Santiago, CL (fake)",
        lastIp:
            compatFromHistory?.lastIp ?? raw?.lastIp ?? "10.10.10.50",
        lastIpV6:
            compatFromHistory?.lastIpV6 ?? raw?.lastIpV6 ?? null,
    };
};

// ─── Store ────────────────────────────────────────────────────────────────────
const useDashboardStore = create(
    persist(
        (set, get) => ({
            // ── Widgets ──────────────────────────────────────────────────────────────
            widgets: { ...DASHBOARD_WIDGETS_DEFAULT },

            toggleWidget: (key) =>
                set((s) => ({
                    widgets: {
                        ...s.widgets,
                        [key]: { ...s.widgets[key], enabled: !s.widgets[key].enabled },
                    },
                })),

            setWidgetEnabled: (key, enabled) =>
                set((s) => ({
                    widgets: {
                        ...s.widgets,
                        [key]: { ...s.widgets[key], enabled },
                    },
                })),

            enableAllWidgets: () =>
                set((s) => ({
                    widgets: Object.fromEntries(
                        Object.entries(s.widgets).map(([k, v]) => [k, { ...v, enabled: true }])
                    ),
                })),

            disableAllWidgets: () =>
                set((s) => ({
                    widgets: Object.fromEntries(
                        Object.entries(s.widgets).map(([k, v]) => [k, { ...v, enabled: false }])
                    ),
                })),

            setWidgets: (widgets) => set({ widgets }),

            resetWidgets: () => set({ widgets: { ...DASHBOARD_WIDGETS_DEFAULT } }),

            // ── Sesión ───────────────────────────────────────────────────────────────
            session: { ...SESSION_DEFAULT },

            setSession: (sessionData) =>
                set({
                    session: {
                        ...SESSION_DEFAULT,
                        ...sessionData,
                        isLoggedIn: true,
                        lastAccess: new Date().toISOString(),
                    },
                }),

            updateSession: (partial) =>
                set((s) => ({
                    session: { ...s.session, ...partial },
                })),

            /**
             * Registra un nuevo acceso:
             * - Agrega item al inicio de lastConnections (sin truncar).
             * - Mantiene campos "compat" alineados al último acceso.
             */
            registerAccess: ({ device, location, ip, ip_v6, ts } = {}) =>
                set((s) => {
                    const entry = {
                        ts: ts ?? new Date().toISOString(),
                        device: device ?? s.session.lastDevice ?? "Desconocido",
                        location: location ?? s.session.lastLocation ?? "Desconocido",
                        ip: ip ?? s.session.lastIp ?? null,
                        ip_v6: ip_v6 ?? s.session.lastIpV6 ?? null, // ✅ NUEVO
                    };

                    const lastConnections = [entry, ...(s.session.lastConnections ?? [])];

                    return {
                        session: {
                            ...s.session,
                            lastConnections,
                            lastAccess: entry.ts,
                            lastDevice: entry.device,
                            lastLocation: entry.location,
                            lastIp: entry.ip,
                            lastIpV6: entry.ip_v6, // ✅ NUEVO
                        },
                    };
                }),

            clearSession: () => set({ session: { ...SESSION_DEFAULT } }),

            resetDashboard: () =>
                set({
                    widgets: { ...DASHBOARD_WIDGETS_DEFAULT },
                    session: { ...SESSION_DEFAULT },
                }),

            // ── Seed desde JSON (fake data) ──────────────────────────────────────────
            hydrateFromFakeData: ({ force = false } = {}) => {
                const s = get();

                const user = pickFirstUser(dataUserProfile);
                if (!user) return;

                const sessionIsIncomplete =
                    !s?.session?.userId ||
                    isPlaceholder(s?.session?.lastDevice) ||
                    isPlaceholder(s?.session?.lastLocation) ||
                    isBlank(s?.session?.lastAccess);

                if (!force && !sessionIsIncomplete) return;

                const widgets = normalizeWidgets(user?.dashboard?.widgets);
                const session = normalizeSession(user);

                set({ widgets, session });
            },
        }),
        {
            name: "minuteAItor-dashboard",
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                widgets: state.widgets,
                session: state.session,
            }),

            onRehydrateStorage: () => (state, error) => {
                if (error) return;

                const needSeed =
                    !state?.session?.userId ||
                    isPlaceholder(state?.session?.lastDevice) ||
                    isPlaceholder(state?.session?.lastLocation);

                if (needSeed) {
                    state?.hydrateFromFakeData?.({ force: true });
                }
            },
        }
    )
);

export default useDashboardStore;