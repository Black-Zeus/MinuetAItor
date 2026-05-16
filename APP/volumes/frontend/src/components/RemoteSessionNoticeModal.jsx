import React, { useCallback, useEffect, useState } from "react";
import useAuthStore from "@/store/authStore";

const AUTO_REDIRECT_SECONDS = 30;
const LOGIN_PATH = "/login";

const RemoteSessionNoticeModal = () => {
  const notice = useAuthStore((s) => s.remoteLogoutNotice);
  const closeRemoteLogoutNotice = useAuthStore((s) => s.closeRemoteLogoutNotice);
  const [secondsLeft, setSecondsLeft] = useState(AUTO_REDIRECT_SECONDS);

  const redirectToLogin = useCallback(() => {
    closeRemoteLogoutNotice();
    window.location.replace(LOGIN_PATH);
  }, [closeRemoteLogoutNotice]);

  useEffect(() => {
    if (!notice?.isOpen) {
      setSecondsLeft(AUTO_REDIRECT_SECONDS);
      return;
    }

    setSecondsLeft(AUTO_REDIRECT_SECONDS);
    const timer = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          clearInterval(timer);
          redirectToLogin();
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [notice?.detectedAt, notice?.isOpen, redirectToLogin]);

  if (!notice?.isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[10020] bg-black/65 backdrop-blur-sm" aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="remote-session-title"
        className="fixed inset-0 z-[10021] flex items-center justify-center p-4"
      >
        <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-2xl dark:border-amber-900/50 dark:bg-gray-900">
          <div className="h-1.5 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500" />

          <div className="p-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-gray-200 shadow-sm dark:border-gray-700">
              <img
                src="/images/chinchinAItor.jpg"
                alt="MinuetAItor"
                className="h-full w-full object-cover"
              />
            </div>

            <h2 id="remote-session-title" className="mb-2 text-xl font-bold text-gray-900 dark:text-white">
              {notice.title || "Esta sesión fue cerrada"}
            </h2>

            <p className="mx-auto mb-4 max-w-[42ch] text-sm leading-6 text-gray-600 dark:text-gray-300">
              {notice.message}
            </p>

            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              Si no esperabas este cierre, vuelve a iniciar sesión y solicita apoyo a una persona administradora o al equipo responsable del sistema.
            </div>

            <div className="mb-6 text-sm font-medium text-gray-500 dark:text-gray-400">
              Serás redirigido automáticamente en <span className="font-bold text-gray-900 dark:text-white">{secondsLeft}s</span>.
            </div>

            <button
              type="button"
              onClick={redirectToLogin}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
            >
              Ir a iniciar sesión
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default RemoteSessionNoticeModal;

