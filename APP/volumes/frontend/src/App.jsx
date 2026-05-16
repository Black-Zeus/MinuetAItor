import React, { useLayoutEffect } from "react";
import AppRouter from "@/routes/AppRouter";
import useBaseSiteStore from "@store/baseSiteStore";
import { isDev, isQA } from "@/utils/environment";
import { exposeViteEnvToWindow } from "./utils/exposeEnv";
import ToasterManager from "./components/common/toast/ToasterManager";
import SessionExpiryModal from "./components/SessionExpiryModal";
import AuthSessionEventsBridge from "./components/AuthSessionEventsBridge";
import RemoteSessionNoticeModal from "./components/RemoteSessionNoticeModal";

// Solo exponer en desarrollo o QA, nunca en producción
if (isDev() || isQA()) {
  exposeViteEnvToWindow();
}

function App() {
  const { theme } = useBaseSiteStore();

  useLayoutEffect(() => {
    const html = document.documentElement;
    const isDark = theme === "dark";
    if (html.classList.contains("dark") !== isDark) {
      html.classList.toggle("dark", isDark);
    }
  }, [theme]);

  return (
    <>
      <AuthSessionEventsBridge />
      <AppRouter />
      <ToasterManager />
      <SessionExpiryModal />
      <RemoteSessionNoticeModal />
    </>
  );
}

export default App;
