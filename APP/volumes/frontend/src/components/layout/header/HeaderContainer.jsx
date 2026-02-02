/**
 * HeaderContainer.jsx
 * Componente contenedor principal del header - 100% Tailwind
 */

import React from 'react';

const HeaderContainer = ({ children, className = '' }) => {
  return (
    <header 
      className={`
        flex items-center justify-between
        h-16 px-6 bg-white border-b border-gray-200
        dark:bg-gray-800 dark:border-gray-700
        ${className}
      `}
      id="header"
    >
      {children}
    </header>
  );
};

export default HeaderContainer;
