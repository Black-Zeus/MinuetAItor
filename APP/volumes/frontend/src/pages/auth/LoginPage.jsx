/**
 * pages/auth/Login/LoginPage.jsx
 * Página de Login - MinuetAItor
 */

import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaSun, FaMoon, FaEye, FaEyeSlash, FaCircleExclamation, FaTriangleExclamation } from 'react-icons/fa6';
import useAuthStore from '@store/authStore';
import useBaseSiteStore from '@store/baseSiteStore';
import {
    getAccessRequestStatus,
    login as apiLogin,
    submitAccessRequest,
} from '@/services/authService';
import systemMaintenanceService from '@/services/systemMaintenanceService';
import { APP_VERSION } from '@/utils/environment';
import { applyThemeToDocument, resolveThemeMode } from '@/utils/theme';

const AccessRequestModal = ({ onClose, onDisabled }) => {
    const [form, setForm] = useState({ fullName: '', email: '', observation: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCheckingStatus, setIsCheckingStatus] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        let alive = true;
        getAccessRequestStatus()
            .then((result) => {
                if (!alive) return;
                if (!result?.enabled) {
                    onDisabled?.();
                    return;
                }
                setIsCheckingStatus(false);
            })
            .catch(() => {
                if (!alive) return;
                setError('No fue posible validar si las solicitudes de alta están habilitadas.');
                setIsCheckingStatus(false);
            });

        return () => {
            alive = false;
        };
    }, [onDisabled]);

    const handleChange = (field) => (event) => {
        setForm((prev) => ({ ...prev, [field]: event.target.value }));
        if (error) setError('');
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        if (!form.fullName.trim() || !form.email.trim()) {
            setError('Ingresa nombre y correo para enviar la solicitud.');
            return;
        }

        let shouldResetSubmitting = true;
        setIsSubmitting(true);
        try {
            const status = await getAccessRequestStatus();
            if (!status?.enabled) {
                shouldResetSubmitting = false;
                onDisabled?.();
                return;
            }
            await submitAccessRequest(form);
            setSuccess(true);
        } catch (err) {
            setError(err?.message || 'No fue posible enviar la solicitud.');
        } finally {
            if (shouldResetSubmitting) setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4 py-6 backdrop-blur-sm">
            <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
                    <div>
                        <h2 className="text-xl font-semibold text-white">Solicitar alta</h2>
                        <p className="mt-1 text-sm text-slate-400">
                            Completa tus datos para que un administrador revise la solicitud.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 hover:bg-white/10"
                    >
                        Cerrar
                    </button>
                </div>

                {success ? (
                    <div className="space-y-5 px-6 py-6">
                        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-100">
                            <p className="font-semibold">Solicitud recibida</p>
                            <p className="mt-1 text-emerald-100/80">
                                Notificamos a los administradores y enviamos una confirmación al correo indicado.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-500"
                        >
                            Entendido
                        </button>
                    </div>
                ) : isCheckingStatus ? (
                    <div className="px-6 py-6">
                        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
                            Validando disponibilidad de solicitudes de alta...
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4 px-6 py-6">
                        {error ? (
                            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                                {error}
                            </div>
                        ) : null}

                        <label className="block">
                            <span className="text-sm font-medium text-slate-300">Nombre completo</span>
                            <input
                                type="text"
                                value={form.fullName}
                                onChange={handleChange('fullName')}
                                autoFocus
                                maxLength={200}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none transition focus:border-blue-400"
                                placeholder="Ej: María González"
                            />
                        </label>

                        <label className="block">
                            <span className="text-sm font-medium text-slate-300">Correo electrónico</span>
                            <input
                                type="email"
                                value={form.email}
                                onChange={handleChange('email')}
                                maxLength={200}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none transition focus:border-blue-400"
                                placeholder="usuario@empresa.com"
                            />
                        </label>

                        <label className="block">
                            <span className="text-sm font-medium text-slate-300">Observación</span>
                            <textarea
                                value={form.observation}
                                onChange={handleChange('observation')}
                                rows={4}
                                maxLength={1000}
                                className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none transition focus:border-blue-400"
                                placeholder="Área, motivo o contexto para el alta..."
                            />
                        </label>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isSubmitting ? 'Enviando solicitud...' : 'Enviar solicitud'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

const LoginPage = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const { login: storeLogin, isLoading } = useAuthStore();

    // ── CAMBIO 1: usar selector isSidebarCollapsed → theme desde nuevo schema ──
    // theme, toggleTheme, setTheme siguen igual — no cambia la API pública
    const { theme, toggleTheme, setTheme } = useBaseSiteStore();

    // ── CAMBIO 2: la key de localStorage cambió de 'minuteAItor-base-site' → 'site-storage' ──
    useLayoutEffect(() => {
        const stored = localStorage.getItem('site-storage') || localStorage.getItem('minuteAItor-base-site');
        if (!stored) setTheme('system');
        applyThemeToDocument(theme);
    }, []);

    useLayoutEffect(() => {
        applyThemeToDocument(theme);
    }, [theme]);

    const [credential, setCredential] = useState('');
    const [password, setPassword]     = useState('');
    const [showPass, setShowPass]     = useState(false);
    const [error, setError]           = useState('');
    const [errorTitle, setErrorTitle] = useState('Acceso denegado');
    const [errorTone, setErrorTone]   = useState('error');
    const [operationMode, setOperationMode] = useState('normal');
    const [operationType, setOperationType] = useState('');
    const [accessRequestEnabled, setAccessRequestEnabled] = useState(false);
    const [showAccessRequestModal, setShowAccessRequestModal] = useState(false);

    useEffect(() => {
        let alive = true;
        getAccessRequestStatus()
            .then((result) => {
                if (alive) setAccessRequestEnabled(Boolean(result?.enabled));
            })
            .catch(() => {
                if (alive) setAccessRequestEnabled(false);
            });
        systemMaintenanceService.getPublicOperationState()
            .then((state) => {
                if (!alive) return;
                const mode = state?.mode || 'normal';
                const type = state?.operationType || '';
                setOperationMode(mode);
                setOperationType(type);
                if (mode === 'normal') return;
                const isReadOnly = mode === 'read_only';
                const isCommissioning = mode === 'commissioning';
                const isManual = String(type).startsWith('manual_');
                setErrorTitle(isReadOnly ? 'Sistema en solo lectura' : isCommissioning ? 'Sistema en puesta en marcha' : 'Sistema en mantenimiento');
                setErrorTone('maintenance');
                setError(
                    isReadOnly
                        ? 'El sistema se encuentra habilitado solo para consulta. Puedes iniciar sesión para revisar información, pero las acciones que modifiquen datos permanecerán bloqueadas.'
                        : isCommissioning
                            ? 'El sistema aún no se encuentra habilitado para operación productiva. Durante este estado, solo los administradores pueden iniciar sesión, realizar configuraciones y ejecutar transacciones de validación.'
                        : isManual
                            ? 'El sistema se encuentra temporalmente fuera de operación general. Solo administradores pueden ingresar para administrar o recuperar el servicio.'
                            : 'El sistema se encuentra temporalmente fuera de operación general mientras se realizan tareas de mantenimiento.'
                );
            })
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, []);

    const from = location.state?.from || '/';

    const handleOpenAccessRequestModal = async () => {
        setError('');
        try {
            const result = await getAccessRequestStatus();
            if (!result?.enabled) {
                setAccessRequestEnabled(false);
                setShowAccessRequestModal(false);
                setErrorTitle('Solicitud de alta deshabilitada');
                setErrorTone('maintenance');
                setError('La solicitud de alta fue deshabilitada por un administrador.');
                return;
            }
            setAccessRequestEnabled(true);
            setShowAccessRequestModal(true);
        } catch {
            setErrorTitle('No se pudo validar la solicitud');
            setErrorTone('error');
            setError('No fue posible confirmar si la solicitud de alta está disponible.');
        }
    };

    const handleAccessRequestDisabled = () => {
        setAccessRequestEnabled(false);
        setShowAccessRequestModal(false);
        setErrorTitle('Solicitud de alta deshabilitada');
        setErrorTone('maintenance');
        setError('La solicitud de alta fue deshabilitada por un administrador.');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setErrorTitle('Acceso denegado');
        setErrorTone(operationMode === 'normal' ? 'error' : 'maintenance');

        const isManualOperation = String(operationType).startsWith('manual_');
        if (operationMode === 'maintenance' && !isManualOperation) {
            setErrorTitle('Sistema en mantenimiento');
            setError(
                'El sistema se encuentra temporalmente fuera de operación general mientras se realizan tareas de mantenimiento.'
            );
            return;
        }

        if (!credential || !password) {
            setErrorTitle('Datos requeridos');
            setError('Por favor, completa todos los campos.');
            return;
        }

        try {
            const tokenResponse = await apiLogin({ credential, password });
            // storeLogin ahora también dispara sessionStore.loadFromApi() automáticamente
            storeLogin(tokenResponse);
            if (operationMode === 'commissioning') {
                navigate('/settings/system?tab=commissioning', { replace: true });
                return;
            }
            if (operationMode === 'maintenance' && isManualOperation) {
                navigate('/settings/system?tab=maintenance', { replace: true });
                return;
            }
            navigate(from, { replace: true });
        } catch (err) {
            const status = err?.status ?? 0;
            if (status === 401) {
                setErrorTitle('Credenciales incorrectas');
                setError('Las credenciales ingresadas no son válidas. Por favor, inténtalo de nuevo.');
            } else if (status === 503 && err?.maintenance) {
                setErrorTitle(err?.title || 'Sistema en mantenimiento');
                setErrorTone('maintenance');
                setError(err?.message || 'El sistema se encuentra temporalmente fuera de operación general.');
            } else if (status === 0) {
                setErrorTitle('Sin conexión');
                setError('No se pudo conectar al servidor. Verifica tu conexión e intenta nuevamente.');
            } else {
                setErrorTitle(err?.title || 'Acceso denegado');
                setError(err?.title || err?.message || 'Ocurrió un error al iniciar sesión.');
            }
        }
    };

    const isDark = resolveThemeMode(theme) === 'dark';

    return (
        <div className="
            min-h-screen grid place-items-center
            px-4 py-10 sm:px-6 lg:px-12
            transition-colors duration-300
            bg-gradient-to-b
            from-slate-800 to-slate-900
            dark:from-slate-900 dark:to-black
        ">
            <div className="
                pointer-events-none absolute -top-40 -left-40
                w-[700px] h-[400px] rounded-full
                bg-blue-500/20 dark:bg-blue-500/15 blur-[120px]
            " />
            <div className="
                pointer-events-none absolute bottom-0 right-0
                w-[500px] h-[400px] rounded-full
                bg-sky-400/15 dark:bg-sky-400/10 blur-[120px]
            " />

            <div className="relative w-full flex justify-center">

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

                    <button
                        onClick={toggleTheme}
                        aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                        title={isDark ? 'Modo claro' : 'Modo oscuro'}
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
                            ? <FaSun className="w-[15px] h-[15px] text-amber-300" />
                            : <FaMoon className="w-[15px] h-[15px] text-slate-300" />
                        }
                    </button>

                    <aside className="
                        p-7 sm:p-10
                        bg-[radial-gradient(800px_400px_at_20%_10%,rgba(59,130,246,0.18),transparent_60%),
                             radial-gradient(700px_420px_at_80%_70%,rgba(14,165,233,0.12),transparent_60%)]
                    ">
                        <div className="h-full flex flex-col gap-6">

                            <div className="grid grid-cols-[160px_1fr] sm:grid-cols-[220px_1fr] gap-5 sm:gap-7 items-center">
                                <div className="
                                    w-40 h-40 sm:w-[220px] sm:h-[220px]
                                    rounded-[24px] overflow-hidden flex-shrink-0
                                    border border-white/15
                                    shadow-[0_12px_35px_rgba(0,0,0,0.35)]
                                ">
                                    <img
                                        src="/images/chinchinAItor.jpg"
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

                            <p className="
                                text-[0.97rem] leading-[1.6] text-center
                                text-slate-300 max-w-[60ch] mx-auto
                            ">
                                MinuetAItor convierte reuniones en resultados operativos.
                                Centraliza decisiones, estructura acuerdos y automatiza la generación
                                de minutas, compromisos y requerimientos, asegurando responsables,
                                fechas comprometidas y trazabilidad continua.
                            </p>

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

                    <section className="
                        p-7 sm:p-10
                        bg-slate-800/70 dark:bg-slate-900/80
                        border-t lg:border-t-0 lg:border-l border-white/10
                        transition-colors duration-300
                    ">
                        <div className="flex flex-col h-full gap-4">

                            <header>
                                <h2 className="text-[1.4rem] font-semibold text-white m-0">
                                    Acceso
                                </h2>
                                <p className="mt-1.5 text-slate-400">
                                    Ingresa tus credenciales corporativas para continuar.
                                </p>
                            </header>

                            {error && (
                                <div className={`
                                    flex items-start gap-3 px-4 py-3.5
                                    rounded-xl text-sm
                                    ${errorTone === 'maintenance'
                                        ? 'bg-amber-500/10 border border-amber-500/40 text-amber-200'
                                        : 'bg-red-500/10 border border-red-500/40 text-red-300'}
                                    animate-pulse-once
                                `}>
                                    {errorTone === 'maintenance' ? (
                                        <FaTriangleExclamation className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-300" />
                                    ) : (
                                        <FaCircleExclamation className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
                                    )}
                                    <div>
                                        <p className={errorTone === 'maintenance' ? 'font-medium text-amber-100' : 'font-medium text-red-200'}>{errorTitle}</p>
                                        <p className={errorTone === 'maintenance' ? 'mt-0.5 text-amber-100/80' : 'mt-0.5 text-red-300/80'}>{error}</p>
                                    </div>
                                </div>
                            )}

                            <form
                                id="loginForm"
                                onSubmit={handleSubmit}
                                autoComplete="on"
                                noValidate
                                className="grid gap-3.5"
                            >
                                <div className="grid gap-2">
                                    <label htmlFor="credential" className="text-sm font-medium text-slate-300">
                                        Usuario o correo electrónico
                                    </label>
                                    <input
                                        type="text"
                                        id="credential"
                                        name="credential"
                                        autoComplete="username"
                                        placeholder="usuario o usuario@dominio.cl"
                                        required
                                        value={credential}
                                        onChange={(e) => setCredential(e.target.value)}
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
                                                : <FaEye className="w-4 h-4" />
                                            }
                                        </button>
                                    </div>
                                </div>

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

                            <footer className="mt-auto pt-2">
                                <div className="flex items-center justify-center gap-2 text-sm text-slate-400 flex-wrap">
                                    <span className="text-slate-600 select-none">·</span>
                                    <a href="/forgot-password" className="font-medium text-blue-400 hover:text-blue-300 transition-colors">
                                        ¿Olvidaste tu contraseña?
                                    </a>
                                    {accessRequestEnabled ? (
                                        <>
                                            <span className="text-slate-600 select-none">·</span>
                                            <button
                                                type="button"
                                                onClick={handleOpenAccessRequestModal}
                                                className="font-medium text-blue-400 transition-colors hover:text-blue-300"
                                            >
                                                Solicitar alta
                                            </button>
                                            <span className="text-slate-600 select-none">·</span>
                                        </>
                                    ) : null}
                                </div>
                            </footer>

                        </div>
                    </section>

                </div>

                {APP_VERSION && (
                    <span className="
                        absolute right-2 -bottom-7
                        text-[0.8rem] text-slate-500
                        pointer-events-none select-none
                    ">
                        v{APP_VERSION}
                    </span>
                )}

                {showAccessRequestModal ? (
                    <AccessRequestModal
                        onClose={() => setShowAccessRequestModal(false)}
                        onDisabled={handleAccessRequestDisabled}
                    />
                ) : null}

            </div>
        </div>
    );
};

export default LoginPage;
