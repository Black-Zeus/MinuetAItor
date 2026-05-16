import { useEffect, useRef } from "react";
import { API_ENDPOINTS } from "@/constants";
import useAuthStore from "@/store/authStore";

const decodeJwtPayload = (jwt) => {
  try {
    const parts = String(jwt || "").split(".");
    if (parts.length < 2) return null;

    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad) b64 += "=".repeat(4 - pad);

    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
};

export const useAuthSessionSSE = () => {
  const accessToken = useAuthStore((s) => s.accessToken);
  const logout = useAuthStore((s) => s.logout);
  const openRemoteLogoutNotice = useAuthStore((s) => s.openRemoteLogoutNotice);
  const sourceRef = useRef(null);

  useEffect(() => {
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }

    if (!accessToken) return;

    const payload = decodeJwtPayload(accessToken);
    const currentJti = payload?.jti;
    if (!currentJti) return;

    const url = `/api${API_ENDPOINTS.AUTH.SESSION_EVENTS}?token=${encodeURIComponent(accessToken)}`;
    const source = new EventSource(url);
    sourceRef.current = source;

    const handleSessionRevoked = (event) => {
      let data = {};
      try {
        data = JSON.parse(event?.data ?? "{}");
      } catch {
        data = {};
      }

      if (data?.target_jti && data.target_jti !== currentJti) return;

      source.close();
      if (sourceRef.current === source) {
        sourceRef.current = null;
      }

      logout(`Remote session event: ${data?.reason ?? "session_revoked"}`);
      openRemoteLogoutNotice({
        title: "Esta sesión fue cerrada",
        message:
          data?.message ??
          "Detectamos que esta sesión fue cerrada desde otro dispositivo o por un cambio de seguridad. Para continuar, vuelve a iniciar sesión.",
        source: data?.reason ?? "sse",
      });
    };

    source.addEventListener("session_revoked", handleSessionRevoked);
    source.addEventListener("keepalive", () => {});
    source.onerror = () => {
      // EventSource reintenta automáticamente mientras la sesión siga vigente.
    };

    return () => {
      source.close();
      if (sourceRef.current === source) {
        sourceRef.current = null;
      }
    };
  }, [accessToken, logout, openRemoteLogoutNotice]);
};

