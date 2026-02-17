/**
 * pages/minuteEditor/cards/MinuteEditorCardParticipationSummary.jsx
 * Card de solo lectura: resumen de participación calculado desde el store.
 */

import React from 'react';
import Icon from '@components/ui/icon/iconManager';
import useMinuteEditorStore from '@/store/minuteEditorStore';

export const MinuteEditorCardParticipationSummary = () => {
  const { getParticipationSummary } = useMinuteEditorStore();
  const { invited, attendees, copy, total } = getParticipationSummary();

  const rows = [
    { label: 'Invitados',    value: `${invited} persona${invited !== 1 ? 's' : ''}` },
    { label: 'Asistentes',   value: `${attendees} persona${attendees !== 1 ? 's' : ''}${invited > 0 ? ` (${Math.round(attendees / invited * 100)}%)` : ''}` },
    { label: 'Copia (CC)',   value: `${copy} persona${copy !== 1 ? 's' : ''}` },
  ];

  return (
    <article className="bg-white dark:bg-gray-800 rounded-xl p-6 transition-theme shadow-md border border-gray-200/50 dark:border-gray-700/50 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold tracking-wider text-gray-800 dark:text-gray-200 uppercase transition-theme">
          Resumen de participación
        </h2>
        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200/50 dark:border-gray-700/50 transition-theme">
          <Icon name="lock" className="mr-1" />
          No modificable
        </span>
      </div>

      <div className="mt-5 flex-1 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-900/30 p-4 space-y-3">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <span className="text-sm text-gray-500 dark:text-gray-400 transition-theme">{label}</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 transition-theme">{value}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme mt-3">
        Calculado automáticamente según la tabla de participantes.
      </p>
    </article>
  );
};

export default MinuteEditorCardParticipationSummary;