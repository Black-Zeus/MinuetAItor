/**
 * pages/minuteEditor/MinuteEditorFindReplace.jsx
 * Toolbar de búsqueda y reemplazo sobre contenido editable del editor.
 */

import React, { useState, useEffect } from 'react';
import Icon from '@components/ui/icon/iconManager';
import useMinuteEditorStore from '@/store/minuteEditorStore';

const MinuteEditorFindReplace = () => {
  const {
    findQuery, replaceQuery,
    setFindQuery, setReplaceQuery,
    countMatches, applyReplace,
  } = useMinuteEditorStore();

  const [matchCount, setMatchCount] = useState(0);

  // Recalcular coincidencias al cambiar la query de búsqueda
  useEffect(() => {
    setMatchCount(countMatches());
  }, [findQuery]);

  const handleFind = () => setMatchCount(countMatches());

  const handleReplace = (all) => {
    if (!findQuery) return;
    applyReplace(all);
    setMatchCount(countMatches());
  };

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl p-4 transition-theme shadow-md border border-gray-200/50 dark:border-gray-700/50">
      <div className="flex flex-col md:flex-row md:items-center gap-3">

        {/* Buscar */}
        <div className="flex-1 flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={findQuery}
            onChange={e => setFindQuery(e.target.value)}
            placeholder="Buscar en el documento…"
            className="flex-1 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 text-sm transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          />
          <button
            type="button"
            onClick={handleFind}
            className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-theme text-sm font-medium"
          >
            <Icon name="search" className="mr-2" />
            Buscar
          </button>
        </div>

        {/* Reemplazar */}
        <div className="flex-1 flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={replaceQuery}
            onChange={e => setReplaceQuery(e.target.value)}
            placeholder="Reemplazar con…"
            className="flex-1 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 text-sm transition-theme focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          />
          <button
            type="button"
            onClick={() => handleReplace(false)}
            className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-theme text-sm font-medium whitespace-nowrap"
          >
            Reemplazar
          </button>
          <button
            type="button"
            onClick={() => handleReplace(true)}
            className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-theme text-sm font-medium whitespace-nowrap"
          >
            Reemplazar todo
          </button>
        </div>

        {/* Contador */}
        <div className="text-sm text-gray-500 dark:text-gray-400 transition-theme whitespace-nowrap">
          <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">{matchCount}</span> coincidencias
        </div>

      </div>
    </section>
  );
};

export default MinuteEditorFindReplace;