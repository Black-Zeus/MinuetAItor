/**
 * index.js
 * Exportaciones centralizadas de todos los componentes del sidebar
 */

// Componente principal
export { default as Sidebar } from './Sidebar';

// Subcomponentes
export { default as SidebarToggle } from './SidebarToggle';
export { default as SidebarBrand } from './SidebarBrand';
export { default as SidebarNav } from './SidebarNav';
export { default as SidebarMenuGroup } from './SidebarMenuGroup';
export { default as SidebarMenuItem } from './SidebarMenuItem';
export { default as SidebarFooter } from './SidebarFooter';

// Para retrocompatibilidad (si existían)
export { default as SidebarContainer } from './Sidebar';