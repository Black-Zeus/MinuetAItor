import React from 'react';
import Icon from '@components/ui/icon/iconManager';

const isPathActive = (activePath = '/', itemPath = '') => {
  if (!itemPath) return false;
  if (itemPath === '/') return activePath === '/';
  return activePath === itemPath || activePath.startsWith(`${itemPath}/`);
};

const SidebarMenuItem = ({
  module,
  isCollapsed = false,
  activePath = '/',
  onClick = () => {}
}) => {
  if (!module) return null;

  const hasChildren = Array.isArray(module.children) && module.children.length > 0;
  const isSelfActive = isPathActive(activePath, module.path);
  const isAnyChildActive = hasChildren
    ? module.children.some((c) => isPathActive(activePath, c.path))
    : false;

  const isActive = isSelfActive || isAnyChildActive;

  const [isOpen, setIsOpen] = React.useState(isAnyChildActive);

  React.useEffect(() => {
    if (isAnyChildActive) setIsOpen(true);
  }, [isAnyChildActive]);

  const handleClick = (e) => {
    e.preventDefault();

    if (hasChildren && !module.path) {
      setIsOpen((v) => !v);
      return;
    }

    onClick(module);
  };

  return (
    <div>
      <a
        href={module.path || '#'}
        className={
          `flex items-center px-6 py-3 text-white/90 ` +
          `hover:bg-white/10 transition-colors cursor-pointer ` +
          `${isActive ? 'bg-white/15 border-l-4 border-primary-500' : ''} ` +
          `${isCollapsed ? 'justify-center' : ''}`
        }
        onClick={handleClick}
        title={module.name}
        aria-label={module.name}
      >
        <Icon name={module.icon} className="w-5 h-5 flex-shrink-0" />

        {!isCollapsed && (
          <>
            <span className="ml-3 font-medium flex-1">{module.name}</span>

            {hasChildren && (
              <span
                className={
                  `text-white/70 transition-transform ` +
                  `${isOpen ? 'rotate-90' : 'rotate-0'}`
                }
              >
                ▸
              </span>
            )}
          </>
        )}
      </a>

      {hasChildren && !isCollapsed && isOpen && (
        <div className="ml-4 mt-1 space-y-0.5">
          {module.children
            .slice()
            .sort((a, b) => (a.order || 999) - (b.order || 999))
            .map((child) => {
              const childActive = isPathActive(activePath, child.path);
              return (
                <a
                  key={child.id}
                  href={child.path || '#'}
                  className={
                    `flex items-center px-6 py-2 text-sm text-white/80 ` +
                    `hover:bg-white/10 transition-colors cursor-pointer rounded-md ` +
                    `${childActive ? 'bg-white/10' : ''}`
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    onClick(child);
                  }}
                  title={child.name}
                  aria-label={child.name}
                >
                  <Icon name={child.icon} className="w-4 h-4 flex-shrink-0" />
                  <span className="ml-3 font-medium">{child.name}</span>
                </a>
              );
            })}
        </div>
      )}
    </div>
  );
};

export default SidebarMenuItem;
