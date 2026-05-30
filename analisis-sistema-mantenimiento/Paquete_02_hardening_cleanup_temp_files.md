# Paquete 02 - Hardening cleanup_temp_files

## Estado

Implementado en codigo. No se ejecuto el worker ni se probaron rutas reales dentro de Docker.

## Cambios aplicados

Archivos modificados:

- `APP/volumes/worker/app/core/config.py`
- `APP/volumes/worker/app/handlers/maintenance_handler.py`

## Politica final de seguridad de rutas

La rutina `cleanup_temp_files` ahora opera en modo conservador:

1. `TRACE_BASE_DIR` debe ser una ruta absoluta.
2. Se resuelve la ruta con `Path.resolve(strict=False)`.
3. Se rechazan raices peligrosas:
   - `/`
   - `/app`
   - `/mnt`
   - `/var`
   - `/tmp`, salvo que `MAINTENANCE_TEMP_CLEANUP_ALLOW_TMP_ROOT=true`
4. No se siguen symlinks.
5. Cada candidato debe mantenerse dentro de `TRACE_BASE_DIR`.
6. Cada candidato debe estar dentro de una raiz permitida por allowlist.
7. Solo se limpian subdirectorios permitidos existentes.
8. Si no existe ningun subdirectorio permitido, no se borra nada y la ejecucion queda en `warning`.
9. No se borran directorios vacios fuera de las rutas permitidas.
10. Si hay fallos parciales o advertencias, el estado final queda en `warning`.

## Configuracion nueva del worker

Variables de entorno nuevas:

- `MAINTENANCE_TEMP_CLEANUP_ALLOWED_SUBDIRS`
  - Default: `traces/tmp,render/tmp,uploads/tmp,maintenance/tmp`
- `MAINTENANCE_TEMP_CLEANUP_DRY_RUN`
  - Default: `false`
- `MAINTENANCE_TEMP_CLEANUP_SAFETY_GRACE_MINUTES`
  - Default: `30`
- `MAINTENANCE_TEMP_CLEANUP_ALLOW_TMP_ROOT`
  - Default: `false`

## Ejemplos de rutas permitidas

Si `TRACE_BASE_DIR=/app/assets/temp`, quedan permitidas solo rutas bajo:

- `/app/assets/temp/traces/tmp`
- `/app/assets/temp/render/tmp`
- `/app/assets/temp/uploads/tmp`
- `/app/assets/temp/maintenance/tmp`

## Ejemplos de rutas rechazadas u omitidas

- `TRACE_BASE_DIR=/`
- `TRACE_BASE_DIR=/app`
- `TRACE_BASE_DIR=/mnt`
- `TRACE_BASE_DIR=/var`
- `TRACE_BASE_DIR=/tmp` sin permiso explicito
- rutas relativas como `assets/temp`
- symlinks
- archivos directamente bajo `TRACE_BASE_DIR` si no estan dentro de allowlist
- subdirectorios con `..`

## Contadores registrados

El mensaje runtime ahora incluye:

- `scanned`
- `deleted_files`
- `deleted_dirs`
- `skipped`
- `failed`
- `retention_days`
- `safety_grace_minutes`
- `allowed_roots`
- resumen de advertencias

## Estado runtime

El handler de mantenimiento ahora acepta estado final `warning`, ademas de `success` y `error`.

Si `cleanup_temp_files` devuelve advertencias o errores parciales:

- `system_maintenance_runs.status = warning`
- runtime legacy queda en `warning`
- evento SSE se publica con `status=warning`
- notificacion admin usa nivel warning

## Pruebas sugeridas

1. `TRACE_BASE_DIR` inexistente:
   - esperado: no borra, estado `warning`.
2. `TRACE_BASE_DIR=/`:
   - esperado: error, no borra.
3. `TRACE_BASE_DIR=/tmp` sin `MAINTENANCE_TEMP_CLEANUP_ALLOW_TMP_ROOT=true`:
   - esperado: error, no borra.
4. Symlink dentro de allowlist apuntando fuera:
   - esperado: se omite.
5. Archivo reciente:
   - esperado: se omite por gracia/retencion.
6. Archivo antiguo dentro de allowlist:
   - esperado: se elimina si no es dry-run.
7. Archivo sin permisos:
   - esperado: `failed > 0` y estado `warning`.
8. Directorio vacio permitido:
   - esperado: se elimina si queda vacio.
9. Directorio vacio no permitido:
   - esperado: no se toca.

## Validacion realizada

Comandos ejecutados:

```bash
python3 -m py_compile APP/volumes/worker/app/core/config.py APP/volumes/worker/app/handlers/maintenance_handler.py
git diff --check
```

Resultado:

- Compilacion estatica Python OK.
- `git diff --check` OK.
