/**
 * types/InteractiveModals.jsx
 * Modales interactivos: confirm, form, wizard, login
 * Modales que requieren interacción del usuario y manejo de datos
 */

import React, { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { 
  MODAL_CLASSES,
  getModalConfig 
} from '../modalTypes.js';

// ====================================
// MODAL DE CONFIRMACIÓN
// ====================================

const ConfirmModal = ({
  type = 'confirm',
  title,
  message,
  content,
  buttons,
  variant = 'danger', // danger, warning, info
  onClose,
  onConfirm,
  onCancel
}) => {
  const config = getModalConfig(type);
  const IconComponent = config.icon;

  // Estilos según la variante
  const variantStyles = {
    danger: {
      icon: 'text-red-500 dark:text-red-400',
      confirmButton: MODAL_CLASSES.button.danger
    },
    warning: {
      icon: 'text-yellow-500 dark:text-yellow-400',
      confirmButton: MODAL_CLASSES.button.warning
    },
    info: {
      icon: 'text-blue-500 dark:text-blue-400',
      confirmButton: MODAL_CLASSES.button.primary
    }
  };

  const styles = variantStyles[variant] || variantStyles.danger;

  return (
    <>
      {/* Body */}
      <div className={MODAL_CLASSES.bodyContent}>
        <div className="flex items-start space-x-4">
          {/* Icono */}
          <div className="flex-shrink-0">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              variant === 'danger' ? 'bg-red-100 dark:bg-red-900/20' :
              variant === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/20' :
              'bg-blue-100 dark:bg-blue-900/20'
            }`}>
              <IconComponent className={`w-6 h-6 ${styles.icon}`} />
            </div>
          </div>

          {/* Contenido */}
          <div className="flex-1 min-w-0">
            {message && (
              <p className="text-gray-900 dark:text-gray-100 text-base leading-relaxed">
                {message}
              </p>
            )}
            
            {content && (
              <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                {typeof content === 'string' ? (
                  <p>{content}</p>
                ) : (
                  content
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={MODAL_CLASSES.footer}>
        <div className={MODAL_CLASSES.footerButtons}>
          <button
            onClick={onCancel || onClose}
            className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.secondary}`}
          >
            {buttons?.cancel || 'Cancelar'}
          </button>
          <button
            onClick={onConfirm}
            className={`${MODAL_CLASSES.button.base} ${styles.confirmButton}`}
          >
            {buttons?.confirm || 'Confirmar'}
          </button>
        </div>
      </div>
    </>
  );
};

// ====================================
// MODAL DE FORMULARIO
// ====================================

const FormModal = ({
  type = 'form',
  title,
  message,
  fields = [],
  data = {},
  buttons,
  validation = {},
  onClose,
  onSubmit,
  onChange
}) => {
  const [formData, setFormData] = useState(data);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Manejar cambios en los campos
  const handleInputChange = useCallback((name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Limpiar error del campo cuando el usuario empiece a escribir
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
    
    // Callback externo
    onChange?.(name, value, formData);
  }, [onChange, formData, errors]);

  // Validar formulario
  const validateForm = useCallback(() => {
    const newErrors = {};
    
    fields.forEach(field => {
      const value = formData[field.name];
      
      // Campo requerido
      if (field.required && (!value || value.toString().trim() === '')) {
        newErrors[field.name] = `${field.label} es requerido`;
        return;
      }
      
      // Validación por tipo
      if (value && field.type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          newErrors[field.name] = 'Email inválido';
        }
      }
      
      // Validación personalizada
      if (validation[field.name] && value) {
        const customError = validation[field.name](value, formData);
        if (customError) {
          newErrors[field.name] = customError;
        }
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [fields, formData, validation]);

  // Manejar envío
  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();
    
    if (isSubmitting) return;
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit?.(formData);
    } catch (error) {
      console.error('Error submitting form:', error);
      // Aquí podrías mostrar un error global
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSubmit, isSubmitting, validateForm]);

  return (
    <>
      {/* Body */}
      <div className={MODAL_CLASSES.bodyContent}>
        {message && (
          <div className="mb-6 text-gray-600 dark:text-gray-400">
            <p>{message}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {fields.map((field, index) => (
            <div key={field.name || index} className={MODAL_CLASSES.form.group}>
              <label className={MODAL_CLASSES.form.label}>
                {field.label}
                {field.required && <span className={MODAL_CLASSES.form.required}>*</span>}
              </label>
              
              {/* Textarea */}
              {field.type === 'textarea' ? (
                <textarea
                  value={formData[field.name] || ''}
                  onChange={(e) => handleInputChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  rows={field.rows || 3}
                  className={`${MODAL_CLASSES.form.input} ${
                    errors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''
                  }`}
                />
              ) : 
              
              /* Select */
              field.type === 'select' ? (
                <select
                  value={formData[field.name] || ''}
                  onChange={(e) => handleInputChange(field.name, e.target.value)}
                  className={`${MODAL_CLASSES.form.input} ${
                    errors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''
                  }`}
                >
                  <option value="">{field.placeholder || `Seleccionar ${field.label}`}</option>
                  {field.options?.map((option, idx) => (
                    <option key={idx} value={option.value || option}>
                      {option.label || option}
                    </option>
                  ))}
                </select>
              ) : 
              
              /* Input regular */
              (
                <input
                  type={field.type || 'text'}
                  value={formData[field.name] || ''}
                  onChange={(e) => handleInputChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  className={`${MODAL_CLASSES.form.input} ${
                    errors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''
                  }`}
                />
              )}
              
              {/* Error del campo */}
              {errors[field.name] && (
                <p className={MODAL_CLASSES.form.error}>
                  {errors[field.name]}
                </p>
              )}
              
              {/* Ayuda del campo */}
              {field.help && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {field.help}
                </p>
              )}
            </div>
          ))}
        </form>
      </div>

      {/* Footer */}
      <div className={MODAL_CLASSES.footer}>
        <div className={MODAL_CLASSES.footerButtons}>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.secondary}`}
          >
            {buttons?.cancel || 'Cancelar'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.primary} flex items-center`}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isSubmitting ? 'Guardando...' : (buttons?.submit || 'Guardar')}
          </button>
        </div>
      </div>
    </>
  );
};

// ====================================
// MODAL DE WIZARD (ASISTENTE)
// ====================================

const WizardModal = ({
  type = 'wizard',
  title,
  steps = [],
  data = {},
  buttons,
  validation = {},
  onClose,
  onComplete,
  onStepChange
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState(data);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepErrors, setStepErrors] = useState({});

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  // Manejar cambios en los campos
  const handleInputChange = useCallback((name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Limpiar error del campo
    if (stepErrors[name]) {
      setStepErrors(prev => ({ ...prev, [name]: null }));
    }
  }, [stepErrors]);

  // Validar paso actual
  const validateCurrentStep = useCallback(() => {
    if (!currentStepData?.fields) return true;
    
    const errors = {};
    
    currentStepData.fields.forEach(field => {
      const value = formData[field.name];
      
      if (field.required && (!value || value.toString().trim() === '')) {
        errors[field.name] = `${field.label} es requerido`;
        return;
      }
      
      if (validation[field.name] && value) {
        const customError = validation[field.name](value, formData);
        if (customError) {
          errors[field.name] = customError;
        }
      }
    });
    
    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  }, [currentStepData, formData, validation]);

  // Ir al siguiente paso
  const handleNext = useCallback(() => {
    if (!validateCurrentStep()) return;
    
    if (isLastStep) {
      handleComplete();
    } else {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      onStepChange?.(nextStep, formData);
    }
  }, [currentStep, isLastStep, validateCurrentStep, formData, onStepChange]);

  // Ir al paso anterior
  const handlePrevious = useCallback(() => {
    if (!isFirstStep) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      onStepChange?.(prevStep, formData);
    }
  }, [currentStep, isFirstStep, formData, onStepChange]);

  // Completar wizard
  const handleComplete = useCallback(async () => {
    if (isSubmitting) return;
    
    if (!validateCurrentStep()) return;
    
    setIsSubmitting(true);
    try {
      await onComplete?.(formData);
    } catch (error) {
      console.error('Error completing wizard:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onComplete, isSubmitting, validateCurrentStep]);

  return (
    <>
      {/* Body */}
      <div className={MODAL_CLASSES.bodyContent}>
        {/* Indicador de pasos */}
        <div className="flex justify-between items-center mb-8 relative">
          {/* Línea de progreso */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200 dark:bg-gray-700"></div>
          
          {steps.map((step, index) => (
            <div key={index} className="flex flex-col items-center relative bg-white dark:bg-gray-900 px-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
                index < currentStep 
                  ? 'bg-green-500 border-green-500 text-white' 
                  : index === currentStep
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
              }`}>
                {index < currentStep ? '✓' : index + 1}
              </div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-2 text-center max-w-20">
                {step.title}
              </div>
            </div>
          ))}
        </div>

        {/* Contenido del paso actual */}
        {currentStepData && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {currentStepData.title}
              </h3>
              {currentStepData.description && (
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {currentStepData.description}
                </p>
              )}
            </div>
            
            {/* Campos del paso */}
            {currentStepData.fields?.map((field, index) => (
              <div key={field.name || index} className={MODAL_CLASSES.form.group}>
                <label className={MODAL_CLASSES.form.label}>
                  {field.label}
                  {field.required && <span className={MODAL_CLASSES.form.required}>*</span>}
                </label>
                
                {field.type === 'textarea' ? (
                  <textarea
                    value={formData[field.name] || ''}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    rows={field.rows || 3}
                    className={`${MODAL_CLASSES.form.input} ${
                      stepErrors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''
                    }`}
                  />
                ) : field.type === 'select' ? (
                  <select
                    value={formData[field.name] || ''}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    className={`${MODAL_CLASSES.form.input} ${
                      stepErrors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''
                    }`}
                  >
                    <option value="">{field.placeholder || `Seleccionar ${field.label}`}</option>
                    {field.options?.map((option, idx) => (
                      <option key={idx} value={option.value || option}>
                        {option.label || option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type || 'text'}
                    value={formData[field.name] || ''}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    className={`${MODAL_CLASSES.form.input} ${
                      stepErrors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''
                    }`}
                  />
                )}
                
                {stepErrors[field.name] && (
                  <p className={MODAL_CLASSES.form.error}>
                    {stepErrors[field.name]}
                  </p>
                )}
              </div>
            ))}

            {/* Contenido personalizado del paso */}
            {currentStepData.content && (
              <div className="mt-4">
                {currentStepData.content}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={MODAL_CLASSES.footer}>
        <div className="flex justify-between w-full">
          {/* Botón anterior */}
          <div>
            {!isFirstStep && (
              <button
                onClick={handlePrevious}
                disabled={isSubmitting}
                className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.secondary} flex items-center`}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                {buttons?.previous || 'Anterior'}
              </button>
            )}
          </div>
          
          {/* Botones de acción */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.secondary}`}
            >
              {buttons?.cancel || 'Cancelar'}
            </button>
            
            {isLastStep ? (
              <button
                onClick={handleComplete}
                disabled={isSubmitting}
                className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.success} flex items-center`}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isSubmitting ? 'Finalizando...' : (buttons?.complete || 'Finalizar')}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.primary} flex items-center`}
              >
                {buttons?.next || 'Siguiente'}
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// ====================================
// MODAL DE LOGIN
// ====================================

const LoginModal = ({
  type = 'login',
  title,
  message,
  fields = [],
  buttons,
  showRegisterLink = true,
  showForgotPassword = true,
  onClose,
  onSubmit,
  onRegister,
  onForgotPassword
}) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    rememberMe: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  // Campos por defecto si no se proporcionan
  const defaultFields = [
    {
      name: 'username',
      label: 'Usuario o Email',
      type: 'text',
      placeholder: 'usuario@empresa.com',
      required: true
    },
    {
      name: 'password',
      label: 'Contraseña',
      type: 'password',
      placeholder: '••••••••',
      required: true
    }
  ];

  const formFields = fields.length > 0 ? fields : defaultFields;

  const handleInputChange = useCallback((name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  }, [errors]);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();
    
    if (isSubmitting) return;
    
    // Validación básica
    const newErrors = {};
    formFields.forEach(field => {
      if (field.required && !formData[field.name]) {
        newErrors[field.name] = `${field.label} es requerido`;
      }
    });
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onSubmit?.(formData);
    } catch (error) {
      console.error('Error logging in:', error);
      setErrors({ general: 'Error al iniciar sesión. Verifique sus credenciales.' });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSubmit, isSubmitting, formFields]);

  return (
    <>
      {/* Body */}
      <div className={MODAL_CLASSES.bodyContent}>
        {message && (
          <div className="mb-6 text-gray-600 dark:text-gray-400">
            <p>{message}</p>
          </div>
        )}

        {/* Error general */}
        {errors.general && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">{errors.general}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {formFields.map((field, index) => (
            <div key={field.name || index} className={MODAL_CLASSES.form.group}>
              <label className={MODAL_CLASSES.form.label}>
                {field.label}
                {field.required && <span className={MODAL_CLASSES.form.required}>*</span>}
              </label>
              
              <div className="relative">
                <input
                  type={field.name === 'password' ? (showPassword ? 'text' : 'password') : field.type}
                  value={formData[field.name] || ''}
                  onChange={(e) => handleInputChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  className={`${MODAL_CLASSES.form.input} ${
                    field.name === 'password' ? 'pr-10' : ''
                  } ${errors[field.name] ? 'border-red-300 dark:border-red-600 focus:ring-red-500' : ''}`}
                />
                
                {/* Toggle de mostrar/ocultar contraseña */}
                {field.name === 'password' && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
              
              {errors[field.name] && (
                <p className={MODAL_CLASSES.form.error}>
                  {errors[field.name]}
                </p>
              )}
            </div>
          ))}

          {/* Recordarme y Olvidé contraseña */}
          <div className="flex items-center justify-between py-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.rememberMe}
                onChange={(e) => handleInputChange('rememberMe', e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 focus:ring-offset-0"
              />
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Recordarme</span>
            </label>
            
            {showForgotPassword && (
              <button 
                type="button"
                onClick={onForgotPassword}
                className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500"
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}
          </div>
        </form>

        {/* Link de registro */}
        {showRegisterLink && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-6">
            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
              ¿No tienes cuenta?{' '}
              <button 
                onClick={onRegister}
                className="text-primary-600 dark:text-primary-400 hover:text-primary-500 font-medium"
              >
                Regístrate aquí
              </button>
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={MODAL_CLASSES.footer}>
        <div className={MODAL_CLASSES.footerButtons}>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.secondary}`}
          >
            {buttons?.cancel || 'Cancelar'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`${MODAL_CLASSES.button.base} ${MODAL_CLASSES.button.primary} flex items-center`}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isSubmitting ? 'Iniciando...' : (buttons?.submit || 'Iniciar Sesión')}
          </button>
        </div>
      </div>
    </>
  );
};

// ====================================
// FUNCIONES RENDER (WRAPPERAS)
// ====================================

export const renderConfirmModal = (props) => <ConfirmModal {...props} />;
export const renderFormModal = (props) => <FormModal {...props} />;
export const renderWizardModal = (props) => <WizardModal {...props} />;
export const renderLoginModal = (props) => <LoginModal {...props} />;

// ====================================
// MAPEO DE FUNCIONES RENDER
// ====================================

export const interactiveModalRenderers = {
  confirm: renderConfirmModal,
  form: renderFormModal,
  wizard: renderWizardModal,
  login: renderLoginModal
};

// ====================================
// EXPORT POR DEFECTO
// ====================================

export default interactiveModalRenderers;