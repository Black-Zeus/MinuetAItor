import React from 'react';
import SidebarMenuItem from './SidebarMenuItem';

const SidebarMenuGroup = ({
  section,
  modules = [],
  isCollapsed = false,
  activePath = '/',
  onModuleClick = () => {}
}) => {
  if (!modules || modules.length === 0) return null;

  return (
    <div className="mb-6">
      {!isCollapsed && section?.title && (
        <div className="px-6 py-2 text-xs font-semibold uppercase tracking-wider text-white/60">
          {section.title}
        </div>
      )}

      <div className="space-y-0.5">
        {modules.map((module) => (
          <SidebarMenuItem
            key={module.id}
            module={module}
            isCollapsed={isCollapsed}
            activePath={activePath}
            onClick={onModuleClick}
          />
        ))}
      </div>
    </div>
  );
};

export default SidebarMenuGroup;
