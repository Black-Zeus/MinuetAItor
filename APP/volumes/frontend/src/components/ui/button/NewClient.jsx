/**
 * NewClient.jsx
 * Botón con modal wizard para crear nuevos clientes
 */

import React from 'react';
import ActionButton from '@/components/ui/button/ActionButton';
import { FaPlus } from 'react-icons/fa';
import { ModalManager } from '@/components/ui/modal';

// Función handler para el wizard de creación de cliente
const showClientWizard = async () => {
  try {
    const data = await ModalManager.wizard({
      title: 'Crear Nuevo Cliente',
      steps: [
        {
          title: 'Información Personal',
          description: 'Datos básicos del contacto principal',
          fields: [
            {
              name: 'name',
              label: 'Nombre Completo',
              type: 'text',
              required: true,
              placeholder: 'Ej: Carlos Rodríguez'
            },
            {
              name: 'email',
              label: 'Email',
              type: 'email',
              required: true,
              placeholder: 'carlos.rodriguez@empresa.com'
            },
            {
              name: 'phone',
              label: 'Teléfono',
              type: 'tel',
              required: false,
              placeholder: '+56 9 1234 5678'
            },
            {
              name: 'position',
              label: 'Cargo',
              type: 'text',
              required: false,
              placeholder: 'Ej: Gerente de Proyectos'
            }
          ]
        },
        {
          title: 'Información de la Empresa',
          description: 'Datos de la organización del cliente',
          fields: [
            {
              name: 'company',
              label: 'Nombre de la Empresa',
              type: 'text',
              required: true,
              placeholder: 'Ej: TechCorp Chile'
            },
            {
              name: 'industry',
              label: 'Industria',
              type: 'select',
              required: false,
              options: [
                { value: '', label: 'Seleccionar industria...' },
                { value: 'tecnologia', label: 'Tecnología' },
                { value: 'finanzas', label: 'Finanzas' },
                { value: 'salud', label: 'Salud' },
                { value: 'educacion', label: 'Educación' },
                { value: 'retail', label: 'Retail' },
                { value: 'manufactura', label: 'Manufactura' },
                { value: 'servicios', label: 'Servicios' },
                { value: 'construccion', label: 'Construcción' },
                { value: 'logistica', label: 'Logística' },
                { value: 'otra', label: 'Otra' }
              ]
            },
            {
              name: 'address',
              label: 'Dirección',
              type: 'text',
              required: false,
              placeholder: 'Av. Apoquindo 4501, Las Condes, Santiago'
            },
            {
              name: 'website',
              label: 'Sitio Web',
              type: 'url',
              required: false,
              placeholder: 'https://www.empresa.com'
            }
          ]
        },
        {
          title: 'Estado y Clasificación',
          description: 'Defina el estado inicial del cliente',
          fields: [
            {
              name: 'status',
              label: 'Estado',
              type: 'select',
              required: true,
              options: [
                { value: 'prospecto', label: 'Prospecto' },
                { value: 'activo', label: 'Activo' },
                { value: 'inactivo', label: 'Inactivo' }
              ]
            },
            {
              name: 'priority',
              label: 'Prioridad',
              type: 'select',
              required: false,
              options: [
                { value: '', label: 'Sin prioridad definida' },
                { value: 'baja', label: 'Baja' },
                { value: 'media', label: 'Media' },
                { value: 'alta', label: 'Alta' },
                { value: 'critica', label: 'Crítica' }
              ]
            },
            {
              name: 'source',
              label: 'Fuente de Contacto',
              type: 'select',
              required: false,
              options: [
                { value: '', label: 'Seleccionar fuente...' },
                { value: 'referido', label: 'Referido' },
                { value: 'evento', label: 'Evento/Conferencia' },
                { value: 'web', label: 'Sitio Web' },
                { value: 'rrss', label: 'Redes Sociales' },
                { value: 'email', label: 'Email Marketing' },
                { value: 'llamada', label: 'Llamada en Frío' },
                { value: 'otro', label: 'Otro' }
              ]
            }
          ]
        },
        {
          title: 'Notas y Observaciones',
          description: 'Información adicional relevante sobre el cliente',
          fields: [
            {
              name: 'notes',
              label: 'Notas Generales',
              type: 'textarea',
              required: false,
              placeholder: 'Agregue cualquier información relevante sobre el cliente, expectativas, intereses especiales, etc.',
              rows: 6
            },
            {
              name: 'tags',
              label: 'Etiquetas',
              type: 'text',
              required: false,
              placeholder: 'Ej: VIP, Contrato anual, Zona norte (separadas por coma)'
            }
          ]
        },
        {
          title: 'Confirmación',
          description: 'Revise la información del cliente antes de guardar',
          type: 'summary',
          fields: []
        }
      ]
    });
    
    console.log('Nuevo cliente creado:', data);
    
    // Aquí procesarías la creación del cliente
    // Por ejemplo, enviarlo al backend:
    // await createClient(data);
    
    // Mostrar notificación de éxito (si tienes sistema de notificaciones)
    // NotificationManager.success('Cliente creado exitosamente');
    
  } catch (error) {
    console.log('Creación de cliente cancelada');
  }
};

const NewClient = () => {
  return (
    <ActionButton
      label="Nuevo Cliente"
      onClick={showClientWizard}
      variant="primary"
      icon={<FaPlus />}
    />
  );
};

export default NewClient;