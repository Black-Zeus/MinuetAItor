/**
 * pages/minuteEditor/cards/MinuteEditorCardAdditionalInfo.jsx
 * Card de solo lectura: nota adicional generada por la IA. Bloqueada para auditoría.
 */

import React from 'react';
import Icon from '@components/ui/icon/iconManager';
import useMinuteEditorStore from '@/store/minuteEditorStore';

export const MinuteEditorCardAdditionalInfo = () => {
  const { additionalNote } = useMinuteEditorStore();

  return (
    <article className="bg-white dark:bg-gray-800 rounded-xl p-6 transition-theme shadow-md border border-gray-200/50 dark:border-gray-700/50 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold tracking-wider text-gray-800 dark:text-gray-200 uppercase transition-theme">
          Información adicional
        </h2>
        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border border-primary-200/50 dark:border-primary-700/50 transition-theme">
          <Icon name="brain" className="mr-1" />
          IA (bloqueado)
        </span>
      </div>

      <div className="mt-5 flex-1 rounded-xl border border-dashed border-primary-300/50 dark:border-primary-700/40 bg-primary-50/20 dark:bg-primary-900/10 p-4">
        <p className="text-sm text-gray-900 dark:text-gray-100 transition-theme leading-relaxed">
          {additionalNote || <span className="italic text-gray-400 dark:text-gray-600">Sin nota adicional.</span>}
        </p>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 transition-theme mt-3">
        Este contenido fue procesado por la IA y se mantiene inalterable para auditoría.
      </p>
    </article>
  );
};

export default MinuteEditorCardAdditionalInfo;