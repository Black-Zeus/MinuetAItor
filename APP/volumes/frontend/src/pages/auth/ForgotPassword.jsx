import React, { useLayoutEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaMoon, FaSun } from 'react-icons/fa6';
import Icon from '@/components/ui/icon/iconManager';
import useBaseSiteStore from '@store/baseSiteStore';
import { forgotPassword as requestPasswordReset } from '@/services/authService';

const AUTH_LOGO_SRC = '/images/chinchinAItor.jpg';
const APP_VERSION = '1.0.0';

const ForgotPasswordPage = () => {
  const { theme, toggleTheme, setTheme } = useBaseSiteStore();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useLayoutEffect(() => {
    const stored = localStorage.getItem('site-storage');
    if (!stored) setTheme('dark');
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, []);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const validate = () => {
    if (!email.trim()) return 'El correo es requerido.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Ingresa un correo válido.';
    return '';
  };

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
      await requestPasswordReset(email);
      setSubmitted(true);
    } catch (err) {
      setError(err?.message || 'No pudimos procesar tu solicitud. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

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
                Recupera el acceso a tu cuenta corporativa con un flujo controlado, auditable y alineado con la seguridad operacional de la plataforma.
              </p>

              <div className="flex flex-1 flex-col justify-center gap-7">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15">
                  <Icon name="lock" className="text-2xl text-white" />
                </div>

                <div>
                  <h2 className="mb-3 text-xl font-semibold text-white">Recuperación de contraseña</h2>
                  <p className="max-w-[48ch] text-base leading-relaxed text-blue-100">
                    Ingresa tu correo corporativo y te enviaremos un enlace seguro para restablecer tu acceso.
                  </p>
                </div>

                <ul className="space-y-3">
                  {[
                    { icon: 'envelope', label: 'Recibirás un correo con el enlace de recuperación.' },
                    { icon: 'shieldAlt', label: 'El proceso usa un enlace de uso único y controlado.' },
                    { icon: 'clock', label: 'La recuperación tiene una vigencia acotada para mayor seguridad.' },
                  ].map(({ icon, label }) => (
                    <li key={label} className="flex items-center gap-3 text-blue-100">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15">
                        <Icon name={icon} className="text-xs text-white" />
                      </span>
                      <span className="text-sm">{label}</span>
                    </li>
                  ))}
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
                  {submitted ? 'Solicitud enviada' : '¿Olvidaste tu contraseña?'}
                </h2>
                <p className="mt-1.5 text-slate-400">
                  {submitted
                    ? 'Si el correo existe, el sistema enviará las instrucciones en breve.'
                    : 'Completa tu correo corporativo para iniciar la recuperación.'}
                </p>
              </header>

              {!submitted && error && (
                <div className="animate-pulse-once flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3.5 text-sm text-red-300">
                  <Icon name="exclamationCircle" className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
                  <div>
                    <p className="font-medium text-red-200">Solicitud inválida</p>
                    <p className="mt-0.5 text-red-300/80">{error}</p>
                  </div>
                </div>
              )}

              {!submitted ? (
                <form onSubmit={handleSubmit} noValidate className="grid gap-3.5">
                  <div className="grid gap-2">
                    <label htmlFor="email" className="text-sm font-medium text-slate-300">
                      Correo electrónico
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="usuario@dominio.cl"
                      value={email}
                      onChange={(e) => handleChange(e.target.value)}
                      disabled={isLoading}
                      className={`w-full rounded-[14px] border px-3 py-3 text-white placeholder-slate-500 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
                        error
                          ? 'border-red-500/60 bg-red-950/20'
                          : 'border-slate-600/50 bg-slate-700/60 dark:bg-slate-800/70'
                      }`}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        <span>Enviando instrucciones...</span>
                      </>
                    ) : (
                      <>
                        <Icon name="paperPlane" />
                        Enviar instrucciones
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="flex flex-1 flex-col justify-center rounded-2xl border border-green-500/25 bg-green-500/10 px-6 py-8 text-center">
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15">
                    <Icon name="checkCircle" className="text-2xl text-green-300" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Correo enviado</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">
                    Si <span className="font-semibold text-white">{email}</span> está registrado en el sistema, recibirás las instrucciones en los próximos minutos.
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    Revisa también spam o correo no deseado.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setEmail('');
                      setError('');
                    }}
                    className="mx-auto mt-6 inline-flex items-center gap-2 text-sm font-medium text-blue-400 transition-colors hover:text-blue-300"
                  >
                    <Icon name="rotateLeft" className="text-xs" />
                    Intentar con otro correo
                  </button>
                </div>
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

export default ForgotPasswordPage;
