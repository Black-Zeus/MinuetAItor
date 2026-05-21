/**
 * TagsHeader.jsx
 * Header del módulo Tags — patrón ProjectHeader
 */

import React from "react";
import ModuleHeader from "@/components/common/page/ModuleHeader";
import NewTag from "@/components/ui/button/NewTag";

export default function TagsHeader({ onCreated, categories = [] }) {
  return (
    <ModuleHeader
      icon="FaTags"
      title="Tags"
      description="Catálogo de etiquetas para clasificación y análisis de minutas"
      actions={<NewTag onCreated={onCreated} categories={categories} />}
    />
  );
}
