import React, { useEffect, useLayoutEffect } from "react";
import AppRouter from "@/routes/AppRouter";
import useBaseSiteStore from "@store/baseSiteStore";
import { isDev, isQA } from "@/utils/environment";
import { applyThemeToDocument } from "@/utils/theme";
import { exposeViteEnvToWindow } from "./utils/exposeEnv";
import useAuthStore from "@/store/authStore";
import { startSessionAutoRefresh } from "@/services/sessionRefresher";
import ToasterManager from "./components/common/toast/ToasterManager";
import SessionExpiryModal from "./components/SessionExpiryModal";
import AuthSessionEventsBridge from "./components/AuthSessionEventsBridge";
import NotificationsEventsBridge from "./components/NotificationsEventsBridge";
import RemoteSessionNoticeModal from "./components/RemoteSessionNoticeModal";
import SystemMaintenanceEventsBridge from "./components/SystemMaintenanceEventsBridge";

// Solo exponer en desarrollo o QA, nunca en producción
if (isDev() || isQA()) {
  exposeViteEnvToWindow();
}

function App() {
  const theme = useBaseSiteStore((s) => s.theme);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  useBaseSiteStore((s) => s.ui?.timeZone);

  useLayoutEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return undefined;

    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return undefined;

    const handleSystemThemeChange = () => {
      applyThemeToDocument("system");
    };

    media.addEventListener?.("change", handleSystemThemeChange);
    return () => media.removeEventListener?.("change", handleSystemThemeChange);
  }, [theme]);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return undefined;
    return startSessionAutoRefresh();
  }, [accessToken, isAuthenticated]);

  return (
    <>
      <AuthSessionEventsBridge />
      <NotificationsEventsBridge />
      <SystemMaintenanceEventsBridge />
      <AppRouter />
      <ToasterManager />
      <SessionExpiryModal />
      <RemoteSessionNoticeModal />
    </>
  );
}

export default App;
