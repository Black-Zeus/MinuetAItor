/**
 * SidebarUser.jsx
 * Perfil de usuario en el footer del sidebar
 */

import React from 'react';

const SidebarUser = ({ 
  avatar,
  initials,
  name,
  role,
  onClick,
  tooltip,
  className = ''
}) => {
  const handleClick = (e) => {
    if (onClick) {
      e.preventDefault();
      onClick(e);
    }
  };

  return (
    <div 
      className={`sidebar-user ${className}`}
      id="sidebarUser"
      onClick={handleClick}
      data-tooltip={tooltip || 'Perfil de Usuario'}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="sidebar-user-avatar">
        {avatar ? (
          <img src={avatar} alt={name} />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      <div className="sidebar-user-info">
        <p className="sidebar-user-name">{name}</p>
        {role && <p className="sidebar-user-role">{role}</p>}
      </div>
    </div>
  );
};

export default SidebarUser;
