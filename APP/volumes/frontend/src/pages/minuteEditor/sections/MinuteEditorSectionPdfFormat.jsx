/**
 * pages/minuteEditor/sections/MinuteEditorSectionPdfFormat.jsx
 * Tab "Formato PDF": seleccion de template real y configuracion de hojas adicionales.
 *
 * Los IDs de template deben coincidir con TEMPLATE_MAP en pdf-worker/handlers/minute_pdf.py.
 * La seleccion se persiste en pdfFormat.template del store y viaja con el autosave.
 */

import React from 'react';
import Icon from '@components/ui/icon/iconManager';
import { DEFAULT_PDF_TEMPLATE } from '@/constants/pdfTemplates';
import useMinuteEditorStore from '@/store/minuteEditorStore';
import {
  PDF_SHEETS,
  SheetToggleCard,
  TemplateSelector,
} from './pdfFormat/PdfFormatComponents';

const MinuteEditorSectionPdfFormat = ({ recordId, isReadOnly = false }) => {
  const { pdfFormat, togglePdfSheet, setPdfTemplate } = useMinuteEditorStore();
  const selectedTemplate = pdfFormat.template ?? DEFAULT_PDF_TEMPLATE;
  const enabledCount = PDF_SHEETS.filter(s => pdfFormat[s.key]?.enabled).length;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 transition-theme shadow-md border border-gray-200/50 dark:border-gray-700/50">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white transition-theme flex items-center gap-2">
              <Icon name="gear" className="text-primary-600 dark:text-primary-400" />
              Formato de salida PDF
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 transition-theme">
              Selecciona el template visual y activa las hojas adicionales que se incluiran en el PDF.
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200/50 dark:border-gray-700/50 transition-theme">
            <Icon name="fileLines" className="text-primary-500 dark:text-primary-400 text-sm" />
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 transition-theme">
              {enabledCount} de {PDF_SHEETS.length} hojas activas
            </span>
          </div>
        </div>

        <div className="mt-5 border-t border-gray-100 dark:border-gray-700/50 pt-5 transition-theme">
          <TemplateSelector
            recordId={recordId}
            selectedId={selectedTemplate}
            onChange={setPdfTemplate}
            isReadOnly={isReadOnly}
          />
        </div>
      </div>

      <div className="space-y-4">
        {PDF_SHEETS.map(({ key, title, description, icon, ConfigComponent }) => (
          <SheetToggleCard
            key={key}
            title={title}
            description={description}
            icon={icon}
            enabled={pdfFormat[key]?.enabled ?? false}
            onToggle={() => togglePdfSheet(key)}
            isReadOnly={isReadOnly}
          >
            <ConfigComponent isReadOnly={isReadOnly} />
          </SheetToggleCard>
        ))}
      </div>
    </div>
  );
};

export default MinuteEditorSectionPdfFormat;
