import React, { useEffect, useMemo, useState } from "react";
import CatalogBasePagination from "@/components/common/CatalogBasePagination";
import Icon from "@/components/ui/icon/iconManager";
import ActionButton from "@/components/ui/button/ActionButton";
import { ModalManager } from "@/components/ui/modal";
import useAuthStore from "@/store/authStore";
import useBaseSiteStore from "@store/baseSiteStore";
import useSessionStore from "@store/sessionStore";
import { getMySessions, logoutAllSessions, logoutSession } from "@/services/authService";
import { formatDateTimeTechnical } from "@/utils/formats";

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_BODY  = "text-gray-600 dark:text-gray-300";
const TXT_META  = "text-gray-500 dark:text-gray-400";
const GLOBAL_SESSIONS_PER_PAGE = 20;

const CLOSURE_FILTER_OPTIONS = [
  { id: "normal", label: "Normal" },
  { id: "forced", label: "Forzada" },
  { id: "extension", label: "Extensión" },
  { id: "unknown", label: "No determinado" },
];

const SessionStatusBadge = ({ isOnline }) => (
  <div
    className={[
      "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-theme",
      isOnline
        ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/40"
        : "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-700/60",
    ].join(" ")}
  >
    <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
    <span>{isOnline ? "Online" : "Offline"}</span>
  </div>
);

const ClosureStatusBadge = ({ type, label }) => {
  const styles = {
    normal: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/40",
    forced: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/40",
    extension: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800/40",
    unknown: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-700/60",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles[type] ?? styles.unknown}`}>
      {label ?? "Cierre no determinado"}
    </span>
  );
};

const pickSessionIcon = (device = "") => {
  const normalized = String(device).toLowerCase();
  if (/(iphone|android|mobile|telefono|phone)/.test(normalized)) return "FaMobile";
  if (/(ipad|tablet)/.test(normalized)) return "FaTablet";
  return "FaDesktop";
};

const buildFallbackCurrentSession = ({ connections, user, loginTimestamp }) => {
  const active = connections?.active ?? null;
  const lastActive = active?.ts ?? user?.last_login_at ?? loginTimestamp ?? null;

  if (!lastActive) return null;

  const device = active?.device ?? "Sesión actual";
  const location = active?.location ?? "Ubicación desconocida";
  const ip = active?.ip_v4 ?? active?.ip_v6 ?? "IP no disponible";

  return {
    id: "current-session-fallback",
    icon: pickSessionIcon(device),
    device,
    location,
    ip,
    lastActive,
    isOnline: active?.is_online ?? true,
    isCurrent: true,
  };
};

const looksLikeSameSession = (session, fallbackSession) => {
  if (!session || !fallbackSession) return false;
  if (session.id === fallbackSession.id) return true;

  return (
    session.lastActive === fallbackSession.lastActive &&
    session.device === fallbackSession.device &&
    session.ip === fallbackSession.ip
  );
};

const mergeCurrentSession = (sessions, fallbackSession) => {
  if (!fallbackSession) return sessions;

  if (sessions.some((session) => session.isCurrent)) return sessions;

  const matchIndex = sessions.findIndex((session) => looksLikeSameSession(session, fallbackSession));
  if (matchIndex >= 0) {
    return sessions.map((session, index) =>
      index === matchIndex
        ? {
          ...session,
          isCurrent: true,
          isOnline: fallbackSession.isOnline ?? session.isOnline,
        }
        : session
    );
  }

  return [fallbackSession, ...sessions];
};

const mapSession = (session, { isClosed = false } = {}) => ({
  id: session.jti,
  icon: pickSessionIcon(session.device),
  device: session.device ?? "Dispositivo desconocido",
  location: session.location ?? "Ubicación desconocida",
  ip: session.ip_v4 ?? session.ip_v6 ?? "IP no disponible",
  lastActive: session.ts,
  isOnline: Boolean(session.is_online),
  isCurrent: Boolean(session.is_current),
  isClosed,
  closedAt: session.closed_at ?? null,
  closureType: session.closure_type ?? null,
  closureLabel: session.closure_label ?? null,
  closureDetail: session.closure_detail ?? null,
});

const SessionCard = ({ session, onRevoke = () => {}, isRevoking }) => (
  <div
    className={[
      "flex items-center justify-between gap-4 p-4 rounded-xl border transition-theme",
      session.isClosed
        ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/20"
        : session.isCurrent
        ? "border-primary-200 dark:border-primary-800/60 bg-primary-50 dark:bg-primary-900/10"
        : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30",
    ].join(" ")}
  >
    <div className="flex items-center gap-4 min-w-0">
      <div
        className={[
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
          session.isCurrent ? "bg-primary-100 dark:bg-primary-900/30" : "bg-gray-200 dark:bg-gray-700",
        ].join(" ")}
      >
        <Icon
          name={session.icon}
          className={`w-5 h-5 ${session.isCurrent ? "text-primary-600 dark:text-primary-400" : "text-gray-500 dark:text-gray-400"}`}
        />
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-semibold ${TXT_TITLE} transition-theme`}>{session.device}</p>
          {session.isCurrent && (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
              Sesión actual
            </span>
          )}
          {session.isClosed ? (
            <ClosureStatusBadge type={session.closureType} label={session.closureLabel} />
          ) : (
            <SessionStatusBadge isOnline={session.isOnline} />
          )}
        </div>
        <p className={`text-xs ${TXT_META} mt-0.5 transition-theme`}>
          {session.location} · {session.ip}
        </p>
        <p className={`text-xs ${TXT_META} transition-theme`}>
          <Icon name="clock" className="inline w-3 h-3 mr-1" />
          {session.isClosed ? `Inicio: ${formatDateTimeTechnical(session.lastActive)}` : formatDateTimeTechnical(session.lastActive)}
        </p>
        {session.isClosed && (
          <>
            <p className={`text-xs ${TXT_META} transition-theme`}>
              <Icon name="FaPowerOff" className="inline w-3 h-3 mr-1" />
              Cierre: {formatDateTimeTechnical(session.closedAt)}
            </p>
            <p className={`text-xs ${TXT_META} transition-theme`}>{session.closureDetail}</p>
          </>
        )}
      </div>
    </div>

    {!session.isClosed && !session.isCurrent && (
      <ActionButton
        label="Cerrar sesión"
        variant="danger"
        size="xs"
        icon={<Icon name="FaPowerOff" />}
        onClick={() => onRevoke(session)}
        disabled={isRevoking}
      />
    )}
  </div>
);

const UserProfileSessions = () => {
  const [sessions, setSessions] = useState([]);
  const [closedSessions, setClosedSessions] = useState([]);
  const [closureFilters, setClosureFilters] = useState(() =>
    CLOSURE_FILTER_OPTIONS.reduce((acc, option) => ({ ...acc, [option.id]: true }), {})
  );
  const [globalSessionsPage, setGlobalSessionsPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState(null);
  const timeZone = useBaseSiteStore((s) => s.ui?.timeZone);

  const getFallbackCurrentSession = () => {
    const { user, connections } = useSessionStore.getState();
    const { loginTimestamp } = useAuthStore.getState();

    return buildFallbackCurrentSession({ connections, user, loginTimestamp });
  };

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      const result = await getMySessions();
      const items = Array.isArray(result?.sessions) ? result.sessions : [];
      const closedItems = Array.isArray(result?.closed_sessions) ? result.closed_sessions : [];
      const fallbackCurrentSession = getFallbackCurrentSession();
      const mappedSessions = items.map((session) => mapSession(session));
      const mappedClosedSessions = closedItems.map((session) => mapSession(session, { isClosed: true }));

      setSessions(mergeCurrentSession(mappedSessions, fallbackCurrentSession));
      setClosedSessions(mappedClosedSessions);
      setGlobalSessionsPage(1);
    } catch (error) {
      const fallbackCurrentSession = getFallbackCurrentSession();
      setSessions(mergeCurrentSession([], fallbackCurrentSession));
      setClosedSessions([]);
      ModalManager.error?.({
        title: "No se pudieron cargar las sesiones",
        message: error?.message ?? "Intenta nuevamente.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const otherSessions = useMemo(() => sessions.filter((session) => !session.isCurrent), [sessions]);
  const onlineSessions = useMemo(() => sessions.filter((session) => session.isOnline), [sessions]);
  const filteredClosedSessions = useMemo(
    () => closedSessions.filter((session) => closureFilters[session.closureType ?? "unknown"]),
    [closedSessions, closureFilters]
  );
  const globalSessionsTotalPages = Math.max(1, Math.ceil(filteredClosedSessions.length / GLOBAL_SESSIONS_PER_PAGE));
  const paginatedClosedSessions = useMemo(
    () => filteredClosedSessions.slice(
      (globalSessionsPage - 1) * GLOBAL_SESSIONS_PER_PAGE,
      globalSessionsPage * GLOBAL_SESSIONS_PER_PAGE
    ),
    [filteredClosedSessions, globalSessionsPage]
  );

  useEffect(() => {
    if (globalSessionsPage > globalSessionsTotalPages) {
      setGlobalSessionsPage(globalSessionsTotalPages);
    }
  }, [globalSessionsPage, globalSessionsTotalPages]);

  const handleClosureFilterChange = (filterId) => {
    setGlobalSessionsPage(1);
    setClosureFilters((current) => ({
      ...current,
      [filterId]: !current[filterId],
    }));
  };

  const handleGlobalSessionsPageChange = (nextPage) => {
    if (nextPage >= 1 && nextPage <= globalSessionsTotalPages) {
      setGlobalSessionsPage(nextPage);
    }
  };

  const handleRevokeOne = async (session) => {
    try {
      const confirmed = await ModalManager.confirm?.({
        title: "Cerrar sesión puntual",
        message: `Se cerrará la sesión de ${session.device}. ¿Confirmas?`,
        confirmText: "Cerrar sesión",
        cancelText: "Cancelar",
        variant: "danger",
      });
      if (!confirmed) return;

      setRevokingSessionId(session.id);
      const result = await logoutSession(session.id);
      await loadSessions();
      ModalManager.success?.({
        title: "Sesión cerrada",
        message: result?.session_revoked
          ? "La sesión seleccionada fue desconectada."
          : "La sesión ya no estaba activa.",
      });
    } catch (error) {
      ModalManager.error?.({
        title: "No se pudo cerrar la sesión",
        message: error?.message ?? "Intenta nuevamente.",
      });
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleRevokeAll = async () => {
    try {
      const confirmed = await ModalManager.confirm?.({
        title: "Cerrar todas las sesiones",
        message: "Se cerrarán todas las sesiones excepto la actual. ¿Confirmas?",
        confirmText: "Cerrar todas",
        cancelText: "Cancelar",
        variant: "danger",
      });
      if (!confirmed) return;

      setIsRevoking(true);
      const result = await logoutAllSessions();
      await loadSessions();
      ModalManager.success?.({
        title: "Sesiones cerradas",
        message: result?.sessions_revoked
          ? `Se desconectaron ${result.sessions_revoked} sesiones activas.`
          : "No había otras sesiones activas para cerrar.",
      });
    } catch (error) {
      ModalManager.error?.({
        title: "No se pudieron cerrar las sesiones",
        message: error?.message ?? "Intenta nuevamente.",
      });
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div data-time-zone={timeZone} className="space-y-5">
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 transition-theme">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className={`text-lg font-bold ${TXT_TITLE} flex items-center gap-2 transition-theme`}>
              <Icon name="FaDesktop" className="text-primary-500 dark:text-primary-400 w-4 h-4" />
              Sesiones activas
            </h2>
            <p className={`text-sm ${TXT_BODY} mt-0.5 transition-theme`}>
              {onlineSessions.length} en línea de {sessions.length} {sessions.length === 1 ? "sesión registrada" : "sesiones registradas"}.
            </p>
          </div>

          {otherSessions.length > 0 && (
            <ActionButton
              label="Cerrar todas"
              variant="soft"
              size="sm"
              icon={<Icon name="FaTrash" />}
              onClick={handleRevokeAll}
              disabled={isRevoking}
            />
          )}
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-4">
            <p className={`text-sm ${TXT_BODY} transition-theme`}>Cargando sesiones activas...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.length ? (
              sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onRevoke={handleRevokeOne}
                  isRevoking={isRevoking || revokingSessionId === session.id}
                />
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-4">
                <p className={`text-sm ${TXT_BODY} transition-theme`}>No hay sesiones activas registradas.</p>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 transition-theme">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className={`text-lg font-bold ${TXT_TITLE} flex items-center gap-2 transition-theme`}>
              <Icon name="FaClockRotateLeft" className="text-primary-500 dark:text-primary-400 w-4 h-4" />
              Sesiones globales
            </h2>
            <p className={`text-sm ${TXT_BODY} mt-0.5 transition-theme`}>
              Últimos 7 días: {filteredClosedSessions.length} de {closedSessions.length} {closedSessions.length === 1 ? "sesión cerrada registrada" : "sesiones cerradas registradas"}.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {CLOSURE_FILTER_OPTIONS.map((option) => (
              <label
                key={option.id}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 transition-theme dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-300"
              >
                <input
                  type="checkbox"
                  checked={Boolean(closureFilters[option.id])}
                  onChange={() => handleClosureFilterChange(option.id)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-4">
            <p className={`text-sm ${TXT_BODY} transition-theme`}>Cargando sesiones globales...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedClosedSessions.length ? (
              paginatedClosedSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  isRevoking={false}
                />
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-4">
                <p className={`text-sm ${TXT_BODY} transition-theme`}>
                  {closedSessions.length ? "No hay sesiones para los estados seleccionados." : "No hay sesiones cerradas registradas."}
                </p>
              </div>
            )}
            <CatalogBasePagination
              page={globalSessionsPage}
              totalPages={globalSessionsTotalPages}
              onPageChange={handleGlobalSessionsPageChange}
              total={filteredClosedSessions.length}
              itemsPerPage={GLOBAL_SESSIONS_PER_PAGE}
              singularLabel="sesión"
              pluralLabel="sesiones"
            />
          </div>
        )}
      </section>
    </div>
  );
};

export default UserProfileSessions;
