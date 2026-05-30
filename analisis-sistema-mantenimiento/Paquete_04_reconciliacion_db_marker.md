# Paquete 04 - Reconciliacion DB/marker

## Estado

Implementado en codigo. No se ejecuto backend ni pruebas HTTP dentro de Docker.

## Cambios aplicados

Archivos modificados:

- `APP/volumes/backend/app/services/system_maintenance_service.py`
- `APP/volumes/backend/app/routers/v1/system_maintenance.py`
- `APP/volumes/backend/app/schemas/system_maintenance.py`
- `APP/volumes/backend/app/main.py`

## Politica final DB/marker

La base de datos queda como fuente primaria del modo operativo.

El archivo marker pasa a ser un artefacto derivado. El sistema compara DB y marker al consultar estado y al aplicar middleware de bloqueo.

Politica conservadora:

- Si DB indica modo restringido y marker falta o difiere, el sistema sigue restringido desde DB.
- Si DB indica `normal` pero existe marker restringido, el sistema no se libera automaticamente; queda restringido por estado inconsistente.
- Si marker esta corrupto y DB indica restringido, predomina DB.
- Si DB no se puede leer en middleware, se usa marker como fallback conservador.

## Cambios en consulta de estado

`get_system_operation_state` ya no retorna marker como primera fuente incondicional.

Ahora:

1. Lee DB.
2. Lee marker.
3. Si DB esta restringida, retorna DB.
4. Si DB normal y marker restringido, retorna marker con `source=marker_file_inconsistent`.
5. Si DB restringida y marker falta/difiere, retorna DB con `source=database_marker_inconsistent`.

## Payload publico reducido

El endpoint publico `/v1/system/maintenance/operation-state/public` ahora usa `get_public_system_operation_state`.

La respuesta publica mantiene el contrato, pero reduce exposicion:

- `started_by = null`
- `reason = null`, salvo mensaje generico en estado inconsistente
- conserva `mode`, `operation_id`, `operation_type`, `started_at`, `source`

## Orden de escritura al cambiar modo

Antes:

- marker se escribia/limpiaba antes de `db.commit()`.

Ahora:

1. Se actualiza DB.
2. Se hace `commit`.
3. Se escribe o limpia marker derivado.
4. Si falla la sincronizacion del marker, se registra error en logs y metadata.

## Validaciones backend nuevas

En `SystemOperationModeRequest`:

- `reason` tiene `max_length=500`.
- `reason` se normaliza colapsando espacios.

En servicio:

- `reason` es obligatorio para modos distintos de `normal`.
- `reason` mayor a 500 caracteres se rechaza.

## Middleware operativo

`maintenance_marker_read_only_middleware` ahora calcula estado efectivo:

1. Intenta leer DB.
2. Usa DB si esta restringida.
3. Si DB normal pero marker restringido, aplica bloqueo conservador.
4. Si DB falla, usa marker como fallback.

Esto evita liberar escrituras si el marker quedo divergente.

## Comportamiento ante divergencia

DB normal + marker maintenance:

- estado efectivo restringido
- source `marker_file_inconsistent`
- no libera automaticamente

DB maintenance + sin marker:

- estado efectivo restringido desde DB
- source `database_marker_inconsistent`

Marker corrupto:

- si DB restringida, predomina DB
- si DB normal, no hay bloqueo derivado del marker corrupto

Fallo al escribir marker:

- DB queda persistida
- se registra error en logs
- se intenta guardar `marker_sync_error` en metadata
- consultas posteriores detectan inconsistencia si marker falta/difiere

## Pruebas sugeridas

1. DB normal + marker maintenance:
   - esperado: bloqueo conservador, source inconsistente.
2. DB maintenance + sin marker:
   - esperado: bloqueo desde DB.
3. Marker corrupto:
   - esperado: DB decide si esta disponible.
4. Fallo al escribir marker:
   - esperado: DB queda actualizada y se registra error operacional.
5. Fallo de commit DB:
   - esperado: no debe escribirse/limpiarse marker.
6. `reason` vacio en modo restringido:
   - esperado: error 400.
7. `reason` mayor a 500:
   - esperado: error de validacion.
8. Endpoint publico:
   - esperado: no expone actor ni motivo administrativo sensible.

## Validacion realizada

Comandos ejecutados:

```bash
python3 -m py_compile APP/volumes/backend/app/main.py APP/volumes/backend/app/services/system_maintenance_service.py APP/volumes/backend/app/schemas/system_maintenance.py APP/volumes/backend/app/routers/v1/system_maintenance.py
git diff --check
```

Resultado:

- Compilacion estatica Python OK.
- `git diff --check` OK.
