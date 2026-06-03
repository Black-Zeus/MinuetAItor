import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@components/ui/icon/iconManager";
import contextService from "@/services/contextService";
import contextSettingsService from "@/services/contextSettingsService";
import clientService from "@/services/clientService";
import projectService from "@/services/projectService";
import { listMinutes } from "@/services/minutesService";
import { openPdfViewer } from "@/components/ui/pdf/PdfViewerModal";

const SCOPE_OPTIONS = [
  { id: "global", label: "Global", icon: "globe", hint: "Todo lo autorizado" },
  { id: "client", label: "Cliente", icon: "business", hint: "Un cliente" },
  { id: "project", label: "Proyecto", icon: "diagramProject", hint: "Un proyecto" },
  { id: "minute", label: "Minuta", icon: "fileLines", hint: "Una minuta final" },
];

const SEARCH_STATE_KEY = "knowledge-search:last-query";

const getErrorMessage = (error) => error?.message || "Ocurrió un error al consultar el contexto.";

const readSavedSearchState = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SEARCH_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const writeSavedSearchState = (payload) => {
  if (typeof window === "undefined") return;
  try {
    if (!payload?.question?.trim() && !payload?.result) {
      window.sessionStorage.removeItem(SEARCH_STATE_KEY);
      return;
    }
    window.sessionStorage.setItem(SEARCH_STATE_KEY, JSON.stringify(payload));
  } catch {
    // La persistencia de navegación es auxiliar; la consulta no debe fallar por storage.
  }
};

const getResultQueryId = (value) => value?.queryId ?? value?.query_id ?? "";

const getCitationValue = (citation, camelKey, snakeKey) => citation?.[camelKey] ?? citation?.[snakeKey] ?? "";

const extractCitationPrefixValue = (text, label) => {
  const firstLine = String(text || "").split("\n")[0] || "";
  const pattern = new RegExp(`(?:^|\\|\\s*)${label}:\\s*([^|\\n]+)`, "i");
  return firstLine.match(pattern)?.[1]?.trim() ?? "";
};

const getCitationSource = (citation, index) => {
  const text = citation?.text ?? "";
  const minuteId = getCitationValue(citation, "minuteId", "minute_id");
  const minuteTitle =
    getCitationValue(citation, "minuteTitle", "minute_title") ||
    extractCitationPrefixValue(text, "Minuta") ||
    "Minuta sin título";
  const clientName =
    getCitationValue(citation, "clientName", "client_name") ||
    extractCitationPrefixValue(text, "Cliente");
  const projectName =
    getCitationValue(citation, "projectName", "project_name") ||
    extractCitationPrefixValue(text, "Proyecto");
  const location =
    getCitationValue(citation, "minuteLocation", "minute_location") ||
    extractCitationPrefixValue(text, "Sala") ||
    extractCitationPrefixValue(text, "Lugar");
  const status = getCitationValue(citation, "minuteStatus", "minute_status");
  const fallbackKey = [minuteTitle, clientName, projectName, location].filter(Boolean).join("::") || `source-${index}`;

  return {
    key: minuteId || fallbackKey,
    minuteId,
    minuteTitle,
    clientName,
    projectName,
    location,
    status,
  };
};

const groupCitationsByMinute = (citations = []) => {
  const groups = [];
  const groupIndex = new Map();

  citations.forEach((citation, index) => {
    const source = getCitationSource(citation, index);
    const existingIndex = groupIndex.get(source.key);
    const normalizedCitation = { ...citation, citationIndex: index };

    if (existingIndex == null) {
      groupIndex.set(source.key, groups.length);
      groups.push({ ...source, citations: [normalizedCitation] });
      return;
    }

    groups[existingIndex].citations.push(normalizedCitation);
  });

  return groups;
};

const buildCitationBody = (citation) => {
  if (isOverviewCitation(citation)) return "";

  const rawText = String(citation?.text ?? "");
  const lines = rawText.split("\n").map((line) => line.trim()).filter(Boolean);
  const title = String(citation?.title || citation?.itemType || citation?.item_type || "").trim();
  const contentLines = [...lines];

  if (contentLines[0]?.startsWith("Cliente:") && contentLines[0]?.includes("|")) {
    contentLines.shift();
  }
  if (title && contentLines[0] === title) {
    contentLines.shift();
  }

  return contentLines.join("\n").trim() || rawText.trim();
};

const isOverviewCitation = (citation) => {
  const title = String(citation?.title || "").trim().toLowerCase();
  const itemType = String(citation?.itemType || citation?.item_type || "").trim().toLowerCase();
  return title === "ficha de minuta" || itemType === "minute_overview";
};

const getVisibleCitations = (citations = []) => citations.filter((citation) => !isOverviewCitation(citation));

const KnowledgeSearchPage = () => {
  const navigate = useNavigate();
  const savedSearchRef = useRef(readSavedSearchState());
  const savedSearch = savedSearchRef.current;
  const activeQueryIdRef = useRef(getResultQueryId(savedSearch?.result));
  const submitSeqRef = useRef(0);
  const [availability, setAvailability] = useState(null);
  const [availabilityError, setAvailabilityError] = useState("");
  const [question, setQuestion] = useState(savedSearch?.question ?? "");
  const [scopeType, setScopeType] = useState(savedSearch?.scopeType ?? "global");
  const [clientId, setClientId] = useState(savedSearch?.clientId ?? "");
  const [projectId, setProjectId] = useState(savedSearch?.projectId ?? "");
  const [minuteId, setMinuteId] = useState(savedSearch?.minuteId ?? "");
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [minutes, setMinutes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(["queued", "running"].includes(savedSearch?.result?.status));
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(savedSearch?.result ?? null);

  const isAvailable = Boolean(availability?.available);
  const showsClientFilter = scopeType === "client" || scopeType === "project" || scopeType === "minute";
  const needsProject = scopeType === "project";
  const needsMinute = scopeType === "minute";

  const canSubmit = useMemo(() => {
    if (!isAvailable || isLoading || isPolling || question.trim().length < 3) return false;
    if (scopeType === "client" && !clientId) return false;
    if (needsProject && !projectId) return false;
    if (needsMinute && !minuteId) return false;
    return true;
  }, [clientId, isAvailable, isLoading, isPolling, minuteId, needsMinute, needsProject, projectId, question, scopeType]);

  useEffect(() => {
    let mounted = true;
    contextSettingsService.getAvailability()
      .then((payload) => {
        if (mounted) setAvailability(payload);
      })
      .catch((err) => {
        if (mounted) setAvailabilityError(getErrorMessage(err));
      });
    return () => { mounted = false; };
  }, []);

  const loadCatalogs = useCallback(async () => {
    setIsCatalogLoading(true);
    try {
      const [clientResult, projectResult, minuteResult] = await Promise.all([
        clientService.list({ skip: 0, limit: 200, isActive: true }),
        projectService.list({ skip: 0, limit: 200, isActive: true }),
        listMinutes({ skip: 0, limit: 200, status_filter: "completed" }),
      ]);
      setClients(clientResult?.items ?? []);
      setProjects(projectResult?.items ?? []);
      setMinutes(minuteResult?.minutes ?? []);
    } finally {
      setIsCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAvailable) loadCatalogs();
  }, [isAvailable, loadCatalogs]);

  useEffect(() => {
    writeSavedSearchState({
      question,
      scopeType,
      clientId,
      projectId,
      minuteId,
      result,
      savedAt: Date.now(),
    });
  }, [clientId, minuteId, projectId, question, result, scopeType]);

  useEffect(() => {
    if (scopeType === "global") {
      setClientId("");
      setProjectId("");
      setMinuteId("");
    }
    if (scopeType === "client") {
      setProjectId("");
      setMinuteId("");
    }
    if (scopeType === "project") {
      setMinuteId("");
    }
  }, [scopeType]);

  const visibleProjects = useMemo(() => {
    if (!clientId) return projects;
    return projects.filter((project) => String(project?.client_id ?? project?.clientId ?? "") === String(clientId));
  }, [clientId, projects]);

  const visibleMinutes = useMemo(() => {
    return minutes.filter((minute) => {
      if (clientId && String(minute?.client_id ?? "") !== String(clientId)) return false;
      if (projectId && String(minute?.project_id ?? "") !== String(projectId)) return false;
      return true;
    });
  }, [clientId, minutes, projectId]);
  const citationGroups = useMemo(
    () => groupCitationsByMinute(getVisibleCitations(result?.citations ?? [])),
    [result?.citations]
  );
  const shouldShowCitations = Boolean(
    result &&
    result.status !== "insufficient_context" &&
    citationGroups.length > 0
  );

  const handleClientChange = useCallback((nextClientId) => {
    setClientId(nextClientId);
    setProjectId((currentProjectId) => {
      if (!currentProjectId || !nextClientId) return currentProjectId;
      const currentProject = projects.find((project) => String(project.id) === String(currentProjectId));
      const currentProjectClientId = currentProject?.client_id ?? currentProject?.clientId ?? "";
      return String(currentProjectClientId) === String(nextClientId) ? currentProjectId : "";
    });
    setMinuteId("");
  }, [projects]);

  const handleProjectChange = useCallback((nextProjectId) => {
    setProjectId(nextProjectId);
    setMinuteId("");

    if (!nextProjectId) return;

    const selectedProject = projects.find((project) => String(project.id) === String(nextProjectId));
    const ownerClientId = selectedProject?.client_id ?? selectedProject?.clientId ?? "";
    if (ownerClientId) setClientId(String(ownerClientId));
  }, [projects]);

  const handleMinuteChange = useCallback((nextMinuteId) => {
    setMinuteId(nextMinuteId);

    if (!nextMinuteId) return;

    const selectedMinute = minutes.find((minute) => String(minute.id) === String(nextMinuteId));
    const ownerClientId = selectedMinute?.client_id ?? selectedMinute?.clientId ?? "";
    const ownerProjectId = selectedMinute?.project_id ?? selectedMinute?.projectId ?? "";
    if (ownerClientId) setClientId(String(ownerClientId));
    if (ownerProjectId) setProjectId(String(ownerProjectId));
  }, [minutes]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    const submitSeq = submitSeqRef.current + 1;
    submitSeqRef.current = submitSeq;
    activeQueryIdRef.current = "";

    const nextQuestion = question.trim();
    const nextScopeType = scopeType;
    const nextClientId = scopeType === "client" ? clientId : null;
    const nextProjectId = needsProject ? projectId : null;
    const nextMinuteId = needsMinute ? minuteId : null;

    setIsLoading(true);
    setIsPolling(false);
    setError("");
    setResult(null);
    writeSavedSearchState({
      question: nextQuestion,
      scopeType: nextScopeType,
      clientId,
      projectId,
      minuteId,
      result: null,
      savedAt: Date.now(),
    });

    try {
      const payload = {
        question: nextQuestion,
        scopeType: nextScopeType,
        clientId: nextClientId,
        projectId: nextProjectId,
        minuteId: nextMinuteId,
      };
      const response = await contextService.query(payload);
      if (submitSeqRef.current !== submitSeq) return;
      activeQueryIdRef.current = getResultQueryId(response);
      setResult(response);
      if (["queued", "running"].includes(response?.status)) {
        setIsPolling(true);
      }
    } catch (err) {
      if (submitSeqRef.current === submitSeq) {
        setError(getErrorMessage(err));
      }
    } finally {
      if (submitSeqRef.current === submitSeq) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    const queryId = getResultQueryId(result);
    if (!queryId || !["queued", "running"].includes(result?.status)) {
      setIsPolling(false);
      return undefined;
    }
    activeQueryIdRef.current = queryId;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const nextResult = await contextService.getQuery(queryId);
        if (!cancelled && activeQueryIdRef.current === queryId) setResult(nextResult);
      } catch (err) {
        if (!cancelled && activeQueryIdRef.current === queryId) {
          setError(getErrorMessage(err));
          setIsPolling(false);
        }
      }
    }, 2500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [result]);

  return (
    <div className="space-y-6 transition-theme [&_button:not(:disabled)]:cursor-pointer [&_button:disabled]:cursor-not-allowed">
      <div className="flex w-full flex-col gap-4">
        <header className="rounded-xl border border-gray-200/60 bg-white p-4 shadow-md transition-theme dark:border-gray-700/50 dark:bg-gray-800">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary-200/60 bg-primary-50 text-primary-600 dark:border-primary-700/40 dark:bg-primary-900/20 dark:text-primary-300">
              <Icon name="brain" className="text-lg" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-bold text-gray-900 transition-theme dark:text-gray-100">
                  Consulta contextual
                </h1>
              </div>
              <p className="mt-1 text-sm text-gray-500 transition-theme dark:text-gray-400">
                Consulta semántica sobre minutas finales indexadas y autorizadas.
              </p>
            </div>
          </div>
        </header>

        {(!isAvailable || availabilityError) && (
          <InlineNotice
            icon={availabilityError ? "warning" : "circleInfo"}
            tone={availabilityError ? "error" : "warning"}
            title={availabilityError ? "No se pudo validar disponibilidad" : "Consulta contextual no está disponible"}
            text={availabilityError || "El módulo está desactivado o las consultas no están habilitadas."}
          />
        )}

        {isAvailable && !isCatalogLoading && minutes.length === 0 && (
          <InlineNotice
            icon="circleInfo"
            tone="warning"
            title="Sin minutas finales disponibles"
            text="Aún no hay minutas finales disponibles para consultar. Publica al menos una minuta y sincroniza el contexto para habilitar respuestas con evidencia."
          />
        )}

        <section className="rounded-xl border border-gray-200/60 bg-white p-3 shadow-md transition-theme dark:border-gray-700/50 dark:bg-gray-800">
          <form
            onSubmit={handleSubmit}
            className="grid gap-3 lg:auto-rows-[42px] lg:grid-cols-6 lg:items-stretch"
          >
            <div className="relative min-h-[192px] min-w-0 lg:col-span-4 lg:row-span-4">
              <Icon name="search" className="absolute left-3 top-3 text-sm text-gray-400 dark:text-gray-500" />
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="¿Quién está a cargo del compromiso de facturación?"
                rows={4}
                className="h-full min-h-[192px] w-full resize-none rounded-lg border border-gray-200 bg-gray-50 py-3 pl-9 pr-3 text-sm font-medium leading-6 text-gray-900 outline-none transition-theme placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-600"
                disabled={!isAvailable || isLoading || isPolling}
              />
            </div>

            <fieldset className="min-h-[150px] rounded-lg border border-gray-200 bg-gray-50 p-2 transition-theme dark:border-gray-700 dark:bg-gray-900/60 lg:col-span-2 lg:row-span-3">
              <legend className="sr-only">Parametrización de búsqueda</legend>
              <div className="grid h-full grid-cols-2 grid-rows-3 gap-1.5">
                {SCOPE_OPTIONS.map((option) => (
                  <label
                    key={option.id}
                    title={option.hint}
                    className={`flex min-w-0 items-center gap-2 rounded-md px-2 text-xs font-bold transition-theme ${
                      scopeType === option.id
                        ? "bg-white text-primary-700 shadow-sm ring-1 ring-primary-200/70 dark:bg-gray-800 dark:text-primary-300 dark:ring-primary-700/50"
                        : "text-gray-600 hover:bg-white/70 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/80 dark:hover:text-gray-100"
                    } ${!isAvailable || isLoading || isPolling ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                  >
                    <input
                      type="radio"
                      name="knowledge-search-scope"
                      value={option.id}
                      checked={scopeType === option.id}
                      onChange={() => setScopeType(option.id)}
                      disabled={!isAvailable || isLoading || isPolling}
                      className="h-3.5 w-3.5 shrink-0 border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-900"
                    />
                    <Icon
                      name={option.icon}
                      className={`shrink-0 text-sm ${scopeType === option.id ? "text-primary-600 dark:text-primary-300" : "text-gray-500 dark:text-gray-400"}`}
                    />
                    <span className="truncate">{option.label}</span>
                  </label>
                ))}

                <div className="col-span-2 grid min-h-0 grid-cols-2 gap-1.5">
                  {showsClientFilter && (
                    <AutocompleteField
                      icon="business"
                      label="Cliente"
                      value={clientId}
                      onChange={handleClientChange}
                      disabled={isCatalogLoading || isLoading || isPolling}
                      options={clients.map((client) => ({
                        value: client.id,
                        label: client.name,
                      }))}
                    />
                  )}

                  {needsProject && (
                    <AutocompleteField
                      icon="folder"
                      label="Proyecto"
                      value={projectId}
                      onChange={handleProjectChange}
                      disabled={isCatalogLoading || isLoading || isPolling || !visibleProjects.length}
                      options={visibleProjects.map((project) => ({
                        value: project.id,
                        label: project.name,
                      }))}
                    />
                  )}

                  {needsMinute && (
                    <AutocompleteField
                      icon="fileLines"
                      label="Minuta"
                      value={minuteId}
                      onChange={handleMinuteChange}
                      disabled={isCatalogLoading || isLoading || isPolling || !visibleMinutes.length}
                      options={visibleMinutes.map((minute) => ({
                        value: minute.id,
                        label: minute.title,
                      }))}
                    />
                  )}

                  {!showsClientFilter && (
                    <div className="col-span-2 flex min-h-0 min-w-0 items-center gap-2 rounded-md border border-gray-200 bg-white px-2 text-xs font-bold text-gray-500 transition-theme dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                      <Icon name="shield" className="shrink-0 text-sm" />
                      <span className="truncate">Global autorizado</span>
                    </div>
                  )}
                </div>
              </div>
            </fieldset>

            <button
              type="submit"
              disabled={!canSubmit}
              className="flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-bold text-white shadow-md transition-all hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none dark:disabled:bg-gray-700 dark:disabled:text-gray-400 lg:col-span-2 lg:row-span-1"
            >
              <Icon name={isLoading || isPolling ? "spinner" : "search"} className={isLoading || isPolling ? "animate-spin" : ""} />
              <span className="whitespace-nowrap">{isPolling ? "Procesando" : "Consultar"}</span>
            </button>
          </form>
        </section>

        <main className="min-h-[560px] rounded-xl border border-gray-200/60 bg-white p-4 shadow-md transition-theme dark:border-gray-700/50 dark:bg-gray-800">
            {error && (
              <StateBlock icon="warning" title="No se pudo consultar" text={error} tone="error" />
            )}

            {!error && !result && !isLoading && !isPolling && (
              <StateBlock icon="search" title="Haz una pregunta" text="La respuesta se construirá con fragmentos autorizados de minutas finales." />
            )}

            {(isLoading || isPolling) && (
              <StateBlock icon="spinner" title="Procesando consulta" text="La consulta está en cola asincrónica y se actualizará al finalizar." spinning />
            )}

            {!error && result && !["queued", "running"].includes(result.status) && (
              <div className="space-y-4">
                {result.status === "failed" ? (
                  <StateBlock icon="warning" title="La consulta falló" text={result.message || "La consulta no pudo completarse. Revisa la configuración de Contexto IA y el estado del worker."} tone="error" />
                ) : (
                  <>
                    <section className="rounded-lg border border-gray-200/60 bg-gray-50 p-4 transition-theme dark:border-gray-700/50 dark:bg-gray-900/40">
                      <div className="mb-3 flex items-center gap-2">
                        <Icon name="brain" className="text-primary-600 dark:text-primary-300" />
                        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">Respuesta</h2>
                      </div>
                      <div className="whitespace-pre-wrap text-sm leading-7 text-gray-900 dark:text-gray-100">
                        {result.answer || result.message || "Sin respuesta generada."}
                      </div>
                    </section>

                    {shouldShowCitations && (
                    <section>
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          <Icon name="clipboardList" className="text-gray-500 dark:text-gray-400" />
                          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">Citas</h2>
                        </div>
                      </div>
                      <div className="space-y-5">
                        {citationGroups.map((group) => (
                          <CitationSourceGroup
                            key={group.key}
                            group={group}
                            onOpenMinute={(recordId) => navigate(`/minutes/process/${encodeURIComponent(recordId)}`)}
                          />
                        ))}
                      </div>
                    </section>
                    )}
                  </>
                )}
              </div>
            )}
        </main>
      </div>
    </div>
  );
};

const AutocompleteField = ({ icon, label, value, onChange, disabled, options = [] }) => {
  const wrapperRef = useRef(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = useMemo(
    () => options.find((option) => String(option.value) === String(value)),
    [options, value]
  );
  const normalizedQuery = query.trim().toLowerCase();
  const visibleOptions = useMemo(() => {
    if (!normalizedQuery) return options.slice(0, 40);
    return options
      .filter((option) => `${option.label ?? ""} ${option.meta ?? ""}`.toLowerCase().includes(normalizedQuery))
      .slice(0, 40);
  }, [normalizedQuery, options]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setQuery("");
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  const handleSelect = (nextValue) => {
    onChange(nextValue);
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div ref={wrapperRef} className="relative min-w-0">
      <div className="relative">
        <Icon name={icon} className="pointer-events-none absolute left-2 top-1/2 z-10 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400" />
        <input
          type="text"
          value={isOpen ? query : selectedOption?.label ?? ""}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (disabled) return;
            setQuery("");
            setIsOpen(true);
          }}
          disabled={disabled}
          placeholder={label}
          className="h-9 w-full rounded-md border border-gray-200 bg-white pl-7 pr-2 text-xs font-bold text-gray-700 shadow-sm outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:disabled:bg-gray-900/50"
        />
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-40 mt-1 max-h-56 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl transition-theme dark:border-gray-700 dark:bg-gray-800">
          {value && (
            <button
              type="button"
              onClick={() => handleSelect("")}
              className="flex w-full items-center gap-2 border-b border-gray-100 px-3 py-2 text-left text-xs font-bold text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700/75"
            >
              <Icon name="circleInfo" className="shrink-0 text-xs" />
              Limpiar selección
            </button>
          )}

          <div className="max-h-48 overflow-y-auto py-1">
            {visibleOptions.length === 0 ? (
              <p className="px-3 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">Sin resultados.</p>
            ) : (
              visibleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-700/75"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-gray-800 dark:text-gray-100">{option.label}</span>
                    {option.meta && (
                      <span className="block truncate text-[11px] font-medium text-gray-500 dark:text-gray-400">{option.meta}</span>
                    )}
                  </span>
                  {String(value) === String(option.value) && <Icon name="check" className="h-3.5 w-3.5 shrink-0 text-primary-500" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const InlineNotice = ({ icon, title, text, tone }) => (
  <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-theme ${
    tone === "error"
      ? "border-red-200/70 bg-red-50 text-red-800 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-200"
      : "border-amber-200/70 bg-amber-50 text-amber-900 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-200"
  }`}>
    <Icon name={icon} className="mt-0.5 shrink-0" />
    <div>
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-0.5 text-sm opacity-90">{text}</p>
    </div>
  </div>
);

const StateBlock = ({ icon, title, text, spinning = false, tone = "default" }) => (
  <div className={`flex min-h-[500px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center transition-theme ${
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-700/50 dark:bg-red-900/15 dark:text-red-300"
      : "border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400"
  }`}>
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-white text-gray-400 shadow-sm dark:bg-gray-800 dark:text-gray-500">
      <Icon name={icon} className={`text-xl ${spinning ? "animate-spin" : ""}`} />
    </div>
    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{title}</h2>
    <p className="mt-1 max-w-md text-sm leading-6">{text}</p>
  </div>
);

const CitationSourceGroup = ({ group, onOpenMinute }) => {
  const minuteId = group.minuteId ?? "";
  const fragmentCount = group.citations.length;
  const [isOpen, setIsOpen] = useState(true);

  const handleOpenPdf = () => {
    if (!minuteId) return;
    openPdfViewer({
      recordId: minuteId,
      pdfType: "published",
      filename: `${String(group.minuteTitle || "minuta").trim() || "minuta"}.pdf`,
      title: `PDF - ${group.minuteTitle || "Minuta"}`,
    });
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-theme dark:border-gray-700/70 dark:bg-gray-800/70">
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <button
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            aria-expanded={isOpen}
            className="group flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-theme dark:bg-gray-700 dark:text-gray-300">
              <Icon name="fileLines" className="text-sm" />
            </span>

            <span className="min-w-0">
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="truncate text-base font-bold text-gray-900 transition-colors group-hover:text-primary-700 dark:text-gray-100 dark:group-hover:text-primary-200">
                  {group.minuteTitle}
                </span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600 transition-theme dark:bg-gray-700 dark:text-gray-200">
                  {fragmentCount}
                </span>
                {group.status && (
                  <span className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-bold uppercase text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                    {group.status}
                  </span>
                )}
              </span>

              <span className="mt-1 block truncate text-sm font-medium text-gray-500 dark:text-gray-400">
                {[group.clientName, group.projectName, group.location ? `Sala: ${group.location}` : null].filter(Boolean).join(" | ") || "Fuente de contexto"}
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            aria-expanded={isOpen}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 dark:text-gray-400 dark:hover:bg-gray-700/50 dark:hover:text-gray-200"
          >
            <span>{isOpen ? "Ocultar" : "Mostrar"}</span>
            <Icon
              name={isOpen ? "FaChevronUp" : "FaChevronDown"}
              className="h-3.5 w-3.5"
            />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pl-[52px]">
          <span className="rounded-lg border border-primary-200/70 bg-primary-50 px-2 py-1 text-[11px] font-bold text-primary-700 dark:border-primary-700/50 dark:bg-primary-900/20 dark:text-primary-200">
            {fragmentCount} {fragmentCount === 1 ? "fragmento" : "fragmentos"}
          </span>

          {minuteId && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenMinute(minuteId)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-xs font-bold text-gray-700 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-primary-700/60 dark:hover:bg-primary-900/20 dark:hover:text-primary-200"
              >
                <Icon name="eye" className="text-xs" />
                <span>Minuta</span>
              </button>

              <button
                type="button"
                onClick={handleOpenPdf}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-xs font-bold text-gray-700 transition-colors hover:border-green-300 hover:bg-green-50 hover:text-green-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-green-700/60 dark:hover:bg-green-900/20 dark:hover:text-green-200"
              >
                <Icon name="fileLines" className="text-xs" />
                <span>PDF</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {isOpen ? (
        <div className="border-t border-gray-100 px-4 py-2 transition-theme dark:border-gray-700/70">
          <div className="divide-y divide-gray-100 transition-theme dark:divide-gray-800">
            {group.citations.map((citation) => (
              <CitationItem
                key={`${citation.chunkId ?? citation.chunk_id ?? citation.citationIndex}-${citation.citationIndex}`}
                citation={citation}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
};

const CitationItem = ({ citation }) => {
  const title = citation.title || citation.itemType || citation.item_type || "Evidencia";
  const body = buildCitationBody(citation);
  const isOverview = isOverviewCitation(citation);

  return (
    <article className="py-3 transition-theme">
      <div className="mb-2 flex items-start gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary-50 text-xs font-bold text-primary-700 dark:bg-primary-900/25 dark:text-primary-300">
            {Number(citation.citationIndex ?? 0) + 1}
          </span>
          <p className="min-w-0 truncate text-sm font-bold text-gray-900 dark:text-gray-100">
            {title}
          </p>
        </div>
      </div>

      {body ? (
        <p className="whitespace-pre-wrap text-sm leading-6 text-gray-600 dark:text-gray-300">{body}</p>
      ) : isOverview ? (
        <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
          Contexto general de la minuta usado como referencia.
        </p>
      ) : null}
    </article>
  );
};

export default KnowledgeSearchPage;
