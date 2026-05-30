# Paquete 05 - Alertas, SSE y frontend operativo

## Estado

Implementado de forma acotada. No se ejecuto build frontend ni servicios Docker.

## Cambios aplicados

Archivos modificados:

- `APP/volumes/frontend/src/pages/system/SystemSettingsMaintenancePanel.jsx`
- `APP/volumes/backend/app/services/system_maintenance_events_service.py`
- `APP/volumes/backend/app/services/system_maintenance_service.py`

## Mejoras frontend

### Polling de respaldo con SSE conectado

Antes:

- Si SSE estaba conectado, la pantalla no hacia polling.

Ahora:

- Si hay rutina activa: polling cada 5 segundos.
- Si SSE esta conectado y no hay rutina activa: polling de respaldo cada 90 segundos.
- Si SSE no esta conectado: polling normal cada 120 segundos.

Esto mejora convergencia si Pub/Sub pierde un evento o si el navegador mantiene una conexion SSE aparentemente viva.

### Estados visuales de ejecucion

Los botones de ejecucion manual ahora distinguen:

- `Encolando...`
- `En cola`
- `En curso`
- `Finalizado con advertencia`
- `Reintentar ahora`
- `Ejecutar ahora`

Ademas, si la rutina esta `queued` o `running`, el boton queda bloqueado para evitar disparos manuales concurrentes desde UI.

## Mejoras SSE/CORS

Antes:

- `maintenance_sse_headers()` siempre enviaba `Access-Control-Allow-Origin: *`.

Ahora:

- En `dev` mantiene `*`.
- En otros entornos solo agrega `Access-Control-Allow-Origin` si existe exactamente un origen configurado en `cors_allowed_origins`.
- Si hay multiples origenes o ninguno, deja que el middleware/gateway CORS gobierne la respuesta.

## Mejoras de alertas por email

Antes:

- Fallas al encolar emails de alerta/recuperacion de colas se silencian.

Ahora:

- Se registran warnings con `queue`, `size`, `threshold` y `exc_info=True`.
- La notificacion in-app sigue sin bloquearse por fallas de correo.

## No implementado en esta fase

- Persistencia dedicada de estado de alerta por cola en tabla nueva.
- Preferencias configurables de que eventos generan notificacion admin.
- Supresion completa de ruido por notificaciones `running/success` programadas.

Queda recomendado para una siguiente fase porque requiere definir contrato funcional y posiblemente migracion adicional.

## Pruebas manuales sugeridas

1. Abrir `Sistema >> Mantenimiento` con SSE conectado.
   - esperado: badge `SSE + respaldo 90s` cuando no hay rutina activa.
2. Encolar limpieza manual.
   - esperado: boton pasa por `Encolando...`, luego `En cola`/`En curso`.
3. Simular perdida de evento SSE.
   - esperado: la pantalla converge por polling de respaldo.
4. Probar entorno PRD con `cors_allowed_origins`.
   - esperado: SSE no usa wildcard.
5. Forzar falla SMTP/email queue.
   - esperado: alerta in-app sigue y backend registra warning.

## Validacion realizada

Comandos ejecutados:

```bash
python3 -m py_compile APP/volumes/backend/app/services/system_maintenance_events_service.py APP/volumes/backend/app/services/system_maintenance_service.py
git diff --check
```

Resultado:

- Compilacion estatica Python OK.
- `git diff --check` OK.

No se ejecuto build frontend por las reglas del repositorio: no instalar ni asumir runtime local Node fuera de Docker.
