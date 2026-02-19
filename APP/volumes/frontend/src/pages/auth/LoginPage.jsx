/**
 * pages/auth/Login/LoginPage.jsx
 * Página de Login - MinuetAItor
 * - Integrado con baseSiteStore (toggleTheme / theme)
 * - Modo oscuro como default si no hay preferencia guardada
 * - Toggle sol/luna en la esquina superior-derecha del card
 */

import React, { useState, useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaSun, FaMoon, FaEye, FaEyeSlash, FaCircleExclamation } from 'react-icons/fa6';
import useAuthStore from '@store/authStore';
import useBaseSiteStore from '@store/baseSiteStore';

// ─── Versión ──────────────────────────────────────────────────────────────────
const APP_VERSION = '1.0.0';

// ─── Componente principal ─────────────────────────────────────────────────────
const LoginPage = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Auth
    const { login, isLoading } = useAuthStore();

    // Tema global — persiste en localStorage y aplica clase .dark en <html>
    const { theme, toggleTheme, setTheme } = useBaseSiteStore();

    // Forzar dark si no hay preferencia guardada aún
    useLayoutEffect(() => {
        const stored = localStorage.getItem('minuteAItor-base-site');
        if (!stored) {
            setTheme('dark');
        }
        // Sincronizar clase en <html> con el valor actual del store
        document.documentElement.classList.toggle('dark', theme === 'dark');
    }, []);

    // Re-aplicar clase cuando cambia el tema
    useLayoutEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
    }, [theme]);

    // Form state
    const [email,      setEmail]      = useState('');
    const [password,   setPassword]   = useState('');
    const [showPass,   setShowPass]   = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [error,      setError]      = useState('');

    const from = location.state?.from || '/';

    // ── Submit ─────────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!email || !password) {
            setError('Por favor, completa todos los campos.');
            return;
        }

        try {
            await login({ email, password, rememberMe });
            navigate(from, { replace: true });
        } catch (err) {
            setError(err?.message || 'Credenciales incorrectas. Inténtalo de nuevo.');
        }
    };

    const isDark = theme === 'dark';

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="
            min-h-screen grid place-items-center
            px-4 py-10 sm:px-6 lg:px-12
            transition-colors duration-300
            bg-gradient-to-b
            from-slate-800 to-slate-900
            dark:from-slate-900 dark:to-black
        ">
            {/* Blob decorativo izquierdo */}
            <div className="
                pointer-events-none absolute -top-40 -left-40
                w-[700px] h-[400px] rounded-full
                bg-blue-500/20 dark:bg-blue-500/15 blur-[120px]
            " />
            {/* Blob decorativo derecho */}
            <div className="
                pointer-events-none absolute bottom-0 right-0
                w-[500px] h-[400px] rounded-full
                bg-sky-400/15 dark:bg-sky-400/10 blur-[120px]
            " />

            <div className="relative w-full flex justify-center">

                {/* ══════════════ CARD ══════════════ */}
                <div className="
                    w-full max-w-5xl relative
                    grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]
                    rounded-[22px] overflow-hidden
                    border border-white/10
                    shadow-[0_22px_60px_rgba(0,0,0,0.45)]
                    bg-slate-700/60 dark:bg-slate-900/70
                    backdrop-blur-[16px]
                    transition-colors duration-300
                ">

                    {/* ── Toggle tema (esquina superior-derecha del card) ── */}
                    <button
                        onClick={toggleTheme}
                        aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                        title={isDark  ? 'Modo claro' : 'Modo oscuro'}
                        className="
                            absolute top-3.5 right-3.5 z-10
                            w-9 h-9 flex items-center justify-center
                            rounded-xl
                            border border-white/15
                            bg-white/10 hover:bg-white/20
                            transition-all duration-200
                        "
                    >
                        {isDark
                            ? <FaSun  className="w-[15px] h-[15px] text-amber-300" />
                            : <FaMoon className="w-[15px] h-[15px] text-slate-300" />
                        }
                    </button>

                    {/* ══════ PANEL IZQUIERDO — BRAND ══════ */}
                    <aside className="
                        p-7 sm:p-10
                        bg-[radial-gradient(800px_400px_at_20%_10%,rgba(59,130,246,0.18),transparent_60%),
                             radial-gradient(700px_420px_at_80%_70%,rgba(14,165,233,0.12),transparent_60%)]
                    ">
                        <div className="h-full flex flex-col gap-6">

                            {/* Logo + título */}
                            <div className="grid grid-cols-[160px_1fr] sm:grid-cols-[220px_1fr] gap-5 sm:gap-7 items-center">

                                <div className="
                                    w-40 h-40 sm:w-[220px] sm:h-[220px]
                                    rounded-[24px] overflow-hidden flex-shrink-0
                                    border border-white/15
                                    shadow-[0_12px_35px_rgba(0,0,0,0.35)]
                                ">
                                    <img
                                        src="/chinchinAItor.jpg"
                                        alt="Logo MinuetAItor"
                                        className="w-full h-full object-cover"
                                    />
                                </div>

                                <div className="text-center">
                                    <h1 className="text-3xl sm:text-[2.2rem] font-bold leading-tight text-white">
                                        MinuetAItor
                                    </h1>
                                    <p className="mt-2 text-[0.95rem] sm:text-[1.05rem] text-slate-300 max-w-[40ch] mx-auto">
                                        Estandariza acuerdos y transforma reuniones en ejecución operativa
                                    </p>
                                </div>
                            </div>

                            {/* Descripción */}
                            <p className="
                                text-[0.97rem] leading-[1.6] text-center
                                text-slate-300 max-w-[60ch] mx-auto
                            ">
                                MinuetAItor convierte reuniones en resultados operativos.
                                Centraliza decisiones, estructura acuerdos y automatiza la generación
                                de minutas, compromisos y requerimientos, asegurando responsables,
                                fechas comprometidas y trazabilidad continua.
                            </p>

                            {/* Pill footer */}
                            <div className="mt-auto" aria-hidden="true">
                                <span className="
                                    inline-flex items-center px-4 py-2.5
                                    rounded-full text-[0.82rem]
                                    border border-white/12
                                    bg-white/[0.06]
                                    text-slate-400
                                ">
                                    Entorno Corporativo · Acceso Autenticado y Auditado
                                </span>
                            </div>

                        </div>
                    </aside>

                    {/* ══════ PANEL DERECHO — FORMULARIO ══════ */}
                    <section className="
                        p-7 sm:p-10
                        bg-slate-800/70 dark:bg-slate-900/80
                        border-t lg:border-t-0 lg:border-l border-white/10
                        transition-colors duration-300
                    ">
                        <div className="flex flex-col h-full gap-4">

                            {/* Cabecera */}
                            <header>
                                <h2 className="text-[1.4rem] font-semibold text-white m-0">
                                    Acceso
                                </h2>
                                <p className="mt-1.5 text-slate-400">
                                    Ingresa tus credenciales corporativas para continuar.
                                </p>
                            </header>

                            {/* Error global */}
                            {error && (
                                <div className="
                                    flex items-center gap-2 px-4 py-3
                                    rounded-xl text-sm
                                    bg-red-900/30 border border-red-700/50
                                    text-red-300
                                ">
                                    <FaCircleExclamation className="w-4 h-4 flex-shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {/* Form */}
                            <form
                                id="loginForm"
                                onSubmit={handleSubmit}
                                autoComplete="on"
                                noValidate
                                className="grid gap-3.5"
                            >
                                {/* Email */}
                                <div className="grid gap-2">
                                    <label htmlFor="email" className="text-sm font-medium text-slate-300">
                                        Correo electrónico
                                    </label>
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        autoComplete="email"
                                        placeholder="usuario@dominio.cl"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="
                                            px-3 py-3 rounded-[14px]
                                            border border-slate-600/50
                                            bg-slate-700/60 dark:bg-slate-800/70
                                            text-white placeholder-slate-500
                                            focus:outline-none focus:ring-2 focus:ring-blue-500/40
                                            transition-all
                                        "
                                    />
                                </div>

                                {/* Contraseña */}
                                <div className="grid gap-2">
                                    <label htmlFor="password" className="text-sm font-medium text-slate-300">
                                        Contraseña
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPass ? 'text' : 'password'}
                                            id="password"
                                            name="password"
                                            autoComplete="current-password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="
                                                w-full px-3 py-3 pr-12 rounded-[14px]
                                                border border-slate-600/50
                                                bg-slate-700/60 dark:bg-slate-800/70
                                                text-white
                                                focus:outline-none focus:ring-2 focus:ring-blue-500/40
                                                transition-all
                                            "
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPass(!showPass)}
                                            aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                            className="
                                                absolute right-2.5 top-1/2 -translate-y-1/2
                                                w-[34px] h-[34px]
                                                flex items-center justify-center
                                                rounded-xl border border-slate-600/40
                                                bg-slate-600/50 hover:bg-slate-500/60
                                                text-slate-300
                                                transition-colors
                                            "
                                        >
                                            {showPass
                                                ? <FaEyeSlash className="w-4 h-4" />
                                                : <FaEye      className="w-4 h-4" />
                                            }
                                        </button>
                                    </div>
                                </div>

                                {/* Recordarme */}
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="w-4 h-4 rounded accent-blue-500"
                                    />
                                    <span className="text-sm text-slate-400">Recordarme</span>
                                </label>

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="
                                        w-full py-3 px-4 mt-1
                                        rounded-xl font-semibold text-white
                                        bg-blue-600 hover:bg-blue-500
                                        disabled:opacity-50 disabled:cursor-not-allowed
                                        transition-colors
                                        flex items-center justify-center gap-2
                                    "
                                >
                                    {isLoading ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Iniciando sesión...</span>
                                        </>
                                    ) : (
                                        'Iniciar Sesión'
                                    )}
                                </button>
                            </form>

                            {/* Footer links */}
                            <footer className="mt-auto pt-2">
    <div className="flex items-center justify-center gap-2 text-sm text-slate-400 flex-wrap">
        <span className="text-slate-600 select-none">·</span>
        <a href="/forgot-password" className="font-medium text-blue-400 hover:text-blue-300 transition-colors">
            ¿Olvidaste tu contraseña?
        </a>
        <span className="text-slate-600 select-none">·</span>
        <a href="#" className="font-medium text-blue-400 hover:text-blue-300 transition-colors">
            Solicitar alta
        </a>
        <span className="text-slate-600 select-none">·</span>
    </div>
</footer>

                        </div>
                    </section>

                </div>

                {/* Badge versión */}
                <span className="
                    absolute right-2 -bottom-7
                    text-[0.8rem] text-slate-500
                    pointer-events-none select-none
                ">
                    v{APP_VERSION}
                </span>

            </div>
        </div>
    );
};

export default LoginPage;