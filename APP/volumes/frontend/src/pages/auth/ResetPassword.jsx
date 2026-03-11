import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FaMoon, FaSun } from 'react-icons/fa6';
import Icon from '@/components/ui/icon/iconManager';
import useBaseSiteStore from '@store/baseSiteStore';
import { resetPassword as submitPasswordReset } from '@/services/authService';

const AUTH_LOGO_SRC = '/images/chinchinAItor.jpg';
const APP_VERSION = '1.0.0';

const PASSWORD_RULES = [
  { id: 'length', label: 'Mínimo 8 caracteres', test: (v) => v.length >= 8 },
  { id: 'upper', label: 'Al menos una mayúscula', test: (v) => /[A-Z]/.test(v) },
  { id: 'lower', label: 'Al menos una minúscula', test: (v) => /[a-z]/.test(v) },
  { id: 'number', label: 'Al menos un número', test: (v) => /\d/.test(v) },
  { id: 'special', label: 'Al menos un carácter especial', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

const getStrength = (password) => {
  const passed = PASSWORD_RULES.filter((rule) => rule.test(password)).length;
  if (passed <= 1) return { level: 0, label: 'Muy débil', color: 'bg-red-500' };
  if (passed === 2) return { level: 1, label: 'Débil', color: 'bg-orange-500' };
  if (passed === 3) return { level: 2, label: 'Regular', color: 'bg-yellow-500' };
  if (passed === 4) return { level: 3, label: 'Fuerte', color: 'bg-blue-500' };
  return { level: 4, label: 'Muy fuerte', color: 'bg-green-500' };
};

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme, toggleTheme, setTheme } = useBaseSiteStore();

  const tokenFromQuery = searchParams.get('token') || '';

  const [form, setForm] = useState({ token: tokenFromQuery, password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [countdown, setCountdown] = useState(5);

  useLayoutEffect(() => {
    const stored = localStorage.getItem('site-storage');
    if (!stored) setTheme('dark');
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, []);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    setForm((prev) => (prev.token === tokenFromQuery ? prev : { ...prev, token: tokenFromQuery }));
  }, [tokenFromQuery]);

  useEffect(() => {
    if (!success) return;
    if (countdown <= 0) {
      navigate('/auth/login');
      return;
    }
    const timeout = setTimeout(() => setCountdown((current) => current - 1), 1000);
    return () => clearTimeout(timeout);
  }, [countdown, navigate, success]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
    if (globalError) setGlobalError('');
    if (field === 'token' && tokenInvalid) setTokenInvalid(false);
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.token.trim()) {
      nextErrors.token = 'Debes ingresar el token de recuperación.';
    }
    if (!form.password) {
      nextErrors.password = 'La contraseña es requerida.';
    } else if (PASSWORD_RULES.some((rule) => !rule.test(form.password))) {
      nextErrors.password = 'La contraseña no cumple todos los requisitos.';
    }

    if (!form.confirm) {
      nextErrors.confirm = 'Debes confirmar tu contraseña.';
    } else if (form.password !== form.confirm) {
      nextErrors.confirm = 'Las contraseñas no coinciden.';
    }

    return nextErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);
    try {
      await submitPasswordReset({
        token: form.token.trim(),
        new_password: form.password,
        confirm_password: form.confirm,
      });
      setSuccess(true);
      setTokenInvalid(false);
    } catch (err) {
      const message = err?.response?.status === 400
        || err?.status === 400
        ? 'El token ingresado es inválido, expiró o ya fue utilizado. Solicita uno nuevo.'
        : err?.message || 'No pudimos restablecer tu contraseña. Intenta nuevamente.';
      if (err?.response?.status === 400 || err?.status === 400) {
        setTokenInvalid(true);
      }
      setGlobalError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const strength = form.password ? getStrength(form.password) : null;
  const passwordsMatch = form.password && form.confirm && form.password === form.confirm;
  const isDark = theme === 'dark';

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-b from-slate-800 to-slate-900 px-4 py-10 transition-colors duration-300 dark:from-slate-900 dark:to-black sm:px-6 lg:px-12">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[400px] w-[700px] rounded-full bg-blue-500/20 blur-[120px] dark:bg-blue-500/15" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[400px] w-[500px] rounded-full bg-sky-400/15 blur-[120px] dark:bg-sky-400/10" />

      <div className="relative flex w-full justify-center">
        <div className="relative grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-[22px] border border-white/10 bg-slate-700/60 shadow-[0_22px_60px_rgba(0,0,0,0.45)] backdrop-blur-[16px] transition-colors duration-300 dark:bg-slate-900/70 lg:grid-cols-[1.1fr_0.9fr]">
          <button
            onClick={toggleTheme}
            aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            title={isDark ? 'Modo claro' : 'Modo oscuro'}
            className="absolute right-3.5 top-3.5 z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/10 transition-all duration-200 hover:bg-white/20"
          >
            {isDark ? (
              <FaSun className="h-[15px] w-[15px] text-amber-300" />
            ) : (
              <FaMoon className="h-[15px] w-[15px] text-slate-300" />
            )}
          </button>

          <aside className="bg-[radial-gradient(800px_400px_at_20%_10%,rgba(59,130,246,0.18),transparent_60%),radial-gradient(700px_420px_at_80%_70%,rgba(14,165,233,0.12),transparent_60%)] p-7 sm:p-10">
            <div className="flex h-full flex-col gap-6">
              <div className="grid grid-cols-[160px_1fr] items-center gap-5 sm:grid-cols-[220px_1fr] sm:gap-7">
                <div className="h-40 w-40 flex-shrink-0 overflow-hidden rounded-[24px] border border-white/15 shadow-[0_12px_35px_rgba(0,0,0,0.35)] sm:h-[220px] sm:w-[220px]">
                  <img src={AUTH_LOGO_SRC} alt="Logo MinuetAItor" className="h-full w-full object-cover" />
                </div>

                <div className="text-center">
                  <h1 className="text-3xl font-bold leading-tight text-white sm:text-[2.2rem]">
                    MinuetAItor
                  </h1>
                  <p className="mx-auto mt-2 max-w-[40ch] text-[0.95rem] text-slate-300 sm:text-[1.05rem]">
                    Estandariza acuerdos y transforma reuniones en ejecución operativa
                  </p>
                </div>
              </div>

              <p className="mx-auto max-w-[60ch] text-center text-[0.97rem] leading-[1.6] text-slate-300">
                Define una nueva contraseña para recuperar el acceso a tu cuenta manteniendo los estándares de seguridad del entorno corporativo.
              </p>

              <div className="flex flex-1 flex-col justify-center gap-7">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15">
                  <Icon name="key" className="text-2xl text-white" />
                </div>

                <div>
                  <h2 className="mb-3 text-xl font-semibold text-white">Nueva contraseña</h2>
                  <p className="max-w-[48ch] text-base leading-relaxed text-blue-100">
                    Usa una contraseña robusta, única y difícil de reutilizar para proteger tu cuenta corporativa.
                  </p>
                </div>

                <ul className="space-y-3">
                  {PASSWORD_RULES.map(({ id, label, test }) => {
                    const passed = test(form.password);
                    return (
                      <li
                        key={id}
                        className={`flex items-center gap-3 text-sm transition-colors ${
                          form.password ? (passed ? 'text-green-300' : 'text-blue-200/60') : 'text-blue-100'
                        }`}
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                          form.password ? (passed ? 'bg-green-500/25' : 'bg-white/10') : 'bg-white/10'
                        }`}>
                          <Icon name={passed ? 'checkCircle' : 'xCircle'} className="text-xs" />
                        </span>
                        <span>{label}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="mt-auto">
                <span className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.06] px-4 py-2.5 text-[0.82rem] text-slate-400">
                  Entorno Corporativo · Acceso Autenticado y Auditado
                </span>
              </div>
            </div>
          </aside>

          <section className="border-t border-white/10 bg-slate-800/70 p-7 transition-colors duration-300 dark:bg-slate-900/80 sm:p-10 lg:border-l lg:border-t-0">
            <div className="flex h-full flex-col gap-4">
              <header>
                <Link
                  to="/auth/login"
                  className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-blue-400 transition-colors hover:text-blue-300"
                >
                  <Icon name="arrowLeft" className="text-xs" />
                  Volver al inicio de sesión
                </Link>

                <h2 className="m-0 text-[1.4rem] font-semibold text-white">
                  {tokenInvalid ? 'Token inválido' : success ? 'Contraseña restablecida' : 'Crear nueva contraseña'}
                </h2>
                <p className="mt-1.5 text-slate-400">
                  {tokenInvalid
                    ? 'El token no es válido o ya expiró.'
                    : success
                      ? 'La cuenta ya quedó actualizada y puedes volver a ingresar.'
                      : 'Pega el token de recuperación y completa ambos campos para actualizar tu contraseña.'}
                </p>
              </header>

              {tokenInvalid ? (
                <div className="flex flex-1 flex-col justify-center rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-8 text-center">
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15">
                    <Icon name="exclamationTriangle" className="text-2xl text-red-300" />
                  </div>
                  <p className="text-sm leading-relaxed text-slate-300">
                    El token de recuperación no es válido o ha expirado. Puedes pegar otro token o solicitar uno nuevo desde la pantalla de recuperación.
                  </p>
                  <div className="mx-auto mt-6 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setTokenInvalid(false);
                        setGlobalError('');
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-600/60 bg-slate-700/60 px-5 py-3 font-semibold text-white transition-colors hover:bg-slate-600/70"
                    >
                      <Icon name="penToSquare" className="text-xs" />
                      Ingresar otro token
                    </button>
                    <Link
                      to="/auth/forgot-password"
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-blue-500"
                    >
                      <Icon name="redo" className="text-xs" />
                      Solicitar nuevo enlace
                    </Link>
                  </div>
                </div>
              ) : success ? (
                <div className="flex flex-1 flex-col justify-center rounded-2xl border border-green-500/25 bg-green-500/10 px-6 py-8 text-center">
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15">
                    <Icon name="checkCircle" className="text-2xl text-green-300" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Contraseña actualizada</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">
                    Tu contraseña fue restablecida correctamente. Serás redirigido al inicio de sesión en{' '}
                    <span className="font-semibold text-white">{countdown}s</span>.
                  </p>
                  <Link
                    to="/auth/login"
                    className="mx-auto mt-6 inline-flex items-center gap-2 text-sm font-medium text-blue-400 transition-colors hover:text-blue-300"
                  >
                    <Icon name="signInAlt" className="text-xs" />
                    Ir ahora al inicio de sesión
                  </Link>
                </div>
              ) : (
                <>
                  {globalError && (
                    <div className="animate-pulse-once flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3.5 text-sm text-red-300">
                      <Icon name="exclamationCircle" className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
                      <div>
                        <p className="font-medium text-red-200">No se pudo completar la operación</p>
                        <p className="mt-0.5 text-red-300/80">{globalError}</p>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} noValidate className="grid gap-3.5">
                    <div className="grid gap-2">
                      <label htmlFor="token" className="text-sm font-medium text-slate-300">
                        Token de recuperación
                      </label>
                      <input
                        id="token"
                        type="text"
                        autoComplete="one-time-code"
                        placeholder="Pega aquí el token recibido por correo"
                        value={form.token}
                        onChange={(e) => handleChange('token', e.target.value)}
                        disabled={isLoading}
                        className={`w-full rounded-[14px] border px-3 py-3 text-white placeholder-slate-500 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
                          errors.token
                            ? 'border-red-500/60 bg-red-950/20'
                            : 'border-slate-600/50 bg-slate-700/60 dark:bg-slate-800/70'
                        }`}
                      />
                      <p className="text-xs text-slate-400">
                        Este campo acepta el token largo incluido en el enlace del correo. El OTP de 6 dígitos mostrado en el email hoy es solo informativo.
                      </p>
                      {errors.token && (
                        <p className="flex items-center gap-1 text-xs text-red-400">
                          <Icon name="exclamationCircle" className="text-xs" />
                          {errors.token}
                        </p>
                      )}
                    </div>

                    <div className="grid gap-2">
                      <label htmlFor="password" className="text-sm font-medium text-slate-300">
                        Nueva contraseña
                      </label>
                      <div className="relative">
                        <input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="••••••••"
                          value={form.password}
                          onChange={(e) => handleChange('password', e.target.value)}
                          disabled={isLoading}
                          className={`w-full rounded-[14px] border px-3 py-3 pr-12 text-white placeholder-slate-500 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
                            errors.password
                              ? 'border-red-500/60 bg-red-950/20'
                              : 'border-slate-600/50 bg-slate-700/60 dark:bg-slate-800/70'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                          className="absolute right-2.5 top-1/2 flex h-[34px] w-[34px] -translate-y-1/2 items-center justify-center rounded-xl border border-slate-600/40 bg-slate-600/50 text-slate-300 transition-colors hover:bg-slate-500/60"
                        >
                          <Icon name={showPassword ? 'eyeSlash' : 'eye'} className="h-4 w-4" />
                        </button>
                      </div>
                      {errors.password && (
                        <p className="flex items-center gap-1 text-xs text-red-400">
                          <Icon name="exclamationCircle" className="text-xs" />
                          {errors.password}
                        </p>
                      )}
                    </div>

                    {strength && (
                      <div className="rounded-xl border border-slate-700/60 bg-slate-900/35 px-4 py-3">
                        <div className="flex gap-1">
                          {[0, 1, 2, 3, 4].map((index) => (
                            <div
                              key={index}
                              className={`h-1.5 flex-1 rounded-full ${index <= strength.level ? strength.color : 'bg-slate-700'}`}
                            />
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-slate-400">
                          Fortaleza actual: <span className="font-medium text-white">{strength.label}</span>
                        </p>
                      </div>
                    )}

                    <div className="grid gap-2">
                      <label htmlFor="confirm" className="text-sm font-medium text-slate-300">
                        Confirmar contraseña
                      </label>
                      <div className="relative">
                        <input
                          id="confirm"
                          type={showConfirm ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="••••••••"
                          value={form.confirm}
                          onChange={(e) => handleChange('confirm', e.target.value)}
                          disabled={isLoading}
                          className={`w-full rounded-[14px] border px-3 py-3 pr-12 text-white placeholder-slate-500 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
                            errors.confirm
                              ? 'border-red-500/60 bg-red-950/20'
                              : 'border-slate-600/50 bg-slate-700/60 dark:bg-slate-800/70'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm((prev) => !prev)}
                          aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                          className="absolute right-2.5 top-1/2 flex h-[34px] w-[34px] -translate-y-1/2 items-center justify-center rounded-xl border border-slate-600/40 bg-slate-600/50 text-slate-300 transition-colors hover:bg-slate-500/60"
                        >
                          <Icon name={showConfirm ? 'eyeSlash' : 'eye'} className="h-4 w-4" />
                        </button>
                      </div>
                      {form.confirm && (
                        <p className={`flex items-center gap-1 text-xs ${passwordsMatch ? 'text-green-400' : 'text-red-400'}`}>
                          <Icon name={passwordsMatch ? 'checkCircle' : 'exclamationCircle'} className="text-xs" />
                          {passwordsMatch ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
                        </p>
                      )}
                      {errors.confirm && !form.confirm && (
                        <p className="flex items-center gap-1 text-xs text-red-400">
                          <Icon name="exclamationCircle" className="text-xs" />
                          {errors.confirm}
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isLoading ? (
                        <>
                          <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          <span>Restableciendo...</span>
                        </>
                      ) : (
                        <>
                          <Icon name="key" />
                          Restablecer contraseña
                        </>
                      )}
                    </button>
                  </form>
                </>
              )}

              <footer className="mt-auto pt-2">
                <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-slate-400">
                  <span className="select-none text-slate-600">·</span>
                  <a href="mailto:soporte@dominio.cl" className="font-medium text-blue-400 transition-colors hover:text-blue-300">
                    Contactar soporte
                  </a>
                  <span className="select-none text-slate-600">·</span>
                </div>
              </footer>
            </div>
          </section>
        </div>

        <span className="pointer-events-none absolute -bottom-7 right-2 select-none text-[0.8rem] text-slate-500">
          v{APP_VERSION}
        </span>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
