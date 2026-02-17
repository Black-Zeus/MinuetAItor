/**
 * pages/minuteEditor/sections/MinuteEditorSectionScope.jsx
 * Tab "Alcance y Contenido": renderiza dinámicamente todas las secciones del JSON.
 * - introduction: resumen + lista de temas
 * - topic: resumen + bloques de detalles
 *
 * REQ: Acordeón por sección
 * - introduction: expandida por defecto
 * - resto: colapsadas por defecto
 */

import React, { useCallback, useEffect, useState } from "react";
import Icon from "@components/ui/icon/iconManager";
import useMinuteEditorStore from "@/store/minuteEditorStore";

const TYPE_BADGE = {
  introduction: {
    label: "INTRODUCTION",
    cls: "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300",
  },
  topic: {
    label: "TOPIC",
    cls: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300",
  },
};

// Sub-componente: lista de temas (sección introduction)
const TopicsList = ({
  sectionId,
  topicsList,
  updateSectionTopic,
  deleteSectionTopic,
  addSectionTopic,
}) => (
  <div className="mt-5">
    <div className="flex items-center justify-between mb-3">
      <p className="text-xs font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase transition-theme">
        Temas tratados (editable)
      </p>
      <button
        type="button"
        onClick={() => addSectionTopic(sectionId)}
        className="px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-theme text-xs font-medium shadow-sm"
      >
        <Icon name="plus" className="mr-1" />
        Agregar tema
      </button>
    </div>

    <ul className="space-y-2">
      {topicsList.map((topic) => (
        <li
          key={topic.id}
          className="flex items-start gap-3 bg-gray-50 dark:bg-gray-900 rounded-xl px-4 py-3 border border-gray-200/50 dark:border-gray-700/50 transition-theme"
        >
          <span className="mt-2.5 w-2 h-2 rounded-full bg-primary-500 shrink-0" />
          <input
            type="text"
            value={topic.text}
            onChange={(e) => updateSectionTopic(sectionId, topic.id, e.target.value)}
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none border-b border-transparent focus:border-primary-400"
          />
          <button
            type="button"
            onClick={() => deleteSectionTopic(sectionId, topic.id)}
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-theme text-xs"
            title="Eliminar tema"
          >
            <Icon name="delete" />
          </button>
        </li>
      ))}
      {topicsList.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-600 italic">
          Sin temas registrados.
        </p>
      )}
    </ul>
  </div>
);

// Sub-componente: bloques de detalle (sección topic)
const DetailsList = ({
  sectionId,
  details,
  updateSectionDetail,
  deleteSectionDetail,
  addSectionDetail,
}) => (
  <div className="mt-5">
    <p className="text-xs font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase transition-theme mb-3">
      Detalles (editable por secciones)
    </p>

    <div className="space-y-4">
      {details.map((detail) => (
        <div
          key={detail.id}
          className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200/50 dark:border-gray-700/50 transition-theme"
        >
          <div className="flex items-center justify-between gap-3">
            <input
              type="text"
              value={detail.label}
              onChange={(e) =>
                updateSectionDetail(sectionId, detail.id, "label", e.target.value)
              }
              className="flex-1 bg-transparent text-sm font-semibold text-primary-700 dark:text-primary-300 transition-theme focus:outline-none border-b border-transparent focus:border-primary-400"
            />
            <button
              type="button"
              onClick={() => deleteSectionDetail(sectionId, detail.id)}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-theme text-xs"
              title="Eliminar detalle"
            >
              <Icon name="delete" />
            </button>
          </div>
          <textarea
            value={detail.description}
            onChange={(e) =>
              updateSectionDetail(
                sectionId,
                detail.id,
                "description",
                e.target.value
              )
            }
            rows={3}
            className="mt-3 w-full bg-white/50 dark:bg-black/10 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40 resize-none"
          />
        </div>
      ))}
      {details.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-600 italic">
          Sin detalles registrados.
        </p>
      )}
    </div>

    <div className="mt-4 flex justify-end">
      <button
        type="button"
        onClick={() => addSectionDetail(sectionId)}
        className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-theme text-sm font-medium shadow-sm"
      >
        <Icon name="plus" className="mr-2" />
        Agregar detalle
      </button>
    </div>
  </div>
);

// Componente principal
const MinuteEditorSectionScope = () => {
  const {
    scopeSections,
    updateSectionSummary,
    addSectionTopic,
    updateSectionTopic,
    deleteSectionTopic,
    addSectionDetail,
    updateSectionDetail,
    deleteSectionDetail,
  } = useMinuteEditorStore();

  // ============================
  // Accordion state (por sección)
  // Reglas:
  // - introduction: expandida por defecto
  // - resto: colapsadas por defecto
  // ============================
  const [expandedMap, setExpandedMap] = useState({}); // { [sectionId]: boolean }

  // Inicialización/normalización cuando cambian las secciones
  useEffect(() => {
    if (!scopeSections?.length) return;

    setExpandedMap((prev) => {
      const next = { ...prev };

      // Completa faltantes con regla (sin pisar interacción del usuario)
      scopeSections.forEach((s) => {
        if (typeof next[s.id] !== "boolean") {
          next[s.id] = s.type === "introduction";
        }
      });

      // Limpia ids que ya no existen
      const validIds = new Set(scopeSections.map((s) => s.id));
      Object.keys(next).forEach((id) => {
        if (!validIds.has(id)) delete next[id];
      });

      return next;
    });
  }, [scopeSections]);

  const isExpanded = useCallback(
    (sectionId) => {
      const v = expandedMap[sectionId];
      // fallback seguro: colapsado si no está inicializado (la intro se inicializa por useEffect)
      return typeof v === "boolean" ? v : false;
    },
    [expandedMap]
  );

  const toggleSection = useCallback((sectionId) => {
    setExpandedMap((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId], // undefined -> true
    }));
  }, []);

  return (
    <div className="space-y-6">
      {scopeSections.map((section) => {
        const badge = TYPE_BADGE[section.type] ?? TYPE_BADGE.topic;
        const expanded = isExpanded(section.id);
        const contentId = `scope_section_${section.id}`;

        return (
          <article
            key={section.id}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 transition-theme shadow-md border border-gray-200/50 dark:border-gray-700/50"
          >
            {/* Header de sección (clickeable) */}
            <div
              className="flex items-center justify-between gap-3 flex-wrap cursor-pointer select-none"
              role="button"
              tabIndex={0}
              aria-expanded={expanded}
              aria-controls={contentId}
              onClick={() => toggleSection(section.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleSection(section.id);
                }
              }}
            >
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white transition-theme">
                  <span className="text-gray-500 dark:text-gray-400 font-mono text-sm mr-2">
                    {section.id}
                  </span>
                  {section.title}
                </h2>
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border border-transparent transition-theme ${badge.cls}`}
                >
                  {badge.label}
                </span>
              </div>

              {/* Botón acordeón */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSection(section.id);
                }}
                className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-theme"
                title={expanded ? "Colapsar" : "Expandir"}
                aria-label={expanded ? "Colapsar sección" : "Expandir sección"}
              >
                <span
                  className={`transition-transform duration-200 ${
                    expanded ? "rotate-180" : "rotate-0"
                  }`}
                >
                  {/* Ajusta el nombre si tu iconManager usa otro identificador */}
                  <Icon name="chevronDown" />
                </span>
              </button>
            </div>

            {/* Contenido colapsable */}
            <div
              id={contentId}
              className={[
                "transition-all duration-200 ease-in-out",
                expanded
                  ? "mt-5 max-h-[5000px] opacity-100"
                  : "mt-0 max-h-0 opacity-0 overflow-hidden",
              ].join(" ")}
            >
              {/* Resumen editable */}
              <div>
                <p className="text-xs font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase transition-theme mb-2">
                  Resumen (editable)
                </p>
                <textarea
                  value={section.summary}
                  onChange={(e) => updateSectionSummary(section.id, e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40 resize-none"
                />
              </div>

              {/* Lista de temas (solo en introduction) */}
              {section.type === "introduction" && (
                <TopicsList
                  sectionId={section.id}
                  topicsList={section.topicsList}
                  updateSectionTopic={updateSectionTopic}
                  deleteSectionTopic={deleteSectionTopic}
                  addSectionTopic={addSectionTopic}
                />
              )}

              {/* Bloques de detalle (en topics) */}
              {section.type === "topic" && (
                <DetailsList
                  sectionId={section.id}
                  details={section.details}
                  updateSectionDetail={updateSectionDetail}
                  deleteSectionDetail={deleteSectionDetail}
                  addSectionDetail={addSectionDetail}
                />
              )}
            </div>
          </article>
        );
      })}

      {scopeSections.length === 0 && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-600 text-sm italic">
          No hay secciones de alcance disponibles.
        </div>
      )}
    </div>
  );
};

export default MinuteEditorSectionScope;