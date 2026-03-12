# AGENTS.md

## Propósito
Este archivo alinea a cualquier agente que trabaje en este repositorio. El objetivo del proyecto es gestionar minutas, participantes, clientes, proyectos y artefactos asociados, con generación asistida por IA y renderizado posterior en frontend.

## Resumen del stack
- Orquestación local: `docker-compose-dev.yml`
- Backend API: FastAPI + SQLAlchemy + MariaDB + Redis + MinIO
- Frontend: React 18 + Vite + Zustand
- Worker: proceso separado para colas/eventos y generación de artefactos
- Base de datos: scripts SQL versionados en `APP/data/settings/mariadb/init`
- Operación del entorno: manual y centralizada por el usuario vía Docker

## Estructura relevante
- `APP/volumes/backend/app`: backend principal
- `APP/volumes/frontend/src`: frontend principal
- `APP/data/settings/mariadb/init`: bootstrap y cambios de esquema SQL
- `APP/data/settings/worker/prompts`: prompts internos del sistema
- `Data/dokerFile/dev_qa`: Dockerfiles de desarrollo y QA
- `docker-compose-dev.yml`: entorno principal de desarrollo

## Arquitectura esperada

### Backend
Se trabaja por capas:
- `models/`: entidades SQLAlchemy
- `schemas/`: contratos Pydantic
- `services/`: lógica de negocio
- `repositories/`: acceso a datos cuando aplica
- `routers/v1/`: endpoints versionados
- `core/`: configuración, seguridad, middleware y excepciones
- `db/`: sesión, Redis, MinIO y base SQL

Regla práctica:
- Si cambias contrato HTTP, revisa `schemas`, `services` y `routers`.
- Si cambias persistencia, revisa `models`, SQL de inicialización y el servicio afectado.
- Mantén el versionado API bajo `/v1`.

### Frontend
La organización actual está orientada por dominio:
- `pages/`: pantallas por módulo
- `components/`: componentes compartidos
- `services/`: acceso a API
- `store/`: estado global con Zustand
- `routes/`: ruteo modular y guards
- `utils/`: helpers transversales

Regla práctica:
- Evita mover archivos entre dominios sin necesidad.
- Si cambias una vista, revisa también el servicio y store relacionados.
- Preserva los patrones existentes antes de introducir una abstracción nueva.

### Base de datos
No hay framework de migraciones visible; el proyecto depende de scripts SQL ordenados manualmente.

Convenciones observadas:
- Prefijos numéricos para definir orden de ejecución: `00`, `10`, `15`, `20`, etc.
- Seeds mínimos separados del esquema.
- MariaDB/MySQL con `utf8mb4`.

Reglas:
- No edites seeds para “parchar” problemas de lógica si el cambio real es de esquema o backend.
- Si agregas tablas/campos, mantén consistencia entre SQL, modelos, schemas y servicios.
- Evita romper compatibilidad con datos ya sembrados en `40_seeds_minimal.sql` y `50_seeds_minimal.sql`.

## Convenciones de trabajo

### Antes de cambiar código
- Revisa primero el flujo existente en el módulo afectado.
- No asumas que el backend tiene cobertura de tests; actualmente no se observan suites automáticas en el repo.
- Favorece cambios pequeños y localizados.
- Asume que la operación del entorno la realiza exclusivamente el usuario.

### Al modificar backend
- Mantén naming consistente con el patrón actual: plural en catálogos y recursos (`clients`, `projects`, `participants`).
- Respeta el contrato de respuesta existente y los middlewares globales.
- Considera impacto en RBAC/autorización; en `main.py` hay varios recursos marcados con TODO de seguridad.
- Si una dependencia cambia, modifica `requirements.txt` y notifica al usuario; no intentes reinstalar ni reiniciar servicios.

### Al modificar frontend
- Respeta la separación por pantallas y módulos.
- No introduzcas librerías nuevas sin necesidad fuerte.
- Reutiliza componentes existentes cuando el comportamiento ya esté resuelto.
- En componentes complejos, prioriza claridad antes que micro-optimizaciones.
- Si una dependencia cambia, modifica `package.json` y notifica al usuario; no ejecutes `npm install`, `npm update` ni tareas equivalentes.

### Al modificar prompts o IA
- Los prompts del sistema viven en `APP/data/settings/worker/prompts`.
- No mezclar instrucciones de producto con instrucciones del agente si el cambio corresponde a prompt runtime.
- Mantén explícitas las reglas de “no inventar información” y salida estructurada cuando el cambio toque generación de minutas.

## Operación del entorno
Este repositorio se gestiona con Docker y su operación es manual.

Reglas obligatorias:
- No ejecutar `docker_tools_v2.sh`.
- No reiniciar, levantar, bajar ni recrear contenedores por cuenta propia.
- No correr instalaciones de dependencias (`npm install`, `pip install`, etc.).
- No limpiar volúmenes, persistencias o datos locales.
- Si un cambio requiere reconstrucción, reinicio de contenedores, reinstalación o limpieza de persistencia, informarlo explícitamente al usuario y detenerse ahí.

Referencia:
- `docker_tools_v2.sh` existe como herramienta operativa del proyecto, pero su uso está reservado exclusivamente al usuario.

## Criterios para cambios seguros
- No romper `docker-compose-dev.yml` salvo que el cambio realmente sea de infraestructura.
- No renombrar rutas, variables de entorno o tablas sin revisar referencias cruzadas.
- Si un cambio toca participantes/minutas/versiones, revisar tanto catálogo maestro como snapshots históricos.
- Si un cambio toca autenticación, revisar `core/security.py`, `core/authz.py`, `services/auth_service.py` y stores/servicios del frontend.
- Si un cambio requiere acciones operativas posteriores, dejar instrucción clara para que el usuario las ejecute manualmente.

## Qué documentar en cada entrega
Cuando un agente termine una tarea, debería dejar claro:
- qué cambió
- qué archivos principales tocó
- cómo validar el cambio
- qué riesgos o supuestos quedan abiertos

## Evitar
- Crear una segunda arquitectura paralela dentro del mismo módulo.
- Mezclar lógica de negocio pesada dentro de routers o componentes de UI.
- Introducir cambios masivos de formato sin valor funcional.
- Cambiar datos seed sensibles, credenciales o prompts base sin justificarlo.

## Referencias internas rápidas
- Backend entrypoint: `APP/volumes/backend/app/main.py`
- Frontend manifest: `APP/volumes/frontend/package.json`
- Prompt base IA: `APP/data/settings/worker/prompts/system_prompt_v08.txt`
- Compose principal: `docker-compose-dev.yml`
