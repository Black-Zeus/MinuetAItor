# Iteracion 01 - Sistema >> Mantenimiento

Fecha: 2026-05-29

## Resumen simple

`Sistema >> Mantenimiento` centraliza controles operativos de administracion. Permite cambiar el modo operativo del sitio, configurar rutinas automaticas, ejecutar limpiezas manuales, definir umbrales de alerta para colas Redis y ver el ultimo estado de ejecucion.

## Que posee la pantalla

1. Modo operativo del sitio
   - Modos: `normal`, `read_only`, `maintenance`, `commissioning`.
   - Al activar un modo restringido pide motivo operativo.
   - Guarda estado en base de datos y tambien usa un archivo marcador de mantenimiento.
   - Publica evento SSE para actualizar la UI.

2. Solicitudes de alta
   - Controla si queda habilitado el boton/flujo de solicitud de acceso.
   - Campo persistido: `access_request_enabled`.

3. Limpieza de sesiones
   - Puede habilitarse/deshabilitarse.
   - Programacion por cron, por defecto `0 * * * *`.
   - Modos:
     - `soft_logout`: marca logout tecnico de sesiones sin presencia Redis.
     - `revoke_idle`: revocacion tecnica de sesiones sin presencia Redis.
     - `archive_only`: solo detecta, no modifica.
   - Puede ejecutarse manualmente con "Ejecutar ahora".

4. Limpieza de temporales
   - Puede habilitarse/deshabilitarse.
   - Programacion por cron, por defecto `0 3 * * *`.
   - Retencion configurable en dias, por defecto 7.
   - Borra archivos antiguos bajo `TRACE_BASE_DIR` y elimina directorios vacios.
   - Puede ejecutarse manualmente con "Ejecutar ahora".

5. Monitoreo de colas
   - Define si se monitorea cada cola y su umbral de advertencia.
   - Si una cola alcanza el umbral, genera notificacion in-app para ADMIN.
   - Si hay correos de administradores, tambien encola email de alerta.
   - Cuando la cola vuelve bajo umbral, genera notificacion de recuperacion.

6. Estado runtime
   - Muestra ultimo encolado, inicio real, fin, estado, mensaje y cantidad afectada.
   - Estados principales: `queued`, `running`, `success`, `error`, `warning`.

## Colas observadas

| Cola | Consumidor | Prioridad | Tipos de job | Uso |
| --- | --- | --- | --- | --- |
| `queue:minutes` | `worker` | Alta | `generate_minute` | Procesamiento principal de minutas. |
| `queue:email` | `worker` | Media | `email` | Correos y notificaciones transaccionales. |
| `queue:maintenance` | `worker` | Baja | `cleanup_sessions`, `cleanup_temp_files` | Rutinas tecnicas de mantenimiento. |
| `queue:pdf` | `pdf-worker` | Alta | `pdf_job` | Renderizado/publicacion de PDF. |
| `queue:dlq` | Manual/soporte | Critica | jobs fallidos | Trabajos que agotaron reintentos o quedaron para revision. |

## Programacion

El scheduler corre con timezone `America/Santiago`.

| Job scheduler | Frecuencia real | Endpoint interno | Funcion |
| --- | --- | --- | --- |
| `maintenance_tick` | Cada minuto, segundo 0 | `POST /internal/v1/maintenance/tick` | Evalua cron de mantenimiento y monitorea colas. |
| `system_backups_tick` | Cada minuto, segundo 0 | `POST /internal/v1/system/backups/tick` | Evalua politicas de respaldos. Relacionado al sistema, pero no propio de esta pantalla. |
| `pending_publication_reminders` | Lunes a viernes 08:00 | `POST /internal/v1/notifications/reminders/pending-publication` | Recordatorios de minutas pendientes. |

El `maintenance_tick` no ejecuta directamente las limpiezas: solo decide si corresponde encolar jobs en `queue:maintenance`.

## Flujo de una rutina automatica

1. Scheduler llama cada minuto a `/internal/v1/maintenance/tick`.
2. Backend toma lock Redis `lock:system:maintenance:tick` para evitar ticks duplicados.
3. Backend lee la configuracion singleton `system_maintenance_settings`.
4. Si el cron calza con el minuto local actual y no fue encolado en el mismo slot, crea job Redis.
5. Worker consume `queue:maintenance`.
6. Worker actualiza runtime en `system_maintenance_settings`.
7. Worker publica eventos en `events:system:maintenance`.
8. UI recibe SSE y refresca estado.

## Archivos principales

- Frontend: `APP/volumes/frontend/src/pages/system/SystemSettingsMaintenancePanel.jsx`
- Servicio frontend: `APP/volumes/frontend/src/services/systemMaintenanceService.js`
- Router backend publico: `APP/volumes/backend/app/routers/v1/system_maintenance.py`
- Router backend interno: `APP/volumes/backend/app/routers/internal/maintenance.py`
- Servicio backend: `APP/volumes/backend/app/services/system_maintenance_service.py`
- Catalogo de colas: `APP/volumes/backend/app/services/system_queue_catalog.py`
- Worker handler: `APP/volumes/worker/app/handlers/maintenance_handler.py`
- Registro de colas worker: `APP/volumes/worker/app/queues/__init__.py`
- Scheduler: `APP/volumes/scheduler/app/scheduler.py`
- Tabla SQL: `APP/data/settings/mariadb/init/20260517_1910_schema_system_maintenance_settings.sql`

## Puntos para analizar despues

- Si `cleanup_sessions` debe cerrar todas las sesiones sin Redis o solo sesiones antiguas/inactivas.
- Si `cleanup_temp_files` debe limitarse mas finamente para no borrar trazas aun necesarias.
- Si las alertas de colas deben tener cooldown adicional para emails.
- Si `queue:maintenance` como baja prioridad puede retrasar tareas operativas cuando hay carga alta.
- Si la pantalla deberia mostrar historial, no solo el ultimo estado runtime.

## Validacion manual sugerida

Dentro del flujo Docker del usuario:

1. Abrir `Sistema >> Mantenimiento`.
2. Confirmar que carga configuracion y estado.
3. Cambiar un umbral o cron y guardar.
4. Ejecutar limpieza manual de sesiones o temporales en un entorno controlado.
5. Verificar que el job entra en `queue:maintenance`, pasa por `running` y termina en `success` o `error`.
6. Revisar que las alertas de colas aparecen al superar umbral.

No se ejecutaron pruebas ni contenedores para este analisis.
