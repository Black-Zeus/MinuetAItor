/**
 * ClientModal.jsx
 * Wizard consistente con NewMinuteForm (paso a paso + confirmación)
 *
 * mode:
 * - "createNewClient"  (sin data)
 * - "viewDetailClient" (requiere data JSON)
 * - "editCurrentClient" (requiere data JSON)
 *
 * onSubmit(payload) => payload normalizado:
 * {
 *   companyName, companyLegalName, companyEmail, companyPhone, companyWebsite,
 *   isConfidential,
 *   contactName, contactEmail, contactPhone, contactPosition, contactDepartment,
 *   notes, tags
 * }
 */

import React, { useMemo, useState } from 'react';
import Icon from '@/components/ui/icon/iconManager';
import { ModalManager } from '@/components/ui/modal';

const MODES = {
  CREATE: 'createNewClient',
  VIEW: 'viewDetailClient',
  EDIT: 'editCurrentClient'
};

const normalizeClient = (data = {}) => ({
  // Empresa
  companyName: data.companyName ?? data.company ?? '',
  companyLegalName: data.companyLegalName ?? data.legalName ?? '',
  companyEmail: data.companyEmail ?? '',
  companyPhone: data.companyPhone ?? '',
  companyWebsite: data.companyWebsite ?? data.website ?? '',
  isConfidential: Boolean(data.isConfidential ?? data.confidential ?? false),

  // Contacto principal
  contactName: data.contactName ?? data.name ?? '',
  contactEmail: data.contactEmail ?? data.email ?? '',
  contactPhone: data.contactPhone ?? data.phone ?? '',
  contactPosition: data.contactPosition ?? data.position ?? '',
  contactDepartment: data.contactDepartment ?? data.department ?? '',

  // Notas
  notes: data.notes ?? '',
  tags: data.tags ?? ''
});

const ClientModal = ({
  mode,
  data,
  onSubmit,
  onClose
}) => {
  const isCreate = mode === MODES.CREATE;
  const isView = mode === MODES.VIEW;
  const isEdit = mode === MODES.EDIT;

  const initial = useMemo(() => normalizeClient(data), [data]);

  const [formData, setFormData] = useState(() => (isCreate ? normalizeClient({}) : initial));
  const [errors, setErrors] = useState({});
  const [currentStep, setCurrentStep] = useState(0);

  // Wizard steps (mismo patrón que tu NewMinuteForm)
  const steps = [
    { title: 'Empresa', number: 1 },
    { title: 'Contacto', number: 2 },
    { title: 'Notas', number: 3 },
    { title: 'Confirmación', number: 4 }
  ];

  const closeModal = () => {
    // 1) callback del padre
    try { onClose?.(); } catch (_) {}

    // 2) fallback robusto
    try { ModalManager.hide?.(); } catch (_) {}
    try { ModalManager.close?.(); } catch (_) {}
    try { ModalManager.dismiss?.(); } catch (_) {}
    try { ModalManager.closeAll?.(); } catch (_) {}
  };

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  };

  const tagsPreview = useMemo(() => {
    return (formData.tags || '')
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
  }, [formData.tags]);

  // Validación por paso (idéntico enfoque a tu wizard)
  const validateStep = (step) => {
    const newErrors = {};

    if (isView) {
      setErrors({});
      return true;
    }

    switch (step) {
      case 0: // Empresa
        if (!formData.companyName.trim()) newErrors.companyName = 'Nombre comercial es requerido';
        break;

      case 1: // Contacto
        if (!formData.contactName.trim()) newErrors.contactName = 'Nombre del contacto es requerido';
        if (!formData.contactEmail.trim()) newErrors.contactEmail = 'Email del contacto es requerido';
        break;

      // case 2 (Notas) sin obligatorios
      // case 3 (Confirmación) sin obligatorios
      default:
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        handleSubmit();
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = () => {
    if (isView) return;
    onSubmit?.({ ...formData });
  };

  // Helpers UI para view
  const FieldRow = ({ label, value }) => {
    const v = (value ?? '').toString().trim();
    return (
      <div className="flex">
        <span className="font-medium text-gray-700 dark:text-gray-300 w-40">{label}:</span>
        <span className="text-gray-600 dark:text-gray-400">
          {v || <span className="italic text-gray-500 dark:text-gray-500">Sin información</span>}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col w-full h-[600px]">
      {/* Header con indicador de pasos (MISMO markup/estilo que NewMinuteForm) */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-center">
              <div className={`
                flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold
                ${idx === currentStep
                  ? 'bg-blue-600 text-white'
                  : idx < currentStep
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                }
              `}>
                {idx < currentStep ? '✓' : step.number}
              </div>
              {idx < steps.length - 1 && (
                <div className={`w-12 h-1 mx-2 ${idx < currentStep ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            {isCreate && `Crear Cliente — ${steps[currentStep].title}`}
            {isEdit && `Editar Cliente — ${steps[currentStep].title}`}
            {isView && `Detalles del Cliente — ${steps[currentStep].title}`}
          </h3>

          {formData.isConfidential && (
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
              Confidencial
            </span>
          )}
        </div>
      </div>

      {/* Contenido con scroll */}
      <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">

        {/* Paso 0: Empresa */}
        {currentStep === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Ingrese la identificación de la empresa.
            </p>

            {!isView && (
              <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={formData.isConfidential}
                    onChange={(e) => handleChange('isConfidential', e.target.checked)}
                    className="mt-1 h-4 w-4"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      Cliente Confidencial
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Aplica restricciones de visibilidad/roles en módulos posteriores.
                    </div>
                  </div>
                </label>
              </div>
            )}

            {/* Nombre Comercial */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre Comercial <span className="text-red-500">*</span>
              </label>

              {isView ? (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {formData.companyName || <span className="italic text-gray-500 dark:text-gray-500">Sin información</span>}
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => handleChange('companyName', e.target.value)}
                    className={`
                      w-full px-3 py-2 border rounded-lg
                      bg-white dark:bg-gray-800
                      text-gray-900 dark:text-gray-100
                      ${errors.companyName ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'}
                      focus:outline-none focus:ring-2
                    `}
                  />
                  {errors.companyName && <p className="mt-1 text-sm text-red-500">{errors.companyName}</p>}
                </>
              )}
            </div>

            {/* Razón Social */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Razón Social (opcional)
              </label>

              {isView ? (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {formData.companyLegalName || <span className="italic text-gray-500 dark:text-gray-500">Sin información</span>}
                </div>
              ) : (
                <input
                  type="text"
                  value={formData.companyLegalName}
                  onChange={(e) => handleChange('companyLegalName', e.target.value)}
                  className="
                    w-full px-3 py-2 border rounded-lg
                    bg-white dark:bg-gray-800
                    text-gray-900 dark:text-gray-100
                    border-gray-300 dark:border-gray-600
                    focus:outline-none focus:ring-2 focus:ring-blue-500
                  "
                />
              )}
            </div>

            {/* Email / Teléfono */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Corporativo (opcional)
                </label>

                {isView ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {formData.companyEmail || <span className="italic text-gray-500 dark:text-gray-500">Sin información</span>}
                  </div>
                ) : (
                  <input
                    type="email"
                    value={formData.companyEmail}
                    onChange={(e) => handleChange('companyEmail', e.target.value)}
                    className="
                      w-full px-3 py-2 border rounded-lg
                      bg-white dark:bg-gray-800
                      text-gray-900 dark:text-gray-100
                      border-gray-300 dark:border-gray-600
                      focus:outline-none focus:ring-2 focus:ring-blue-500
                    "
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Teléfono (opcional)
                </label>

                {isView ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {formData.companyPhone || <span className="italic text-gray-500 dark:text-gray-500">Sin información</span>}
                  </div>
                ) : (
                  <input
                    type="tel"
                    value={formData.companyPhone}
                    onChange={(e) => handleChange('companyPhone', e.target.value)}
                    className="
                      w-full px-3 py-2 border rounded-lg
                      bg-white dark:bg-gray-800
                      text-gray-900 dark:text-gray-100
                      border-gray-300 dark:border-gray-600
                      focus:outline-none focus:ring-2 focus:ring-blue-500
                    "
                  />
                )}
              </div>
            </div>

            {/* Website */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Sitio Web (opcional)
              </label>

              {isView ? (
                <div className="text-sm text-gray-600 dark:text-gray-400 break-words">
                  {formData.companyWebsite || <span className="italic text-gray-500 dark:text-gray-500">Sin información</span>}
                </div>
              ) : (
                <input
                  type="url"
                  value={formData.companyWebsite}
                  onChange={(e) => handleChange('companyWebsite', e.target.value)}
                  className="
                    w-full px-3 py-2 border rounded-lg
                    bg-white dark:bg-gray-800
                    text-gray-900 dark:text-gray-100
                    border-gray-300 dark:border-gray-600
                    focus:outline-none focus:ring-2 focus:ring-blue-500
                  "
                />
              )}
            </div>
          </div>
        )}

        {/* Paso 1: Contacto */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Ingrese el contacto principal del cliente.
            </p>

            {/* Nombre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre Completo <span className="text-red-500">*</span>
              </label>

              {isView ? (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {formData.contactName || <span className="italic text-gray-500 dark:text-gray-500">Sin información</span>}
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={formData.contactName}
                    onChange={(e) => handleChange('contactName', e.target.value)}
                    className={`
                      w-full px-3 py-2 border rounded-lg
                      bg-white dark:bg-gray-800
                      text-gray-900 dark:text-gray-100
                      ${errors.contactName ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'}
                      focus:outline-none focus:ring-2
                    `}
                  />
                  {errors.contactName && <p className="mt-1 text-sm text-red-500">{errors.contactName}</p>}
                </>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email <span className="text-red-500">*</span>
              </label>

              {isView ? (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {formData.contactEmail || <span className="italic text-gray-500 dark:text-gray-500">Sin información</span>}
                </div>
              ) : (
                <>
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => handleChange('contactEmail', e.target.value)}
                    className={`
                      w-full px-3 py-2 border rounded-lg
                      bg-white dark:bg-gray-800
                      text-gray-900 dark:text-gray-100
                      ${errors.contactEmail ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'}
                      focus:outline-none focus:ring-2
                    `}
                  />
                  {errors.contactEmail && <p className="mt-1 text-sm text-red-500">{errors.contactEmail}</p>}
                </>
              )}
            </div>

            {/* Teléfono / Cargo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Teléfono (opcional)
                </label>

                {isView ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {formData.contactPhone || <span className="italic text-gray-500 dark:text-gray-500">Sin información</span>}
                  </div>
                ) : (
                  <input
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(e) => handleChange('contactPhone', e.target.value)}
                    className="
                      w-full px-3 py-2 border rounded-lg
                      bg-white dark:bg-gray-800
                      text-gray-900 dark:text-gray-100
                      border-gray-300 dark:border-gray-600
                      focus:outline-none focus:ring-2 focus:ring-blue-500
                    "
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cargo (opcional)
                </label>

                {isView ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {formData.contactPosition || <span className="italic text-gray-500 dark:text-gray-500">Sin información</span>}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={formData.contactPosition}
                    onChange={(e) => handleChange('contactPosition', e.target.value)}
                    className="
                      w-full px-3 py-2 border rounded-lg
                      bg-white dark:bg-gray-800
                      text-gray-900 dark:text-gray-100
                      border-gray-300 dark:border-gray-600
                      focus:outline-none focus:ring-2 focus:ring-blue-500
                    "
                  />
                )}
              </div>
            </div>

            {/* Departamento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Área / Departamento (opcional)
              </label>

              {isView ? (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {formData.contactDepartment || <span className="italic text-gray-500 dark:text-gray-500">Sin información</span>}
                </div>
              ) : (
                <input
                  type="text"
                  value={formData.contactDepartment}
                  onChange={(e) => handleChange('contactDepartment', e.target.value)}
                  className="
                    w-full px-3 py-2 border rounded-lg
                    bg-white dark:bg-gray-800
                    text-gray-900 dark:text-gray-100
                    border-gray-300 dark:border-gray-600
                    focus:outline-none focus:ring-2 focus:ring-blue-500
                  "
                />
              )}
            </div>
          </div>
        )}

        {/* Paso 2: Notas */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Agregue notas y etiquetas para facilitar el seguimiento.
            </p>

            {/* Notas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notas (opcional)
              </label>

              {isView ? (
                <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">
                  {formData.notes?.trim() ? formData.notes : <span className="italic text-gray-500 dark:text-gray-500">Sin información</span>}
                </div>
              ) : (
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  rows={6}
                  className="
                    w-full px-3 py-2 border rounded-lg
                    bg-white dark:bg-gray-800
                    text-gray-900 dark:text-gray-100
                    border-gray-300 dark:border-gray-600
                    focus:outline-none focus:ring-2 focus:ring-blue-500
                    resize-none
                  "
                />
              )}
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Etiquetas (opcional)
              </label>

              {isView ? (
                <>
                  {tagsPreview.length ? (
                    <div className="flex flex-wrap gap-2">
                      {tagsPreview.map((t, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800 text-xs"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm italic text-gray-500 dark:text-gray-500">Sin etiquetas</div>
                  )}
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => handleChange('tags', e.target.value)}
                    placeholder="Ej: VIP, Contrato anual, Zona norte"
                    className="
                      w-full px-3 py-2 border rounded-lg
                      bg-white dark:bg-gray-800
                      text-gray-900 dark:text-gray-100
                      border-gray-300 dark:border-gray-600
                      focus:outline-none focus:ring-2 focus:ring-blue-500
                    "
                  />

                  {tagsPreview.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {tagsPreview.map((t, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Paso 3: Confirmación */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Revise la información antes de {isCreate ? 'crear' : 'guardar'} el cliente.
            </p>

            <div className="space-y-6">
              {/* 1: Empresa */}
              <div className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs mr-2">1</span>
                  Empresa
                </h4>
                <div className="space-y-2 text-sm">
                  <FieldRow label="Nombre Comercial" value={formData.companyName} />
                  <FieldRow label="Razón Social" value={formData.companyLegalName} />
                  <FieldRow label="Email Corporativo" value={formData.companyEmail} />
                  <FieldRow label="Teléfono" value={formData.companyPhone} />
                  <FieldRow label="Sitio Web" value={formData.companyWebsite} />
                  <FieldRow label="Confidencial" value={formData.isConfidential ? 'Sí' : 'No'} />
                </div>
              </div>

              {/* 2: Contacto */}
              <div className="border-l-4 border-indigo-500 pl-4">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500 text-white text-xs mr-2">2</span>
                  Contacto
                </h4>
                <div className="space-y-2 text-sm">
                  <FieldRow label="Nombre" value={formData.contactName} />
                  <FieldRow label="Email" value={formData.contactEmail} />
                  <FieldRow label="Teléfono" value={formData.contactPhone} />
                  <FieldRow label="Cargo" value={formData.contactPosition} />
                  <FieldRow label="Departamento" value={formData.contactDepartment} />
                </div>
              </div>

              {/* 3: Notas */}
              <div className="border-l-4 border-green-500 pl-4">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white text-xs mr-2">3</span>
                  Notas y Etiquetas
                </h4>

                <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">
                  {formData.notes?.trim() ? formData.notes : <span className="italic text-gray-500 dark:text-gray-500">Sin información</span>}
                </div>

                <div className="mt-3">
                  {tagsPreview.length ? (
                    <div className="flex flex-wrap gap-2">
                      {tagsPreview.map((t, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800 text-xs"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm italic text-gray-500 dark:text-gray-500">Sin etiquetas</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Footer con botones (MISMO estilo que NewMinuteForm) */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between">
          <button
            type="button"
            onClick={currentStep === 0 ? closeModal : handlePrevious}
            className="
              px-4 py-2 text-sm font-medium
              text-gray-700 dark:text-gray-300
              bg-white dark:bg-gray-800
              border border-gray-300 dark:border-gray-600
              rounded-lg
              hover:bg-gray-50 dark:hover:bg-gray-700
              focus:outline-none focus:ring-2 focus:ring-blue-500
              transition-colors
            "
          >
            {currentStep === 0 ? 'Cancelar' : 'Anterior'}
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="
              px-4 py-2 text-sm font-medium
              text-white
              bg-blue-600
              rounded-lg
              hover:bg-blue-700
              focus:outline-none focus:ring-2 focus:ring-blue-500
              transition-colors
            "
          >
            {currentStep === steps.length - 1
              ? (isView ? 'Cerrar' : (isCreate ? 'Crear' : 'Guardar'))
              : 'Siguiente'
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClientModal;
export { MODES as CLIENT_MODAL_MODES };