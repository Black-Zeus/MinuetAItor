// src/hooks/useDocumentTitle.js
import { useEffect } from "react";

import { APP_NAME } from "@/utils/environment";

const FALLBACK_APP_NAME = "MinuetAItor";

const resolveAppName = (suffix) => {
  const rawName = suffix && suffix !== "MiApp" ? suffix : APP_NAME;
  const cleanName = String(rawName || "").trim();
  return cleanName && cleanName !== "-" ? cleanName : FALLBACK_APP_NAME;
};

export const formatDocumentTitle = (title, suffix) => {
  const appName = resolveAppName(suffix);
  const cleanTitle = String(title || "").trim();
  if (!cleanTitle || cleanTitle === appName) return appName;
  if (cleanTitle.startsWith(`${appName} - `)) return cleanTitle;
  return `${appName} - ${cleanTitle}`;
};

/**
 * Cambia el título de la página usando el formato estándar:
 * MinuetAItor - {Módulo}
 * @param {string} title - Título del módulo o submódulo.
 * @param {string} [suffix] - Nombre alternativo de la app, si aplica.
 */
export function useDocumentTitle(title, suffix) {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const finalTitle = formatDocumentTitle(title, suffix);

    if (document.title !== finalTitle) {
      document.title = finalTitle;
    }
  }, [title, suffix]);
}
