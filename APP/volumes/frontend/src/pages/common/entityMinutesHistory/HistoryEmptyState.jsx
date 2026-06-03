import React from "react";

import Icon from "@/components/ui/icon/iconManager";

const HistoryEmptyState = ({ loading, error, type }) => (
  <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-8 text-center dark:border-slate-700 dark:bg-slate-900/30">
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
      <Icon name={loading ? "spinner" : error ? "triangleExclamation" : "fileLines"} className={loading ? "animate-spin" : ""} />
    </div>
    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
      {loading ? "Cargando historial..." : error ? "No se pudo cargar el historial" : "Sin minutas registradas"}
    </h4>
    <p className="mt-2 max-w-md text-sm leading-6 text-gray-500 dark:text-gray-400">
      {loading
        ? "Estamos consultando las minutas asociadas."
        : error || (type === "all"
          ? "No hay minutas registradas en el historial general."
          : `No hay minutas asociadas a este ${type === "project" ? "proyecto" : type === "participant" ? "participante" : "cliente"}.`)}
    </p>
  </div>
);

export default HistoryEmptyState;
