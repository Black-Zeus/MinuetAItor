/**
 * HeaderSearch.jsx
 * Componente de búsqueda con input e icono - 100% Tailwind
 */

import React from 'react';
import Icon from '@components/ui/icon/iconManager';

const HeaderSearch = ({ 
  value = '',
  onChange,
  onSubmit,
  placeholder = 'Buscar...',
  className = '' 
}) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(value);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`relative hidden md:block ${className}`}>
      <Icon 
        name="FaMagnifyingGlass" 
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
      />
      <input
        type="text"
        value={value}
        onChange={onChange}
        className="
          w-64 pl-10 pr-4 py-2
          bg-gray-100 dark:bg-gray-700
          border border-gray-200 dark:border-gray-600
          rounded-lg text-sm
          text-gray-800 dark:text-gray-200
          placeholder-gray-500 dark:placeholder-gray-400
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
          transition-all
        "
        placeholder={placeholder}
        aria-label="Buscar"
      />
    </form>
  );
};

export default HeaderSearch;
