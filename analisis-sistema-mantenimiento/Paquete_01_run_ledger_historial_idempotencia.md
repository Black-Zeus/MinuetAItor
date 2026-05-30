# Paquete 01 - Run ledger, historial e idempotencia

## Estado

Implementado en esta rama de trabajo. No se ejecutaron contenedores ni migraciones en base de datos.

## Cambios aplicados

Se agrego una base persistente para registrar ejecuciones de mantenimiento antes del dispatch a Redis. El objetivo es que cada ejecucion tenga `job_id`, `correlation_id`, estado visible y datos de inicio/fin, sin romper los endpoints ni la UI actual.

## Migracion SQL nueva

Archivo:

- `APP/data/settings/mariadb/init/20260529_1438_schema_system_maintenance_runs.sql`

Tabla creada:

- `system_maintenance_runs`

Campos incluidos:

- `id`
- `job_id`
- `action`
- `scheduled_slot`
- `trigger_type`
- `status`
- `queued_at`
- `started_at`
- `finished_at`
- `duration_ms`
- `affected_count`
- `attempt`
- `max_attempts`
- `message`
- `error_code`
- `error_detail`
- `requested_by`
- `correlation_id`
- `created_at`
- `updated_at`

Restricciones e indices:

- `UNIQUE KEY uq_smr_job_id (job_id)`
- `UNIQUE KEY uq_smr_scheduler_slot_action (action, scheduled_slot, trigger_type)`
- `UNIQUE KEY uq_smr_correlation_id (correlation_id)`
- indices por estado, accion y solicitante

La restriccion `action + scheduled_slot + trigger_type` evita duplicidad de ejecuciones programadas. Las ejecuciones manuales guardan `scheduled_slot = NULL`, por lo que no dependen del slot scheduler.

## Cambios backend

Archivos:

- `APP/volumes/backend/app/models/system_maintenance_runs.py`
- `APP/volumes/backend/app/models/__init__.py`
- `APP/volumes/backend/app/services/system_maintenance_service.py`

Funciones nuevas principales:

- `_create_maintenance_run`
- `_dispatch_maintenance_run`
- `_build_maintenance_job`
- `_sync_runtime_from_run`
- `_mark_runtime_dispatch_error`

Comportamiento nuevo:

1. Antes de hacer `RPUSH`, el backend crea un registro `dispatch_pending`.
2. Si Redis acepta el job, el run pasa a `queued`.
3. Si Redis falla, el run queda como `dispatch_error`.
4. El payload del job incluye `run_id` y `correlation_id`.
5. El runtime legacy de `system_maintenance_settings` sigue actualizandose para mantener compatibilidad con la UI actual.
6. Los logs de dispatch incluyen `action`, `job_id`, `correlation_id`, `trigger` y `slot`.

## Cambios worker

Archivo:

- `APP/volumes/worker/app/handlers/maintenance_handler.py`

Funciones nuevas principales:

- `_mark_run_started`
- `_mark_run_finished`

Comportamiento nuevo:

1. Al tomar un job, el worker marca el run como `running`.
2. Si el job ya esta `running` o `success`, lo omite como duplicado.
3. Si llega el mismo intento repetido, tambien lo omite.
4. Al finalizar, marca `success` o `error`.
5. Guarda `duration_ms`, `attempt`, `max_attempts`, `affected_count`, `message`, `error_code` y `error_detail`.
6. Los logs del worker incluyen `job_id` y `correlation_id`.

## Compatibilidad

- No se cambiaron endpoints publicos.
- No se cambio contrato de respuesta del frontend.
- La UI sigue leyendo `system_maintenance_settings` para runtime.
- El ledger queda disponible para auditoria y futuras pantallas/API.

## Riesgos residuales

- No es un outbox transaccional completo Redis + DB.
- Si el backend cae justo despues del `RPUSH` y antes del cambio a `queued`, puede existir mensaje Redis con run en `dispatch_pending`; el worker puede procesarlo y marcarlo `running/success`.
- Si el worker cae a mitad de ejecucion, un run puede quedar `running` hasta reconciliacion futura.
- No hay endpoint para consultar historial aun.

## Validacion realizada

Comandos ejecutados localmente:

```bash
python3 -m py_compile APP/volumes/backend/app/services/system_maintenance_service.py APP/volumes/backend/app/models/system_maintenance_runs.py APP/volumes/worker/app/handlers/maintenance_handler.py
git diff --check
```

Resultado:

- Compilacion estatica Python OK.
- `git diff --check` OK.

## Validacion manual sugerida en Docker

1. Aplicar la migracion SQL nueva.
2. Ejecutar `POST /internal/v1/maintenance/tick`.
3. Verificar fila en `system_maintenance_runs`.
4. Confirmar que el job entra en `queue:maintenance`.
5. Confirmar transicion `queued -> running -> success/error`.
6. Repetir tick del mismo minuto y confirmar que no se duplica `action + scheduled_slot + trigger_type`.
7. Ejecutar una limpieza manual y verificar que genera otro `job_id` aunque coincida el minuto.
