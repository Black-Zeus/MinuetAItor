import React, { useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/icon/iconManager";
import ActionButton from "@/components/ui/button/ActionButton";
import { ModalManager } from "@/components/ui/modal";
import useAuthStore from "@/store/authStore";
import useSessionStore from "@store/sessionStore";
import { getMySessions, logoutAllSessions, logoutSession } from "@/services/authService";
import { formatDateTimeTechnical } from "@/utils/formats";

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_BODY  = "text-gray-600 dark:text-gray-300";
const TXT_META  = "text-gray-500 dark:text-gray-400";

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

const SessionCard = ({ session, onRevoke, isRevoking }) => (
  <div
    className={[
      "flex items-center justify-between gap-4 p-4 rounded-xl border transition-theme",
      session.isCurrent
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
          <SessionStatusBadge isOnline={session.isOnline} />
        </div>
        <p className={`text-xs ${TXT_META} mt-0.5 transition-theme`}>
          {session.location} · {session.ip}
        </p>
        <p className={`text-xs ${TXT_META} transition-theme`}>
          <Icon name="clock" className="inline w-3 h-3 mr-1" />
          {formatDateTimeTechnical(session.lastActive)}
        </p>
      </div>
    </div>

    {!session.isCurrent && (
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
  const [isLoading, setIsLoading] = useState(true);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState(null);

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
      const fallbackCurrentSession = getFallbackCurrentSession();
      const mappedSessions = items.map((session) => ({
        id: session.jti,
        icon: pickSessionIcon(session.device),
        device: session.device ?? "Dispositivo desconocido",
        location: session.location ?? "Ubicación desconocida",
        ip: session.ip_v4 ?? session.ip_v6 ?? "IP no disponible",
        lastActive: session.ts,
        isOnline: Boolean(session.is_online),
        isCurrent: Boolean(session.is_current),
      }));

      setSessions(mergeCurrentSession(mappedSessions, fallbackCurrentSession));
    } catch (error) {
      const fallbackCurrentSession = getFallbackCurrentSession();
      setSessions(mergeCurrentSession([], fallbackCurrentSession));
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
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 transition-theme">
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
    </div>
  );
};

export default UserProfileSessions;
