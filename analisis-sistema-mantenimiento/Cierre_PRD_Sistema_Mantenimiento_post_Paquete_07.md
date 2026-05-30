# Cierre PRD Sistema Mantenimiento post Paquete 07

Fecha: 2026-05-29 America/Santiago

Modulo: `Sistema >> Mantenimiento`

Veredicto: **PRD-ready condicionado**

## Resumen ejecutivo

Se ejecuto el Paquete 07 de cierre operativo con evidencia Docker, SQL, HTTP y logs. Se corrigio de forma acotada la configuracion del worker para exponer `TRACE_BASE_DIR` en runtime, se recreo el worker, se valido `cleanup_temp_files` en dry-run con archivos controlados, se confirmo que `/api/internal/*` no esta expuesto externamente y que el acceso interno desde scheduler al backend funciona con secreto valido.

Tambien se valido SSE por HTTP: sin token responde `401`, con ADMIN abre stream `text/event-stream`, y Nginx tiene `proxy_buffering off`. La matriz DB/marker se ejecuto parcialmente con escenarios A-C y restauro el estado inicial al cierre. No se declara `PRD-ready` pleno porque no fue posible validar UI real en navegador, refresco SSE en UI, fallback de polling ni escenarios DB caida D-E.

## Correcciones menores aplicadas

| Archivo | Cambio | Motivo |
| --- | --- | --- |
| `.env` | Agregado `TRACE_BASE_DIR=/app/assets/temp`. | Hacer explicito el directorio base de temporales en runtime. |
| `docker-compose.yml` | Agregado `TRACE_BASE_DIR` al worker. | El worker activo no recibia la variable requerida por Paquete 07. |
| `docker-compose-dev.yml` | Agregado `TRACE_BASE_DIR` al worker. | Alinear dev con prod. |
| `docker-compose-qa.yml` | Agregado `TRACE_BASE_DIR` al worker. | Alinear QA con prod. |

No se modifico logica de negocio ni contratos HTTP.

## Tabla de validaciones

| Area | Resultado | Evidencia | Estado |
| --- | --- | --- | --- |
| Worker redeployado | Worker recreado y arriba. | `docker compose -f docker-compose.yml up -d --force-recreate worker`; `ps worker` muestra `Up`. | OK |
| Variables worker | Variables nuevas cargadas. | `MAINTENANCE_TEMP_CLEANUP_ALLOWED_SUBDIRS=traces/tmp,render/tmp,uploads/tmp,maintenance/tmp`, `MAINTENANCE_TEMP_CLEANUP_DRY_RUN=true`, `MAINTENANCE_TEMP_CLEANUP_SAFETY_GRACE_MINUTES=30`, `TRACE_BASE_DIR=/app/assets/temp`. | OK |
| Allowlist real | Existe `traces/tmp`; no se observaron `render/tmp`, `uploads/tmp`, `maintenance/tmp`. | `find "$TRACE_BASE_DIR" -maxdepth 4 -type d` muestra `/app/assets/temp/traces/tmp` y multiples directorios UUID con `attachments`. | Warning |
| Cleanup temp dry-run | Job manual procesado en dry-run, archivos no eliminados. | Worker: `Limpieza de temporales simulada | scanned=5 deleted_files=2 ... allowed_roots=1`; `ls` posterior mantiene `pkg07-old-test.txt`, `pkg07-new-test.txt` y symlink externo. | OK |
| Run ledger cleanup temp | Run manual quedo `success` con `affected_count=2`. | SQL: `job_id=a45cc99b-2ed1-4dce-b2d2-d70805325ef8`, `status=success`, `correlation_id=73c61e28-78e8-4f72-bcf9-44212cc0f1aa`. | OK |
| Redis queue | Cola vacia al cierre del job. | `redis-cli LLEN queue:maintenance` = `0`. | OK |
| UI real navegador | No se ejecuto navegador real. | No hay Playwright/browser disponible en esta corrida ni captura manual. | No ejecutado |
| SSE HTTP sin token | Protegido. | `GET /api/v1/system/maintenance/events` responde `401 Unauthorized`. | OK |
| SSE HTTP con ADMIN | Stream abre. | `200 OK`, `Content-Type: text/event-stream; charset=utf-8`, timeout de curl con stream abierto. | OK |
| SSE en UI | No validado en navegador. | No se observo la pantalla real recibiendo evento. | No ejecutado |
| Polling fallback | No validado en navegador. | No se simulo perdida SSE en UI. | No ejecutado |
| Nginx SSE | Buffering desactivado por config. | `nginx -T`: `proxy_buffering off`, `proxy_cache off`, `proxy_read_timeout 3600s`, `add_header X-Accel-Buffering no`. | OK |
| Header `X-Accel-Buffering` externo | No visible en curl externo. | Respuesta SSE externa no mostro el header, aunque Nginx lo declara. | Warning |
| DB/marker A | DB normal + marker maintenance bloquea POST. | Public state: `mode=maintenance`, `source=marker_file_inconsistent`; POST `/api/v1/auth/access-request` responde `503`. | OK |
| DB/marker B | DB maintenance + marker ausente bloquea POST. | Public state: `mode=maintenance`, `source=database_marker_inconsistent`; POST responde `503`. | OK |
| DB/marker C | DB maintenance + marker corrupto bloquea POST. | Marker `not-json-pkg07`; public state sigue `mode=maintenance`; POST responde `503`. | OK |
| DB/marker D | DB caida + marker maintenance no ejecutado. | No se bajo MariaDB para evitar riesgo operacional. | No ejecutado |
| DB/marker E | DB caida + sin marker no ejecutado. | No se bajo MariaDB para evitar riesgo operacional. | No ejecutado |
| Restauracion DB/marker | Estado inicial restaurado. | DB: `mode=commissioning`, `operation_id=7ee326a6-fb66-48de-ac81-f04961910f1b`; marker restaurado en `/app/maintenance_state.json` y copiado a `/app/remote_data/maintenance_state.json`. | OK |
| Middleware GET seguro | No consulta `system_operation_state` en GET seguro medido. | `mysql.general_log` habilitado temporalmente; tras GET seguro, `COUNT(*) WHERE argument LIKE "%FROM system_operation_state%"` = `0`. | OK |
| Middleware mutaciones | Mutaciones restringidas evaluan estado efectivo. | POST bajo marker/DB restringido respondio `503`. | OK |
| Internal externo | Bloqueado por Nginx. | `curl /api/internal/v1/maintenance/tick` responde `404`. | OK |
| Internal interno | Permitido desde scheduler con secreto. | Python desde scheduler a `http://backend:8000/internal/v1/maintenance/tick` responde `status 200`. | OK |
| Ledger final | Contiene `success`, `warning`, `dispatch_error`, `manual` y `cron`. | SQL `ORDER BY created_at DESC LIMIT 30`. | OK |
| Validacion estatica | Sin errores. | `python3 -m py_compile ...` OK; `git diff --check` OK. | OK |

## Hallazgos abiertos

### P07-M01 - UI real, SSE en UI y polling fallback no validados

Severidad: Medio

Evidencia:

- No se abrio navegador real contra `http://minuetaitor.vsoto.cl/`.
- No hay capturas ni consola del navegador.
- No se observo recepcion de eventos SSE dentro de la UI ni convergencia por polling.

Impacto:

La API y el SSE HTTP funcionan, pero la experiencia operativa no esta demostrada end-to-end. Esto impide declarar PRD-ready pleno.

Recomendacion:

Ejecutar validacion manual o automatizada en navegador con ADMIN: abrir `Sistema >> Mantenimiento`, ejecutar `cleanup_temp_files` en dry-run, observar estados visuales, doble-click lock, SSE y fallback de polling.

### P07-M02 - Escenarios DB caida D-E no ejecutados

Severidad: Medio

Evidencia:

- Se ejecutaron A-C sin bajar MariaDB.
- D-E requerian simular DB caida; no se ejecuto para evitar impacto operacional.

Impacto:

La politica DB/marker queda validada para divergencias con DB disponible, pero no para fallback por indisponibilidad real de DB.

Recomendacion:

Ejecutar D-E en QA con ventana controlada: marker maintenance + DB caida debe bloquear; DB caida + sin marker debe comportarse segun Paquete 06 y registrar log rate-limited.

### P07-B01 - Header `X-Accel-Buffering` no visible externamente

Severidad: Bajo

Evidencia:

- `nginx -T` declara `add_header X-Accel-Buffering no`.
- Respuesta externa SSE no muestra el header, aunque el stream abre y `proxy_buffering off` esta configurado.

Impacto:

No bloquea el stream observado, pero deja evidencia HTTP incompleta del header.

Recomendacion:

Si se requiere evidencia estricta por cabecera, ajustar Nginx con `add_header X-Accel-Buffering no always;` y revalidar.

### P07-B02 - Allowlist real incompleta respecto de configuracion

Severidad: Bajo

Evidencia:

- Config: `traces/tmp,render/tmp,uploads/tmp,maintenance/tmp`.
- Runtime observado: existe `traces/tmp`; no se observaron los otros tres directorios.

Impacto:

No es inseguro; el hardening evita limpiar rutas inexistentes o no permitidas. Pero la operacion de limpieza real queda limitada a `traces/tmp` hasta crear/confirmar los demas subdirectorios.

Recomendacion:

Crear los subdirectorios esperados si forman parte del flujo productivo, o ajustar la allowlist por ambiente a rutas reales.

## Evidencia relevante

### Worker y variables

```text
NAME                 IMAGE                    COMMAND              SERVICE   CREATED          STATUS
MinuetAItor-worker   MinuetAItor/worker:prd   "python worker.py"   worker    21 seconds ago   Up 9 seconds

MAINTENANCE_TEMP_CLEANUP_ALLOWED_SUBDIRS=traces/tmp,render/tmp,uploads/tmp,maintenance/tmp
MAINTENANCE_TEMP_CLEANUP_DRY_RUN=true
MAINTENANCE_TEMP_CLEANUP_SAFETY_GRACE_MINUTES=30
TRACE_BASE_DIR=/app/assets/temp
```

### Cleanup temp dry-run

```text
Iniciando job | job_id=a45cc99b-2ed1-4dce-b2d2-d70805325ef8 type=cleanup_temp_files queue=queue:maintenance attempt=1
Ejecutando acción de mantenimiento | action=cleanup_temp_files job_id=a45cc99b-2ed1-4dce-b2d2-d70805325ef8 correlation_id=73c61e28-78e8-4f72-bcf9-44212cc0f1aa
Limpieza de temporales simulada | scanned=5 deleted_files=2 deleted_dirs=0 skipped=3 failed=0 retention_days=1 safety_grace_minutes=30 allowed_roots=1.
Acción de mantenimiento completada | action=cleanup_temp_files job_id=a45cc99b-2ed1-4dce-b2d2-d70805325ef8 correlation_id=73c61e28-78e8-4f72-bcf9-44212cc0f1aa affected_count=2
```

Listado posterior:

```text
pkg07-new-test.txt
pkg07-old-test.txt
pkg07-symlink-outside -> /etc/passwd
```

### DB/marker

Escenario A:

```text
DB=normal, marker=maintenance
GET public: 200, mode=maintenance, source=marker_file_inconsistent
POST /api/v1/auth/access-request: 503 Service Unavailable
```

Escenario B:

```text
DB=maintenance, marker=ausente
GET public: 200, mode=maintenance, source=database_marker_inconsistent
POST /api/v1/auth/access-request: 503 Service Unavailable
```

Escenario C:

```text
DB=maintenance, marker=corrupto
GET public: 200, mode=maintenance, source=database_marker_inconsistent
POST /api/v1/auth/access-request: 503 Service Unavailable
```

Estado restaurado:

```text
system_operation_state.mode=commissioning
operation_id=7ee326a6-fb66-48de-ac81-f04961910f1b
marker restaurado en /app/maintenance_state.json
marker copiado a /app/remote_data/maintenance_state.json
```

### SSE/Nginx

```text
Sin token: HTTP/1.1 401 Unauthorized
Con ADMIN: HTTP/1.1 200 OK
Content-Type: text/event-stream; charset=utf-8
cache-control: no-cache
```

Nginx:

```nginx
location ~ ^/api/.*/events$ {
  proxy_buffering off;
  proxy_cache off;
  proxy_read_timeout 3600s;
  proxy_send_timeout 3600s;
  add_header X-Accel-Buffering no;
}
```

### Internal

```text
Externo: GET /api/internal/v1/maintenance/tick -> 404 Not Found
Interno desde scheduler: POST http://backend:8000/internal/v1/maintenance/tick -> status 200
```

### Middleware

```text
mysql.general_log habilitado temporalmente.
GET seguro ejecutado contra /api/v1/auth/access-request/status.
COUNT(*) WHERE argument LIKE "%FROM system_operation_state%" = 0
general_log desactivado.
```

## Checklist final

- [x] Worker redeployado con env nuevas.
- [x] `TRACE_BASE_DIR` presente y absoluto.
- [x] `MAINTENANCE_TEMP_CLEANUP_ALLOWED_SUBDIRS` presente.
- [x] `MAINTENANCE_TEMP_CLEANUP_DRY_RUN` presente y `true`.
- [x] `MAINTENANCE_TEMP_CLEANUP_SAFETY_GRACE_MINUTES` presente.
- [x] `cleanup_temp_files` validado post-redeploy en dry-run.
- [x] Archivo antiguo dentro de allowlist reportado como candidato.
- [x] Archivo reciente omitido.
- [x] Symlink externo no eliminado.
- [x] Run ledger registra job manual `success`.
- [x] SSE HTTP sin token responde `401`.
- [x] SSE HTTP con ADMIN abre stream.
- [ ] UI real validada.
- [ ] SSE UI validado.
- [ ] Polling fallback validado.
- [x] DB/marker escenario A validado.
- [x] DB/marker escenario B validado.
- [x] DB/marker escenario C validado.
- [ ] DB/marker escenario D validado.
- [ ] DB/marker escenario E validado.
- [x] Middleware medido para GET seguro sin consulta a `system_operation_state`.
- [x] `/api/internal/*` externo bloqueado.
- [x] Tick interno permitido desde scheduler con secreto.
- [x] Run ledger consistente con `job_id` y `correlation_id`.
- [x] Estado DB/marker restaurado al cierre.

## Riesgos residuales

- Falta evidencia en navegador real para UI, SSE visual y polling fallback.
- Falta simular DB caida para validar fallback marker bajo indisponibilidad real.
- El header `X-Accel-Buffering` no aparece en respuesta externa pese a configuracion Nginx.
- La allowlist configurada contiene rutas que no existen todavia en el volumen observado.

## Recomendacion final para PRD

Mantener **PRD-ready condicionado**. El Paquete 07 cerro los pendientes operativos de worker, cleanup dry-run, DB/marker A-C, SSE HTTP, internal gateway y ledger, pero PRD pleno requiere cerrar UI real, SSE en UI, polling fallback y DB caida D-E.
