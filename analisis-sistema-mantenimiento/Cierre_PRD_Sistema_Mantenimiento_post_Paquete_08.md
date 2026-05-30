# Cierre PRD Sistema Mantenimiento post Paquete 08

Fecha: 2026-05-29 America/Santiago

Modulo: `Sistema >> Mantenimiento`

Veredicto final: **PRD-ready condicionado**

## Resumen ejecutivo

Se proceso el Paquete 08 de cierre final PRD. Se cerraron evidencias que seguian pendientes a nivel operativo: DB/marker escenario D, DB/marker escenario E, allowlist real de temporales y ajuste acotado de Nginx para `X-Accel-Buffering`.

El modulo no se declara `PRD-ready` pleno porque no se pudo ejecutar una validacion real de navegador autenticado para `Sistema >> Mantenimiento`, ni observar SSE dentro de la UI ni polling fallback desde la pantalla. La API, worker, ledger, DB/marker y SSE HTTP quedan con evidencia suficiente; la experiencia de usuario queda como pendiente bloqueante para PRD pleno.

## Correcciones y acciones aplicadas

| Archivo/ambito | Cambio | Resultado |
| --- | --- | --- |
| `APP/data/settings/nginx/conf.d/default-prd.conf` | `add_header X-Accel-Buffering no always;` en location SSE. | `nginx -t` OK y reload aplicado. |
| `APP/data/settings/nginx/conf.d/default.conf` | Mismo ajuste para configuracion no PRD. | Alineacion entre entornos. |
| Volumen worker | Creados `$TRACE_BASE_DIR/render/tmp`, `$TRACE_BASE_DIR/uploads/tmp`, `$TRACE_BASE_DIR/maintenance/tmp`. | Allowlist configurada ahora existe completa en runtime. |
| DB/marker | Se detuvo MariaDB de forma breve para escenarios D-E. | Estado restaurado y MariaDB vuelve `healthy`. |

## Tabla de validaciones

| Area | Resultado | Evidencia | Estado |
| --- | --- | --- | --- |
| UI real | No ejecutada. | Hay Google Chrome instalado, pero no se dispone de automatizacion confiable de sesion autenticada ni captura manual. | No ejecutado |
| Consola navegador | No ejecutada. | No se abrio sesion real en navegador. | No ejecutado |
| SSE dentro de UI | No ejecutada. | No se observo `Network`/EventSource desde la pantalla. | No ejecutado |
| Polling fallback UI | No ejecutada. | No se pudo cortar SSE desde UI ni observar convergencia visual. | No ejecutado |
| SSE HTTP | Sigue funcionando. | `curl -N` con Bearer ADMIN responde `200 OK`, `Content-Type: text/event-stream; charset=utf-8`; sin token responde `401` en validacion previa. | OK |
| Nginx SSE | Configuracion ajustada y recargada. | `nginx -t` OK, `nginx -s reload` OK, config con `add_header X-Accel-Buffering no always;`. | OK |
| Header externo `X-Accel-Buffering` | Sigue sin observarse en curl externo. | Respuesta SSE externa mantiene `200 text/event-stream`, pero no muestra la cabecera. | Warning |
| Allowlist temporales | Resuelta en runtime. | `find "$TRACE_BASE_DIR"` muestra `traces/tmp`, `render/tmp`, `uploads/tmp`, `maintenance/tmp`; `dry_run=true`. | OK |
| DB/marker D | DB caida + marker maintenance bloquea mutacion. | MariaDB detenida; marker maintenance; POST `/api/v1/auth/access-request` responde `503` con `mode=maintenance`; GET seguro responde `200`. | OK |
| DB/marker E | DB caida + sin marker no bloquea por middleware. | MariaDB detenida; markers removidos; POST invalido responde `422`, POST valido responde `403` de negocio, no `503 maintenance`; GET seguro responde `200`. | OK |
| Restauracion DB/marker | Restaurado. | MariaDB vuelve `healthy`; DB `mode=commissioning`; marker restaurado en `/app/maintenance_state.json` y `/app/remote_data/maintenance_state.json`. | OK |
| Logs DB caida | Hubo trazas de backend durante la ventana. | Logs muestran `OperationalError` de `system_backups_tick` al estar MariaDB caida; no se observo loop de middleware por cada request. | Warning |
| Run ledger | Consistente. | Ultimos runs incluyen `cleanup_temp_files manual success`, `cleanup_sessions cron success`, `cleanup_temp_files cron warning`, `dispatch_error`; cola Redis `0`. | OK |
| Validacion estatica | OK. | `python3 -m py_compile ...` sin salida; `git diff --check` sin salida. | OK |

## Hallazgos abiertos

### P08-M01 - UI real, SSE UI y polling fallback no ejecutados

Severidad: Medio

Evidencia:

- No se dispone de evidencia de navegador autenticado en `http://minuetaitor.vsoto.cl/`.
- No hay consola, captura ni Network tab de `Sistema >> Mantenimiento`.
- No se observo EventSource desde UI ni polling fallback visual.

Impacto:

Aunque backend/SSE HTTP/worker/ledger operan correctamente, falta la ultima evidencia end-to-end de experiencia operativa. Esto mantiene el modulo en `PRD-ready condicionado`.

Recomendacion:

Ejecutar validacion manual asistida o Playwright en un entorno con navegador controlado: login ADMIN, abrir `Sistema >> Mantenimiento`, ejecutar `cleanup_temp_files` dry-run, observar estados, bloquear doble ejecucion, confirmar SSE y simular fallback polling.

### P08-B01 - `X-Accel-Buffering` no visible externamente pese a ajuste

Severidad: Bajo

Evidencia:

- Config Nginx tiene `add_header X-Accel-Buffering no always;`.
- `nginx -t` y reload OK.
- Curl externo SSE no muestra la cabecera, aunque el stream abre y `proxy_buffering off` esta activo.

Impacto:

No bloquea funcionalidad observada de SSE HTTP. Queda como evidencia incompleta de cabecera.

Recomendacion:

Validar con navegador/Network tab y, si la cabecera sigue siendo requisito formal, revisar herencia de headers Nginx o emitir un primer evento/keepalive que permita inspeccion completa de respuesta.

### P08-B02 - Trazas de scheduler/backups durante DB caida

Severidad: Bajo

Evidencia:

- Durante la ventana de MariaDB detenida, backend registro `OperationalError` en `system_backups_tick`.

Impacto:

No afecta la politica DB/marker de mantenimiento, pero genera ruido operacional cuando DB esta caida y scheduler sigue llamando ticks internos.

Recomendacion:

En una iteracion futura, evaluar manejo mas compacto de errores DB en ticks internos de backups/scheduler para evitar stacktraces largos durante indisponibilidad controlada.

## Evidencia obligatoria

### UI real

Estado: **No ejecutado**.

Motivo: no hubo sesion de navegador autenticado controlable con evidencia suficiente. No se declara PRD-ready pleno.

### Consola navegador

Estado: **No ejecutado**.

### SSE en UI

Estado: **No ejecutado**.

Evidencia complementaria HTTP:

```text
HTTP/1.1 200 OK
Content-Type: text/event-stream; charset=utf-8
cache-control: no-cache
```

### Polling fallback

Estado: **No ejecutado**.

### DB/marker D

Estado: **OK**.

```text
Condicion: MariaDB detenida + marker maintenance
POST /api/v1/auth/access-request -> 503 Service Unavailable
Body: mode=maintenance, operationId=pkg08-db-down-marker
GET /api/v1/auth/access-request/status -> 200 OK
```

### DB/marker E

Estado: **OK**.

```text
Condicion: MariaDB detenida + sin marker
POST invalido /api/v1/auth/access-request -> 422 Validation Error
POST valido /api/v1/auth/access-request -> 403 La solicitud de alta no está habilitada actualmente
GET /api/v1/auth/access-request/status -> 200 OK
Conclusion: no hubo bloqueo 503 por middleware maintenance.
```

### X-Accel-Buffering

Estado: **Warning**.

```nginx
add_header X-Accel-Buffering no always;
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 3600s;
```

### Allowlist final

Estado: **OK**.

```text
TRACE_BASE_DIR=/app/assets/temp
MAINTENANCE_TEMP_CLEANUP_ALLOWED_SUBDIRS=traces/tmp,render/tmp,uploads/tmp,maintenance/tmp
MAINTENANCE_TEMP_CLEANUP_DRY_RUN=true

/app/assets/temp/traces/tmp
/app/assets/temp/render/tmp
/app/assets/temp/uploads/tmp
/app/assets/temp/maintenance/tmp
```

### Estado restaurado

Estado: **OK**.

```text
MariaDB: Up healthy
system_operation_state.mode=commissioning
operation_id=7ee326a6-fb66-48de-ac81-f04961910f1b
marker /app/maintenance_state.json restaurado
marker /app/remote_data/maintenance_state.json restaurado
Redis queue:maintenance = 0
```

## Checklist final

- [ ] UI validada.
- [ ] Consola navegador validada.
- [ ] SSE UI validado.
- [ ] Polling fallback validado.
- [x] DB/marker D validado.
- [x] DB/marker E validado.
- [x] Nginx/SSE HTTP validado.
- [~] Header `X-Accel-Buffering` visible externamente.
- [x] Allowlist temporal resuelta.
- [x] Estado DB/marker restaurado.
- [x] Run ledger consistente.
- [x] Sin hallazgos Criticos o Altos abiertos.

## Riesgos residuales

- Falta la validacion real de UI, que sigue siendo critica para experiencia operativa PRD.
- Falta confirmar visualmente SSE y polling fallback en la pantalla.
- La cabecera `X-Accel-Buffering` no aparece en curl externo pese a configuracion; funcionalmente SSE abre stream.
- Los ticks internos pueden producir stacktraces largos si MariaDB cae.

## Recomendacion final para PRD

Mantener **PRD-ready condicionado**.

El backend, worker, ledger, Redis, Nginx/SSE HTTP, allowlist y politica DB/marker ya tienen evidencia operacional suficiente. Para pasar a **PRD-ready** falta una sola clase de cierre: validacion real de frontend en navegador, incluyendo SSE dentro de UI y polling fallback.
