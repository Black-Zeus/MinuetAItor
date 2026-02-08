/**
 * NewProject.jsx
 * Botón para crear un nuevo proyecto
 * Abre modal con formulario de creación
 */

import React from 'react';
import { ModalManager } from '@/components/ui/modal';
import ActionButton from './ActionButton';
import { FaPlus } from 'react-icons/fa';

const NewProject = () => {
  const handleNewProject = async () => {
    try {
      const data = await ModalManager.form({
        title: 'Crear Nuevo Proyecto',
        fields: [
          // Información básica
          {
            name: 'name',
            label: 'Nombre del Proyecto',
            type: 'text',
            required: true,
            placeholder: 'Ej: Desarrollo Web Corporativo'
          },
          {
            name: 'client',
            label: 'Cliente',
            type: 'text',
            required: true,
            placeholder: 'Ej: ACME Corporation'
          },
          {
            name: 'description',
            label: 'Descripción',
            type: 'textarea',
            placeholder: 'Describe brevemente el proyecto...',
            rows: 4
          },
          // Estado
          {
            name: 'status',
            label: 'Estado',
            type: 'select',
            required: true,
            defaultValue: 'activo',
            options: [
              { value: 'activo', label: 'Activo' },
              { value: 'inactivo', label: 'Inactivo' }
            ]
          },
          // Tags
          {
            name: 'tags',
            label: 'Etiquetas',
            type: 'text',
            placeholder: 'Ej: Web, CMS, Backend (separadas por coma)'
          }
        ],
        submitText: 'Crear Proyecto',
        cancelText: 'Cancelar'
      });

      // Aquí harías la llamada al backend para crear el proyecto
      console.log('[NewProject] Nuevo proyecto:', data);
      
      // Mostrar notificación de éxito
      ModalManager.show({
        type: 'success',
        title: 'Proyecto Creado',
        message: `El proyecto "${data.name}" ha sido creado exitosamente.`,
        autoClose: 3000
      });

    } catch (error) {
      console.log('[NewProject] Creación cancelada');
    }
  };

  return (
     <ActionButton
          label="Nuevo Cliente"
          onClick={handleNewProject}
          variant="primary"
          icon={<FaPlus />}
        />

  );
};

export default NewProject;