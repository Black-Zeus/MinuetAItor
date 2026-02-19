/**
 * useBreadcrumb.js
 * Deriva el breadcrumb desde la URL actual.
 * Fuente de verdad: sidebarConfig + STANDALONE_ROUTES + DYNAMIC_ROUTES.
 *
 * ✅ Funciona con cualquier tipo de navegación:
 *    sidebar click, link interno, URL directa, búsqueda, navegación programática.
 * ✅ Soporta 3 niveles: Inicio > Módulo padre > Submódulo hijo.
 * ✅ Soporta rutas dinámicas con parámetros: /minutes/process/:id
 * ✅ Agregar un módulo en sidebarConfig lo refleja automáticamente en el breadcrumb.
 */

import { useLocation } from 'react-router-dom';
import { SIDEBAR_MODULES } from '@config/sidebarConfig';

// ====================================
// RUTAS STANDALONE
// Páginas fijas que NO tienen entrada en sidebarConfig.
// ====================================
const STANDALONE_ROUTES = [
  { path: '/globalSearch',         name: 'Búsqueda Global', icon: 'FaMagnifyingGlass' },
  { path: '/settings/userProfile', name: 'Mi Perfil',       icon: 'FaPerson'          },
  { path: '/help',                 name: 'Ayuda & Soporte', icon: 'FaCircleInfo'      },
];

// ====================================
// RUTAS DINÁMICAS
// Rutas con parámetros (:id, :slug, etc.)
// pattern: regex que matchea el pathname
// parent: módulo padre (debe existir en sidebarConfig como path)
// name: label que se muestra en el breadcrumb
// ====================================
const DYNAMIC_ROUTES = [
  {
    pattern: /^\/minutes\/process\/[^/]+$/,
    name: 'Edición',
    icon: 'FaPenToSquare',
    parentPath: '/minutes',
  },
];

// ====================================
// HELPERS
// ====================================

/**
 * Busca un módulo por path exacto dentro de SIDEBAR_MODULES (con children).
 */
const findModuleByPath = (modules, pathname) => {
  for (const module of modules) {
    if (module.path === pathname) return { module, parent: null };
    if (module.children?.length) {
      for (const child of module.children) {
        if (child.path === pathname) return { module: child, parent: module };
      }
    }
  }
  return null;
};

/**
 * Busca un módulo por path exacto (solo módulos planos, sin children).
 * Usado para resolver el padre de rutas dinámicas.
 */
const findModuleFlat = (modules, path) => {
  for (const module of modules) {
    if (module.path === path) return module;
    if (module.children?.length) {
      for (const child of module.children) {
        if (child.path === path) return child;
      }
    }
  }
  return null;
};

/**
 * Convierte un array de segmentos en items para HeaderBreadcrumb.
 * El último segmento no lleva href (es la página activa).
 */
const buildItems = (segments) =>
  segments.map((seg, index) =>
    index < segments.length - 1
      ? { label: seg.name, href: seg.path || '#' }
      : { label: seg.name }
  );

// Segmento raíz, siempre el primero
const INICIO = { name: 'Inicio', path: '/dashboard' };

// ====================================
// HOOK
// ====================================
const useBreadcrumb = () => {
  const { pathname } = useLocation();

  // 1️⃣ Buscar en sidebarConfig — match exacto (módulos y submódulos)
  const found = findModuleByPath(SIDEBAR_MODULES, pathname);
  if (found) {
    const { module, parent } = found;
    const segments = parent
      ? [INICIO, parent, module]   // Inicio > Padre > Hijo
      : [INICIO, module];          // Inicio > Módulo

    return {
      title: module.name,
      items: buildItems(segments),
    };
  }

  // 2️⃣ Buscar en rutas dinámicas — match por regex
  const dynamic = DYNAMIC_ROUTES.find((r) => r.pattern.test(pathname));
  if (dynamic) {
    const segments = [INICIO];

    // Resolver módulo padre si tiene parentPath
    if (dynamic.parentPath) {
      const parentModule = findModuleFlat(SIDEBAR_MODULES, dynamic.parentPath);
      if (parentModule) segments.push(parentModule);
    }

    segments.push({ name: dynamic.name, path: pathname });

    return {
      title: dynamic.name,
      items: buildItems(segments),
    };
  }

  // 3️⃣ Buscar en rutas standalone — startsWith para tolerar query params
  const standalone = STANDALONE_ROUTES.find((r) => pathname.startsWith(r.path));
  if (standalone) {
    return {
      title: standalone.name,
      items: buildItems([INICIO, standalone]),
    };
  }

  // 4️⃣ Fallback al dashboard
  return {
    title: 'Inicio',
    items: buildItems([INICIO]),
  };
};

export default useBreadcrumb;