/**
 * ClientGrid.jsx
 * Grid de clientes con estado vacío
 * Renderiza múltiples ClientCard o muestra EmptyState
 */

import React from 'react';
import Icon from '@/components/ui/icon/iconManager';
import ClientCard from './ClientCard';

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_META = "text-gray-500 dark:text-gray-400";

const EmptyState = ({ hasFilters }) => {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
        <Icon name="FaUsers" className={`${TXT_META} w-8 h-8`} />
      </div>
      <h3 className={`text-lg font-medium ${TXT_TITLE} mb-2 transition-theme`}>
        No se encontraron clientes
      </h3>
      <p className={`${TXT_META}`}>
        {hasFilters ? 'Intenta ajustar los filtros' : 'Crea un nuevo cliente para comenzar'}
      </p>
    </div>
  );
};

const ClientGrid = ({ clients, onUpdate, onDelete, hasFilters }) => {
  if (clients.length === 0) {
    return <EmptyState hasFilters={hasFilters} />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {clients.map((client) => (
        <ClientCard
          key={client.id}
          client={client}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

export default ClientGrid;