/**
 * ClientStats.jsx
 * Componente de estadísticas de clientes
 * Muestra tarjetas con totales: Total, Activos, Prospectos, Inactivos
 */

import React from 'react';
import Icon from '@/components/ui/icon/iconManager';

const TXT_TITLE = "text-gray-900 dark:text-white";
const TXT_META = "text-gray-500 dark:text-gray-400";

const StatsCard = ({ icon, label, value, color }) => {
  const colorClasses = {
    primary: 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
    gray: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 transition-theme">
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm ${TXT_META}`}>{label}</p>
          <p className={`text-2xl font-bold ${TXT_TITLE} mt-1 transition-theme`}>{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon name={icon} className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

const ClientStats = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <StatsCard
        icon="FaUsers"
        label="Total Clientes"
        value={stats.total}
        color="primary"
      />
      <StatsCard
        icon="FaCheckCircle"
        label="Activos"
        value={stats.activos}
        color="green"
      />
      <StatsCard
        icon="FaStar"
        label="Prospectos"
        value={stats.prospectos}
        color="yellow"
      />
      <StatsCard
        icon="FaPauseCircle"
        label="Inactivos"
        value={stats.inactivos}
        color="gray"
      />
    </div>
  );
};

export default ClientStats;