# Analisis integral SSE post fixes

Fecha: 2026-05-30  
Modulo foco: `Sistema >> Mantenimiento`, con revision cruzada del transporte SSE compartido y endpoints SSE relacionados.

## Veredicto ejecutivo

No se evidencia ruptura estructural del modulo SSE por los cambios y fixes aplicados.

El flujo SSE de mantenimiento conserva consistencia entre backend, Redis, Nginx y frontend:

- Backend publica y consume el canal `events:system:maintenance`.
- Worker publica en el mismo canal de mantenimiento.
- Frontend consume `/api/v1/system/maintenance/events` mediante `createAuthorizedEventStream`.
- Nginx mantiene ubicacion especializada para endpoints terminados en `/events`, con buffering deshabilitado.
- La microvalidacion del Paquete 10 ya evidencio SSE conectado y polling fallback funcional al bloquear SSE.

Veredicto practico: **SSE estructuralmente OK, sin hallazgos bloqueantes para PRD**.

## Alcance validado

Revision estatica:

- Transporte frontend SSE compartido.
- Hooks SSE de mantenimiento, backups, notificaciones, sesion, minutas y vista publica.
- Routers backend SSE.
- Servicios backend SSE y canales Redis.
- Configuracion Nginx dev/prd para `/api/.*/events`.
- Instrumentacion de logs SSE.

Validacion runtime:

- Probe HTTP autenticado contra `http://minuetaitor.vsoto.cl`.
- Endpoints administrativos:
  - `/api/v1/auth/session-events`
  - `/api/v1/notifications/events`
  - `/api/v1/system/maintenance/events`
  - `/api/v1/system/backups/events`

No cubierto en runtime en esta pasada:

- `/api/v1/minutes/{transaction_id}/events`
- `/api/v1/minutes/{record_id}/observations/events`
- `/api/v1/minutes/public/{record_id}/events`

Estos endpoints fueron revisados estaticamente, pero requieren transaccion/minuta/sesion visitante validas para una prueba operacional completa.

## Mapa SSE actual

| Area | Endpoint frontend | Canal Redis | Consumidor frontend | Estado |
| --- | --- | --- | --- | --- |
| Sesion auth | `/api/v1/auth/session-events` | usuario/sesion en servicio auth | `useAuthSessionSSE` | OK runtime |
| Notificaciones | `/api/v1/notifications/events` | usuario en centro de notificaciones | `useNotificationsSSE` | OK runtime |
| Mantenimiento | `/api/v1/system/maintenance/events` | `events:system:maintenance` | `useSystemMaintenanceSSE` | OK runtime |
| Backups | `/api/v1/system/backups/events` | `events:system:backups` | `useSystemBackupsSSE` | OK runtime |
| Generacion minuta | `/api/v1/minutes/{transaction_id}/events` | `events:minutes:{transaction_id}` | `useMinuteSSE` | OK estatico |
| Observaciones editor | `/api/v1/minutes/{record_id}/observations/events` | `events:minute:editor:observations:{record_id}` | `MinuteEditor.jsx` | OK estatico |
| Vista publica | `/api/v1/minutes/public/{record_id}/events` | `events:minute:public:{record_id}` | `MinuteViewPage.jsx` | OK estatico |

## Evidencia tecnica

### Transporte frontend compartido

Archivo: `APP/volumes/frontend/src/utils/authorizedEventStream.js`

- Parser de streams SSE y bloques `event:`/`data:`: lineas 213-246.
- Conexion via `fetch` con `Accept: text/event-stream` y `Authorization: Bearer`: lineas 260-268.
- Reconexion con backoff y ventana de retries: lineas 188-211.
- Cierre terminal por eventos `auth_error`, `session_expired`, `completed`, `failed`, etc.: lineas 16-26 y 241-244.
- Evita reconectar despues de `close()` porque `scheduleReconnect` retorna si `closed`: lineas 159-168 y 188-189.

Conclusion: el transporte compartido no fue roto; mantiene autorizacion Bearer, reconexion, cierre terminal y parsing SSE.

### Mantenimiento SSE

Archivo: `APP/volumes/backend/app/services/system_maintenance_events_service.py`

- Canal canonico: `events:system:maintenance`, lineas 20-26.
- Headers SSE con `Cache-Control` y `X-Accel-Buffering`: lineas 29-38.
- Publicacion con evento `maintenance_update`: lineas 45-73.
- Stream con subscribe Redis, keepalive y recycle: lineas 76-204.

Archivo: `APP/volumes/frontend/src/hooks/useSystemMaintenanceSSE.js`

- Consume `/api/v1/system/maintenance/events`.
- Refresca estado al recibir eventos de mantenimiento.
- Expone estado operativo SSE para que la UI indique SSE activo o respaldo por polling.

Conclusion: productor, canal, endpoint y consumidor estan alineados.

### Nginx

Archivo: `APP/data/settings/nginx/conf.d/default-prd.conf`

- `location ~ ^/api/.*/events$`: lineas 42-57.
- Rewrite `/api/(.*)` hacia backend versionado: linea 43.
- `proxy_http_version 1.1`: linea 45.
- `proxy_set_header Connection ""`: linea 46.
- `proxy_buffering off`: linea 52.
- `proxy_cache off`: linea 53.
- Timeouts largos: lineas 54-55.
- `X-Accel-Buffering no`: linea 56.

Archivo: `APP/data/settings/nginx/conf.d/default.conf`

- Misma ubicacion especializada para SSE en desarrollo, con buffering off y timeouts largos.

Conclusion: la estructura de proxy SSE sigue presente y cubre los endpoints actuales que terminan en `/events`.

### Minutas publicas y editor

Archivo: `APP/volumes/backend/app/routers/v1/minute_views.py`

- SSE publico usa `HTTPBearer(auto_error=False)` y extrae token Bearer: lineas 28-55.
- Endpoint publico `/minutes/public/{record_id}/events`: lineas 127-139.

Archivo: `APP/volumes/frontend/src/pages/minuteView/MinuteViewPage.jsx`

- Vista publica usa `createAuthorizedEventStream` con token de sesion visitante: lineas 323-330.
- Maneja eventos terminales y recuperacion de sesion: lineas 333-357.

Archivo: `APP/volumes/backend/app/services/minute_views_service.py`

- Canales publicos/editor: lineas 60-61.
- Headers SSE compartidos de vista minuta: lineas 94-99.
- Stream publico valida sesion visitante antes de suscribir: lineas 462-560.
- Stream editor suscribe al canal de observaciones y emite keepalive/recycle: lineas 739-956.

Conclusion: el uso Bearer del transporte compartido es compatible con el router publico SSE. No se evidencia ruptura estatica.

## Evidencia runtime

Archivo generado:

`analisis-sistema-mantenimiento/evidencias-sse-modulo/sse-admin-runtime-probe.json`

Resultado resumido:

| Endpoint | Status | Content-Type | Resultado |
| --- | ---: | --- | --- |
| `/api/v1/auth/session-events` | 200 | `text/event-stream; charset=utf-8` | OK |
| `/api/v1/notifications/events` | 200 | `text/event-stream; charset=utf-8` | OK |
| `/api/v1/system/maintenance/events` | 200 | `text/event-stream; charset=utf-8` | OK |
| `/api/v1/system/backups/events` | 200 | `text/event-stream; charset=utf-8` | OK |

Observacion: el probe corto no recibio primer chunk antes de 2.5s, lo que es esperable porque los keepalive revisados son de 15s. El status 200 y el content-type `text/event-stream` confirman apertura de stream.

## Hallazgos

### Critico

Sin hallazgos.

### Alto

Sin hallazgos.

### Medio

**M1 - Politica CORS SSE no esta homogeneizada en todos los servicios**

Evidencia:

- `APP/volumes/backend/app/services/system_maintenance_events_service.py`, lineas 29-38: mantenimiento ya evita wildcard en PRD salvo configuracion simple/dev.
- `APP/volumes/backend/app/services/system_backup_events_service.py`, lineas 30-31: mantiene `Access-Control-Allow-Origin: *`.
- `APP/volumes/backend/app/services/notification_center_events_service.py`, lineas 32-33: mantiene `Access-Control-Allow-Origin: *`.
- `APP/volumes/backend/app/services/session_events_service.py`, lineas 97-98: mantiene `Access-Control-Allow-Origin: *`.
- `APP/volumes/backend/app/services/minute_views_service.py`, lineas 94-99: mantiene `Access-Control-Allow-Origin: *`.
- `APP/volumes/backend/app/routers/v1/minutes.py`, lineas 763-767: mantiene `Access-Control-Allow-Origin: *`.

Impacto:

No es una regresion de los fixes de mantenimiento, pero queda una diferencia de postura PRD entre mantenimiento y otros streams SSE. Como los streams usan Authorization Bearer, CORS sigue siendo relevante para navegadores.

Recomendacion:

Unificar helper de headers SSE o politica CORS por ambiente para todos los servicios SSE. Mantener wildcard solo en dev o cuando exista configuracion explicita.

### Bajo

**B1 - `X-Accel-Buffering` no fue visible en el probe runtime via fetch**

Evidencia:

- Configuracion Nginx PRD si declara `add_header X-Accel-Buffering no always`: `APP/data/settings/nginx/conf.d/default-prd.conf`, linea 56.
- Backend tambien declara el header en servicios SSE.
- Probe runtime dejo `xAccelBuffering: null` en `sse-admin-runtime-probe.json`.

Impacto:

Bajo. El stream abre correctamente y Nginx tiene `proxy_buffering off`. La ausencia en el probe puede deberse a exposicion/normalizacion de headers en `fetch` o a la capa de proxy efectiva.

Recomendacion:

Si se requiere evidencia formal, validar con `curl -i -N` contra cada endpoint o revisar `nginx -T` dentro del contenedor operativo.

**B2 - Runtime no cubrio SSE de minutas transaccionales/publicas/editor**

Evidencia:

- La prueba runtime cubrio solo endpoints administrativos.
- Los endpoints de minutas requieren `transaction_id`, `record_id` y/o token visitante real.

Impacto:

Bajo para la duda actual sobre estructura. La revision estatica no detecta contrato roto, pero no reemplaza una prueba end-to-end de minuta.

Recomendacion:

En una validacion de regresion funcional completa, generar una minuta de prueba, iniciar generacion, abrir stream de transaction, abrir vista publica con OTP/token visitante y probar observaciones editor-publico.

**B3 - Eventos terminales globales deben seguir usandose con cuidado**

Evidencia:

- `createAuthorizedEventStream` considera terminales `completed`, `failed`, `cancelled`, `auth_error`, etc.: `APP/volumes/frontend/src/utils/authorizedEventStream.js`, lineas 16-26.

Impacto:

Bajo. Es correcto para generacion de minutas y errores de sesion. Los streams administrativos usan nombres no terminales como `maintenance_update`, por lo que no se rompen. Riesgo futuro si un stream nuevo emite `failed` como evento informativo y espera seguir abierto.

Recomendacion:

Documentar convencion: eventos terminales globales cierran stream; estados no terminales deben viajar dentro del payload o con nombres especificos (`*_update`).

## Riesgo de regresion

Riesgo actual: **Bajo**.

Motivos:

- Los endpoints administrativos SSE abren en runtime con 200 y `text/event-stream`.
- Nginx conserva ubicacion dedicada para `/api/.*/events`.
- El transporte frontend usa Bearer y reconexion controlada.
- Mantenimiento tiene fallback por polling validado en Paquete 10.
- No se encontro divergencia entre canal Redis productor/consumidor para mantenimiento.

## Checklist SSE

- [x] Transporte frontend parsea `event:` y `data:`.
- [x] Transporte frontend envia `Authorization: Bearer`.
- [x] Transporte frontend reconecta con backoff.
- [x] Transporte frontend cierra en eventos terminales esperados.
- [x] Mantenimiento publica en `events:system:maintenance`.
- [x] Mantenimiento consume `/api/v1/system/maintenance/events`.
- [x] Worker usa el canal de mantenimiento esperado.
- [x] Nginx tiene location especializado para `/api/.*/events`.
- [x] Nginx deshabilita buffering para SSE.
- [x] Admin SSE runtime responde `200 text/event-stream`.
- [x] Polling fallback de mantenimiento fue validado en Paquete 10.
- [ ] Runtime end-to-end de SSE minuta transaccional.
- [ ] Runtime end-to-end de SSE vista publica visitante.
- [ ] Runtime end-to-end de SSE observaciones editor.
- [ ] Homologar CORS SSE en todos los servicios si PRD exige no wildcard.

## Veredicto final

**PRD-ready desde la perspectiva estructural SSE del submodulo Sistema >> Mantenimiento.**

Condiciones no bloqueantes:

- Homologar CORS en el resto de endpoints SSE en una mejora posterior.
- Ejecutar una prueba end-to-end de SSE de minutas cuando se quiera cerrar regresion global fuera del alcance de mantenimiento.
