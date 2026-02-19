/**
 * pages/auth/ForgotPasswordPage.jsx
 * Página de recuperación de contraseña - MinuetAItor
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
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

// ─── component ─────────────────────────────────────────────────────────────
const ForgotPasswordPage = () => {
  const { theme, toggleTheme } = useBaseSiteStore();

  const [email, setEmail]       = useState('');
  const [error, setError]       = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // ── validation ────────────────────────────────────────────────────────────
  const validate = () => {
    if (!email.trim()) return 'El correo es requerido.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Ingresa un correo válido.';
    return '';
  };

  // ── handlers ──────────────────────────────────────────────────────────────
  const handleChange = (value) => {
    setEmail(value);
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    try {
      // TODO: reemplazar por authService.requestPasswordReset(email)
      await new Promise(r => setTimeout(r, 900));
      setSubmitted(true);
    } catch {
      setError('No pudimos procesar tu solicitud. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── render ────────────────────────────────────────────────────────────────
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
              <Icon name="lock" className="text-white text-2xl" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white mb-3">¿Olvidaste tu contraseña?</h2>
              <p className="text-blue-100 text-base leading-relaxed">
                No te preocupes. Ingresa tu correo corporativo y te enviaremos
                un enlace seguro para restablecer tu acceso.
              </p>
            </div>

            <ul className="space-y-3">
              {[
                { icon: 'envelope',       label: 'Recibirás un correo en minutos' },
                { icon: 'shieldAlt',      label: 'Enlace de uso único y encriptado' },
                { icon: 'clock',          label: 'Válido por 30 minutos' },
              ].map(({ icon, label }) => (
                <li key={label} className="flex items-center gap-3 text-blue-100">
                  <span className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                    <Icon name={icon} className="text-white text-xs" />
                  </span>
                  <span className="text-sm">{label}</span>
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

          {!submitted ? (
            <>
              {/* Header */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Recuperar contraseña</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                  Ingresa tu correo corporativo y te enviaremos las instrucciones.
                </p>
              </div>

              {/* Formulario */}
              <form onSubmit={handleSubmit} noValidate className="space-y-5">

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Correo electrónico
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="usuario@dominio.cl"
                    value={email}
                    onChange={e => handleChange(e.target.value)}
                    className={cx(INPUT_BASE, error && INPUT_ERROR)}
                    disabled={isLoading}
                  />
                  {error && (
                    <p className="mt-1.5 text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                      <Icon name="exclamationCircle" className="text-xs" />
                      {error}
                    </p>
                  )}
                </div>

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
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Icon name="paperPlane" />
                      Enviar instrucciones
                    </>
                  )}
                </button>

              </form>
            </>
          ) : (
            /* ── Estado éxito ── */
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
                <Icon name="checkCircle" className="text-green-600 dark:text-green-400 text-2xl" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-2">Correo enviado</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-2">
                Si <span className="font-medium text-gray-700 dark:text-gray-300">{email}</span> está
                registrado en el sistema, recibirás las instrucciones en los próximos minutos.
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-xs mb-8">
                Revisa también tu carpeta de spam o correo no deseado.
              </p>
              <button
                onClick={() => { setSubmitted(false); setEmail(''); }}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Intentar con otro correo
              </button>
            </div>
          )}

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

export default ForgotPasswordPage;