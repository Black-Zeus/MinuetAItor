import ActionButton from "./ActionButton"
import { FaPlus } from "react-icons/fa";
import clientsData from '@/data/dataClientes.json';

// Imports necesarios
import ModalManager from '@/components/ui/modal';

// Preparar opciones de clientes
const clientOptions = clientsData.clients.map(client => ({
  value: client.id.toString(),
  label: `${client.name} - ${client.company}`
}));

// Opciones de proyectos (hardcoded por ahora)
const projectOptions = [
  { value: '1', label: 'Proyecto Alpha - Implementación CRM' },
  { value: '2', label: 'Proyecto Beta - Migración Cloud' },
  { value: '3', label: 'Proyecto Gamma - Sistema de Gestión' },
  { value: '4', label: 'Proyecto Delta - Automatización de Procesos' },
  { value: '5', label: 'Proyecto Epsilon - Plataforma E-learning' }
];

// Función handler (debe ser async)
const showWizardModal = async () => {
  try {
    const data = await ModalManager.wizard({
      title: 'Asistente de Preparación de Minutas',
      steps: [
        {
          title: 'Información General',
          description: 'Seleccione el cliente y proyecto, y suba los archivos necesarios',
          fields: [
            {
              name: 'client',
              label: 'Cliente',
              type: 'select',
              required: true,
              options: clientOptions,
              placeholder: 'Seleccione un cliente'
            },
            {
              name: 'project',
              label: 'Proyecto',
              type: 'select',
              required: true,
              options: projectOptions,
              placeholder: 'Seleccione un proyecto'
            },
            {
              name: 'transcription',
              label: 'Transcripción',
              type: 'file',
              required: true,
              accept: '.txt,.doc,.docx,.pdf',
              placeholder: 'Seleccione el archivo de transcripción'
            },
            {
              name: 'summary',
              label: 'Resumen',
              type: 'file',
              required: false,
              accept: '.txt,.doc,.docx,.pdf',
              placeholder: 'Seleccione el archivo de resumen (opcional)'
            }
          ]
        },
        {
          title: 'Fechas y Horarios',
          description: 'Configure las fechas y horarios de la reunión',
          fields: [
            {
              name: 'scheduledDate',
              label: 'Fecha Programada',
              type: 'date',
              required: true
            },
            {
              name: 'scheduledStartTime',
              label: 'Hora Inicio Programada',
              type: 'time',
              required: true
            },
            {
              name: 'actualStartTime',
              label: 'Hora Inicio Real',
              type: 'time',
              required: true
            },
            {
              name: 'scheduledEndTime',
              label: 'Hora Término Programada',
              type: 'time',
              required: true
            }
          ]
        },
        {
          title: 'Participantes',
          description: 'Agregue participantes adicionales que no fueron detectados automáticamente',
          fields: [
            {
              name: 'attendees',
              label: 'Participantes Presentes Adicionales',
              type: 'textarea',
              required: false,
              placeholder: 'Ingrese nombres de participantes adicionales (uno por línea)\nEjemplo: Juan Pérez\nMaría González',
              rows: 5
            },
            {
              name: 'ccParticipants',
              label: 'Participantes con Copia',
              type: 'textarea',
              required: false,
              placeholder: 'Ingrese los nombres de los participantes en copia (uno por línea)',
              rows: 5
            }
          ]
        },
        {
          title: 'Información Adicional',
          description: 'Agregue cualquier información extra relevante',
          fields: [
            {
              name: 'additionalInfo',
              label: 'Información Adicional',
              type: 'textarea',
              required: false,
              placeholder: 'Ingrese información adicional sobre la reunión',
              rows: 6
            }
          ]
        },
        {
          title: 'Confirmación',
          description: 'Revise la información ingresada antes de crear la minuta',
          type: 'summary',
          fields: []
        }
      ]
    });
    
    console.log('Minuta preparada:', data);
      
    
  } catch (error) {
    console.log('Asistente cancelado');
  }
};

const NewMinute = () => {
    return (
        <ActionButton
            label="Nueva Minuta"
            onClick={showWizardModal}
            variant="primary"
            icon={<FaPlus />}
        />
    )
}

export default NewMinute