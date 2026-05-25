import React, { useEffect, useLayoutEffect } from "react";
import AppRouter from "@/routes/AppRouter";
import useBaseSiteStore from "@store/baseSiteStore";
import { isDev, isQA } from "@/utils/environment";
import { applyThemeToDocument } from "@/utils/theme";
import { exposeViteEnvToWindow } from "./utils/exposeEnv";
import ToasterManager from "./components/common/toast/ToasterManager";
import SessionExpiryModal from "./components/SessionExpiryModal";
import AuthSessionEventsBridge from "./components/AuthSessionEventsBridge";
import NotificationsEventsBridge from "./components/NotificationsEventsBridge";
import RemoteSessionNoticeModal from "./components/RemoteSessionNoticeModal";
import SystemMaintenanceEventsBridge from "./components/SystemMaintenanceEventsBridge";
import SystemBackupsEventsBridge from "./components/SystemBackupsEventsBridge";

// Solo exponer en desarrollo o QA, nunca en producción
if (isDev() || isQA()) {
  exposeViteEnvToWindow();
}

function App() {
  const { theme } = useBaseSiteStore();

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

  return (
    <>
      <AuthSessionEventsBridge />
      <NotificationsEventsBridge />
      <SystemMaintenanceEventsBridge />
      <SystemBackupsEventsBridge />
      <AppRouter />
      <ToasterManager />
      <SessionExpiryModal />
      <RemoteSessionNoticeModal />
    </>
  );
}

export default App;
