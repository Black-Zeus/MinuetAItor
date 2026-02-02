/**
 * HeaderDivider.jsx
 * Línea divisoria vertical - 100% Tailwind
 */

import React from 'react';

const HeaderDivider = ({ className = '' }) => {
  return (
    <div className={`h-8 w-px bg-gray-200 dark:bg-gray-700 ${className}`}></div>
  );
};

export default HeaderDivider;