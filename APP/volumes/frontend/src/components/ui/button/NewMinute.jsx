// components/ui/button/NewMinute.jsx
/**
 * NewMinute — Asistente de creación de minutas
 *
 * Cambios vs versión anterior:
 *  - Importa useMinuteNotificationStore
 *  - Tras crear la minuta exitosamente llama addPending(transactionId, recordId, clientName)
 *    para que useMinuteSSE abra el canal SSE y notifique cuando esté lista.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import ActionButton from "./ActionButton";
import Icon from "@/components/ui/icon/iconManager";
import ModalManager from "@/components/ui/modal";
import { generateMinute } from "@/services/minutesService";
import clientService from "@/services/clientService";
import projectService from "@/services/projectService";
import profileService, { profileCategoryService } from "@/services/profileService";
import useSessionStore from "@/store/sessionStore";
import useMinuteNotificationStore from "@/store/minuteNotificationStore";

import logger from "@/utils/logger";
const minLog = logger.scope("minute");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toStringArray = (str) =>
  String(str ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

const MEETING_LOCATION_SUGGESTIONS = [
  "Microsoft Teams",
  "Zoom",
  "Google Meet",
  "Cisco Webex",
  "Slack Huddles",
  "Skype",
  "Discord",
  "Jitsi Meet",
  "GoTo Meeting",
  "Whereby",
  "BlueJeans",
  "Adobe Connect",
  "Amazon Chime",
  "Zoho Meeting",
  "BigBlueButton",
  "Livestorm",
  "RingCentral Video",
  "Google Chat",
  "Signal",
  "Telegram",
  "WhatsApp",
  "FaceTime",
  "Viber",
  "Line",
  "Talky",
  "Airmeet",
  "Demio",
  "Hopin",
  "On24",
  "Miro Talk",
  "Jami",
  "Wire",
  "Pexip",
  "TrueConf",
  "StarLeaf",
  "Avaya Spaces",
  "TeamViewer Meeting",
  "Zoho Cliq",
  "Mattermost Calls",
  "Rocket.Chat Meet",
  "Nextcloud Talk",
  "Dialpad Meetings",
  "8x8 Meet",
  "Fuze",
  "AnyMeeting",
  "ClickMeeting",
  "FreeConference",
  "UberConference",
  "Lark Meetings",
  "Sala de reuniones",
];

const buildPayload = ({ formData, clients, projects, profiles, categories, preparedBy }) => {
  const client   = clients.find((c)   => String(c.id)  === String(formData.client));
  const project  = projects.find((p)  => String(p.id)  === String(formData.project));
  const profile  = profiles.find((p)  => String(p.id)  === String(formData.analysisProfile));
  const category = categories.find((c) => String(c.id) === String(formData.analysisCategory));

  return {
    meetingInfo: {
      scheduledDate:      formData.scheduledDate      ?? "",
      scheduledStartTime: formData.scheduledStartTime ?? "",
      scheduledEndTime:   formData.scheduledEndTime   ?? "",
      actualStartTime:    formData.actualStartTime    ?? "",
      actualEndTime:      "",
      location:           formData.location           ?? "",
    },
    projectInfo: {
      client:    String(client?.name    ?? "").trim(),
      clientID:  String(client?.id      ?? "").trim(),
      project:   String(project?.name   ?? "").trim(),
      projectID: String(project?.id     ?? "").trim(),
      category:  String(category?.name  ?? "").trim(),
    },
    participants: {
      attendees:      toStringArray(formData.attendees),
      invited:        [],
      copyRecipients: toStringArray(formData.ccParticipants),
    },
    profileInfo: {
      profileId:   String(profile?.id   ?? "").trim(),
      profileName: String(profile?.name ?? "").trim(),
    },
    preparedBy: String(preparedBy ?? "").trim(),
    additionalNotes: String(formData.additionalInfo ?? "").trim(),
    generationOptions: {
      language: "es",
    },
  };
};

const buildFiles = (formData) => {
  const files = [];
  if (formData.transcription instanceof File) files.push(formData.transcription);
  if (formData.summary instanceof File)       files.push(formData.summary);
  return files;
};

// ─── Spinner inline ───────────────────────────────────────────────────────────

const InlineSpinner = ({ text = "Cargando..." }) => (
  <div className="flex items-center justify-center gap-2 py-8 text-gray-500 dark:text-gray-400">
    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
    <span className="text-sm">{text}</span>
  </div>
);

// ─── NewMinuteFormInner ────────────────────────────────────────────────────────

const NewMinuteFormInner = ({ onSubmit, onCancel, isSubmitting, onCatalogLoaded }) => {
  const [formData, setFormData] = useState({
    client:             "",
    project:            "",
    analysisCategory:   "",
    analysisProfile:    "",
    transcription:      null,
    summary:            null,
    scheduledDate:      "",
    scheduledStartTime: "",
    actualStartTime:    "",
    scheduledEndTime:   "",
    location:           "",
    attendees:          "",
    ccParticipants:     "",
    additionalInfo:     "",
  });

  const [errors, setErrors]           = useState({});
  const [currentStep, setCurrentStep] = useState(0);

  const [clients,    setClients]    = useState([]);
  const [projects,   setProjects]   = useState([]);
  const [profiles,   setProfiles]   = useState([]);
  const [categories, setCategories] = useState([]);

  const [loadingCatalog,  setLoadingCatalog]  = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [catalogError,    setCatalogError]    = useState(null);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [locationDropdownStyle, setLocationDropdownStyle] = useState(null);
  const [activeLocationSuggestionIndex, setActiveLocationSuggestionIndex] = useState(-1);

  const catalogLoaded = useRef(false);
  const locationInputRef = useRef(null);

  useEffect(() => {
    if (catalogLoaded.current) return;
    catalogLoaded.current = true;

    (async () => {
      setLoadingCatalog(true);
      setCatalogError(null);
      try {
        const [cr, pr, catR] = await Promise.all([
          clientService.list({ isActive: true, limit: 200 }),
          profileService.list({ isActive: true, limit: 200 }),
          profileCategoryService.list({ isActive: true, limit: 200 }),
        ]);
        const c = cr.items   ?? [];
        const p = pr.items   ?? [];
        const k = catR.items ?? [];
        setClients(c);
        setProfiles(p);
        setCategories(k);
        onCatalogLoaded?.({ clients: c, profiles: p, categories: k, projects: [] });
      } catch (err) {
        minLog.error("Error cargando catálogos:", err);
        setCatalogError("No se pudieron cargar los datos. Verifica tu conexión e intenta de nuevo.");
      } finally {
        setLoadingCatalog(false);
      }
    })();
  }, [onCatalogLoaded]);

  useEffect(() => {
    if (!formData.client) { setProjects([]); return; }

    (async () => {
      setLoadingProjects(true);
      try {
        const r = await projectService.list({
          isActive: true,
          limit: 200,
          filters: { clientId: formData.client },
        });
        const p = r.items ?? [];
        setProjects(p);
        onCatalogLoaded?.({ projects: p });
      } catch (err) {
        minLog.error("Error cargando proyectos:", err);
        setProjects([]);
      } finally {
        setLoadingProjects(false);
      }
    })();
  }, [formData.client, onCatalogLoaded]);

  const clientOptions = useMemo(() =>
    clients.map((c) => ({
      value: String(c.id),
      label: String(c.name ?? "").trim() || "(Sin nombre)",
    })),
  [clients]);

  const projectOptions = useMemo(() =>
    projects.map((p) => ({
      value: String(p.id),
      label: String(p.name ?? "").trim(),
    })),
  [projects]);

  const categoryOptions = useMemo(() => {
    const catIdsWithProfiles = new Set(
      profiles.map((p) => String(p.categoryId ?? p.category_id ?? ""))
    );
    return categories
      .filter((c) => catIdsWithProfiles.has(String(c.id)))
      .map((c) => ({ value: String(c.id), label: String(c.name ?? "") }));
  }, [categories, profiles]);

  const analysisProfileOptions = useMemo(() => {
    if (!formData.analysisCategory) return [];
    return profiles
      .filter((p) => String(p.categoryId ?? p.category_id ?? "") === String(formData.analysisCategory))
      .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "es"))
      .map((p) => ({
        value:       String(p.id),
        label:       String(p.name ?? ""),
        description: String(p.description ?? ""),
      }));
  }, [profiles, formData.analysisCategory]);

  const selectedProfile = useMemo(() => {
    if (!formData.analysisProfile) return null;
    return analysisProfileOptions.find(
      (p) => p.value === String(formData.analysisProfile)
    ) ?? null;
  }, [analysisProfileOptions, formData.analysisProfile]);

  const selectedClient = useMemo(() =>
    clients.find((c) => String(c.id) === String(formData.client)) ?? null,
  [clients, formData.client]);

  const selectedProject = useMemo(() =>
    projects.find((p) => String(p.id) === String(formData.project)) ?? null,
  [projects, formData.project]);

  const selectedCategory = useMemo(() =>
    categories.find((c) => String(c.id) === String(formData.analysisCategory)) ?? null,
  [categories, formData.analysisCategory]);

  const filteredLocationSuggestions = useMemo(() => {
    const query = String(formData.location ?? "").trim().toLowerCase();
    const normalized = MEETING_LOCATION_SUGGESTIONS.filter((option, index, arr) =>
      arr.indexOf(option) === index
    );

    if (!query) return normalized.slice(0, 10);

    return normalized
      .filter((option) => option.toLowerCase().includes(query))
      .slice(0, 10);
  }, [formData.location]);

  useEffect(() => {
    if (!showLocationSuggestions || currentStep !== 2 || !locationInputRef.current) return;

    const updateDropdownPosition = () => {
      const rect = locationInputRef.current?.getBoundingClientRect();
      if (!rect) return;

      setLocationDropdownStyle({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      });
    };

    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);

    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [showLocationSuggestions, currentStep]);

  useEffect(() => {
    setActiveLocationSuggestionIndex(filteredLocationSuggestions.length > 0 ? 0 : -1);
  }, [filteredLocationSuggestions]);

  const handleChange = (name, value) => {
    setFormData((prev) => {
      const newData = { ...prev, [name]: value };
      if (name === "client") newData.project = "";
      if (name === "analysisCategory") {
        const catProfiles = profiles.filter(
          (p) => String(p.categoryId ?? p.category_id ?? "") === String(value)
        );
        newData.analysisProfile = catProfiles.length === 1 ? String(catProfiles[0].id) : "";
      }
      return newData;
    });

    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
    if (name === "analysisCategory" && errors.analysisProfile) {
      setErrors((prev) => ({ ...prev, analysisProfile: null }));
    }
  };

  const selectLocationSuggestion = (option) => {
    handleChange("location", option);
    setShowLocationSuggestions(false);
    setActiveLocationSuggestionIndex(-1);
  };

  const validateStep = (step) => {
    const newErrors = {};
    switch (step) {
      case 0:
        if (!formData.client)           newErrors.client           = "Cliente es requerido";
        if (!formData.project)          newErrors.project          = "Proyecto es requerido";
        if (!formData.analysisCategory) newErrors.analysisCategory = "Categoría de análisis es requerida";
        if (!formData.analysisProfile)  newErrors.analysisProfile  = "Perfil de análisis es requerido";
        break;
      case 1:
        if (!formData.transcription) newErrors.transcription = "Transcripción es requerida";
        break;
      case 2:
        if (!formData.scheduledDate)      newErrors.scheduledDate      = "Fecha programada es requerida";
        if (!formData.scheduledStartTime) newErrors.scheduledStartTime = "Hora inicio programada es requerida";
        if (!formData.actualStartTime)    newErrors.actualStartTime    = "Hora inicio real es requerida";
        if (!formData.scheduledEndTime)   newErrors.scheduledEndTime   = "Hora término es requerida";
        break;
      default:
        break;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1);
      else handleSubmit();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = () => {
    onSubmit?.(formData);
  };

  const steps = [
    { title: "Información General",   number: 1 },
    { title: "Adjuntos",              number: 2 },
    { title: "Fechas y Horarios",     number: 3 },
    { title: "Participantes",         number: 4 },
    { title: "Información Adicional", number: 5 },
    { title: "Confirmación",          number: 6 },
  ];

  const isLastStep     = currentStep === steps.length - 1;
  const submitDisabled = (isLastStep && isSubmitting) || loadingCatalog || !!catalogError;

  return (
    <>
    <div className="w-full rounded-[26px] bg-white/8 p-[2px] shadow-[0_0_24px_rgba(255,255,255,0.08),0_24px_70px_rgba(15,23,42,0.24)] backdrop-blur-[3px] dark:bg-white/[0.06] dark:shadow-[0_0_28px_rgba(255,255,255,0.06),0_24px_70px_rgba(2,6,23,0.52)]">
    <div className="flex h-[78vh] min-h-[620px] w-full flex-col rounded-[24px] border border-white/45 bg-slate-100 dark:border-white/10 dark:bg-slate-950">

      {/* Stepper */}
      <div className="flex-shrink-0 px-8 py-6 border-b border-slate-200/80 dark:border-slate-700/80">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold
                  ${idx === currentStep
                    ? "bg-blue-600 text-white"
                    : idx < currentStep
                      ? "bg-green-600 text-white"
                      : "bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400"
                  }`}
              >
                {idx < currentStep ? "✓" : step.number}
              </div>
              {idx < steps.length - 1 && (
                <div className={`w-12 h-1 mx-2 ${idx < currentStep ? "bg-green-600" : "bg-gray-300 dark:bg-gray-600"}`} />
              )}
            </div>
          ))}
        </div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          {steps[currentStep].title}
        </h3>
      </div>

      {/* Contenido con scroll */}
      <div className="flex-1 overflow-y-auto px-8 py-6 min-h-0">

        {loadingCatalog && <InlineSpinner text="Cargando catálogos..." />}
        {!loadingCatalog && catalogError && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
            {catalogError}
          </div>
        )}

        {/* Paso 0: Información General */}
        {!loadingCatalog && !catalogError && currentStep === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Seleccione cliente y proyecto. Luego configure el{" "}
              <strong>enfoque de análisis IA</strong> (categoría y perfil) que
              ajustará el <strong>prompt</strong> utilizado para analizar la minuta.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Empresa <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.client}
                onChange={(e) => handleChange("client", e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                  ${errors.client ? "border-red-500 focus:ring-red-500" : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"}
                  focus:outline-none focus:ring-2`}
              >
                <option value="">Seleccione una empresa</option>
                {clientOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {errors.client && <p className="mt-1 text-sm text-red-500">{errors.client}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Proyecto <span className="text-red-500">*</span>
              </label>
              {loadingProjects ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Cargando proyectos...
                </div>
              ) : (
                <select
                  value={formData.project}
                  onChange={(e) => handleChange("project", e.target.value)}
                  disabled={!formData.client}
                  className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                    ${errors.project ? "border-red-500 focus:ring-red-500" : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"}
                    focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <option value="">
                    {formData.client ? "Seleccione un proyecto" : "Primero seleccione una empresa"}
                  </option>
                  {projectOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}
              {errors.project && <p className="mt-1 text-sm text-red-500">{errors.project}</p>}
              {formData.client && !loadingProjects && projectOptions.length === 0 && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Este cliente no tiene proyectos activos.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Categoría de análisis IA <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.analysisCategory}
                onChange={(e) => handleChange("analysisCategory", e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                  ${errors.analysisCategory ? "border-red-500 focus:ring-red-500" : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"}
                  focus:outline-none focus:ring-2`}
              >
                <option value="">Seleccione una categoría</option>
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {errors.analysisCategory && <p className="mt-1 text-sm text-red-500">{errors.analysisCategory}</p>}
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                Define el <strong>área técnica</strong> del análisis (por ejemplo: Infraestructura, Seguridad, Software).
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Perfil de análisis IA <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.analysisProfile}
                onChange={(e) => handleChange("analysisProfile", e.target.value)}
                disabled={!formData.analysisCategory}
                className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                  ${errors.analysisProfile ? "border-red-500 focus:ring-red-500" : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"}
                  focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <option value="">
                  {formData.analysisCategory ? "Seleccione un perfil" : "Primero seleccione una categoría"}
                </option>
                {analysisProfileOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {errors.analysisProfile && <p className="mt-1 text-sm text-red-500">{errors.analysisProfile}</p>}
              {selectedProfile && (
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800 space-y-1">
                  <p><strong>Descripción:</strong> {selectedProfile.description || "Sin descripción"}</p>
                  <p className="text-gray-500 dark:text-gray-500">
                    Este perfil ajusta el <strong>prompt</strong> para orientar el análisis de la minuta
                    sin alterar el formato de entrada/salida.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Paso 1: Adjuntos */}
        {!loadingCatalog && !catalogError && currentStep === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Suba la transcripción (obligatoria) y el resumen (opcional)
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Transcripción <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                accept=".txt,.doc,.docx,.pdf"
                onChange={(e) => handleChange("transcription", e.target.files?.[0] ?? null)}
                className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                  ${errors.transcription ? "border-red-500" : "border-gray-300 dark:border-gray-600"}
                  file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0
                  file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100`}
              />
              {formData.transcription && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Archivo: {formData.transcription.name}</p>
              )}
              {errors.transcription && <p className="mt-1 text-sm text-red-500">{errors.transcription}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Resumen (opcional)
              </label>
              <input
                type="file"
                accept=".txt,.doc,.docx,.pdf"
                onChange={(e) => handleChange("summary", e.target.files?.[0] ?? null)}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                  border-gray-300 dark:border-gray-600
                  file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0
                  file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {formData.summary && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Archivo: {formData.summary.name}</p>
              )}
            </div>
          </div>
        )}

        {/* Paso 2: Fechas y Horarios */}
        {!loadingCatalog && !catalogError && currentStep === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Configure las fechas y horarios de la reunión
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fecha Programada <span className="text-red-500">*</span>
              </label>
              <input type="date" value={formData.scheduledDate}
                onChange={(e) => handleChange("scheduledDate", e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                  ${errors.scheduledDate ? "border-red-500 focus:ring-red-500" : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"}
                  focus:outline-none focus:ring-2`}
              />
              {errors.scheduledDate && <p className="mt-1 text-sm text-red-500">{errors.scheduledDate}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Hora Inicio Programada <span className="text-red-500">*</span>
              </label>
              <input type="time" value={formData.scheduledStartTime}
                onChange={(e) => handleChange("scheduledStartTime", e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                  ${errors.scheduledStartTime ? "border-red-500 focus:ring-red-500" : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"}
                  focus:outline-none focus:ring-2`}
              />
              {errors.scheduledStartTime && <p className="mt-1 text-sm text-red-500">{errors.scheduledStartTime}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Hora Inicio Real <span className="text-red-500">*</span>
              </label>
              <input type="time" value={formData.actualStartTime}
                onChange={(e) => handleChange("actualStartTime", e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                  ${errors.actualStartTime ? "border-red-500 focus:ring-red-500" : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"}
                  focus:outline-none focus:ring-2`}
              />
              {errors.actualStartTime && <p className="mt-1 text-sm text-red-500">{errors.actualStartTime}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Hora Término Programada <span className="text-red-500">*</span>
              </label>
              <input type="time" value={formData.scheduledEndTime}
                onChange={(e) => handleChange("scheduledEndTime", e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                  ${errors.scheduledEndTime ? "border-red-500 focus:ring-red-500" : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"}
                  focus:outline-none focus:ring-2`}
              />
              {errors.scheduledEndTime && <p className="mt-1 text-sm text-red-500">{errors.scheduledEndTime}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ubicación / Medio
              </label>
              <div className="relative">
                <input
                  ref={locationInputRef}
                  type="text"
                  value={formData.location}
                  onKeyDown={(e) => {
                    if (!showLocationSuggestions || filteredLocationSuggestions.length === 0) {
                      return;
                    }

                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setActiveLocationSuggestionIndex((prev) =>
                        prev < filteredLocationSuggestions.length - 1 ? prev + 1 : 0
                      );
                      return;
                    }

                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setActiveLocationSuggestionIndex((prev) =>
                        prev > 0 ? prev - 1 : filteredLocationSuggestions.length - 1
                      );
                      return;
                    }

                    if (e.key === "Enter" && activeLocationSuggestionIndex >= 0) {
                      e.preventDefault();
                      selectLocationSuggestion(filteredLocationSuggestions[activeLocationSuggestionIndex]);
                      return;
                    }

                    if (e.key === "Escape") {
                      e.preventDefault();
                      setShowLocationSuggestions(false);
                      setActiveLocationSuggestionIndex(-1);
                    }
                  }}
                  onBlur={() => {
                    window.setTimeout(() => setShowLocationSuggestions(false), 120);
                  }}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    handleChange("location", nextValue);
                    setShowLocationSuggestions(Boolean(String(nextValue).trim()));
                  }}
                  placeholder="Ej: Zoom, Google Meet, Microsoft Teams, Sala 2"
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                    border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Puede seleccionar una plataforma sugerida o escribir una ubicación personalizada.
              </p>
            </div>
          </div>
        )}

        {/* Paso 3: Participantes */}
        {!loadingCatalog && !catalogError && currentStep === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Ingrese la lista de asistentes a la reunión y las personas que recibirán copia de la minuta
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Participantes Presentes
              </label>
              <textarea
                value={formData.attendees}
                onChange={(e) => handleChange("attendees", e.target.value)}
                rows={5}
                placeholder={"Ingrese los nombres de los asistentes a la reunión (uno por línea)\nEjemplo:\nJuan Pérez\nMaría González\nRoberto Silva"}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                  border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Destinatarios en Copia (CC)
              </label>
              <textarea
                value={formData.ccParticipants}
                onChange={(e) => handleChange("ccParticipants", e.target.value)}
                rows={5}
                placeholder={"Ingrese los nombres de quienes recibirán copia de la minuta (uno por línea)\nEjemplo:\nAna Martínez - Gerente General\nCarlos López - Jefe de Proyecto"}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                  border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
        )}

        {/* Paso 4: Información Adicional */}
        {!loadingCatalog && !catalogError && currentStep === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Agregue cualquier información extra relevante sobre la reunión
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Información Adicional
              </label>
              <textarea
                value={formData.additionalInfo}
                onChange={(e) => handleChange("additionalInfo", e.target.value)}
                rows={8}
                placeholder={"Ingrese información adicional sobre la reunión\n\nEjemplos:\n- Objetivos específicos de la reunión\n- Contexto o antecedentes relevantes\n- Temas prioritarios a tratar\n- Observaciones especiales"}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                  border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
        )}

        {/* Paso 5: Confirmación */}
        {!loadingCatalog && !catalogError && currentStep === 5 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Revise la información ingresada antes de crear la minuta.
            </p>
            <div className="space-y-6">

              <div className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs mr-2">1</span>
                  Información General
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex"><span className="font-medium text-gray-700 dark:text-gray-300 w-44">Empresa:</span><span className="text-gray-600 dark:text-gray-400">{String(selectedClient?.name ?? "").trim() || "Sin información proporcionada"}</span></div>
                  <div className="flex"><span className="font-medium text-gray-700 dark:text-gray-300 w-44">Proyecto:</span><span className="text-gray-600 dark:text-gray-400">{String(selectedProject?.name ?? "").trim() || "Sin información proporcionada"}</span></div>
                  <div className="flex"><span className="font-medium text-gray-700 dark:text-gray-300 w-44">Categoría (análisis IA):</span><span className="text-gray-600 dark:text-gray-400">{String(selectedCategory?.name ?? "").trim() || "Sin información proporcionada"}</span></div>
                  <div className="flex"><span className="font-medium text-gray-700 dark:text-gray-300 w-44">Perfil (análisis IA):</span><span className="text-gray-600 dark:text-gray-400">{String(selectedProfile?.label ?? "").trim() || "Sin información proporcionada"}</span></div>
                  {selectedProfile?.description && (
                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                      <p><strong>Descripción:</strong> {String(selectedProfile.description).trim()}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-l-4 border-purple-500 pl-4">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-500 text-white text-xs mr-2">2</span>
                  Adjuntos
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex"><span className="font-medium text-gray-700 dark:text-gray-300 w-44">Transcripción:</span><span className="text-gray-600 dark:text-gray-400">{formData.transcription?.name ?? "No cargada"}</span></div>
                  <div className="flex"><span className="font-medium text-gray-700 dark:text-gray-300 w-44">Resumen:</span><span className="text-gray-600 dark:text-gray-400">{formData.summary?.name ?? "No cargado (opcional)"}</span></div>
                </div>
              </div>

              <div className="border-l-4 border-green-500 pl-4">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white text-xs mr-2">3</span>
                  Fechas y Horarios
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex"><span className="font-medium text-gray-700 dark:text-gray-300 w-44">Fecha programada:</span><span className="text-gray-600 dark:text-gray-400">{formData.scheduledDate || "Sin información"}</span></div>
                  <div className="flex"><span className="font-medium text-gray-700 dark:text-gray-300 w-44">Inicio programado:</span><span className="text-gray-600 dark:text-gray-400">{formData.scheduledStartTime || "Sin información"}</span></div>
                  <div className="flex"><span className="font-medium text-gray-700 dark:text-gray-300 w-44">Inicio real:</span><span className="text-gray-600 dark:text-gray-400">{formData.actualStartTime || "Sin información"}</span></div>
                  <div className="flex"><span className="font-medium text-gray-700 dark:text-gray-300 w-44">Término programado:</span><span className="text-gray-600 dark:text-gray-400">{formData.scheduledEndTime || "Sin información"}</span></div>
                  <div className="flex"><span className="font-medium text-gray-700 dark:text-gray-300 w-44">Ubicación:</span><span className="text-gray-600 dark:text-gray-400">{formData.location || "Sin información"}</span></div>
                </div>
              </div>

              <div className="border-l-4 border-amber-500 pl-4">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white text-xs mr-2">4</span>
                  Participantes
                </h4>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="flex"><span className="font-medium text-gray-700 dark:text-gray-300 w-44">Participantes:</span><span className="text-gray-600 dark:text-gray-400">{String(formData.attendees ?? "").trim() ? "Ver listado" : "Sin información proporcionada"}</span></div>
                    {String(formData.attendees ?? "").trim() && (
                      <pre className="mt-2 text-xs whitespace-pre-wrap break-words p-3 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">{String(formData.attendees).trim()}</pre>
                    )}
                  </div>
                  <div>
                    <div className="flex"><span className="font-medium text-gray-700 dark:text-gray-300 w-44">Copia (CC):</span><span className="text-gray-600 dark:text-gray-400">{String(formData.ccParticipants ?? "").trim() ? "Ver listado" : "Sin información proporcionada"}</span></div>
                    {String(formData.ccParticipants ?? "").trim() && (
                      <pre className="mt-2 text-xs whitespace-pre-wrap break-words p-3 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">{String(formData.ccParticipants).trim()}</pre>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-l-4 border-gray-500 pl-4">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-600 text-white text-xs mr-2">5</span>
                  Información Adicional
                </h4>
                <div className="text-sm">
                  {String(formData.additionalInfo ?? "").trim() ? (
                    <pre className="text-xs whitespace-pre-wrap break-words p-3 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">{String(formData.additionalInfo).trim()}</pre>
                  ) : (
                    <p className="text-gray-600 dark:text-gray-400">Sin información adicional.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                <strong>ℹ️ Procesamiento asíncrono:</strong> Al confirmar, la minuta será enviada al
                procesador IA. Recibirás una notificación cuando esté lista para edición.
                El proceso puede tardar unos minutos.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-8 py-5 border-t border-slate-200/80 dark:border-slate-700/80">
        <div className="flex justify-between">
          <button
            onClick={currentStep === 0 ? onCancel : handlePrevious}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800
              border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700
              focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {currentStep === 0 ? "Cancelar" : "Anterior"}
          </button>
          <button
            onClick={handleNext}
            disabled={submitDisabled}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700
              focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLastStep && isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Enviando...
              </>
            ) : (
              isLastStep ? "Finalizar" : "Siguiente"
            )}
          </button>
        </div>
      </div>
    </div>
    </div>
    {showLocationSuggestions && filteredLocationSuggestions.length > 0 && locationDropdownStyle
      ? createPortal(
          <div
            className="fixed z-[1105] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
            style={locationDropdownStyle}
          >
            <div className="max-h-60 overflow-y-auto py-1">
              {filteredLocationSuggestions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectLocationSuggestion(option);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                    activeLocationSuggestionIndex >= 0 &&
                    filteredLocationSuggestions[activeLocationSuggestionIndex] === option
                      ? "bg-blue-50 text-gray-900 dark:bg-blue-900/20 dark:text-white"
                      : "text-gray-700 hover:bg-blue-50 dark:text-gray-200 dark:hover:bg-blue-900/20"
                  }`}
                >
                  <span>{option}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">Sugerencia</span>
                </button>
              ))}
            </div>
          </div>,
          document.body
        )
      : null}
    </>
  );
};

// ─── Wrapper que expone catálogo al orquestador ───────────────────────────────

const NewMinuteFormWithCatalog = ({ onSubmit, onCancel, isSubmitting }) => {
  const [catalog, setCatalog] = useState({
    clients: [], projects: [], profiles: [], categories: [],
  });

  const handleCatalogLoaded = useCallback((loaded) => {
    setCatalog((prev) => ({ ...prev, ...loaded }));
  }, []);

  return (
    <NewMinuteFormInner
      onSubmit={(formData) => onSubmit(formData, catalog)}
      onCancel={onCancel}
      isSubmitting={isSubmitting}
      onCatalogLoaded={handleCatalogLoaded}
    />
  );
};

// ─── NewMinute ────────────────────────────────────────────────────────────────

/**
 * Props:
 *   onSuccess (Function) — callback opcional invocado tras 202.
 *                          Recibe { transactionId, recordId }.
 *                          Desde Minute.jsx → refresca lista.
 *                          Desde Dashboard → navega a /minutes.
 */
const NewMinute = ({ onSuccess }) => {
  const user       = useSessionStore((s) => s.user);
  const addPending = useMinuteNotificationStore((s) => s.addPending);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNewMinute = () => {
    ModalManager.show({
      type:       "custom",
      title:      "Asistente de Preparación de Minutas",
      size:       "minuteWide",
      showHeader: false,
      showFooter: false,
      content: (
        <NewMinuteFormWithCatalog
          isSubmitting={isSubmitting}
          onSubmit={async (formData, catalog) => {
            setIsSubmitting(true);
            try {
              const payload = buildPayload({
                formData,
                clients:    catalog.clients,
                projects:   catalog.projects,
                profiles:   catalog.profiles,
                categories: catalog.categories,
                preparedBy: user?.full_name ?? user?.username ?? "",
              });

              const files = buildFiles(formData);

              minLog.log("Enviando minuta al backend", { payload, files: files.map((f) => f.name) });

              const result = await generateMinute(payload, files);

              minLog.log("Minuta creada:", result);

              ModalManager.closeAll();
              ModalManager.success({
                title:   "Minuta en Procesamiento",
                message: "La minuta fue enviada al procesador IA. Recibirás una notificación cuando esté lista para edición.",
              });

              // ── NUEVO: registrar la tx para que useMinuteSSE abra el SSE ──
              const clientName = catalog.clients.find(
                (c) => String(c.id) === String(formData.client)
              )?.name ?? "Minuta";
              addPending(result?.transactionId, result?.recordId, clientName);

              // Notificar al padre (refrescar lista o navegar a /minutes)
              onSuccess?.({ transactionId: result?.transactionId, recordId: result?.recordId });

            } catch (err) {
              minLog.error("Error al crear minuta:", err);

              const detail =
                err?.response?.data?.error?.detail ??
                err?.response?.data?.detail         ??
                err?.message                        ??
                "Ocurrió un error inesperado al crear la minuta.";

              ModalManager.show({
                type:    "error",
                title:   "Error al crear minuta",
                message: String(detail),
              });
            } finally {
              setIsSubmitting(false);
            }
          }}
          onCancel={() => ModalManager.closeAll()}
        />
      ),
    });
  };

  return (
    <ActionButton
      label="Nueva Minuta"
      onClick={handleNewMinute}
      variant="primary"
      icon={<Icon name="FaPlus" />}
    />
  );
};

export default NewMinute;
