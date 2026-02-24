/**
 * SessionExpiryModal.jsx
 * Modal de aviso de expiración de sesión.
 *
 * Comportamiento:
 * - Se muestra cuando quedan WARN_BEFORE_SECONDS antes de que expire el token.
 * - Muestra un countdown regresivo.
 * - "Mantener sesión activa" llama a refreshNow() y cierra el modal.
 * - Si el countdown llega a FORCE_LOGOUT_AT_SECONDS (10s antes de expirar), fuerza logout.
 * - Se monta en App.jsx junto al ToasterManager — no usa ModalManager para mayor control.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import useAuthStore from "@/store/authStore";
import { refreshNow } from "@/services/axiosInterceptor";

import logger from "@/utils/logger";
const log = logger.scope("sessionExpiry");

// ─── Configuración ────────────────────────────────────────────────────────────

/** Cuántos segundos antes de expirar se muestra el modal */
const WARN_BEFORE_SECONDS = 120; // 2 min

/** Cuántos segundos antes de expirar se fuerza el logout (sin esperar al usuario) */
const FORCE_LOGOUT_AT_SECONDS = 10;

/** Cada cuántos ms se revisa el token */
const CHECK_INTERVAL_MS = 5_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getSecondsLeft = (expiresAt) => {
    if (!expiresAt) return Infinity;
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
};

const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
};

// ─── Componente ───────────────────────────────────────────────────────────────

const SessionExpiryModal = () => {
    const expiresAt = useAuthStore((s) => s.expiresAt);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const logout = useAuthStore((s) => s.logout);

    const [visible, setVisible] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(WARN_BEFORE_SECONDS);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const forcedRef = useRef(false); // evita doble logout

    // ─── Tick cada segundo cuando el modal está visible ───────────────────────

    useEffect(() => {
        if (!visible) return;

        const tick = setInterval(() => {
            const left = getSecondsLeft(expiresAt);
            setSecondsLeft(left);

            // Forzar logout 10s antes de que expire (para evitar que el usuario
            // presione justo en el segundo 0 y el token ya haya expirado)
            if (left <= FORCE_LOGOUT_AT_SECONDS && !forcedRef.current) {
                forcedRef.current = true;
                log.warn("[SessionExpiry] Timeout alcanzado — forzando logout");
                logout("Session expired — countdown reached zero");
            }
        }, 1_000);

        return () => clearInterval(tick);
    }, [visible, expiresAt, logout]);

    // ─── Polling para detectar cuándo mostrar el modal ────────────────────────

    useEffect(() => {
        if (!isAuthenticated) {
            setVisible(false);
            forcedRef.current = false;
            return;
        }

        const check = () => {
            const left = getSecondsLeft(expiresAt);

            if (left <= WARN_BEFORE_SECONDS && left > 0) {
                setSecondsLeft(left);
                setVisible(true);
            } else if (left > WARN_BEFORE_SECONDS) {
                // Token todavía tiene tiempo — asegurarse de que el modal esté cerrado
                setVisible(false);
                forcedRef.current = false;
                setError(null);
            }
        };

        check(); // revisar inmediatamente al montar / cambiar expiresAt
        const id = setInterval(check, CHECK_INTERVAL_MS);
        return () => clearInterval(id);
    }, [isAuthenticated, expiresAt]);

    // ─── Mantener sesión ──────────────────────────────────────────────────────

    const handleKeepAlive = useCallback(async () => {
        setRefreshing(true);
        setError(null);
        try {
            await refreshNow();
            log.info("[SessionExpiry] Token refrescado — modal cerrado");
            setVisible(false);
            forcedRef.current = false;
        } catch (err) {
            log.error("[SessionExpiry] Error al refrescar:", err);
            setError("No fue posible renovar la sesión. Intenta de nuevo.");
        } finally {
            setRefreshing(false);
        }
    }, []);

    // ─── Calcular % para el anillo de progreso ────────────────────────────────

    const pct = Math.min(1, Math.max(0, secondsLeft / WARN_BEFORE_SECONDS));
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference * (1 - pct);

    const ringColor =
        secondsLeft > 60 ? "#3b82f6"   // azul
            : secondsLeft > 30 ? "#f59e0b" // ámbar
                : "#ef4444";                    // rojo

    if (!visible || !isAuthenticated) return null;

    return (
        <>
            {/* ── Backdrop ── */}
            <div
                className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm"
                aria-hidden="true"
            />

            {/* ── Modal ── */}
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="session-expiry-title"
                className="
          fixed inset-0 z-[10000] flex items-center justify-center p-4
        "
            >
                <div className="
          w-full max-w-md
          bg-white dark:bg-gray-900
          rounded-2xl shadow-2xl
          border border-gray-200 dark:border-gray-700
          overflow-hidden
          animate-[fadeInScale_0.2s_ease-out]
        ">

                    {/* ── Franja superior azul ── */}
                    <div className="h-1.5 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-500" />

                    {/* ── Cuerpo ── */}
                    <div className="p-8 flex flex-col items-center text-center">

                        {/* Logo */}
                        <div className="mb-5 w-16 h-16 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm flex-shrink-0">
                            <img
                                src="/images/chinchinAItor.jpg"
                                alt="MinuetAItor"
                                className="w-full h-full object-cover"
                            />
                        </div>

                        {/* Título */}
                        <h2
                            id="session-expiry-title"
                            className="text-xl font-bold text-gray-900 dark:text-white mb-1"
                        >
                            Tu sesión está por expirar
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-[30ch]">
                            Por seguridad, cerraremos tu sesión automáticamente.
                        </p>

                        {/* Anillo de countdown */}
                        <div className="relative flex items-center justify-center mb-6">
                            <svg width="96" height="96" className="-rotate-90">
                                {/* Track */}
                                <circle
                                    cx="48" cy="48" r={radius}
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="6"
                                    className="text-gray-200 dark:text-gray-700"
                                />
                                {/* Progreso */}
                                <circle
                                    cx="48" cy="48" r={radius}
                                    fill="none"
                                    stroke={ringColor}
                                    strokeWidth="6"
                                    strokeLinecap="round"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={dashOffset}
                                    style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.5s ease" }}
                                />
                            </svg>
                            {/* Tiempo en el centro */}
                            <div className="absolute flex flex-col items-center">
                                <span
                                    className="text-2xl font-bold tabular-nums"
                                    style={{ color: ringColor }}
                                >
                                    {formatTime(secondsLeft)}
                                </span>
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-0.5">
                                    restantes
                                </span>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="w-full mb-4 px-4 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
                                {error}
                            </div>
                        )}

                        {/* Botones */}
                        <div className="flex flex-col gap-3 w-full">
                            <button
                                type="button"
                                onClick={handleKeepAlive}
                                disabled={refreshing}
                                className="
                  w-full py-3 rounded-xl font-semibold text-sm
                  bg-blue-600 hover:bg-blue-700 active:bg-blue-800
                  text-white
                  disabled:opacity-60 disabled:cursor-not-allowed
                  transition-colors
                  flex items-center justify-center gap-2
                "
                            >
                                {refreshing ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Renovando sesión...
                                    </>
                                ) : (
                                    "Mantener sesión activa"
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => logout("User chose to logout from expiry modal")}
                                disabled={refreshing}
                                className="
                  w-full py-2.5 rounded-xl font-medium text-sm
                  text-gray-600 dark:text-gray-400
                  hover:bg-gray-100 dark:hover:bg-gray-800
                  disabled:opacity-60 disabled:cursor-not-allowed
                  transition-colors
                "
                            >
                                Cerrar sesión ahora
                            </button>
                        </div>

                    </div>

                    {/* ── Footer informativo ── */}
                    <div className="px-8 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                        <p className="text-xs text-center text-gray-400 dark:text-gray-500">
                            MinuetAItor · Sesión corporativa segura
                        </p>
                    </div>

                </div>
            </div>
        </>
    );
};

export default SessionExpiryModal;