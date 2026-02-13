import Icon from '@/components/ui/icon/iconManager';

const TeamsStats = ({ stats }) => {
  const statCards = [
    {
      label: 'Total Usuarios',
      value: stats.total,
      valueColor: 'text-gray-900',
      icon: 'FaUsers',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600'
    },
    {
      label: 'Activos',
      value: stats.active,
      valueColor: 'text-green-600',
      icon: 'FaUserCheck',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600'
    },
    {
      label: 'Inactivos',
      value: stats.inactive,
      valueColor: 'text-gray-400',
      icon: 'FaUserSlash',
      iconBg: 'bg-gray-100',
      iconColor: 'text-gray-400'
    },
    {
      label: 'Administradores',
      value: stats.admins,
      valueColor: 'text-purple-600',
      icon: 'FaUserShield',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600'
    }
  ];

  return (
    <div className="grid grid-cols-4 gap-4 mt-6">
      {statCards.map((stat, index) => (
        <div key={index} className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.valueColor}`}>{stat.value}</p>
            </div>
            <div className={`w-12 h-12 ${stat.iconBg} rounded-lg flex items-center justify-center`}>
              <Icon name={stat.icon} className={`${stat.iconColor} text-xl`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TeamsStats;