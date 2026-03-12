import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import AboutModal from "@/components/common/aboutModal/AboutModal";
import HeaderThemeToggle from "@/components/layout/header/HeaderThemeToggle";
import useAuthStore from "@/store/authStore";
import useMinuteViewStore from "@/store/minuteViewStore";
import {
  createMinuteObservation,
  getMinuteViewDetail,
  getMinuteViewPdfBlob,
  logoutMinuteViewSession,
  requestMinuteViewOtp,
  verifyMinuteViewOtp,
} from "@/services/minuteViewService";

const OBSERVATION_STATUS_META = {
  new: {
    label: "Nueva",
    className: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-300",
  },
  inserted: {
    label: "Insertada",
    className: "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700/50 dark:bg-sky-900/20 dark:text-sky-300",
  },
  approved: {
    label: "Aprobada",
    className: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-300",
  },
  rejected: {
    label: "Rechazada",
    className: "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700/50 dark:bg-rose-900/20 dark:text-rose-300",
  },
};

const MinuteViewPage = () => {
  const { id: recordId } = useParams();
  const navigate = useNavigate();

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const savedSession = useMinuteViewStore((s) => s.sessionsByRecord?.[recordId] ?? null);
  const saveSession = useMinuteViewStore((s) => s.saveSession);
  const clearSession = useMinuteViewStore((s) => s.clearSession);

  const [email, setEmail] = useState(savedSession?.visitor?.email ?? "");
  const [otpCode, setOtpCode] = useState("");
  const [step, setStep] = useState(savedSession?.accessToken ? "loading" : "login");
  const [loading, setLoading] = useState(savedSession?.accessToken ? true : false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const pdfUrlRef = useRef("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedEditorComments, setExpandedEditorComments] = useState({});
  const [expandedVersionGroups, setExpandedVersionGroups] = useState({});
  const [observationText, setObservationText] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "dark";
    const saved = window.localStorage.getItem("minute-view-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  });

  const isDark = theme === "dark";

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("minute-view-theme", theme);
    }
  }, [theme]);

  useEffect(() => {
    if (!detail?.observationGroups?.length) return;

    setExpandedVersionGroups((prev) => {
      const next = { ...prev };
      detail.observationGroups.forEach((group) => {
        if (typeof next[group.recordVersionId] !== "boolean") {
          next[group.recordVersionId] = Boolean(group.isActiveVersion);
        }
      });
      return next;
    });
  }, [detail?.observationGroups]);

  useEffect(() => {
    const html = document.documentElement;
    const previousDark = html.classList.contains("dark");

    html.classList.toggle("dark", isDark);

    return () => {
      html.classList.toggle("dark", previousDark);
    };
  }, [isDark]);

  useEffect(() => {
    if (isAuthenticated && recordId) {
      navigate(`/minutes/process/${recordId}`, { replace: true });
    }
  }, [isAuthenticated, navigate, recordId]);

  useEffect(() => () => {
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
  }, []);

  useEffect(() => {
    if (!recordId || !savedSession?.accessToken) {
      setStep("login");
      setLoading(false);
      return;
    }

    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [detailData, pdfBlob] = await Promise.all([
          getMinuteViewDetail(recordId, savedSession.accessToken),
          getMinuteViewPdfBlob(recordId, savedSession.accessToken),
        ]);
        if (!active) return;
        if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
        setDetail(detailData);
        pdfUrlRef.current = URL.createObjectURL(pdfBlob);
        setPdfUrl(pdfUrlRef.current);
        setStep("view");
        setError("");
      } catch (err) {
        if (!active) return;
        clearSession(recordId);
        setStep("login");
        setError(err?.message || "La sesión de visitante expiró o dejó de ser válida.");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [clearSession, recordId, savedSession?.accessToken]);

  const handleRequestOtp = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await requestMinuteViewOtp({ recordId, email });
      setRequestMessage(response?.message || "Código enviado.");
      setStep("otp");
    } catch (err) {
      setError(err?.message || "No fue posible enviar el código.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const session = await verifyMinuteViewOtp({ recordId, email, otpCode });
      saveSession(recordId, session);
      const [detailData, pdfBlob] = await Promise.all([
        getMinuteViewDetail(recordId, session.accessToken),
        getMinuteViewPdfBlob(recordId, session.accessToken),
      ]);
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
      setDetail(detailData);
      pdfUrlRef.current = URL.createObjectURL(pdfBlob);
      setPdfUrl(pdfUrlRef.current);
      setStep("view");
      setOtpCode("");
    } catch (err) {
      setError(err?.message || "El código es inválido o expiró.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    const token = useMinuteViewStore.getState().getSession(recordId)?.accessToken;
    try {
      if (token) {
        await logoutMinuteViewSession(recordId, token);
      }
    } catch {
      // El logout local se aplica igual aunque falle el backend.
    } finally {
      clearSession(recordId);
      setDetail(null);
      setStep("login");
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = "";
      setPdfUrl("");
      setObservationText("");
    }
  };

  const handleCreateObservation = async (event) => {
    event.preventDefault();
    const token = useMinuteViewStore.getState().getSession(recordId)?.accessToken;
    if (!token) {
      setError("La sesión visitante expiró. Solicita un código nuevo.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await createMinuteObservation(recordId, token, observationText);
      const detailData = await getMinuteViewDetail(recordId, token);
      setDetail(detailData);
      setObservationText("");
      setIsModalOpen(false);
    } catch (err) {
      setError(err?.message || "No fue posible registrar la observación.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleEditorComment = (observationId) => {
    setExpandedEditorComments((prev) => ({
      ...prev,
      [observationId]: !prev[observationId],
    }));
  };

  const toggleVersionGroup = (recordVersionId) => {
    setExpandedVersionGroups((prev) => ({
      ...prev,
      [recordVersionId]: !prev[recordVersionId],
    }));
  };

  const currentVersionLabel = detail?.versions?.find(
    (item) => item.versionId === detail?.currentVersionId
  )?.versionLabel || `v${detail?.currentVersionNum || "-"}`;

  if (loading) {
    return (
      <div className={`${isDark ? "dark" : ""} min-h-screen grid place-items-center bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100`}>
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 rounded-full border-4 border-sky-500/60 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Preparando acceso a la minuta...</p>
        </div>
      </div>
    );
  }

  const renderAccessPanel = () => (
    <div className={`${isDark ? "dark" : ""} min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.10),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(15,118,110,0.12),_transparent_35%),linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)] px-5 py-10 text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(15,118,110,0.2),_transparent_35%),linear-gradient(180deg,#020617_0%,#081120_100%)] dark:text-slate-100`}>
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl overflow-hidden rounded-[28px] border border-slate-300/70 bg-white/80 shadow-[0_32px_90px_rgba(15,23,42,0.18)] backdrop-blur xl:grid-cols-[1.25fr_0.75fr] dark:border-white/10 dark:bg-slate-950/55 dark:shadow-[0_32px_90px_rgba(0,0,0,0.45)]">
        <section className="border-b border-slate-300/70 px-8 py-10 dark:border-white/10 xl:border-b-0 xl:border-r">
          <div className="flex items-start gap-5">
            <div className="flex h-24 w-24 items-center justify-center rounded-[22px] border border-slate-300/70 bg-slate-900/70 text-3xl font-black text-sky-300 dark:border-white/10">
              M
            </div>
            <div className="pt-2">
              <p className="text-xs uppercase tracking-[0.3em] text-sky-600/80 dark:text-sky-300/80">Visualización Externa</p>
              <h1 className="mt-3 text-5xl font-black tracking-tight text-slate-950 dark:text-white">MinuetAItor</h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                Accede a la minuta con un código temporal enviado a tu correo. El acceso
                queda ligado a la minuta <span className="font-semibold text-slate-900 dark:text-white">{recordId}</span>.
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-[22px] border border-slate-300/70 bg-slate-100/80 p-6 dark:border-white/10 dark:bg-slate-900/45">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Minuta</p>
                <p className="mt-2 text-lg font-semibold text-slate-950 break-all dark:text-white">{recordId}</p>
              </div>
              <div className="rounded-full border border-sky-400/25 bg-sky-500/10 px-4 py-2 text-xs font-semibold text-sky-700 dark:text-sky-200">
                Acceso con OTP
              </div>
            </div>
          </div>
        </section>

        <section className="px-8 py-10">
          <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
            {step === "otp" ? "Validar código" : "Identificación de visitante"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {step === "otp"
              ? "Ingresa el código de un solo uso que enviamos a tu correo. La vigencia es de 30 minutos."
              : "Ingresa el correo con el que fuiste invitado a revisar esta minuta."}
          </p>

          {error ? (
            <div className="mt-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          {requestMessage ? (
            <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {requestMessage}
            </div>
          ) : null}

          {step === "otp" ? (
            <form className="mt-8 space-y-5" onSubmit={handleVerifyOtp}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Correo validado</span>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-500 outline-none dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-300"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Código OTP</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value.replace(/\D+/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-lg tracking-[0.45em] text-slate-950 outline-none focus:border-sky-400/60 dark:border-white/10 dark:bg-slate-900/80 dark:text-white"
                />
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep("login")}
                  className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={submitting || otpCode.length < 6}
                  className="flex-1 rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Validando..." : "Ingresar a la minuta"}
                </button>
              </div>
            </form>
          ) : (
            <form className="mt-8 space-y-5" onSubmit={handleRequestOtp}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">ID de minuta</span>
                <input
                  type="text"
                  value={recordId || ""}
                  disabled
                  className="w-full rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-500 outline-none dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-300"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Correo del participante</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nombre@empresa.cl"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-sky-400/60 dark:border-white/10 dark:bg-slate-900/80 dark:text-white"
                />
              </label>
              <button
                type="submit"
                disabled={submitting || !email.trim()}
                className="w-full rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Enviando código..." : "Solicitar código de acceso"}
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );

  if (step !== "view" || !detail) {
    return renderAccessPanel();
  }

  return (
    <div className={`${isDark ? "dark" : ""} flex h-screen flex-col overflow-hidden bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100`}>
      <header className="sticky top-0 z-30 w-full border-b border-slate-300/70 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-slate-950/90">
        <div className="flex w-full items-center justify-between gap-4 px-5 py-4">
          <div className="flex min-w-0 items-center gap-4">
            <AboutModal
              appName="MinuetAItor"
              version="1.0.0"
              logoSrc="/images/chinchinAItor.jpg"
              imageSrc="/images/chinchinAItor.jpg"
              developerName="Zeus"
              developerEmail="zeus@tudominio.cl"
              size="modalLarge"
            >
              <button
                type="button"
                className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-300 bg-white transition hover:opacity-95 dark:border-white/10 dark:bg-slate-900/70"
                aria-label="Abrir información de MinuetAItor"
              >
                <img
                  src="/images/chinchinAItor.jpg"
                  alt="MinuetAItor"
                  className="h-[94%] w-[94%] object-cover"
                />
              </button>
            </AboutModal>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                <span>{detail.record?.clientName || "Cliente"}</span>
                <span>/</span>
                <span>{detail.record?.projectName || "Proyecto"}</span>
                <span>/</span>
                <span className="text-sky-300">{currentVersionLabel}</span>
              </div>
              <h1 className="mt-2 truncate text-xl font-bold text-slate-950 dark:text-white">{detail.record?.title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <HeaderThemeToggle
              onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
              currentTheme={theme}
            />
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Observaciones
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="mx-[10%] my-[15px] w-[80%] flex-1 overflow-hidden">
        <section className="h-full overflow-hidden rounded-[28px] border border-slate-300/70 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-slate-900/70 dark:shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
          {pdfUrl ? (
            <iframe title="Minute PDF Viewer" src={pdfUrl} className="h-full w-full bg-white" />
          ) : (
            <div className="grid h-full place-items-center text-slate-500 dark:text-slate-400">
              No hay un PDF disponible para esta minuta.
            </div>
          )}
        </section>
      </main>

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/55" onClick={() => setIsDrawerOpen(false)} />
          <aside className="absolute right-0 top-0 flex h-full w-[min(720px,92vw)] flex-col border-l border-slate-300 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-slate-950 dark:shadow-[0_20px_50px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-300 bg-slate-100/90 px-5 py-4 dark:border-white/10 dark:bg-slate-900/55">
              <div>
                <h2 className="text-base font-extrabold text-slate-950 dark:text-white">Observaciones registradas</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Listado por iteración y estado de revisión.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsDrawerOpen(false);
                    setIsModalOpen(true);
                  }}
                  className="rounded-xl border border-sky-300 bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-200 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-100 dark:hover:bg-sky-500/20"
                >
                  Agregar observación
                </button>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
              {detail.observationGroups?.some((group) => group.observations?.length) ? (
                <div className="space-y-4">
                  {detail.observationGroups?.map((group) => (
                    <div key={group.recordVersionId} className="overflow-hidden rounded-2xl border border-slate-300 dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => toggleVersionGroup(group.recordVersionId)}
                        className="flex w-full items-center justify-between gap-3 border-b border-slate-300 bg-slate-100/90 px-4 py-3 text-left dark:border-white/10 dark:bg-slate-900/60"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-950 dark:text-white">{group.versionLabel}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {group.isActiveVersion ? "Versión actual" : "Iteración histórica"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:text-slate-300">
                            {group.observations?.length || 0}
                          </span>
                          <span
                            className={`transition-transform duration-200 ${
                              expandedVersionGroups[group.recordVersionId] ? "rotate-180" : "rotate-0"
                            }`}
                          >
                            <svg
                              viewBox="0 0 20 20"
                              fill="none"
                              className="h-4 w-4 text-slate-500 dark:text-slate-300"
                              aria-hidden="true"
                            >
                              <path
                                d="M5 7.5L10 12.5L15 7.5"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                        </div>
                      </button>

                      {expandedVersionGroups[group.recordVersionId] ? (
                        group.observations?.length ? (
                          <table className="w-full border-collapse text-sm">
                            <thead>
                              <tr className="bg-slate-100/80 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
                                <th className="px-4 py-3">Autor</th>
                                <th className="px-4 py-3">Observación</th>
                                <th className="px-4 py-3">Estado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.observations.map((item) => (
                                <React.Fragment key={item.id}>
                                  <tr className="border-t border-slate-200 align-top dark:border-white/5">
                                    <td className="px-4 py-3">
                                      <p className="font-medium text-slate-950 dark:text-white">{item.authorName || item.authorEmail}</p>
                                      <p className="mt-1 text-xs text-slate-500">
                                        {item.createdAt ? new Date(item.createdAt).toLocaleString("es-CL") : ""}
                                      </p>
                                    </td>
                                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{item.body}</td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-start justify-between gap-3">
                                        <span
                                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                                            OBSERVATION_STATUS_META[item.status]?.className ||
                                            "border-slate-300 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-slate-900/20 dark:text-slate-300"
                                          }`}
                                        >
                                          {OBSERVATION_STATUS_META[item.status]?.label || item.status}
                                        </span>
                                        {item.editorComment ? (
                                          <button
                                            type="button"
                                            onClick={() => toggleEditorComment(item.id)}
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800"
                                            aria-label={
                                              expandedEditorComments[item.id]
                                                ? "Ocultar comentario del elaborador"
                                                : "Mostrar comentario del elaborador"
                                            }
                                            title={
                                              expandedEditorComments[item.id]
                                                ? "Ocultar comentario del elaborador"
                                                : "Mostrar comentario del elaborador"
                                            }
                                          >
                                            <span
                                              className={`transition-transform duration-200 ${
                                                expandedEditorComments[item.id] ? "rotate-180" : "rotate-0"
                                              }`}
                                            >
                                              <svg
                                                viewBox="0 0 20 20"
                                                fill="none"
                                                className="h-4 w-4"
                                                aria-hidden="true"
                                              >
                                                <path
                                                  d="M5 7.5L10 12.5L15 7.5"
                                                  stroke="currentColor"
                                                  strokeWidth="1.8"
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                />
                                              </svg>
                                            </span>
                                          </button>
                                        ) : null}
                                      </div>
                                    </td>
                                  </tr>
                                  {item.editorComment && expandedEditorComments[item.id] ? (
                                    <tr className="border-t border-slate-100 bg-slate-50/70 dark:border-white/5 dark:bg-slate-900/30">
                                      <td colSpan={3} className="px-4 py-3">
                                        <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40">
                                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                            Comentario del elaborador
                                          </p>
                                          <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">
                                            {item.editorComment}
                                          </p>
                                        </div>
                                      </td>
                                    </tr>
                                  ) : null}
                                </React.Fragment>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="px-4 py-5 text-sm text-slate-500">
                            Sin observaciones registradas en esta iteración.
                          </div>
                        )
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500 dark:border-white/15 dark:bg-slate-900/35 dark:text-slate-400">
                  No existen observaciones para la minuta actual.
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : null}

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 px-4">
          <div className="w-full max-w-xl rounded-[28px] border border-slate-300 bg-white p-6 shadow-[0_28px_90px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-slate-900 dark:shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
            <h2 className="text-xl font-bold text-slate-950 dark:text-white">Nueva observación</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              La observación quedará asociada a la versión activa actual de la minuta.
            </p>

            <form className="mt-5 space-y-4" onSubmit={handleCreateObservation}>
              <textarea
                value={observationText}
                onChange={(event) => setObservationText(event.target.value)}
                rows={7}
                placeholder="Describe el ajuste o comentario que quieres dejar sobre esta versión."
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-950 outline-none focus:border-sky-400/60 dark:border-white/10 dark:bg-slate-950 dark:text-white"
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || observationText.trim().length < 3}
                  className="rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Guardando..." : "Registrar observación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default MinuteViewPage;
