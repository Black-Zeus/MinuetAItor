/**
 * pages/minuteEditor/MinuteEditor.jsx
 * Orquestador principal del editor de minutas.
 * Carga el JSON de la IA / draft / snapshot desde la API, inicializa el store
 * y coordina todos los subcomponentes por tabs.
 */

import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import useMinuteEditorStore from "@store/minuteEditorStore";
import { getMinuteDetail, listMinuteObservations } from "@/services/minutesService";

import MinuteEditorHeader      from "./MinuteEditorHeader";
import MinuteEditorFindReplace from "./MinuteEditorFindReplace";
import MinuteEditorTabs        from "./MinuteEditorTabs";

import MinuteEditorSectionInfo          from "./sections/MinuteEditorSectionInfo";
import MinuteEditorSectionParticipants, { useParticipantEmailHydration } from "./sections/MinuteEditorSectionParticipants";
import MinuteEditorSectionScope         from "./sections/MinuteEditorSectionScope";
import MinuteEditorSectionAgreements    from "./sections/MinuteEditorSectionAgreements";
import MinuteEditorSectionRequirements  from "./sections/MinuteEditorSectionRequirements";
import MinuteEditorSectionObservations  from "./sections/MinuteEditorSectionObservations";
import MinuteEditorSectionTags          from "./sections/MinuteEditorSectionTags";
import MinuteEditorSectionNextMeetings  from "./sections/MinuteEditorSectionNextMeetings";
import MinuteEditorSectionTimeline      from "./sections/MinuteEditorSectionTimeline";
import MinuteEditorSectionPdfFormat     from "./sections/MinuteEditorSectionPdfFormat";
import MinuteEditorSectionPreview       from "./sections/MinuteEditorSectionPreview";
import MinuteEditorSectionMetadata      from "./sections/MinuteEditorSectionMetadata";

const EDITABLE_STATUSES = new Set(["pending"]);

const mergeInputAttachments = (content, inputAttachments = []) => {
  if (!content || !Array.isArray(inputAttachments) || inputAttachments.length === 0) {
    return content;
  }

  const currentInputAttachments = content?.inputInfo?.attachments;
  if (
    content?.inputInfo &&
    (!Array.isArray(currentInputAttachments) || currentInputAttachments.length === 0)
  ) {
    return {
      ...content,
      inputInfo: {
        ...content.inputInfo,
        attachments: inputAttachments,
      },
    };
  }

  const currentLocked = content?.metadataLocked?.attachments;
  if (content?.metadataLocked && (!Array.isArray(currentLocked) || currentLocked.length === 0)) {
    return {
      ...content,
      metadataLocked: {
        ...content.metadataLocked,
        attachments: inputAttachments,
      },
    };
  }

  return content;
};


const mergeRecordFallbacks = (content, record) => {
  if (!content || !record?.preparedBy) {
    return content;
  }

  const currentPreparedBy = String(
    content?.generalInfo?.preparedBy ??
    content?.inputInfo?.preparedBy ??
    content?.meetingInfo?.preparedBy ??
    ""
  ).trim();

  if (currentPreparedBy) {
    return content;
  }

  if (content?.generalInfo) {
    return {
      ...content,
      generalInfo: {
        ...content.generalInfo,
        preparedBy: record.preparedBy,
      },
    };
  }

  if (content?.meetingInfo) {
    return {
      ...content,
      meetingInfo: {
        ...content.meetingInfo,
        preparedBy: record.preparedBy,
      },
    };
  }

  return content;
};

const countPendingObservations = (items = []) =>
  items.filter((item) => item.status === "new" || item.status === "approved").length;

const MinuteEditor = () => {
  const { id: recordId } = useParams();
  const navigate = useNavigate();

  const { loadFromIAResponse, loadFromDraft, reset, isLoaded, activeTab } =
    useMinuteEditorStore();
  const pendingSearchResult = useMinuteEditorStore((s) => s.pendingSearchResult);
  const clearPendingSearchResult = useMinuteEditorStore((s) => s.clearPendingSearchResult);

  const [loadError,  setLoadError]  = useState(null);
  const [recordMeta, setRecordMeta] = useState(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [observationPendingCount, setObservationPendingCount] = useState(0);

  useParticipantEmailHydration();

  /**
   * Callback que el Header invoca tras cada transición exitosa.
   * Actualiza el status local para que el Header re-renderice
   * con el estado correcto (ej: ready-for-edit → pending tras primer Guardar).
   */
  const handleTransitionSuccess = (newStatus) => {
    setRecordMeta((prev) => prev ? { ...prev, status: newStatus } : prev);
    setIsReadOnly(!EDITABLE_STATUSES.has(newStatus));
  };

  useEffect(() => {
    if (!recordId) {
      navigate("/minutes", { replace: true });
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const data = await getMinuteDetail(recordId);
        if (cancelled) return;

        const { record, content, contentType, inputAttachments } = data;

        if (!content || !contentType) {
          setLoadError({
            type:    "no_content",
            status:  record?.status,
            message: "Esta minuta no tiene contenido disponible para editar.",
          });
          return;
        }

        const hydratedContent = mergeRecordFallbacks(
          mergeInputAttachments(content, inputAttachments),
          record,
        );

        setRecordMeta(record);
        setIsReadOnly(!EDITABLE_STATUSES.has(record.status));

        if (contentType === "ai_output") {
          loadFromIAResponse(hydratedContent);
        } else if (contentType === "draft" || contentType === "snapshot") {
          loadFromDraft(hydratedContent);
        } else {
          setLoadError({
            type:    "unknown_content_type",
            message: `Formato desconocido: '${contentType}'.`,
          });
        }
      } catch (err) {
        if (cancelled) return;
        setLoadError({
          type:    "fetch_error",
          message: err?.message ?? "Error al cargar la minuta.",
        });
      }
    };

    load();
    return () => {
      cancelled = true;
      reset();
    };
  }, [recordId]);

  useEffect(() => {
    if (!recordId) return;

    let cancelled = false;

    const loadObservationCount = async () => {
      try {
        const data = await listMinuteObservations(recordId);
        if (cancelled) return;
        setObservationPendingCount(countPendingObservations(data?.items || []));
      } catch {
        if (!cancelled) setObservationPendingCount(0);
      }
    };

    loadObservationCount();
    return () => {
      cancelled = true;
    };
  }, [recordId]);

  useEffect(() => {
    if (!pendingSearchResult) return;

    const run = () => {
      const target = document.querySelector(`[data-search-target="${pendingSearchResult.targetId}"]`);
      if (!target) {
        clearPendingSearchResult();
        return;
      }

      target.scrollIntoView({ behavior: "smooth", block: "center" });

      const focusable = target.querySelector("input, textarea, [tabindex]");
      if (focusable instanceof HTMLElement) {
        focusable.focus({ preventScroll: true });

        if (
          pendingSearchResult.text &&
          typeof focusable.value === "string" &&
          typeof focusable.setSelectionRange === "function"
        ) {
          const value = String(focusable.value ?? "");
          const query = String(pendingSearchResult.text.slice(
            pendingSearchResult.start,
            pendingSearchResult.start + pendingSearchResult.length
          ));
          const startIndex = value.toLowerCase().indexOf(query.toLowerCase());
          if (startIndex >= 0) {
            focusable.setSelectionRange(startIndex, startIndex + query.length);
          }
        }
      }

      clearPendingSearchResult();
    };

    const rafId = window.requestAnimationFrame(() => {
      window.setTimeout(run, 80);
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [activeTab, clearPendingSearchResult, pendingSearchResult]);

  // ── Error state ─────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="flex min-h-full items-center justify-center transition-theme">
        <div className="max-w-md text-center space-y-4 px-6">
          <i className="fas fa-circle-exclamation text-4xl text-red-400 dark:text-red-500" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 transition-theme">
            No se pudo cargar el editor
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 transition-theme">
            {loadError.message}
          </p>
          {loadError.status && (
            <p className="text-xs text-gray-400 dark:text-gray-500 font-mono transition-theme">
              Estado: <span className="font-semibold">{loadError.status}</span>
            </p>
          )}
          <button
            type="button"
            onClick={() => navigate("/minutes", { replace: true })}
            className="mt-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white transition-all"
          >
            Volver a la lista
          </button>
        </div>
      </div>
    );
  }

  // ── Loading state ────────────────────────────────────────────
  if (!isLoaded) {
    return (
      <div className="flex min-h-full items-center justify-center transition-theme">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <i className="fas fa-spinner fa-spin text-primary-500" />
          <span className="text-sm font-medium">Cargando editor…</span>
        </div>
      </div>
    );
  }

  // ── Editor ───────────────────────────────────────────────────
  return (
    <div className="transition-theme">
      {/*
        onTransitionSuccess conectado: el Header llama este callback tras
        transitionMinute() exitoso, actualizando recordMeta.status en este
        componente. Sin esto el status queda estancado (ej: ready-for-edit
        tras el primer Guardar) y el siguiente Guardar intenta hacer
        transition(pending→pending) dando 409.
      */}
      <MinuteEditorHeader
        recordMeta={recordMeta}
        isReadOnly={isReadOnly}
        onTransitionSuccess={handleTransitionSuccess}
      />

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {!isReadOnly && <MinuteEditorFindReplace />}

        <MinuteEditorTabs observationPendingCount={observationPendingCount} />

        {activeTab === "info"         && <MinuteEditorSectionInfo         isReadOnly={isReadOnly} />}
        {activeTab === "participants" && <MinuteEditorSectionParticipants isReadOnly={isReadOnly} />}
        {activeTab === "scope"        && <MinuteEditorSectionScope        isReadOnly={isReadOnly} />}
        {activeTab === "agreements"   && <MinuteEditorSectionAgreements   isReadOnly={isReadOnly} />}
        {activeTab === "requirements" && <MinuteEditorSectionRequirements isReadOnly={isReadOnly} />}
        {activeTab === "observations" && (
          <MinuteEditorSectionObservations
            recordId={recordId}
            onPendingCountChange={setObservationPendingCount}
          />
        )}
        {activeTab === "tags"         && <MinuteEditorSectionTags         isReadOnly={isReadOnly} />}
        {activeTab === "next"         && <MinuteEditorSectionNextMeetings isReadOnly={isReadOnly} />}
        {activeTab === "timeline"     && <MinuteEditorSectionTimeline     recordId={recordId} recordStatus={recordMeta?.status} />}
        {activeTab === "pdfformat"    && <MinuteEditorSectionPdfFormat    recordId={recordId} isReadOnly={isReadOnly} />}
        {activeTab === "preview"      && (
          <MinuteEditorSectionPreview
            recordId={recordId}
            recordStatus={recordMeta?.status}
            isReadOnly={isReadOnly}
            onTransitionSuccess={handleTransitionSuccess}
          />
        )}
        {activeTab === "metadata"     && <MinuteEditorSectionMetadata     recordId={recordId} isReadOnly={isReadOnly} />}
      </main>
    </div>
  );
};

export default MinuteEditor;
