/**
 * pages/minuteEditor/MinuteEditor.jsx
 * Orquestador principal del editor de minutas.
 * Carga el JSON de la IA, inicializa el store y coordina todos los subcomponentes.
 */

import React, { useEffect } from 'react';
import useMinuteEditorStore from '@store/minuteEditorStore';

// Layout
import MinuteEditorHeader      from './MinuteEditorHeader';
import MinuteEditorFindReplace from './MinuteEditorFindReplace';
import MinuteEditorTabs        from './MinuteEditorTabs';

// Secciones / Tabs
import MinuteEditorSectionInfo         from './sections/MinuteEditorSectionInfo';
import MinuteEditorSectionParticipants from './sections/MinuteEditorSectionParticipants';
import MinuteEditorSectionScope        from './sections/MinuteEditorSectionScope';
import MinuteEditorSectionAgreements   from './sections/MinuteEditorSectionAgreements';
import MinuteEditorSectionRequirements from './sections/MinuteEditorSectionRequirements';
import MinuteEditorSectionTags         from './sections/MinuteEditorSectionTags';
import MinuteEditorSectionNextMeetings from './sections/MinuteEditorSectionNextMeetings';
import MinuteEditorSectionTimeline     from './sections/MinuteEditorSectionTimeline';
import MinuteEditorSectionPdfFormat    from './sections/MinuteEditorSectionPdfFormat';
import MinuteEditorSectionMetadata     from './sections/MinuteEditorSectionMetadata';

// Datos de ejemplo (en producción vendrá como prop o desde API)
import sampleData from '@/data/minuteIAResponse.json';

const MinuteEditor = ({ iaResponse = null }) => {
  const { loadFromIAResponse, reset, isLoaded, activeTab } = useMinuteEditorStore();

  // Cargar datos al montar
  useEffect(() => {
    const data = iaResponse ?? sampleData;
    loadFromIAResponse(data);
    return () => reset();
  }, []);

  if (!isLoaded) {
    return (
      <div className="min-h-screen  flex items-center justify-center transition-theme">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <i className="fas fa-spinner fa-spin text-primary-500" />
          <span className="text-sm font-medium">Cargando editor…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen  transition-theme">
      {/* Top bar sticky */}
      <MinuteEditorHeader />

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Buscar / Reemplazar */}
        <MinuteEditorFindReplace />

        {/* Navegación por tabs */}
        <MinuteEditorTabs />

        {/* Contenido del tab activo */}
        {activeTab === 'info'         && <MinuteEditorSectionInfo />}
        {activeTab === 'participants' && <MinuteEditorSectionParticipants />}
        {activeTab === 'scope'        && <MinuteEditorSectionScope />}
        {activeTab === 'agreements'   && <MinuteEditorSectionAgreements />}
        {activeTab === 'requirements' && <MinuteEditorSectionRequirements />}
        {activeTab === 'tags'         && <MinuteEditorSectionTags />}
        {activeTab === 'next'         && <MinuteEditorSectionNextMeetings />}
        {activeTab === 'timeline'     && <MinuteEditorSectionTimeline />}
        {activeTab === 'pdfformat'    && <MinuteEditorSectionPdfFormat />}
        {activeTab === 'metadata'     && <MinuteEditorSectionMetadata />}
      </main>
    </div>
  );
};

export default MinuteEditor;