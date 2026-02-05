// src/hooks/useDocumentTitle.js
import { useEffect, useRef } from "react";

/**
 * Cambia el título de la página y lo restaura al desmontar.
 * @param {string} title - Título principal o completo.
 * @param {string} [suffix="MiApp"] - Sufijo opcional.
 * @param {boolean} [concat=true] - Si true concatena con " | sufijo", si false usa el title tal cual.
 */
export function useDocumentTitle(title, suffix = "MiApp", concat = false) {
  const originalTitleRef = useRef(document?.title);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const finalTitle = concat && suffix ? `${title} | ${suffix}` : title;

    if (document.title !== finalTitle) {
      document.title = finalTitle;
    }

    return () => {
      if (typeof document !== "undefined") {
        document.title = originalTitleRef.current;
      }
    };
  }, [title, suffix, concat]);
}
