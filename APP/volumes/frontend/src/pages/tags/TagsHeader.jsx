/**
 * TagsHeader.jsx (alineado a ProjectHeader template)
 * - Título + subtítulo con constantes TXT_*
 * - Layout flex con acciones a la derecha
 * - Botones normalizados con ActionButton (misma línea visual del sistema)
 */

import React from "react";
import Icon from "@/components/ui/icon/iconManager";
import ActionButton from "@/components/ui/button/ActionButton";
import NewTag from "@/components/ui/button/NewTag";

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_META = "text-gray-600 dark:text-gray-300";

export default function TagsHeader({ onCreateTag, onResetCatalog }) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className={`text-3xl font-bold ${TXT_TITLE} flex items-center gap-3 transition-theme`}>
          <Icon name="FaTags" className="text-primary-600 dark:text-primary-400 w-8 h-8" />
          Tags
        </h1>
        <p className={`${TXT_META} mt-2 transition-theme`}>
          Catálogo de tags (name + description) para clasificación y análisis
        </p>
      </div>

      <div className="flex items-center gap-2">
        <NewTag />
      </div>
    </div>
  );
}