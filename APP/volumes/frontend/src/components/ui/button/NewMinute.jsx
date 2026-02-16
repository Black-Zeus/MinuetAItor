import ActionButton from "./ActionButton";
import { FaPlus } from "react-icons/fa";
import clientsData from '@/data/dataClientes.json';
import projectsData from '@/data/dataProjectos.json';
import analysisProfiles from '@/data/analysisProfilesCatalog.json';
import ModalManager from '@/components/ui/modal';
import { useState, useCallback } from 'react';

/**
 * NewMinuteForm - Formulario personalizado con combos dependientes
 */
const NewMinuteForm = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    client: '',
    project: '',
    analysisProfile: '',
    transcription: null,
    summary: null,
    scheduledDate: '',
    scheduledStartTime: '',
    actualStartTime: '',
    scheduledEndTime: '',
    attendees: '',
    ccParticipants: '',
    additionalInfo: ''
  });

  const [errors, setErrors] = useState({});
  const [currentStep, setCurrentStep] = useState(0);

  // Preparar opciones de clientes
  const clientOptions = clientsData.clients.map(client => ({
    value: client.id.toString(),
    label: `${client.name} - ${client.company}`
  }));

  // Preparar opciones de perfiles de análisis
  const analysisProfileOptions = analysisProfiles.map((profile, idx) => ({
    value: idx.toString(),
    label: profile.nombre,
    description: profile.descripcion
  }));

  // Función para obtener proyectos filtrados por cliente
  const getProjectsByClient = useCallback((clientId) => {
    if (!clientId) return [];

    return projectsData.projects
      .filter(project => project.clientId.toString() === clientId.toString())
      .map(project => ({
        value: project.id.toString(), // <- normalizado a string
        label: project.name
      }));
  }, []);

  // Handler para cambios en los campos
  const handleChange = (name, value) => {
    setFormData(prev => {
      const newData = { ...prev, [name]: value };

      // Si cambia el cliente, resetear el proyecto
      if (name === 'client') {
        newData.project = '';
      }

      return newData;
    });

    // Limpiar error del campo
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Validación por paso
  const validateStep = (step) => {
    const newErrors = {};

    switch (step) {
      case 0: // Información General
        if (!formData.client) newErrors.client = 'Cliente es requerido';
        if (!formData.project) newErrors.project = 'Proyecto es requerido';
        if (!formData.analysisProfile) newErrors.analysisProfile = 'Perfil de análisis es requerido';
        break;

      case 1: // Adjuntos
        if (!formData.transcription) newErrors.transcription = 'Transcripción es requerida';
        break;

      case 2: // Fechas y Horarios
        if (!formData.scheduledDate) newErrors.scheduledDate = 'Fecha programada es requerida';
        if (!formData.scheduledStartTime) newErrors.scheduledStartTime = 'Hora inicio programada es requerida';
        if (!formData.actualStartTime) newErrors.actualStartTime = 'Hora inicio real es requerida';
        if (!formData.scheduledEndTime) newErrors.scheduledEndTime = 'Hora término es requerida';
        break;

      // Paso 3 (Participantes), Paso 4 (Info Adicional) normalmente sin obligatorios
      default:
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Navegación entre pasos
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
    onSubmit?.(formData);
  };

  // Obtener proyectos disponibles
  const projectOptions = getProjectsByClient(formData.client);

  // Obtener perfil seleccionado
  const selectedProfile = formData.analysisProfile
    ? analysisProfiles[parseInt(formData.analysisProfile)]
    : null;

  // Definición de pasos (ahora con Adjuntos)
  const steps = [
    { title: 'Información General', number: 1 },
    { title: 'Adjuntos', number: 2 },
    { title: 'Fechas y Horarios', number: 3 },
    { title: 'Participantes', number: 4 },
    { title: 'Información Adicional', number: 5 },
    { title: 'Confirmación', number: 6 }
  ];

  return (
    <div className="flex flex-col w-full h-[600px]">
      {/* Header con indicador de pasos */}
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
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          {steps[currentStep].title}
        </h3>
      </div>

      {/* Contenido con scroll */}
      <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
        {/* Paso 0: Información General */}
        {currentStep === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Seleccione el cliente, proyecto y perfil de análisis
            </p>

            {/* Cliente */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cliente <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.client}
                onChange={(e) => handleChange('client', e.target.value)}
                className={`
                  w-full px-3 py-2 border rounded-lg
                  bg-white dark:bg-gray-800
                  text-gray-900 dark:text-gray-100
                  ${errors.client ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'}
                  focus:outline-none focus:ring-2
                `}
              >
                <option value="">Seleccione un cliente</option>
                {clientOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {errors.client && <p className="mt-1 text-sm text-red-500">{errors.client}</p>}
            </div>

            {/* Proyecto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Proyecto <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.project}
                onChange={(e) => handleChange('project', e.target.value)}
                disabled={!formData.client}
                className={`
                  w-full px-3 py-2 border rounded-lg
                  bg-white dark:bg-gray-800
                  text-gray-900 dark:text-gray-100
                  ${errors.project ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'}
                  focus:outline-none focus:ring-2
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                <option value="">
                  {formData.client ? 'Seleccione un proyecto' : 'Primero seleccione un cliente'}
                </option>
                {projectOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {errors.project && <p className="mt-1 text-sm text-red-500">{errors.project}</p>}
            </div>

            {/* Perfil de Análisis */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Perfil de Análisis <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.analysisProfile}
                onChange={(e) => handleChange('analysisProfile', e.target.value)}
                className={`
                  w-full px-3 py-2 border rounded-lg
                  bg-white dark:bg-gray-800
                  text-gray-900 dark:text-gray-100
                  ${errors.analysisProfile ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'}
                  focus:outline-none focus:ring-2
                `}
              >
                <option value="">Seleccione un perfil de análisis</option>
                {analysisProfileOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {errors.analysisProfile && <p className="mt-1 text-sm text-red-500">{errors.analysisProfile}</p>}
              {selectedProfile && (
                <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                  <strong>Descripción:</strong> {selectedProfile.descripcion}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Paso 1: Adjuntos */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Suba la transcripción (obligatoria) y el resumen (opcional)
            </p>

            {/* Transcripción */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Transcripción <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                accept=".txt,.doc,.docx,.pdf"
                onChange={(e) => handleChange('transcription', e.target.files?.[0] ?? null)}
                className={`
                  w-full px-3 py-2 border rounded-lg
                  bg-white dark:bg-gray-800
                  text-gray-900 dark:text-gray-100
                  ${errors.transcription ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100
                `}
              />
              {formData.transcription && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Archivo: {formData.transcription.name}
                </p>
              )}
              {errors.transcription && (
                <p className="mt-1 text-sm text-red-500">{errors.transcription}</p>
              )}
            </div>

            {/* Resumen */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Resumen (opcional)
              </label>
              <input
                type="file"
                accept=".txt,.doc,.docx,.pdf"
                onChange={(e) => handleChange('summary', e.target.files?.[0] ?? null)}
                className="
                  w-full px-3 py-2 border rounded-lg
                  bg-white dark:bg-gray-800
                  text-gray-900 dark:text-gray-100
                  border-gray-300 dark:border-gray-600
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100
                "
              />
              {formData.summary && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Archivo: {formData.summary.name}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Paso 2: Fechas y Horarios */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Configure las fechas y horarios de la reunión
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fecha Programada <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.scheduledDate}
                onChange={(e) => handleChange('scheduledDate', e.target.value)}
                className={`
                  w-full px-3 py-2 border rounded-lg
                  bg-white dark:bg-gray-800
                  text-gray-900 dark:text-gray-100
                  ${errors.scheduledDate ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'}
                  focus:outline-none focus:ring-2
                `}
              />
              {errors.scheduledDate && <p className="mt-1 text-sm text-red-500">{errors.scheduledDate}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Hora Inicio Programada <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={formData.scheduledStartTime}
                onChange={(e) => handleChange('scheduledStartTime', e.target.value)}
                className={`
                  w-full px-3 py-2 border rounded-lg
                  bg-white dark:bg-gray-800
                  text-gray-900 dark:text-gray-100
                  ${errors.scheduledStartTime ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'}
                  focus:outline-none focus:ring-2
                `}
              />
              {errors.scheduledStartTime && <p className="mt-1 text-sm text-red-500">{errors.scheduledStartTime}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Hora Inicio Real <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={formData.actualStartTime}
                onChange={(e) => handleChange('actualStartTime', e.target.value)}
                className={`
                  w-full px-3 py-2 border rounded-lg
                  bg-white dark:bg-gray-800
                  text-gray-900 dark:text-gray-100
                  ${errors.actualStartTime ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'}
                  focus:outline-none focus:ring-2
                `}
              />
              {errors.actualStartTime && <p className="mt-1 text-sm text-red-500">{errors.actualStartTime}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Hora Término Programada <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={formData.scheduledEndTime}
                onChange={(e) => handleChange('scheduledEndTime', e.target.value)}
                className={`
                  w-full px-3 py-2 border rounded-lg
                  bg-white dark:bg-gray-800
                  text-gray-900 dark:text-gray-100
                  ${errors.scheduledEndTime ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'}
                  focus:outline-none focus:ring-2
                `}
              />
              {errors.scheduledEndTime && <p className="mt-1 text-sm text-red-500">{errors.scheduledEndTime}</p>}
            </div>
          </div>
        )}

        {/* Paso 3: Participantes */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Ingrese la lista de asistentes a la reunión y las personas que recibirán copia de la minuta
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Participantes Presentes
              </label>
              <textarea
                value={formData.attendees}
                onChange={(e) => handleChange('attendees', e.target.value)}
                rows={5}
                placeholder={"Ingrese los nombres de los asistentes a la reunión (uno por línea)\nEjemplo:\nJuan Pérez\nMaría González\nRoberto Silva"}
                className="
                  w-full px-3 py-2 border rounded-lg
                  bg-white dark:bg-gray-800
                  text-gray-900 dark:text-gray-100
                  border-gray-300 dark:border-gray-600
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  resize-none
                "
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Destinatarios en Copia (CC)
              </label>
              <textarea
                value={formData.ccParticipants}
                onChange={(e) => handleChange('ccParticipants', e.target.value)}
                rows={5}
                placeholder={"Ingrese los nombres de quienes recibirán copia de la minuta (uno por línea)\nEjemplo:\nAna Martínez - Gerente General\nCarlos López - Jefe de Proyecto"}
                className="
                  w-full px-3 py-2 border rounded-lg
                  bg-white dark:bg-gray-800
                  text-gray-900 dark:text-gray-100
                  border-gray-300 dark:border-gray-600
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  resize-none
                "
              />
            </div>
          </div>
        )}

        {/* Paso 4: Información Adicional */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Agregue cualquier información extra relevante sobre la reunión
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Información Adicional
              </label>
              <textarea
                value={formData.additionalInfo}
                onChange={(e) => handleChange('additionalInfo', e.target.value)}
                rows={8}
                placeholder={"Ingrese información adicional sobre la reunión\n\nEjemplos:\n- Objetivos específicos de la reunión\n- Contexto o antecedentes relevantes\n- Temas prioritarios a tratar\n- Observaciones especiales"}
                className="
                  w-full px-3 py-2 border rounded-lg
                  bg-white dark:bg-gray-800
                  text-gray-900 dark:text-gray-100
                  border-gray-300 dark:border-gray-600
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  resize-none
                "
              />
            </div>
          </div>
        )}

        {/* Paso 5: Confirmación */}
        {currentStep === 5 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Revise la información ingresada antes de crear la minuta
            </p>

            <div className="space-y-6">
              {/* 1: Información General */}
              <div className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs mr-2">1</span>
                  Información General
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex">
                    <span className="font-medium text-gray-700 dark:text-gray-300 w-40">Cliente:</span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {clientsData.clients.find(c => c.id.toString() === formData.client)?.name} - {clientsData.clients.find(c => c.id.toString() === formData.client)?.company}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="font-medium text-gray-700 dark:text-gray-300 w-40">Proyecto:</span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {projectsData.projects.find(p => p.id.toString() === formData.project)?.name}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="font-medium text-gray-700 dark:text-gray-300 w-40">Perfil de Análisis:</span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {selectedProfile?.nombre || 'Sin información proporcionada'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2: Adjuntos */}
              <div className="border-l-4 border-indigo-500 pl-4">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500 text-white text-xs mr-2">2</span>
                  Adjuntos
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex">
                    <span className="font-medium text-gray-700 dark:text-gray-300 w-40">Transcripción:</span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {formData.transcription?.name || 'Sin archivo'}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="font-medium text-gray-700 dark:text-gray-300 w-40">Resumen:</span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {formData.summary?.name || 'Sin información proporcionada'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3: Fechas y Horarios */}
              <div className="border-l-4 border-green-500 pl-4">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white text-xs mr-2">3</span>
                  Fechas y Horarios
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex">
                    <span className="font-medium text-gray-700 dark:text-gray-300 w-40">Fecha Programada:</span>
                    <span className="text-gray-600 dark:text-gray-400">{formData.scheduledDate}</span>
                  </div>
                  <div className="flex">
                    <span className="font-medium text-gray-700 dark:text-gray-300 w-40">Hora Inicio Programada:</span>
                    <span className="text-gray-600 dark:text-gray-400">{formData.scheduledStartTime}</span>
                  </div>
                  <div className="flex">
                    <span className="font-medium text-gray-700 dark:text-gray-300 w-40">Hora Inicio Real:</span>
                    <span className="text-gray-600 dark:text-gray-400">{formData.actualStartTime}</span>
                  </div>
                  <div className="flex">
                    <span className="font-medium text-gray-700 dark:text-gray-300 w-40">Hora Término:</span>
                    <span className="text-gray-600 dark:text-gray-400">{formData.scheduledEndTime}</span>
                  </div>
                </div>
              </div>

              {/* 4: Participantes */}
              <div className="border-l-4 border-yellow-500 pl-4">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500 text-white text-xs mr-2">4</span>
                  Participantes
                </h4>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300 block mb-1">Participantes Presentes:</span>
                    {formData.attendees ? (
                      <div className="text-gray-600 dark:text-gray-400 pl-4">
                        {formData.attendees.split('\n').filter(Boolean).map((name, idx) => (
                          <div key={idx}>• {name}</div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-500 dark:text-gray-500 italic pl-4">
                        Sin información proporcionada
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300 block mb-1">Destinatarios en Copia:</span>
                    {formData.ccParticipants ? (
                      <div className="text-gray-600 dark:text-gray-400 pl-4">
                        {formData.ccParticipants.split('\n').filter(Boolean).map((name, idx) => (
                          <div key={idx}>• {name}</div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-500 dark:text-gray-500 italic pl-4">
                        Sin información proporcionada
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 5: Información Adicional */}
              <div className="border-l-4 border-purple-500 pl-4">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-500 text-white text-xs mr-2">5</span>
                  Información Adicional
                </h4>
                {formData.additionalInfo ? (
                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">
                    {formData.additionalInfo}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-500 italic">
                    Sin información proporcionada
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer con botones */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between">
          <button
            onClick={currentStep === 0 ? onCancel : handlePrevious}
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
            {currentStep === steps.length - 1 ? 'Finalizar' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * NewMinute Component
 */
const NewMinute = () => {
  const handleNewMinute = () => {
    ModalManager.show({
      type: 'custom',
      title: 'Asistente de Preparación de Minutas',
      size: 'large',
      showFooter: false,
      content: (
        <NewMinuteForm
          onSubmit={(data) => {
            console.log('✅ Minuta creada:', data);

            ModalManager.success({
              title: 'Minuta Creada',
              message: 'La minuta ha sido creada exitosamente.'
            });
          }}
          onCancel={() => {
            // El modal se cierra automáticamente
          }}
        />
      )
    });
  };

  return (
    <ActionButton
      label="Nueva Minuta"
      onClick={handleNewMinute}
      variant="primary"
      icon={<FaPlus />}
    />
  );
};

export default NewMinute;