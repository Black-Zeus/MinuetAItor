import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import AboutModal from "@/components/common/aboutModal/AboutModal";
import { toastInfo, toastWarn } from "@/components/common/toast/toastHelpers";
import HeaderThemeToggle from "@/components/layout/header/HeaderThemeToggle";
import useAuthStore from "@/store/authStore";
import useMinuteViewStore from "@/store/minuteViewStore";
import systemMaintenanceService from "@/services/systemMaintenanceService";
import { createAuthorizedEventStream } from "@/utils/authorizedEventStream";
import {
  createMinuteObservation,
  deleteMinuteObservation,
  getMinuteViewDetail,
  getMinuteViewPdfBlob,
  logoutMinuteViewSession,
  requestMinuteViewOtp,
  updateMinuteObservation,
  verifyMinuteViewOtp,
} from "@/services/minuteViewService";
import { formatDateTime } from "@/utils/formats";

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

const observationResolutionMessage = (status) => ({
  inserted: "Tu observación fue incorporada a la minuta.",
  approved: "Tu observación fue aprobada para ajuste manual.",
  rejected: "Tu observación fue revisada y no será aplicada a la minuta.",
}[status] ?? "El editor actualizó el estado de una observación.");

const OPERATION_MODE_COPY = {
  maintenance: {
    title: "Sistema en mantenimiento",
    message: "El sistema se encuentra temporalmente fuera de operación general. El acceso externo volverá a estar disponible cuando finalicen las tareas de mantenimiento.",
    badge: "Mantenimiento",
  },
  read_only: {
    title: "Sistema en solo lectura",
    message: "El sistema se encuentra habilitado solo para consulta. Puedes revisar contenido disponible, pero el acceso con código temporal y el registro de observaciones están bloqueados.",
    badge: "Solo lectura",
  },
  commissioning: {
    title: "Sistema en puesta en marcha",
    message: "El sistema aún no se encuentra habilitado para operación productiva. El acceso externo estará disponible cuando administración complete las validaciones base.",
    badge: "Puesta en marcha",
  },
};

const PUBLIC_RECORD_STATUS_LABELS = {
  preview: "Vista previa",
  completed: "Publicada",
};

const PUBLIC_MINUTE_UNAVAILABLE_MESSAGE =
  "Minuta no disponible. Verifica el enlace recibido o solicita uno nuevo al equipo responsable.";

const PUBLIC_OTP_REQUEST_MESSAGE =
  "Si el correo está autorizado, recibirás un código de acceso en unos minutos.";

const PUBLIC_OTP_VERIFY_MESSAGE =
  "No fue posible validar el acceso. Revisa el código recibido o solicita uno nuevo.";

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
  const [pdfError, setPdfError] = useState("");
  const [operationState, setOperationState] = useState({ mode: "normal" });
  const pdfUrlRef = useRef("");
  const eventsRef = useRef(null);
  const operationToastRef = useRef(null);
  const observationTextareaRef = useRef(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedEditorComments, setExpandedEditorComments] = useState({});
  const [expandedVersionGroups, setExpandedVersionGroups] = useState({});
  const [observationText, setObservationText] = useState("");
  const [editingObservation, setEditingObservation] = useState(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "dark";
    const saved = window.localStorage.getItem("minute-view-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  });

  const isDark = theme === "dark";
  const operationMode = operationState?.mode || "normal";
  const operationCopy = OPERATION_MODE_COPY[operationMode] || null;
  const isOperationLocked = Boolean(operationCopy);
  const recordStatus = String(detail?.record?.status || "").trim().toLowerCase();
  const isCompleted = recordStatus === "completed";
  const canCreateObservation = recordStatus === "preview" && !isOperationLocked;
  const ownObservationGroups = detail?.observationGroups || [];
  const sharedObservationGroups = detail?.sharedObservationGroups || [];

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("minute-view-theme", theme);
    }
  }, [theme]);

  useEffect(() => {
    if (!detail?.observationGroups?.length) return;

    setExpandedVersionGroups((prev) => {
      const next = { ...prev };
      [...ownObservationGroups, ...sharedObservationGroups].forEach((group) => {
        if (typeof next[group.recordVersionId] !== "boolean") {
          next[group.recordVersionId] = Boolean(group.isActiveVersion);
        }
      });
      return next;
    });
  }, [ownObservationGroups, sharedObservationGroups]);

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

  useEffect(() => {
    let active = true;

    const loadOperationState = async () => {
      try {
        const state = await systemMaintenanceService.getPublicOperationState();
        if (!active) return;
        setOperationState(state || { mode: "normal" });
      } catch {
        if (!active) return;
        setOperationState({ mode: "normal" });
      }
    };

    loadOperationState();
    const timer = window.setInterval(loadOperationState, 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!operationCopy || operationToastRef.current === operationMode) return;
    operationToastRef.current = operationMode;
    toastWarn(operationCopy.title, operationCopy.message, {
      autoClose: 7000,
      toastId: `minute-public-operation:${operationMode}`,
    });
  }, [operationCopy, operationMode]);

  useEffect(() => () => {
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    eventsRef.current?.close?.("unmount");
  }, []);

  useEffect(() => {
    if (!isModalOpen) return;
    const focusTimer = window.setTimeout(() => {
      observationTextareaRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(focusTimer);
  }, [isModalOpen]);

  useEffect(() => {
    eventsRef.current?.close?.("effect_recreate");
    eventsRef.current = null;

    const token = savedSession?.accessToken;
    if (!recordId || !token || step !== "view") return undefined;

    let active = true;
    let source = null;

    const parseEventPayload = (event) => {
      try {
        return JSON.parse(event?.data ?? "{}");
      } catch {
        return {};
      }
    };

    const refreshDetail = async () => {
      try {
        const detailData = await getMinuteViewDetail(recordId, token);
        if (active) setDetail(detailData);
      } catch {
        // Si el detalle falla, el siguiente ciclo de sesión se encargará de limpiar.
      }
    };

    const refreshPdf = async ({ attempts = 1, delayMs = 1200 } = {}) => {
      let lastError = null;
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
          const pdfBlob = await getMinuteViewPdfBlob(recordId, token);
          if (!active) return;
          if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
          pdfUrlRef.current = URL.createObjectURL(pdfBlob);
          setPdfUrl(pdfUrlRef.current);
          setPdfError("");
          return;
        } catch (pdfErr) {
          lastError = pdfErr;
          if (!active) return;
          if (attempt < attempts) {
            await new Promise((resolve) => window.setTimeout(resolve, delayMs));
          }
        }
      }
      if (!active) return;
      setPdfError(lastError?.message || "El PDF de la minuta aún no está disponible.");
    };

    const onObservationResolved = async (event) => {
      const payload = parseEventPayload(event);
      await refreshDetail();

      const status = String(payload.status || "").trim().toLowerCase();
      toastInfo("Observación actualizada", observationResolutionMessage(status), {
        autoClose: 7000,
        toastId: `minute-public-observation-resolved:${payload.observationId || status || Date.now()}`,
      });
    };

    const onPdfUpdated = async () => {
      await refreshPdf();
      toastInfo("PDF actualizado", "La vista previa de la minuta fue regenerada por el editor.", {
        autoClose: 7000,
        toastId: `minute-public-pdf-updated:${recordId}`,
      });
    };

    const onMinutePublished = async () => {
      await refreshDetail();
      await refreshPdf({ attempts: 10, delayMs: 1500 });
      toastInfo("Minuta publicada", "La minuta fue publicada y se actualizó la vista final.", {
        autoClose: 8000,
        toastId: `minute-public-published:${recordId}`,
      });
    };

    const onSessionExpired = () => {
      active = false;
      clearSession(recordId);
      setStep("login");
      setError("La sesión de visitante expiró. Solicita un nuevo código de acceso.");
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = "";
      setPdfUrl("");
      setPdfError("");
      source?.close();
      if (eventsRef.current === source) {
        eventsRef.current = null;
      }
    };

    const onPublicStreamUnavailable = () => {
      active = false;
      clearSession(recordId);
      setStep("login");
      setDetail(null);
      setError(PUBLIC_MINUTE_UNAVAILABLE_MESSAGE);
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = "";
      setPdfUrl("");
      setPdfError("");
      setObservationText("");
      source?.close("terminal_public_unavailable");
      if (eventsRef.current === source) {
        eventsRef.current = null;
      }
    };

    const reconcilePublicView = async () => {
      await refreshDetail();
      await refreshPdf({ attempts: 2, delayMs: 1000 });
    };

    source = createAuthorizedEventStream(
      `/api/v1/minutes/public/${recordId}/events`,
      token,
      {
        onreconnected: reconcilePublicView,
        onmaxretries: onPublicStreamUnavailable,
      }
    );
    eventsRef.current = source;

    source.addEventListener("observation_resolved", onObservationResolved);
    source.addEventListener("pdf_updated", onPdfUpdated);
    source.addEventListener("minute_published", onMinutePublished);
    source.addEventListener("session_expired", onSessionExpired);
    source.addEventListener("auth_error", onSessionExpired);
    source.addEventListener("session_revoked", onSessionExpired);
    source.addEventListener("forbidden", onPublicStreamUnavailable);
    source.addEventListener("not_found", onPublicStreamUnavailable);
    source.addEventListener("invalid_request", onPublicStreamUnavailable);
    source.addEventListener("keepalive", () => {});
    source.onerror = (errorEvent) => {
      if (errorEvent?.code === "max_retries_exceeded") onPublicStreamUnavailable();
    };

    return () => {
      active = false;
      source.removeEventListener("observation_resolved", onObservationResolved);
      source.removeEventListener("pdf_updated", onPdfUpdated);
      source.removeEventListener("minute_published", onMinutePublished);
      source.removeEventListener("session_expired", onSessionExpired);
      source.removeEventListener("auth_error", onSessionExpired);
      source.removeEventListener("session_revoked", onSessionExpired);
      source.removeEventListener("forbidden", onPublicStreamUnavailable);
      source.removeEventListener("not_found", onPublicStreamUnavailable);
      source.removeEventListener("invalid_request", onPublicStreamUnavailable);
      source.close("unmount");
      if (eventsRef.current === source) {
        eventsRef.current = null;
      }
    };
  }, [recordId, savedSession?.accessToken, step]);

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
        const detailData = await getMinuteViewDetail(recordId, savedSession.accessToken);
        if (!active) return;
        setDetail(detailData);
        setStep("view");
        setError("");
        setPdfError("");

        try {
          const pdfBlob = await getMinuteViewPdfBlob(recordId, savedSession.accessToken);
          if (!active) return;
          if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
          pdfUrlRef.current = URL.createObjectURL(pdfBlob);
          setPdfUrl(pdfUrlRef.current);
        } catch (pdfErr) {
          if (!active) return;
          if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
          pdfUrlRef.current = "";
          setPdfUrl("");
          setPdfError(pdfErr?.message || "El PDF de la minuta aún no está disponible.");
        }
      } catch (err) {
        if (!active) return;
        clearSession(recordId);
        setStep("login");
        setError(PUBLIC_MINUTE_UNAVAILABLE_MESSAGE);
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
    if (isOperationLocked) {
      setError(operationCopy.message);
      toastWarn(operationCopy.title, operationCopy.message, {
        autoClose: 7000,
        toastId: `minute-public-operation-action:${operationMode}`,
      });
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await requestMinuteViewOtp({ recordId, email });
      setRequestMessage(PUBLIC_OTP_REQUEST_MESSAGE);
      setStep("otp");
    } catch (err) {
      setError(PUBLIC_MINUTE_UNAVAILABLE_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    if (isOperationLocked) {
      setError(operationCopy.message);
      toastWarn(operationCopy.title, operationCopy.message, {
        autoClose: 7000,
        toastId: `minute-public-operation-action:${operationMode}`,
      });
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const session = await verifyMinuteViewOtp({ recordId, email, otpCode });
      saveSession(recordId, session);
      const detailData = await getMinuteViewDetail(recordId, session.accessToken);
      setDetail(detailData);
      setStep("view");
      setOtpCode("");
      setPdfError("");

      try {
        const pdfBlob = await getMinuteViewPdfBlob(recordId, session.accessToken);
        if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = URL.createObjectURL(pdfBlob);
        setPdfUrl(pdfUrlRef.current);
      } catch (pdfErr) {
        if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = "";
        setPdfUrl("");
        setPdfError(pdfErr?.message || "El PDF de la minuta aún no está disponible.");
      }
    } catch (err) {
      setError(PUBLIC_OTP_VERIFY_MESSAGE);
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
      eventsRef.current?.close?.("visitor_logout");
      eventsRef.current = null;
      clearSession(recordId);
      setDetail(null);
      setStep("login");
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = "";
      setPdfUrl("");
      setPdfError("");
      setObservationText("");
    }
  };

  const handleCreateObservation = async (event) => {
    event.preventDefault();
    if (isCompleted) {
      setError("La minuta ya fue publicada. No es posible registrar nuevas observaciones.");
      toastWarn("Minuta publicada", "La minuta ya está publicada y no permite nuevas observaciones.", {
        autoClose: 7000,
        toastId: `minute-public-observation-completed:${recordId}`,
      });
      return;
    }
    if (isOperationLocked) {
      setError(operationMode === "read_only"
        ? "El sistema está en solo lectura. No es posible registrar observaciones en este momento."
        : operationMode === "commissioning"
          ? "El sistema está en puesta en marcha. No es posible registrar observaciones en este momento."
          : "El sistema está en mantenimiento. No es posible registrar observaciones en este momento.");
      toastWarn(operationCopy.title, "No es posible registrar observaciones mientras el sistema está bloqueado.", {
        autoClose: 7000,
        toastId: `minute-public-observation-blocked:${operationMode}`,
      });
      return;
    }
    const token = useMinuteViewStore.getState().getSession(recordId)?.accessToken;
    if (!token) {
      setError("La sesión visitante expiró. Solicita un código nuevo.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      if (editingObservation?.id) {
        await updateMinuteObservation(recordId, token, editingObservation.id, observationText);
      } else {
        await createMinuteObservation(recordId, token, observationText);
      }
      const detailData = await getMinuteViewDetail(recordId, token);
      setDetail(detailData);
      setObservationText("");
      setEditingObservation(null);
      setIsModalOpen(false);
      toastInfo(
        editingObservation?.id ? "Observación actualizada" : "Observación registrada",
        editingObservation?.id
          ? "Tu observación fue actualizada correctamente."
          : "Tu observación fue enviada al elaborador.",
        { autoClose: 6000 }
      );
    } catch (err) {
      setError(err?.message || "No fue posible registrar la observación.");
    } finally {
      setSubmitting(false);
    }
  };

  const openCreateObservationModal = () => {
    if (!canCreateObservation) return;
    setEditingObservation(null);
    setObservationText("");
    setError("");
    setIsDrawerOpen(false);
    setIsModalOpen(true);
  };

  const openEditObservationModal = (item) => {
    if (!canCreateObservation || item?.status !== "new" || !item?.isCurrentVersion) return;
    setEditingObservation(item);
    setObservationText(item.body || "");
    setError("");
    setIsModalOpen(true);
  };

  const handleDeleteObservation = async (item) => {
    if (!canCreateObservation || item?.status !== "new" || !item?.isCurrentVersion) return;
    const confirmed = window.confirm("¿Eliminar esta observación? Esta acción no se puede deshacer.");
    if (!confirmed) return;
    const token = useMinuteViewStore.getState().getSession(recordId)?.accessToken;
    if (!token) {
      setError("La sesión visitante expiró. Solicita un código nuevo.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await deleteMinuteObservation(recordId, token, item.id);
      const detailData = await getMinuteViewDetail(recordId, token);
      setDetail(detailData);
      toastInfo("Observación eliminada", "La observación fue eliminada correctamente.", { autoClose: 6000 });
    } catch (err) {
      setError(err?.message || "No fue posible eliminar la observación.");
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

  const publicStatusLabel = PUBLIC_RECORD_STATUS_LABELS[recordStatus] || "Minuta";

  const renderOperationBanner = () => (
    operationCopy ? (
      <div className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
        operationMode === "maintenance"
          ? "border-rose-400/35 bg-rose-500/10 text-rose-100"
          : operationMode === "commissioning"
            ? "border-sky-400/35 bg-sky-500/10 text-sky-100"
          : "border-amber-400/35 bg-amber-500/10 text-amber-100"
      }`}>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="max-w-[38rem]">
            <p className="font-semibold">{operationCopy.title}</p>
            <p className="mt-1 opacity-85">{operationCopy.message}</p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-current/25 bg-white/5 px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] opacity-85">
            {operationCopy.badge}
          </span>
        </div>
      </div>
    ) : null
  );

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
          {renderOperationBanner()}

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
                disabled={submitting || otpCode.length < 6 || isOperationLocked}
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
                disabled={submitting || !email.trim() || isOperationLocked}
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

  if (operationMode === "commissioning" || operationMode === "maintenance" || step !== "view" || !detail) {
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
                <span className="text-sky-300">{publicStatusLabel}</span>
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
        {operationCopy ? (
          <div className={`mb-3 rounded-2xl border px-4 py-3 text-sm ${
            operationMode === "maintenance"
              ? "border-rose-400/35 bg-rose-500/10 text-rose-100"
              : operationMode === "commissioning"
                ? "border-sky-400/35 bg-sky-500/10 text-sky-100"
                : "border-amber-400/35 bg-amber-500/10 text-amber-100"
          }`}>
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="font-semibold">{operationCopy.title}</span>
              <span className="max-w-[42rem] opacity-85">{operationCopy.message}</span>
              <span className="inline-flex w-fit rounded-full border border-current/25 bg-white/5 px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] opacity-85">
                {operationCopy.badge}
              </span>
            </div>
          </div>
        ) : null}
        <section className="h-full overflow-hidden rounded-[28px] border border-slate-300/70 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-slate-900/70 dark:shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
          {pdfUrl ? (
            <iframe title="Minute PDF Viewer" src={pdfUrl} className="h-full w-full bg-white" />
          ) : (
            <div className="grid h-full place-items-center px-6 text-center text-slate-500 dark:text-slate-400">
              {pdfError || "No hay un PDF disponible para esta minuta."}
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
                  Tus observaciones y las que ya fueron aprobadas o incorporadas a la minuta.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {canCreateObservation ? (
                  <button
                    type="button"
                    onClick={openCreateObservationModal}
                    className="rounded-xl border border-sky-300 bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-200 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-100 dark:hover:bg-sky-500/20"
                  >
                    Agregar observación
                  </button>
                ) : isCompleted ? (
                  <span className="rounded-xl border border-emerald-300/50 bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-100">
                    Minuta publicada
                  </span>
                ) : null}
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
              <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Mis observaciones
              </h3>
              {ownObservationGroups?.some((group) => group.observations?.length) ? (
                <div className="space-y-4">
                  {ownObservationGroups?.map((group) => (
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
                                <th className="px-4 py-3 text-right">Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.observations.map((item) => (
                                <React.Fragment key={item.id}>
                                  <tr className="border-t border-slate-200 align-top dark:border-white/5">
                                    <td className="px-4 py-3">
                                      <p className="font-medium text-slate-950 dark:text-white">{item.authorName || item.authorEmail}</p>
                                      <p className="mt-1 text-xs text-slate-500">
                                        {item.createdAt ? formatDateTime(item.createdAt) : ""}
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
                                    <td className="px-4 py-3 text-right">
                                      {canCreateObservation && item.status === "new" && item.isCurrentVersion ? (
                                        <div className="flex justify-end gap-2">
                                          <button
                                            type="button"
                                            onClick={() => openEditObservationModal(item)}
                                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-slate-800"
                                          >
                                            Editar
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteObservation(item)}
                                            className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-400/30 dark:text-rose-200 dark:hover:bg-rose-500/10"
                                          >
                                            Eliminar
                                          </button>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-slate-400">-</span>
                                      )}
                                    </td>
                                  </tr>
                                  {item.editorComment && expandedEditorComments[item.id] ? (
                                    <tr className="border-t border-slate-100 bg-slate-50/70 dark:border-white/5 dark:bg-slate-900/30">
                                      <td colSpan={4} className="px-4 py-3">
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

              <h3 className="mb-3 mt-6 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Observaciones aprobadas o incorporadas de otros participantes
              </h3>
              {sharedObservationGroups?.some((group) => group.observations?.length) ? (
                <div className="space-y-4">
                  {sharedObservationGroups?.map((group) => (
                    <div key={`shared-${group.recordVersionId}`} className="overflow-hidden rounded-2xl border border-slate-300 dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => toggleVersionGroup(`shared-${group.recordVersionId}`)}
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
                              expandedVersionGroups[`shared-${group.recordVersionId}`] ? "rotate-180" : "rotate-0"
                            }`}
                          >
                            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-slate-500 dark:text-slate-300" aria-hidden="true">
                              <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        </div>
                      </button>

                      {expandedVersionGroups[`shared-${group.recordVersionId}`] ? (
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
                                <React.Fragment key={`shared-${item.id}`}>
                                  <tr className="border-t border-slate-200 align-top dark:border-white/5">
                                    <td className="px-4 py-3">
                                      <p className="font-medium text-slate-950 dark:text-white">{item.authorName || item.authorEmail}</p>
                                      <p className="mt-1 text-xs text-slate-500">
                                        {item.createdAt ? formatDateTime(item.createdAt) : ""}
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
                                            onClick={() => toggleEditorComment(`shared-${item.id}`)}
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800"
                                            aria-label={
                                              expandedEditorComments[`shared-${item.id}`]
                                                ? "Ocultar comentario del elaborador"
                                                : "Mostrar comentario del elaborador"
                                            }
                                            title={
                                              expandedEditorComments[`shared-${item.id}`]
                                                ? "Ocultar comentario del elaborador"
                                                : "Mostrar comentario del elaborador"
                                            }
                                          >
                                            <span
                                              className={`transition-transform duration-200 ${
                                                expandedEditorComments[`shared-${item.id}`] ? "rotate-180" : "rotate-0"
                                              }`}
                                            >
                                              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                                                <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                              </svg>
                                            </span>
                                          </button>
                                        ) : null}
                                      </div>
                                    </td>
                                  </tr>
                                  {item.editorComment && expandedEditorComments[`shared-${item.id}`] ? (
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
                        ) : null
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500 dark:border-white/15 dark:bg-slate-900/35 dark:text-slate-400">
                  Aún no hay observaciones aprobadas o incorporadas.
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : null}

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 px-4">
          <div className="w-full max-w-xl rounded-[28px] border border-slate-300 bg-white p-6 shadow-[0_28px_90px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-slate-900 dark:shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
            <h2 className="text-xl font-bold text-slate-950 dark:text-white">
              {editingObservation ? "Editar observación" : "Nueva observación"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              {editingObservation
                ? "Puedes modificarla mientras el elaborador no la haya procesado."
                : "La observación quedará asociada a la versión activa actual de la minuta."}
            </p>

            <form className="mt-5 space-y-4" onSubmit={handleCreateObservation}>
              <textarea
                ref={observationTextareaRef}
                value={observationText}
                onChange={(event) => setObservationText(event.target.value)}
                rows={7}
                placeholder="Describe el ajuste o comentario que quieres dejar sobre esta versión."
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-950 outline-none focus:border-sky-400/60 dark:border-white/10 dark:bg-slate-950 dark:text-white"
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingObservation(null);
                    setObservationText("");
                  }}
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || observationText.trim().length < 3}
                  className="rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Guardando..." : editingObservation ? "Guardar cambios" : "Registrar observación"}
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
