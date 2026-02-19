/**
 * App.jsx
 * Punto de entrada — MinuetAItor
 *
 * Responsabilidades únicas:
 *  - Aplicar el tema dark/light al <html>
 *  - Montar el AppRouter (que gestiona toda la navegación)
 *
 * Todo lo demás (rutas, guards, layout, lazy loading) vive en /routes
 */

import React, { useLayoutEffect } from "react";
import AppRouter from "@/routes/AppRouter";
import useBaseSiteStore from "@store/baseSiteStore";

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