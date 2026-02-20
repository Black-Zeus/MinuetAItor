import React, { useLayoutEffect } from "react";
import AppRouter from "@/routes/AppRouter";
import useBaseSiteStore from "@store/baseSiteStore";
import { isDev, isQA } from "@/utils/environment";
import { exposeViteEnvToWindow } from "./utils/exposeEnv";

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

  return <AppRouter />;
}

export default App;