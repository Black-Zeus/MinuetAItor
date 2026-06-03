import React from "react";

import Icon from "@/components/ui/icon/iconManager";

const HistoryNoFilterResults = () => (
  <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-8 text-center dark:border-slate-700 dark:bg-slate-900/30">
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
      <Icon name="FaFilter" />
    </div>
    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
      Sin resultados para los filtros
    </h4>
    <p className="mt-2 max-w-md text-sm leading-6 text-gray-500 dark:text-gray-400">
      Ajusta la búsqueda o limpia los filtros para volver a ver el historial completo.
    </p>
  </div>
);

export default HistoryNoFilterResults;
