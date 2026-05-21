/**
 * ProfilesCatalogHeader.jsx
 * Header del módulo de perfiles
 * Recibe categories y onCreated para propagarlos al botón NewProfilesCatalog
 */

import React from "react";
import ModuleHeader from "@/components/common/page/ModuleHeader";
import NewProfilesCatalog from "@/components/ui/button/NewProfilesCatalog";

const ProfilesCatalogHeader = ({ categories = [], onCreated }) => {
  return (
    <ModuleHeader
      icon="FaBrain"
      title="Perfiles de Análisis"
      description="Catálogo de perfiles para análisis AI de minutas, con categoría, descripción y prompt."
      actions={
        <NewProfilesCatalog
          categories={categories}
          onCreated={onCreated}
        />
      }
    />
  );
};

export default ProfilesCatalogHeader;
