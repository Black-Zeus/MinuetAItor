/**
 * pages/minuteEditor/MinuteEditorTabs.jsx
 * Barra de navegación por pestañas con contadores dinámicos desde el store.
 */

import React from 'react';
import Icon from '@components/ui/icon/iconManager';
import useMinuteEditorStore from '@store/minuteEditorStore';

const TABS = [
  { id: 'info',         label: 'Información General', icon: 'clipboardList', counter: null },
  { id: 'participants', label: 'Participantes',        icon: 'users',         counter: 'participants' },
  { id: 'scope',        label: 'Alcance y Contenido',  icon: 'diagramProject',counter: 'scopeSections' },
  { id: 'agreements',   label: 'Acuerdos',             icon: 'check',         counter: 'agreements' },
  { id: 'requirements', label: 'Requerimientos',       icon: 'thumbtack',     counter: 'requirements' },
  { id: 'tags',         label: 'Tags',                 icon: 'tags',          counter: 'tags' },
  { id: 'next',         label: 'Próximas Reuniones',   icon: 'calendar',      counter: 'upcomingMeetings' },
  { id: 'timeline',     label: 'Línea de Tiempo',      icon: 'history',       counter: 'timeline' },
  { id: 'pdfformat',    label: 'Formato PDF',          icon: 'fileLines',     counter: null },
  { id: 'metadata',     label: 'Metadata',             icon: 'gear',          counter: null },
];

const MinuteEditorTabs = () => {
  const { activeTab, setActiveTab, participants, scopeSections, agreements, requirements, aiTags, userTags, upcomingMeetings, timeline } = useMinuteEditorStore();

  const getCounter = (key) => {
    switch (key) {
      case 'participants':   return participants.length;
      case 'scopeSections':  return scopeSections.length;
      case 'agreements':     return agreements.length;
      case 'requirements':   return requirements.length;
      case 'tags':           return aiTags.length + userTags.length;
      case 'upcomingMeetings': return upcomingMeetings.length;
      case 'timeline':       return timeline.length;
      default:               return null;
    }
  };

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl p-3 transition-theme shadow-md border border-gray-200/50 dark:border-gray-700/50">
      <div className="flex flex-wrap gap-2">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          const count    = tab.counter ? getCounter(tab.counter) : null;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 rounded-lg transition-theme text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 ${isActive ? 'opacity-100' : 'opacity-90'}`}
            >
              <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border transition-theme
                ${isActive
                  ? 'bg-primary-600/15 border-primary-500/40 text-primary-700 dark:text-primary-300'
                  : 'border-transparent'
                }`}
              >
                <Icon name={tab.icon} className="text-sm" />
                <span className="font-semibold text-sm">{tab.label}</span>
                {count !== null && (
                  <span className="text-xs px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200/50 dark:border-gray-700/50 transition-theme">
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