/**
 * pages/minuteEditor/MinuteEditorTabs.jsx
 */

import React from 'react';
import Icon from '@components/ui/icon/iconManager';
import useMinuteEditorStore from '@store/minuteEditorStore';

const TABS = [
  { id: 'info',         label: 'Información General', icon: 'clipboardList',  counter: null },
  { id: 'participants', label: 'Participantes',        icon: 'users',          counter: 'participants' },
  { id: 'scope',        label: 'Alcance y Contenido',  icon: 'diagramProject', counter: 'scopeSections' },
  { id: 'agreements',   label: 'Acuerdos',             icon: 'check',          counter: 'agreements' },
  { id: 'requirements', label: 'Requerimientos',       icon: 'thumbtack',      counter: 'requirements' },
  { id: 'observations', label: 'Observaciones',        icon: 'comment',        counter: null },
  { id: 'tags',         label: 'Tags',                 icon: 'tags',           counter: 'tags' },
  { id: 'next',         label: 'Próximas Reuniones',   icon: 'calendar',       counter: 'upcomingMeetings' },
  { id: 'timeline',     label: 'Línea de Tiempo',      icon: 'history',        counter: null },
  { id: 'pdfformat',    label: 'Formato PDF',          icon: 'fileLines',      counter: null },
  { id: 'preview',      label: 'Envío',                icon: 'paperPlane',     counter: null },
  { id: 'metadata',     label: 'Metadata',             icon: 'gear',           counter: null },
];

const MinuteEditorTabs = ({ observationPendingCount = 0 }) => {
  const {
    activeTab, setActiveTab,
    participants, scopeSections, agreements, requirements,
    aiTags, userTags, upcomingMeetings, timeline,
  } = useMinuteEditorStore();

  const getCounter = (key) => {
    switch (key) {
      case 'participants':     return participants.length;
      case 'scopeSections':    return scopeSections.length;
      case 'agreements':       return agreements.length;
      case 'requirements':     return requirements.length;
      case 'tags':             return aiTags.length + userTags.length;
      case 'upcomingMeetings': return upcomingMeetings.length;
      case 'timeline':         return timeline.length;
      default:                 return null;
    }
  };

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl p-2 transition-theme shadow-md border border-gray-200/50 dark:border-gray-700/50">
      <div
        role="tablist"
        aria-label="Secciones del editor de minuta"
        className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6"
      >
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          const count = tab.id === "observations"
            ? observationPendingCount
            : tab.counter
              ? getCounter(tab.counter)
              : null;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`group flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-center transition-theme
                ${isActive
                  ? 'border-primary-500/50 bg-primary-600/12 text-primary-700 shadow-sm dark:bg-primary-500/15 dark:text-primary-300'
                  : 'border-transparent text-gray-700 hover:border-gray-200 hover:bg-gray-50 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:bg-gray-900/40'
                }`}
            >
              <span className="flex min-w-0 items-center justify-center gap-2">
                <Icon
                  name={tab.icon}
                  className={`shrink-0 text-sm ${isActive ? 'text-primary-600 dark:text-primary-300' : 'text-gray-500 dark:text-gray-400'}`}
                />
                <span className="truncate text-sm font-semibold">{tab.label}</span>
                {count !== null && (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold transition-theme
                    ${isActive
                      ? 'bg-primary-600 text-white dark:bg-primary-400 dark:text-gray-950'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-300'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default MinuteEditorTabs;
