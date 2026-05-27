import React, { useCallback, useEffect, useMemo, useState } from "react";

import { listMinuteObservations, resolveMinuteObservation, saveMinuteReviewContent } from "@/services/minutesService";
import Icon from "@components/ui/icon/iconManager";
import ModalManager from "@components/ui/modal";
import useMinuteEditorStore from "@/store/minuteEditorStore";

const STATUS_OPTIONS = [
  {
    status: "inserted",
    resolutionType: "direct_insert",
    label: "Insertar",
    description: "Pasa como observación insertada directamente.",
  },
  {
    status: "approved",
    resolutionType: "manual_update",
    label: "Aprobar",
    description: "El editor la acepta y debe modificar la minuta manualmente.",
  },
  {
    status: "rejected",
    resolutionType: "none",
    label: "Rechazar",
    description: "La observación no aplica para esta minuta.",
  },
];

const STATUS_STYLES = {
  new: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300",
  inserted: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300",
  rejected: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300",
};

const labelForStatus = (status) => ({
  new: "Nueva",
  inserted: "Insertada",
  approved: "Aprobada",
  rejected: "Rechazada",
}[status] ?? status);

const actionLabelForStatus = (status) => ({
  inserted: "Insertar observación",
  approved: "Aprobar para ajuste manual",
  rejected: "Rechazar observación",
}[status] ?? "Resolver observación");

const countPendingObservations = (items = []) =>
  items.filter((item) => item.status === "new" || item.status === "approved").length;

const MINUTE_EDITOR_OBSERVATIONS_EVENT = "minute-editor-observations-updated";

const buildResolutionForm = (form = {}) => {
  const status = form.status || "approved";
  const option = STATUS_OPTIONS.find((item) => item.status === status);
  return {
    ...form,
    status,
    resolutionType: option?.resolutionType ?? "none",
  };
};

const MinuteEditorSectionObservations = ({ recordId, onPendingCountChange }) => {
  const scopeSections = useMinuteEditorStore((state) => state.scopeSections);
  const insertObservationIntoScope = useMinuteEditorStore((state) => state.insertObservationIntoScope);
  const getExportPayload = useMinuteEditorStore((state) => state.getExportPayload);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [formsById, setFormsById] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [expandedById, setExpandedById] = useState({});

  const applyObservationSnapshot = useCallback((data) => {
    setItems(Array.isArray(data?.items) ? data.items : []);
    setFormsById((prev) => {
      const next = { ...prev };
      (data?.items || []).forEach((item) => {
        next[item.id] = next[item.id] || {
          status: "approved",
          resolutionType: "manual_update",
          editorComment: "",
        };
      });
      return next;
    });
    setExpandedById((prev) => {
      const next = { ...prev };
      (data?.items || []).forEach((item) => {
        if (typeof next[item.id] !== "boolean") {
          next[item.id] = item.status === "new";
        }
      });
      return next;
    });
  }, []);

  const loadObservations = useCallback(async ({ showLoading = false, showError = true } = {}) => {
    if (!recordId) return;
    if (showLoading) setLoading(true);
    try {
      const data = await listMinuteObservations(recordId);
      applyObservationSnapshot(data);
    } catch (err) {
      if (showError) {
        ModalManager.error({
          title: "No fue posible cargar las observaciones",
          message: err?.message || "Intenta nuevamente en unos segundos.",
        });
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [applyObservationSnapshot, recordId]);

  useEffect(() => {
    if (!recordId) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const data = await listMinuteObservations(recordId);
        if (!active) return;
        applyObservationSnapshot(data);
      } catch (err) {
        if (!active) return;
        ModalManager.error({
          title: "No fue posible cargar las observaciones",
          message: err?.message || "Intenta nuevamente en unos segundos.",
        });
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [applyObservationSnapshot, recordId]);

  useEffect(() => {
    const onObservationsUpdated = () => {
      loadObservations({ showLoading: false, showError: false });
    };

    window.addEventListener(MINUTE_EDITOR_OBSERVATIONS_EVENT, onObservationsUpdated);
    return () => window.removeEventListener(MINUTE_EDITOR_OBSERVATIONS_EVENT, onObservationsUpdated);
  }, [loadObservations]);

  useEffect(() => {
    onPendingCountChange?.(countPendingObservations(items));
  }, [items, onPendingCountChange]);

  const grouped = useMemo(() => {
    return items.reduce((acc, item) => {
      const key = item.versionLabel || `v${item.versionNum || "-"}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [items]);

  const updateForm = (id, patch) => {
    setFormsById((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...patch,
      },
    }));
  };

  const toggleExpanded = (id) => {
    setExpandedById((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleStatusChange = (id, status) => {
    const option = STATUS_OPTIONS.find((item) => item.status === status);
    updateForm(id, {
      status,
      resolutionType: option?.resolutionType ?? "none",
    });
  };

  const resolveObservation = async (item, form) => {
    const cleanComment = String(form.editorComment || "").trim();
    const resolutionForm = buildResolutionForm(form);
    const response = await resolveMinuteObservation(item.id, {
      status: resolutionForm.status,
      resolutionType: resolutionForm.resolutionType,
      editorComment: cleanComment,
    });
    setItems((prev) => prev.map((current) => (current.id === item.id ? response.item : current)));
    updateForm(item.id, { editorComment: cleanComment });
    setExpandedById((prev) => ({ ...prev, [item.id]: false }));
  };

  const openApprovedInfoModal = (item, form) => {
    ModalManager.custom({
      title: "Aprobación con ajuste manual",
      size: "medium",
      showFooter: true,
      content: (
        <div className="space-y-4 p-1">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 transition-theme dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
            Esta observación se marcará como <b>aprobada</b>, pero no se insertará automáticamente en la minuta.
          </div>
          <p className="text-sm leading-6 text-gray-600 transition-theme dark:text-gray-300">
            Después de confirmar, el editor debe aplicar el cambio manualmente en la sección correspondiente de la minuta.
          </p>
          <div className="rounded-xl bg-gray-50/80 px-4 py-3 text-sm text-gray-800 transition-theme dark:bg-gray-950/30 dark:text-gray-200">
            {item.body}
          </div>
        </div>
      ),
      buttons: [
        {
          text: "Cancelar",
          variant: "secondary",
          onClick: () => ModalManager.closeAll?.(),
        },
        {
          text: "Confirmar aprobación manual",
          variant: "primary",
          onClick: async () => {
            setSavingId(item.id);
            try {
              await resolveObservation(item, form);
              ModalManager.closeAll?.();
            } catch (err) {
              ModalManager.error({
                title: "No fue posible resolver la observación",
                message: err?.message || "Intenta nuevamente en unos segundos.",
              });
            } finally {
              setSavingId(null);
            }
          },
        },
      ],
    });
  };

  const openInsertModal = (item, form) => {
    const topicSections = scopeSections.filter((section) => section.type === "topic");
    let selectedSectionId = topicSections[0]?.id || "__new__";
    let newSectionTitle = "Extras / Observaciones";

    const InsertObservationModalContent = () => {
      const [targetId, setTargetId] = useState(selectedSectionId);

      useEffect(() => {
        selectedSectionId = targetId;
      }, [targetId]);

      return (
        <div className="space-y-4 p-1">
          <p className="text-sm leading-6 text-gray-600 transition-theme dark:text-gray-300">
            Selecciona en qué nodo de <b>Alcance y Contenido</b> se registrará esta observación. Si no existe el nodo,
            puedes crear uno nuevo en este momento.
          </p>

          <div className="rounded-xl bg-gray-50/80 px-4 py-3 text-sm text-gray-800 transition-theme dark:bg-gray-950/30 dark:text-gray-200">
            {item.body}
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 transition-theme dark:text-gray-400">
              Nodo destino
            </label>
            <select
              value={targetId}
              onChange={(event) => {
                setTargetId(event.target.value);
              }}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 transition-theme outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              {topicSections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
              <option value="__new__">Crear nodo final nuevo</option>
            </select>
          </div>

          {targetId === "__new__" ? (
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 transition-theme dark:text-gray-400">
                Título del nodo nuevo
              </label>
              <input
                type="text"
                defaultValue={newSectionTitle}
                onChange={(event) => {
                  newSectionTitle = event.target.value;
                }}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 transition-theme outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
          ) : null}
        </div>
      );
    };

    ModalManager.custom({
      title: "Insertar observación en Alcance y Contenido",
      size: "medium",
      showFooter: true,
      content: <InsertObservationModalContent />,
      buttons: [
        {
          text: "Cancelar",
          variant: "secondary",
          onClick: () => ModalManager.closeAll?.(),
        },
        {
          text: "Insertar y resolver",
          variant: "primary",
          onClick: async () => {
            if (selectedSectionId === "__new__" && !String(newSectionTitle || "").trim()) {
              ModalManager.warning({
                title: "Título requerido",
                message: "Debes indicar el título del nuevo nodo antes de insertar la observación.",
              });
              return;
            }

            setSavingId(item.id);
            try {
              insertObservationIntoScope({
                sectionId: selectedSectionId === "__new__" ? null : selectedSectionId,
                sectionTitle: newSectionTitle,
                body: item.body,
                authorLabel: item.authorName || item.authorEmail,
                createdAt: item.createdAt,
              });
              await saveMinuteReviewContent(recordId, getExportPayload());
              await resolveObservation(item, form);
              ModalManager.closeAll?.();
            } catch (err) {
              ModalManager.error({
                title: "No fue posible insertar la observación",
                message: err?.message || "Intenta nuevamente en unos segundos.",
              });
            } finally {
              setSavingId(null);
            }
          },
        },
      ],
    });
  };

  const openRejectConfirmModal = (item, form) => {
    ModalManager.custom({
      title: "Rechazar observación",
      size: "medium",
      showFooter: true,
      content: (
        <div className="space-y-4 p-1">
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 transition-theme dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
            Esta observación quedará marcada como <b>rechazada</b> y no se aplicará a la minuta.
          </div>
          <div className="rounded-xl bg-gray-50/80 px-4 py-3 text-sm text-gray-800 transition-theme dark:bg-gray-950/30 dark:text-gray-200">
            {item.body}
          </div>
          <div className="rounded-xl border border-gray-200/70 bg-gray-50/80 px-4 py-3 text-sm text-gray-700 transition-theme dark:border-gray-700/60 dark:bg-gray-950/30 dark:text-gray-300">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 transition-theme dark:text-gray-400">
              Comentario del editor
            </p>
            <p>{String(form.editorComment || "").trim()}</p>
          </div>
        </div>
      ),
      buttons: [
        {
          text: "Cancelar",
          variant: "secondary",
          onClick: () => ModalManager.closeAll?.(),
        },
        {
          text: "Confirmar rechazo",
          variant: "danger",
          onClick: async () => {
            setSavingId(item.id);
            try {
              await resolveObservation(item, form);
              ModalManager.closeAll?.();
            } catch (err) {
              ModalManager.error({
                title: "No fue posible rechazar la observación",
                message: err?.message || "Intenta nuevamente en unos segundos.",
              });
            } finally {
              setSavingId(null);
            }
          },
        },
      ],
    });
  };

  const handleResolve = async (item) => {
    const form = buildResolutionForm(formsById[item.id] || {});
    const cleanComment = String(form.editorComment || "").trim();
    if (!cleanComment) {
      ModalManager.custom({
        title: "Comentario requerido",
        size: "small",
        showFooter: true,
        content: (
          <div className="rounded-xl border border-amber-700/60 bg-amber-950/25 px-4 py-3 text-sm text-amber-200 transition-theme">
            <div className="flex items-start gap-3">
              <Icon name="triangleExclamation" className="mt-0.5 shrink-0 text-amber-300" />
              <p>Completa el comentario obligatorio antes de resolver la observación.</p>
            </div>
          </div>
        ),
        buttons: [
          {
            text: "Cerrar",
            variant: "secondary",
            onClick: () => ModalManager.closeAll?.(),
          },
        ],
      });
      return;
    }
    if (cleanComment.length < 3) {
      ModalManager.custom({
        title: "Comentario muy corto",
        size: "small",
        showFooter: true,
        content: (
          <div className="rounded-xl border border-amber-700/60 bg-amber-950/25 px-4 py-3 text-sm text-amber-200 transition-theme">
            <div className="flex items-start gap-3">
              <Icon name="triangleExclamation" className="mt-0.5 shrink-0 text-amber-300" />
              <p>Ingresa un comentario de al menos 3 caracteres antes de resolver la observación.</p>
            </div>
          </div>
        ),
        buttons: [
          {
            text: "Cerrar",
            variant: "secondary",
            onClick: () => ModalManager.closeAll?.(),
          },
        ],
      });
      return;
    }

    if (form.status === "inserted") {
      openInsertModal(item, form);
      return;
    }

    if (form.status === "approved") {
      openApprovedInfoModal(item, form);
      return;
    }

    if (form.status === "rejected") {
      openRejectConfirmModal(item, form);
    }
  };

  if (loading) {
    return (
      <section className="rounded-2xl border border-gray-200/60 bg-white/70 p-6 text-sm text-gray-500 transition-theme dark:border-gray-700/60 dark:bg-gray-900/20 dark:text-gray-400">
        Cargando observaciones...
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-gray-200/60 bg-white/70 p-5 transition-theme dark:border-gray-700/60 dark:bg-gray-900/20">
        <h3 className="text-base font-semibold text-gray-900 transition-theme dark:text-gray-100">
          Observaciones de visitantes
        </h3>
        <p className="mt-2 text-sm text-gray-500 transition-theme dark:text-gray-400">
          Cada observación debe resolverse con comentario obligatorio. Usa <b>Insertar</b> para observaciones
          que pasan directo a la sección de observaciones, <b>Aprobar</b> para cambios manuales y <b>Rechazar</b>{" "}
          cuando no aplique.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white/60 p-8 text-center text-sm text-gray-500 transition-theme dark:border-gray-700 dark:bg-gray-900/20 dark:text-gray-400">
          Esta minuta todavía no tiene observaciones registradas por visitantes.
        </div>
      ) : null}

      {Object.entries(grouped).map(([groupLabel, groupItems]) => (
        <div key={groupLabel} className="space-y-4">
          <div className="px-1 text-sm font-semibold uppercase tracking-[0.18em] text-gray-500 transition-theme dark:text-gray-400">
            {groupLabel}
          </div>
          {groupItems.map((item) => {
            const form = formsById[item.id] || {};
            const isResolved = item.status !== "new";
            const isBusy = savingId === item.id;
            const isExpanded = expandedById[item.id] ?? (item.status === "new");
            return (
              <article
                key={item.id}
                className="rounded-2xl border border-gray-200/60 bg-white/70 p-5 transition-theme dark:border-gray-700/60 dark:bg-gray-900/20"
              >
                <button
                  type="button"
                  onClick={() => toggleExpanded(item.id)}
                  className="flex w-full flex-wrap items-start justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 transition-theme dark:text-gray-100">
                        {item.authorName || item.authorEmail}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[item.status] || STATUS_STYLES.new}`}>
                        {labelForStatus(item.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 transition-theme dark:text-gray-400">
                      {item.authorEmail} · {item.createdAt ? new Date(item.createdAt).toLocaleString("es-CL") : "Sin fecha"}
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="text-right text-xs text-gray-500 transition-theme dark:text-gray-400">
                      <p>ID #{item.id}</p>
                      <p>{item.versionLabel || `v${item.versionNum || "-"}`}</p>
                    </div>
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-theme dark:border-gray-700 dark:text-gray-300">
                      <span
                        className={`transition-transform duration-200 ${
                          isExpanded ? "rotate-180" : "rotate-0"
                        }`}
                      >
                        <Icon name="chevronDown" />
                      </span>
                    </span>
                  </div>
                </button>

                {isExpanded ? (
                  <>
                    <div className="mt-4 rounded-xl bg-gray-50/80 px-4 py-3 text-sm leading-6 text-gray-800 transition-theme dark:bg-gray-950/40 dark:text-gray-200">
                      {item.body}
                    </div>

                    {isResolved ? (
                      <div className="mt-4 rounded-xl border border-gray-200/70 bg-gray-50/80 px-4 py-3 transition-theme dark:border-gray-700/60 dark:bg-gray-950/30">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 transition-theme dark:text-gray-400">
                          Resolución del editor
                        </p>
                        <p className="mt-2 text-sm text-gray-800 transition-theme dark:text-gray-200">
                          {item.editorComment || "Sin comentario"}
                        </p>
                      </div>
                    ) : null}

                    {!isResolved ? (
                      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(360px,1fr)_240px] lg:items-center">
                        <div className="flex min-h-[122px] min-w-0 flex-col">
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 transition-theme dark:text-gray-400">
                            Comentario obligatorio
                          </label>
                          <textarea
                            rows={3}
                            value={form.editorComment || ""}
                            onChange={(event) => updateForm(item.id, { editorComment: event.target.value })}
                            disabled={isBusy}
                            placeholder="Describe por qué se inserta, aprueba o rechaza esta observación."
                            className="min-h-0 flex-1 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 transition-theme outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                          />
                        </div>

                        <div className="flex min-w-0 flex-col justify-center">
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 transition-theme dark:text-gray-400">
                            Acción
                          </label>
                          <select
                            value={form.status || "approved"}
                            onChange={(event) => handleStatusChange(item.id, event.target.value)}
                            disabled={isBusy}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 transition-theme outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                          >
                            {STATUS_OPTIONS.map((option) => (
                              <option key={option.status} value={option.status}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleResolve(item)}
                            disabled={isBusy}
                            className="mt-3 min-h-[40px] w-full rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold leading-5 text-white shadow-sm transition-all hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isBusy ? "Guardando resolución..." : actionLabelForStatus(form.status || "approved")}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </article>
            );
          })}
        </div>
      ))}
    </section>
  );
};

export default MinuteEditorSectionObservations;
