/**
 * modules/index.js
 * Punto central de todas las rutas — MinuetAItor
 *
 * Orden de prioridad:
 *  1. Auth (públicas) — primero para que el guard PublicRoute actúe antes
 *  2. Core (dashboard, búsqueda)
 *  3. Minutes (módulo principal)
 *  4. Management (clientes, proyectos, equipos)
 *  5. Analytics + Reports
 *  6. Settings + Perfil
 *  7. Demo (última prioridad)
 */

import { authRoutes }       from "./auth.routes";
import { coreRoutes }       from "./core.routes";
import { minutesRoutes }    from "./minutes.routes";
import { managementRoutes } from "./management.routes";
import analyticsRoutes      from "./analytics.routes";
import { settingsRoutes }   from "./settings.routes";
import { demoRoutes }       from "./demo.routes";

export const allRoutes = [
  ...authRoutes,
  ...coreRoutes,
  ...minutesRoutes,
  ...managementRoutes,
  ...analyticsRoutes,
  ...settingsRoutes,
  ...demoRoutes,
];

// Re-exports individuales (para imports selectivos)
export { authRoutes }       from "./auth.routes";
export { coreRoutes }       from "./core.routes";
export { minutesRoutes }    from "./minutes.routes";
export { managementRoutes } from "./management.routes";
export { settingsRoutes }   from "./settings.routes";
export { demoRoutes }       from "./demo.routes";

export default allRoutes;