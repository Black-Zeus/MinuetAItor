/**
 * TagsHeader.jsx
 * Header del módulo Tags — patrón ProjectHeader
 */

import React from "react";
import Icon   from "@/components/ui/icon/iconManager";
import NewTag from "@/components/ui/button/NewTag";

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_META  = "text-gray-600 dark:text-gray-300";

export default function TagsHeader({ onCreated, categories = [] }) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className={`text-3xl font-bold ${TXT_TITLE} flex items-center gap-3 transition-theme`}>
          <Icon name="FaTags" className="text-primary-600 dark:text-primary-400 w-8 h-8" />
          Tags
        </h1>
        <p className={`${TXT_META} mt-2 transition-theme`}>
          Catálogo de etiquetas para clasificación y análisis de minutas
        </p>
      </div>

      <div className="flex items-center gap-2">
        <NewTag onCreated={onCreated} categories={categories} />
      </div>
    </div>
  );
}