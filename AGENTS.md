# AGENTS.md

## Proposito
Este repositorio implementa MinuetAItor, una plataforma para gestionar minutas, participantes, clientes, proyectos, artefactos y procesos auxiliares de generacion por IA y renderizado PDF.

Este archivo define reglas globales para cualquier agente que trabaje en el repo. Las carpetas con su propio `AGENTS.md` refinan estas reglas para su ambito.

## Mapa real del proyecto
- Archivos de orquestacion por entorno:
  - `docker-compose.yml` → Produccion
  - `docker-compose-dev.yml` → Desarrollo
  - `docker-compose-qa.yml` → Calidad
- Backend API: `APP/volumes/backend/app`
- Frontend: `APP/volumes/frontend`
- Worker de negocio e IA: `APP/volumes/worker/app`
- Worker de PDF: `APP/volumes/pdf-worker/app`
- Scheduler: `APP/volumes/scheduler/app`
- SQL bootstrap/manual migrations: `APP/data/settings/mariadb/init`
- Prompts runtime: `APP/data/settings/worker/prompts`
- Dockerfiles dev/qa: `Data/dokerFile/dev_qa`
- Gateway y settings de infraestructura: `APP/data/settings`

## Regla operativa principal
Todo corre dentro de Docker. El usuario opera el entorno. El agente modifica codigo y configuracion, pero no administra contenedores.

Restricciones obligatorias:
- No ejecutar `docker_tools_v2.sh`.
- No reiniciar, levantar, bajar, recrear ni destruir contenedores.
- No correr `docker compose up`, `down`, `restart`, `build`, `exec` ni equivalentes, salvo instruccion explicita del usuario.
- No instalar dependencias con `npm`, `pnpm`, `yarn`, `pip`, `poetry` o similares.
- No asumir disponibilidad local de Python, Node, npm o herramientas de desarrollo fuera de contenedores.
- Si un cambio requiere rebuild, instalacion, reinicio, reseed o limpieza de persistencia, dejarlo indicado para ejecucion manual del usuario.

## Principios de cambio
- Hacer cambios pequenos, localizados y coherentes con la arquitectura existente.
- Revisar primero el flujo real del modulo afectado antes de editar.
- No crear una arquitectura paralela dentro del mismo dominio.
- No mezclar logica de negocio pesada en routers, componentes de UI o scripts de infraestructura.
- No renombrar tablas, rutas, variables de entorno o colas sin revisar referencias cruzadas.
- No usar seeds para parchear problemas de negocio que en realidad exigen cambio de esquema o servicio.

## Compatibilidad legacy
- Salvo instruccion explicita del usuario, no asumir que toda mejora debe preservar compatibilidad con datos, payloads o estructuras legacy.
- Si el entorno esta en fase de desarrollo y la persistencia puede recrearse, priorizar una implementacion limpia sobre adaptar manualmente datos historicos.
- Solo invertir tiempo en normalizacion, migracion o compatibilidad retroactiva cuando:
  - el usuario lo pida explicitamente
  - exista un requisito operativo real de conservar datos previos
  - romper compatibilidad afecte flujos activos que no puedan recrearse
- Si decides no cubrir legacy, dejarlo claro en la entrega final para que el usuario sepa que el cambio aplica desde la nueva estructura hacia adelante.

## Arquitectura resumida

### Backend
- Stack: FastAPI + SQLAlchemy + MariaDB + Redis + MinIO
- Capas principales:
  - `models/`
  - `schemas/`
  - `services/`
  - `repositories/`
  - `routers/v1/`
  - `routers/internal/`
  - `core/`
  - `db/`
- El backend monta prompts desde `APP/data/settings/worker/prompts`.
- El backend expone `/health` y registra routers versionados bajo `/v1`.

Reglas:
- Si cambia contrato HTTP, revisar `schemas`, `services`, `routers` y consumo desde frontend.
- Si cambia persistencia, alinear `models`, SQL manual y servicios afectados.
- Revisar seguridad cuando el cambio toque `core/security.py`, `core/authz.py`, `services/auth_service.py` o endpoints marcados con TODO de RBAC en `main.py`.

### Frontend
- Stack: React 18 + Vite + Zustand + React Router
- Organizacion principal:
  - `src/pages/`
  - `src/components/`
  - `src/services/`
  - `src/store/`
  - `src/routes/`
  - `src/utils/`

Reglas:
- Mantener la organizacion por dominio actual.
- Si cambia una pantalla, revisar el servicio API y store relacionados.
- Reutilizar componentes y patrones existentes antes de abstraer de nuevo.

### Procesos asincronos
- `worker`: consume colas Redis para procesos de negocio, IA, mantenimiento y correo.
- `pdf-worker`: consume `queue:pdf` y genera artefactos PDF usando Gotenberg y MinIO.
- `scheduler`: agenda tareas cron y dispara jobs internos o llamadas al backend interno.

Reglas:
- Si se cambia payload de un job, actualizar productor y consumidor.
- Mantener consistencia entre nombres de cola, `type` del job y handler registrado.
- No asumir que un worker puede compensar silenciosamente errores de contrato.

### Base de datos
- No hay framework de migraciones visible.
- El estado inicial depende de scripts SQL manuales en `APP/data/settings/mariadb/init`.
- Convencion temporal del proyecto:
  - Persistencia en BD: UTC
  - Presentacion UI y logs operativos: hora local Santiago (`America/Santiago`)
  - Si un `DATETIME` de MariaDB no trae tz, debe interpretarse como UTC de aplicacion
- Orden observado:
  - `20260517_1810_schema_core.sql`
  - `20260517_1820_schema_extensions.sql`
  - `20260517_1830_schema_indexes.sql`
  - `20260517_1840_triggers.sql`
  - `20260517_1850_seed_catalogs_minimal.sql`
  - `20260517_1855_seed_operational_minimal.sql`
  - `20260517_1910_schema_system_maintenance_settings.sql`
  - `20260517_1920_alter_system_maintenance_settings_queue_thresholds.sql`
  - `20260517_1930_schema_notifications.sql`
  - `20260517_1940_alter_notification_recipients_visibility.sql`
  - `20260517_1950_alter_system_maintenance_queue_monitoring.sql`

Reglas:
- Mantener orden léxico según la convención `YYYYMMDD_HHMM_{motivo}.sql`.
- El bloque `HHMM` debe usar formato de 24 horas y corresponder a la hora real de creación del archivo SQL.
- Si agregas campos o tablas, reflejar el cambio en SQL, modelos, schemas y servicios.
- Evitar romper compatibilidad con seeds existentes salvo que el cambio lo requiera y quede justificado.

## Ambitos sensibles
- Minutas, participantes, versiones y vistas publicas: revisar catalogos maestros y snapshots historicos.
- Auth y ACL: revisar backend y frontend a la vez.
- Prompts de IA: preservar reglas de no inventar informacion y estructura de salida.
- Infra Docker/nginx: cambiar solo si el requerimiento es realmente de infraestructura.

## Validacion esperada
Como el agente no opera Docker ni runtimes locales, validar preferentemente con:
- revision estatica de codigo y referencias cruzadas
- consistencia entre capas
- chequeo de imports, rutas y contratos
- instrucciones claras para que el usuario valide dentro de su flujo Docker

Si no fue posible ejecutar pruebas o levantar servicios, indicarlo explicitamente.

## Que debe dejar claro cada entrega
- que cambio
- que archivos principales toco
- como validar manualmente dentro del entorno Docker del usuario
- que riesgos, supuestos o pasos operativos quedan pendientes
