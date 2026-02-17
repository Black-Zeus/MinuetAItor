/**
 * ProfilesCatalogHeader.jsx
 * Header del módulo de perfiles (alineado a ProjectHeader)
 */

import React from "react";
import Icon from "@/components/ui/icon/iconManager";
import NewProfilesCatalog from "@/components/ui/button/NewProfilesCatalog";

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_META = "text-gray-600 dark:text-gray-300";

const ProfilesCatalogHeader = () => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className={`text-3xl font-bold ${TXT_TITLE} flex items-center gap-3 transition-theme`}>
          <Icon name="FaBrain" className="text-primary-600 dark:text-primary-400 w-8 h-8" />
          Perfiles de Análisis
        </h1>
        <p className={`${TXT_META} mt-2 transition-theme`}>
          Catálogo de perfiles (nombre + descripción + categoría + prompt) para análisis AI de minutas
        </p>
      </div>

      <NewProfilesCatalog />
    </div>
  );
};

export default ProfilesCatalogHeader;