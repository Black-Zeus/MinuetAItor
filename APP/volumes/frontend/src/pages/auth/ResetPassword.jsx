/**
 * pages/auth/ResetPasswordPage.jsx
 * Página de restablecimiento de contraseña - MinuetAItor
 * Espera un ?token=... en la URL (o param de react-router)
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '@/components/ui/icon/iconManager';
import useBaseSiteStore from '@store/baseSiteStore';

// ─── helpers ───────────────────────────────────────────────────────────────
const cx = (...classes) => classes.filter(Boolean).join(' ');

const INPUT_BASE = `
  w-full px-3 py-2.5 border rounded-lg text-sm
  bg-white dark:bg-gray-800
  text-gray-900 dark:text-gray-100
  placeholder-gray-400 dark:placeholder-gray-500
  border-gray-300 dark:border-gray-600
  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
  transition-colors
`;

const INPUT_ERROR = 'border-red-400 focus:ring-red-400 focus:border-red-400';

// Requisitos de contraseña
const PASSWORD_RULES = [
  { id: 'length',  label: 'Mínimo 8 caracteres',              test: (v) => v.length >= 8 },
  { id: 'upper',   label: 'Al menos una mayúscula',            test: (v) => /[A-Z]/.test(v) },
  { id: 'lower',   label: 'Al menos una minúscula',            test: (v) => /[a-z]/.test(v) },
  { id: 'number',  label: 'Al menos un número',               test: (v) => /\d/.test(v) },
  { id: 'special', label: 'Al menos un carácter especial',     test: (v) => /[^A-Za-z0-9]/.test(v) },
];

const getStrength = (password) => {
  const passed = PASSWORD_RULES.filter(r => r.test(password)).length;
  if (passed <= 1) return { level: 0, label: 'Muy débil',  color: 'bg-red-500' };
  if (passed === 2) return { level: 1, label: 'Débil',      color: 'bg-orange-500' };
  if (passed === 3) return { level: 2, label: 'Regular',    color: 'bg-yellow-500' };
  if (passed === 4) return { level: 3, label: 'Fuerte',     color: 'bg-blue-500' };
  return              { level: 4, label: 'Muy fuerte',  color: 'bg-green-500' };
};

// ─── component ─────────────────────────────────────────────────────────────
const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme, toggleTheme } = useBaseSiteStore();

  const token = searchParams.get('token') || '';

  const [form, setForm]             = useState({ password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [errors, setErrors]         = useState({});
  const [isLoading, setIsLoading]   = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [success, setSuccess]       = useState(false);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [countdown, setCountdown]   = useState(5);

  const strength = form.password ? getStrength(form.password) : null;

  // ── verificar token al montar ─────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setTokenInvalid(true);
    } else {
      // TODO: authService.validateResetToken(token) para validar en backend
    }
  }, [token]);

  // ── countdown tras éxito ──────────────────────────────────────────────────
  useEffect(() => {
    if (!success) return;
    if (countdown <= 0) {
      navigate('/auth/login');
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [success, countdown, navigate]);

  // ── validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!form.password) {
      errs.password = 'La contraseña es requerida.';
    } else {
      const failed = PASSWORD_RULES.filter(r => !r.test(form.password));
      if (failed.length) errs.password = 'La contraseña no cumple todos los requisitos.';
    }
    if (!form.confirm) {
      errs.confirm = 'Debes confirmar tu contraseña.';
    } else if (form.password !== form.confirm) {
      errs.confirm = 'Las contraseñas no coinciden.';
    }
    return errs;
  };

  // ── handlers ──────────────────────────────────────────────────────────────
  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
    if (globalError) setGlobalError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setIsLoading(true);
    try {
      // TODO: authService.resetPassword(token, form.password)
      await new Promise(r => setTimeout(r, 900));
      setSuccess(true);
    } catch (err) {
      const msg = err?.response?.status === 400
        ? 'El enlace ha expirado o ya fue utilizado. Solicita uno nuevo.'
        : 'No pudimos restablecer tu contraseña. Intenta nuevamente.';
      setGlobalError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // ── render: token inválido ────────────────────────────────────────────────
  if (tokenInvalid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-6 transition-colors">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-6">
            <Icon name="exclamationTriangle" className="text-red-600 dark:text-red-400 text-2xl" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-2">Enlace inválido</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-8">
            Este enlace de recuperación no es válido o ha expirado.
            Solicita uno nuevo desde la página de recuperación.
          </p>
          <Link
            to="/forgot-password"
            className="inline-flex items-center gap-2 py-2.5 px-5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            <Icon name="redo" className="text-xs" />
            Solicitar nuevo enlace
          </Link>
        </div>
      </div>
    );
  }

  // ── render: éxito ─────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-6 transition-colors">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
            <Icon name="checkCircle" className="text-green-600 dark:text-green-400 text-2xl" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-2">Contraseña restablecida</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-8">
            Tu contraseña ha sido actualizada correctamente. Serás redirigido al
            inicio de sesión en <span className="font-semibold text-gray-700 dark:text-gray-300">{countdown}s</span>.
          </p>
          <Link
            to="/auth/login"
            className="inline-flex items-center gap-2 py-2.5 px-5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            <Icon name="signInAlt" className="text-xs" />
            Ir al inicio de sesión
          </Link>
        </div>
      </div>
    );
  }

  // ── render: formulario ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950 transition-colors">

      {/* ── Panel izquierdo – Branding ── */}
      <aside className="hidden lg:flex lg:w-[480px] xl:w-[520px] flex-col bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 dark:from-blue-900 dark:via-blue-800 dark:to-indigo-900 relative overflow-hidden shrink-0">

        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-white/5" />
          <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-white/5" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-white/[0.03]" />
        </div>

        <div className="relative flex flex-col h-full p-10 text-white">

          <div className="flex items-center gap-4 mb-12">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center overflow-hidden shrink-0">
              <img src="/content/img/chinchinAItor.jpg" alt="MinuetAItor logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">MinuetAItor</h1>
              <p className="text-blue-200 text-sm leading-snug mt-0.5">
                Gestión inteligente de minutas
              </p>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center gap-8">
            <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center">
              <Icon name="key" className="text-white text-2xl" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white mb-3">Nueva contraseña</h2>
              <p className="text-blue-100 text-base leading-relaxed">
                Crea una contraseña segura para proteger tu acceso corporativo.
                Asegúrate de que sea única y no la hayas usado antes.
              </p>
            </div>

            {/* Tips */}
            <ul className="space-y-3">
              {PASSWORD_RULES.map(({ id, label }) => (
                <li key={id} className={cx(
                  'flex items-center gap-3 text-sm transition-colors',
                  form.password
                    ? PASSWORD_RULES.find(r => r.id === id)?.test(form.password)
                      ? 'text-green-300'
                      : 'text-blue-200/60'
                    : 'text-blue-200'
                )}>
                  <span className={cx(
                    'w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors',
                    form.password && PASSWORD_RULES.find(r => r.id === id)?.test(form.password)
                      ? 'bg-green-500/30'
                      : 'bg-white/10'
                  )}>
                    <Icon
                      name={form.password && PASSWORD_RULES.find(r => r.id === id)?.test(form.password) ? 'check' : 'times'}
                      className="text-[10px]"
                    />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-10">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-blue-100 text-xs">
              <Icon name="lock" className="text-xs" />
              Entorno Corporativo · Acceso Autenticado y Auditado
            </span>
          </div>

        </div>
      </aside>

      {/* ── Panel derecho – Formulario ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="absolute top-5 right-5 w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Cambiar tema"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>

        <div className="w-full max-w-md">

          {/* Logo móvil */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-blue-100 dark:bg-blue-900 shrink-0">
              <img src="/content/img/chinchinAItor.jpg" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">MinuetAItor</span>
          </div>

          {/* Back link */}
          <Link
            to="/auth/login"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mb-8"
          >
            <Icon name="arrowLeft" className="text-xs" />
            Volver al inicio de sesión
          </Link>

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Crear nueva contraseña</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Elige una contraseña segura para tu cuenta corporativa.
            </p>
          </div>

          {/* Error global */}
          {globalError && (
            <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
              <Icon name="exclamationCircle" className="mt-0.5 shrink-0" />
              <span>{globalError}</span>
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            {/* Nueva contraseña */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => handleChange('password', e.target.value)}
                  className={cx(INPUT_BASE, 'pr-10', errors.password && INPUT_ERROR)}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <Icon name={showPassword ? 'eyeSlash' : 'eye'} className="text-sm" />
                </button>
              </div>

              {/* Barra de fortaleza */}
              {form.password && strength && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        className={cx(
                          'h-1 flex-1 rounded-full transition-colors',
                          i <= strength.level ? strength.color : 'bg-gray-200 dark:bg-gray-700'
                        )}
                      />
                    ))}
                  </div>
                  <p className={cx(
                    'text-xs',
                    strength.level <= 1 ? 'text-red-500' :
                    strength.level === 2 ? 'text-yellow-600 dark:text-yellow-400' :
                    strength.level === 3 ? 'text-blue-600 dark:text-blue-400' :
                    'text-green-600 dark:text-green-400'
                  )}>
                    Fortaleza: {strength.label}
                  </p>
                </div>
              )}

              {errors.password && (
                <p className="mt-1.5 text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                  <Icon name="exclamationCircle" className="text-xs" />
                  {errors.password}
                </p>
              )}
            </div>

            {/* Confirmar contraseña */}
            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Confirmar contraseña
              </label>
              <div className="relative">
                <input
                  id="confirm"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={form.confirm}
                  onChange={e => handleChange('confirm', e.target.value)}
                  className={cx(INPUT_BASE, 'pr-10', errors.confirm && INPUT_ERROR)}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                  aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <Icon name={showConfirm ? 'eyeSlash' : 'eye'} className="text-sm" />
                </button>
              </div>

              {/* Indicador de coincidencia */}
              {form.confirm && form.password && (
                <p className={cx(
                  'mt-1.5 text-xs flex items-center gap-1',
                  form.password === form.confirm
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-500 dark:text-red-400'
                )}>
                  <Icon name={form.password === form.confirm ? 'checkCircle' : 'exclamationCircle'} className="text-xs" />
                  {form.password === form.confirm ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
                </p>
              )}

              {errors.confirm && !form.confirm && (
                <p className="mt-1.5 text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                  <Icon name="exclamationCircle" className="text-xs" />
                  {errors.confirm}
                </p>
              )}
            </div>

            {/* Botón submit */}
            <button
              type="submit"
              disabled={isLoading}
              className={cx(
                'w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-all',
                isLoading
                  ? 'bg-blue-400 dark:bg-blue-700 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 active:scale-[0.99]'
              )}
            >
              {isLoading ? (
                <>
                  <Icon name="spinner" className="animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Icon name="key" />
                  Restablecer contraseña
                </>
              )}
            </button>

          </form>

          {/* Footer */}
          <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
            ¿Problemas de acceso?{' '}
            <a href="mailto:soporte@dominio.cl" className="text-blue-600 dark:text-blue-400 hover:underline">
              Contactar soporte
            </a>
          </p>

        </div>
      </main>
    </div>
  );
};

export default ResetPasswordPage;