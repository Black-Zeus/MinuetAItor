# AGENTS.md

## Ambito
Este archivo aplica a `APP/volumes/frontend`.

El frontend corre dentro del contenedor `frontend` con Vite. No asumir Node, npm ni build local fuera de Docker.

## Estructura vigente
- `src/pages`: pantallas por dominio
- `src/components`: componentes compartidos y layout
- `src/services`: consumo API
- `src/store`: estado global con Zustand
- `src/routes`: rutas, modulos y guards
- `src/utils`: helpers transversales
- `public`: assets publicos

## Reglas de cambio
- Mantener la organizacion por dominio actual.
- Si cambias una pantalla, revisar tambien:
  - servicio API correspondiente
  - store relacionado
  - rutas/guards si cambia navegacion o acceso
- Preferir reutilizar componentes ya existentes antes de introducir nuevos patrones.
- Evitar mover archivos entre dominios salvo necesidad real.
- En componentes complejos, priorizar claridad por sobre micro-optimizacion.
- Seguir el contrato real del backend; no parchear en UI incoherencias que deben resolverse en API salvo que el requerimiento sea explicitamente visual.

## Integracion con backend
- Los cambios de contrato deben coordinarse con `APP/volumes/backend/app`.
- Revisar especialmente servicios en `src/services` y stores cuando cambien auth, minutes, participants, clients, projects o tags.
- Si el cambio toca sesion o permisos, revisar guards, `authStore`, `sessionStore` y servicios de auth.

## Dependencias y operacion
- Si cambia una dependencia, editar `package.json` y avisar al usuario.
- No ejecutar `npm install`, `npm run dev`, `npm run build` ni similares.
- No reiniciar contenedores.

## Validacion sugerida
- Revisar rutas, imports, props y consumo de store.
- Verificar que los nombres de campos y payloads coincidan con la API.
- Indicar al usuario que valide la pantalla dentro del entorno Docker y navegador servido por el stack.
