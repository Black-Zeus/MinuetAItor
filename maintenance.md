# Modulo de respaldos, restauracion y limpieza de respaldos

## Proposito

Este documento define el diseno operativo del modulo de respaldos de MinuetAItor.

El modulo debe permitir:

- Generar respaldos manuales y programados.
- Restaurar respaldos compatibles.
- Limpiar respaldos antiguos segun politicas de retencion.
- Proteger la consistencia del sistema durante backup, restore y purge.
- Dejar trazabilidad clara de cada operacion critica.

El alcance de los respaldos es exclusivamente de datos aplicativos:

- MariaDB: datos, no estructura.
- MinIO: objetos/binarios de buckets controlados.

No se respalda infraestructura, imagenes Docker, volumen completo de MariaDB, scripts SQL, secretos runtime ni estructura de base de datos.

## Principios

- El backend orquesta y valida permisos.
- Un worker dedicado ejecuta operaciones pesadas.
- Las operaciones criticas corren con lock exclusivo.
- El sistema entra en modo protegido durante backup, restore y purge.
- Backup manual y automatico usan modo solo lectura durante la ventana de trabajo.
- Restore usa modo mantenimiento estricto.
- Restore es destructivo y solo se permite sobre paquetes verificados y compatibles.
- Despues de restore se fuerza una sesion limpia para todos los usuarios.
- Redis no debe ser la unica fuente de verdad para locks o estado de restore, porque Redis se limpia durante el proceso.

## Arquitectura propuesta

### Backend

Responsabilidades:

- Exponer endpoints publicos bajo `/v1/system/backups`.
- Validar rol administrador.
- Activar y desactivar modo mantenimiento.
- Activar y desactivar modo solo lectura para backups.
- Encolar jobs de respaldo en Redis.
- Persistir configuracion, historial, locks y auditoria.
- Bloquear requests normales cuando el sistema este en mantenimiento.
- Bloquear escrituras normales cuando el sistema este en solo lectura.
- Permitir solo rutas internas, healthcheck y la sesion autorizada cuando aplique.

### Backup worker dedicado

Se recomienda crear un contenedor dedicado, por ejemplo `backup-worker`.

Motivos:

- Aisla jobs pesados y destructivos del worker normal.
- Permite instalar herramientas especificas: `mariadb-dump`, cliente MariaDB, `tar`, `gzip`, utilidades de checksum y opcionalmente MinIO Client `mc`.
- Permite montar el volumen de respaldos.
- Puede trabajar con concurrencia controlada, idealmente un solo job critico a la vez.
- Evita competir con jobs de IA, correo, mantenimiento liviano o PDF.

En desarrollo queda definido como servicio `backup-worker` en `docker-compose-dev.yml`, con Dockerfile dedicado:

```txt
Data/dokerFile/dev_qa/Dockerfile.backup-worker
```

La imagen debe incluir, como minimo:

- `mariadb-client` para `mariadb-dump` y cliente MariaDB.
- MinIO Client `mc`.
- `tar`, `gzip` y `sha256sum`.
- Python runtime para consumir cola y reportar estado al backend.

Cola sugerida:

```txt
queue:backups
```

Tipos de job sugeridos:

```txt
db_backup
object_backup
full_backup
restore_backup
backup_purge
```

### Scheduler

El scheduler no deberia generar respaldos directamente.

Responsabilidades:

- Llamar un tick interno del backend.
- El backend decide si una politica esta vencida.
- Si el sistema esta en mantenimiento, registrar tareas diferidas o saltadas.
- Despues de backup/purge, permitir reconciliar tareas diferidas.
- Despues de restore, descartar tareas diferidas previas.

## Estados globales del sistema

Estados sugeridos:

```txt
normal
read_only_backup
maintenance_backup
maintenance_restore
maintenance_purge
```

El estado debe persistirse en MariaDB o en una fuente durable equivalente.

Campos sugeridos:

```txt
mode
operation_id
operation_type
reason
started_by
allowed_session_jti
started_at
expires_at
metadata_json
```

Reglas:

- `normal`: operacion habitual.
- `read_only_backup`: se permite navegacion y lectura, pero se bloquean escrituras normales y nuevos jobs mutantes.
- `maintenance_backup`: alias operacional si se requiere bloquear toda la UI durante un backup; en esta version la politica elegida para backup es `read_only_backup`.
- `maintenance_restore`: bloqueo estricto; solo opera el proceso de restore y la sesion autorizada hasta el punto de limpieza final.
- `maintenance_purge`: bloqueo de operaciones de backup/restore y, segun politica, bloqueo global.
- Todo modo de mantenimiento debe tener vencimiento operativo o mecanismo administrativo de recuperacion.

## Experiencia visual durante modo protegido

La UI debe mostrar una ayuda visual clara cuando el sistema este en modo protegido.

Para `read_only_backup`:

- Mostrar banner global indicando que el sistema esta en respaldo y temporalmente en solo lectura.
- Deshabilitar acciones que generen escritura.
- Mostrar mensajes de error amables si una accion mutante intenta ejecutarse durante la ventana.
- Mostrar en login y pantallas de autenticacion un mensaje de mantenimiento/solo lectura para evitar nuevos registros o acciones que escriban en BD.

Para `maintenance_restore`:

- Bloquear login normal.
- Mostrar mensaje de mantenimiento por restauracion.
- Permitir solo acceso administrativo estrictamente necesario si la operacion lo requiere.

Cuando una sesion activa detecte `maintenance_restore`:

- Abrir un modal bloqueante informando que el sistema entro en modo mantenimiento por restauracion.
- Mostrar un timer de 30 segundos.
- Al terminar el timer, cerrar la sesion local y expulsar al usuario hacia login.
- El login debe permanecer bloqueado para nuevos accesos mientras dure `maintenance_restore`.

## Lock exclusivo

Debe existir un lock global para operaciones criticas.

Operaciones mutuamente excluyentes:

- Backup manual.
- Backup programado.
- Restore.
- Purge.
- Importacion de paquete externo, si se implementa.

Reglas:

- No puede correr mas de una operacion critica al mismo tiempo.
- Restore tiene prioridad conceptual, pero no debe interrumpir un backup a medias sin politica explicita.
- Purge nunca debe correr durante backup o restore.
- El lock no debe depender solo de Redis.

## Respaldo de MariaDB

El respaldo de MariaDB debe ser de datos, no de estructura.

Dump sugerido:

```txt
mariadb-dump --no-create-info --single-transaction --routines=false --triggers=false
```

El paquete no debe incluir `CREATE TABLE`, `ALTER TABLE`, triggers ni procedimientos.

Contenido sugerido:

```txt
metadata.json
manifest.json
data.sql.gz
checksums.txt
```

Metadata minima:

```txt
app_version
db_schema_version
backup_scope
created_at
created_by
source_environment
tables
checksum
```

Reglas:

- En esta version se respaldan todas las tablas del sistema.
- La lista blanca de MariaDB corresponde a todas las tablas aplicativas y de sistema creadas por el esquema vigente.
- La estructura se asume existente en el entorno destino.
- El restore solo inyecta data y conserva identificadores y relaciones.
- El paquete debe validar compatibilidad de version de app y version de esquema antes de restaurar.

## Version de esquema de BD

Como el proyecto no usa un framework de migraciones visible, `db_schema_version` debe derivarse de los scripts SQL manuales.

Formato propuesto:

```txt
<latest_sql_file>::<schema_fingerprint>
```

Ejemplo:

```txt
20260517_1950_alter_system_maintenance_queue_monitoring.sql::sha256:1a2b3c4d5e6f
```

Reglas para calcularlo:

- Ordenar lexicograficamente los archivos `*.sql` de `APP/data/settings/mariadb/init`.
- Calcular un SHA-256 sobre el contenido concatenado en ese orden.
- Usar los primeros 12 caracteres hexadecimales para lectura humana, conservando el hash completo en `metadata.json` si se desea.
- `latest_sql_file` es el ultimo archivo SQL del orden lexicografico considerado.
- El backup registra `app_version`, `db_schema_version`, `schema_fingerprint_full` y `latest_sql_file`.
- Restore solo se permite si `app_version` y `db_schema_version` coinciden con el entorno destino.

Nota:

- Si en el futuro se incorpora una tabla formal de migraciones, `db_schema_version` debe pasar a usar esa fuente como autoridad.

## Restore de MariaDB

El restore de MariaDB debe limpiar la base de forma controlada antes de inyectar datos.

Procedimiento conceptual:

```sql
SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE tabla_hija_1;
TRUNCATE tabla_hija_2;
TRUNCATE tabla_padre_1;

SET FOREIGN_KEY_CHECKS = 1;
```

Reglas:

- Usar lista blanca de tablas restaurables.
- En esta version esa lista equivale a todas las tablas del sistema.
- Mantener un orden explicito de truncate, aunque se desactiven FK.
- No restaurar sesiones activas.
- No restaurar cache ni estado runtime.
- Generar auditoria local de la actividad de restore antes y despues de ejecutar.
- Validar integridad al finalizar.

Tablas con tratamiento especial:

- `user_sessions`: limpiar siempre, no restaurar sesiones activas.
- Tablas de auditoria: deben registrar la actividad de backup, restore y purge. Si la auditoria historica entra en el snapshot, el evento local de restore debe reinsertarse al finalizar o conservarse fuera del truncado.
- Tablas de configuracion: incluir solo si son datos aplicativos, no secretos runtime.
- Tablas de colas o estados temporales: no restaurar.

### Orden de truncate propuesto

El esquema contiene ciclos de FK validos para la aplicacion, por ejemplo referencias entre `users` y `objects`, y entre `records` y `record_versions`. Por eso el restore debe ejecutar el truncado con `FOREIGN_KEY_CHECKS=0`.

El orden siguiente se deriva de las FK declaradas en los SQL manuales y deja primero tablas hijas o de evento:

```txt
ai_tag_conversions
ai_usage_events
artifact_type_mime_types
audit_log
email_delivery_events
mime_type_extensions
notification_recipients
organization_settings
participant_emails
record_artifacts
record_drafts
record_status_transitions
record_type_artifact_types
record_version_agreements
record_version_ai_tags
record_version_commits
record_version_observations
record_version_requirements
record_version_tags
role_permissions
smtp_configs
system_maintenance_settings
user_client_acl
user_clients
user_dashboard_widgets
user_notification_preferences
user_profiles
user_project_acl
user_roles
user_sessions
ai_model_pricing
ai_provider_configs
notifications
artifact_states
minute_transactions
artifact_types
ai_tags
visitor_sessions
tags
permissions
dashboard_widgets
roles
visitor_access_requests
tag_categories
record_version_participants
participants
ai_profile_categories
ai_profiles
buckets
clients
file_extensions
mime_types
objects
projects
record_statuses
record_types
record_versions
records
users
version_statuses
```

Notas:

- Antes de truncar, ejecutar `SET FOREIGN_KEY_CHECKS = 0`.
- Despues de cargar la data, ejecutar `SET FOREIGN_KEY_CHECKS = 1`.
- Si se agregan tablas nuevas, recalcular este orden desde las FK vigentes.
- El evento de auditoria del restore no debe depender de que el usuario original exista despues de reinyectar la data.

## Respaldo de MinIO

MinIO expone API compatible S3. No debe asumirse como una carpeta real de filesystem.

Estrategias posibles:

### API S3/MinIO

El backup-worker lista buckets y objetos, descarga streams y empaqueta el contenido.

Debe preservar:

- Bucket.
- Object key.
- Size.
- ETag o checksum.
- Content-Type.
- Metadata del objeto.

### MinIO Client `mc`

Estrategia elegida para esta version por estabilidad operacional.

Flujo conceptual:

```txt
mc alias set local http://minio:9000 <user> <password>
mc mirror local/<bucket> /backup-staging/minio/<bucket>
```

Luego el staging se empaqueta dentro del backup final.

Reglas:

- En esta version se respaldan todos los buckets del sistema.
- La lista blanca de MinIO corresponde a todos los buckets propios de MinuetAItor.
- No respaldar buckets ajenos al sistema.
- Registrar inventario de objetos en `manifest.json`.
- Validar checksums al generar y antes de restaurar.

Buckets concretos del sistema segun seed de catalogos y `db/minio_client.py`:

```txt
minuetaitor-inputs
minuetaitor-json
minuetaitor-published
minuetaitor-attach
minuetaitor-draft
```

## Restore de MinIO

El restore de MinIO debe ser destructivo y controlado para los buckets incluidos.

Procedimiento conceptual:

1. Validar manifest y checksum.
2. Entrar en modo `maintenance_restore`.
3. Limpiar buckets controlados.
4. Reinyectar objetos desde el paquete.
5. Validar inventario final.

Reglas:

- No limpiar buckets fuera de la lista blanca.
- En esta version la lista blanca corresponde a todos los buckets del sistema.
- No restaurar objetos si el paquete no corresponde al scope esperado.
- En restore full, DB y MinIO deben quedar consistentes entre si.

## Tipos de respaldo

### Database

Incluye solo datos de MariaDB.

No incluye:

- Estructura.
- Objetos MinIO.
- Secretos runtime.

### Objects

Incluye solo buckets/objetos MinIO controlados.

No incluye:

- Dump MariaDB.
- Estructura de BD.

### Full

Incluye:

- Datos MariaDB.
- Objetos MinIO.
- Manifest comun.
- Metadata de version y compatibilidad.

No incluye:

- Estructura SQL.
- Imagenes Docker.
- Secretos runtime sin politica explicita.

## Formato del paquete

Formato final:

```txt
backup-<scope>-<timestamp>.tar.gz
```

Ejemplos:

```txt
backup-database-20260524T031500Z.tar.gz
backup-objects-20260524T032000Z.tar.gz
backup-full-20260524T040000Z.tar.gz
```

Estructura interna:

```txt
metadata.json
manifest.json
checksums.sha256
mariadb/data.sql.gz
minio/<bucket>/data.bucket.tar.gz
```

Reglas:

- `metadata.json` y `manifest.json` deben soportar `database`, `objects` y `full` con la misma estructura base.
- Las secciones no aplicables deben existir como deshabilitadas o vacias, no eliminarse sin contrato.
- `full` equivale a `database` + `objects`.
- Para `database`, la seccion MinIO queda vacia o marcada como `included: false`.
- Para `objects`, la seccion MariaDB queda vacia o marcada como `included: false`.
- Cada bucket MinIO se empaqueta por separado como `minio/<bucket>/data.bucket.tar.gz`.
- `checksums.sha256` debe cubrir metadata, manifest y cada payload real.

Estructura conceptual de `metadata.json`:

```json
{
  "schemaVersion": "1",
  "backupId": "uuid",
  "scope": "full",
  "createdAt": "2026-05-24T03:15:00Z",
  "createdBy": {
    "userId": "uuid",
    "username": "admin",
    "fullName": "Administrador",
    "email": "admin@example.com"
  },
  "appVersion": "version",
  "dbSchemaVersion": "latest_sql::sha256:abcdef123456",
  "sourceEnvironment": "dev",
  "sections": {
    "mariadb": { "included": true },
    "minio": { "included": true }
  }
}
```

Estructura conceptual de `manifest.json`:

```json
{
  "schemaVersion": "1",
  "backupId": "uuid",
  "scope": "full",
  "mariadb": {
    "included": true,
    "path": "mariadb/data.sql.gz",
    "format": "sql_gzip",
    "tables": []
  },
  "minio": {
    "included": true,
    "buckets": [
      {
        "name": "minuetaitor-inputs",
        "path": "minio/minuetaitor-inputs/data.bucket.tar.gz",
        "objectCount": 0,
        "sizeBytes": 0
      }
    ]
  }
}
```

## Backup purge

`backup_purge` es la limpieza automatica o manual de respaldos antiguos.

No genera respaldos.
No restaura datos.
No modifica MariaDB aplicativa ni MinIO aplicativo.

Responsabilidades:

- Eliminar paquetes vencidos segun retencion.
- Actualizar historial.
- Liberar almacenamiento.
- Mantener reglas de seguridad de conservacion.

Reglas:

- No correr durante backup o restore.
- No borrar el ultimo respaldo exitoso de cada scope.
- Conservar al menos una cantidad minima de respaldos validos por tipo, aunque superen la retencion.
- No borrar paquetes en estado `running`, `verifying`, `restoring` o `locked`.
- Registrar auditoria de cada paquete eliminado.

Antes de calcular candidatos, el backend debe reconciliar el catalogo de BD contra la carpeta fisica de respaldos.
La UI lee desde `system_backup_artifacts`, pero ese catalogo debe reflejar el filesystem:

- Paquetes `backup-*.tar.gz` presentes en carpeta y ausentes en BD se registran como `origin_type=filesystem`.
- Registros `available` cuyo archivo fisico ya no exista pasan a `status=missing`.
- Registros `missing` cuyo archivo fisico reaparece vuelven a `status=available`.
- `purge` solo considera artefactos `available` y nunca elimina el ultimo valido por scope.

Ejemplo:

```txt
retencion: 14 dias
minimos protegidos:
  database: 3
  objects: 2
  full: 2
```

## Flujo de backup manual

1. Administrador solicita respaldo.
2. Backend valida permisos.
3. Backend adquiere lock exclusivo.
4. Backend activa `read_only_backup`.
5. Backend pausa o bloquea productores de tareas normales y escrituras de usuario.
6. Backend encola job en `queue:backups`.
7. Backup-worker genera el paquete.
8. Backup-worker genera manifest y checksums.
9. Backup-worker registra resultado.
10. Backend desactiva modo solo lectura.
11. Se reconcilian tareas diferidas segun politica.

## Flujo de backup programado

1. Scheduler llama tick interno.
2. Backend evalua cron de politicas.
3. Si no hay mantenimiento ni lock activo, encola backup.
4. Si hay mantenimiento, registra tarea diferida o saltada.
5. Backend activa `read_only_backup`.
6. Backup-worker ejecuta igual que en backup manual.

## Flujo de restore

1. Administrador selecciona paquete.
2. Backend valida permisos.
3. Backend reconcilia carpeta fisica de respaldos contra `system_backup_artifacts`.
4. Backend valida manifest, checksum, scope y compatibilidad de version.
5. Backend genera un respaldo preventivo del mismo scope que el restore solicitado.
6. Backend valida que el respaldo preventivo quedo `available`.
7. Backend adquiere lock exclusivo.
8. Backend escribe marker file de restore en la raiz operativa del backend.
9. Backend activa `maintenance_restore`.
10. Backend envia correo de inicio a todos los usuarios con perfil administrador.
11. Backend revoca todas las sesiones salvo la del operador que inicio restore.
12. Backend bloquea nuevas conexiones normales.
13. Backup-worker limpia MariaDB mediante truncate controlado.
14. Backup-worker restaura data MariaDB.
15. Backup-worker limpia buckets MinIO controlados.
16. Backup-worker restaura objetos MinIO.
17. Backup-worker ejecuta validacion post-restore.
18. Al terminar, se revocan todas las sesiones, incluida la del operador.
19. Se limpia Redis y colas operativas.
20. Se descartan tareas diferidas previas al restore.
21. Backend envia correo de termino a todos los usuarios con perfil administrador.
22. Backend elimina o marca como completado el marker file.
23. Backend deja el sistema en estado `normal` o `clear`.
24. Usuarios deben iniciar sesion nuevamente.

Regla clave:

```txt
Despues de restore no se reejecutan tareas diferidas anteriores.
```

Esas tareas pertenecian al estado previo del sistema.

Restore debe soportar los tres scopes:

- `database`: ejecuta solo subflujo MariaDB.
- `objects`: ejecuta solo subflujo MinIO.
- `full`: ejecuta subflujo MariaDB y subflujo MinIO.

La seleccion del subflujo se deriva desde `metadata.json`, `manifest.json` y checksums. La UI puede mostrarlo como una sola accion de restore, pero internamente el backend y el backup-worker deben validar y enrutar segun el scope del paquete.

Regla de respaldo preventivo antes de restore:

- Restore `database` genera primero un backup `database`.
- Restore `objects` genera primero un backup `objects`.
- Restore `full` genera primero un backup `full`.
- El respaldo preventivo debe quedar marcado como `origin_type=pre_restore`.
- Si el respaldo preventivo falla, el restore no inicia.

## Flujo de backup purge

1. Backend o scheduler solicita purge segun politica.
2. Backend valida que no exista backup o restore activo.
3. Backend adquiere lock exclusivo.
4. Backend activa `maintenance_purge` o modo protegido equivalente.
5. Backup-worker calcula candidatos vencidos.
6. Backup-worker aplica reglas de proteccion.
7. Backup-worker elimina paquetes permitidos.
8. Backup-worker actualiza historial y auditoria.
9. Backend libera lock y modo mantenimiento.

## Pausa de tareas y reconciliacion

Durante mantenimiento se deben pausar o bloquear tareas normales para evitar escrituras concurrentes.

Categorias sugeridas:

### Tareas a pausar

- Procesamiento IA.
- Generacion PDF.
- Envio de correos.
- Jobs de minutas.
- Limpiezas operativas.
- Ticks programados que muten estado.

### Tareas permitidas

- Healthcheck.
- Endpoints internos estrictamente necesarios para backup/restore.
- Consulta de estado de la operacion por administradores autorizados.

### Tareas diferidas

Cuando una tarea programada debio ejecutarse dentro de una ventana de mantenimiento, se registra:

```txt
action
scheduled_slot
reason
maintenance_operation_id
decision
created_at
```

Politica sugerida:

- Tras backup/purge: ofrecer reejecucion manual o automatica segun tipo de tarea.
- Tras restore: descartar diferidas previas.

## Auditoria

Toda operacion debe registrar:

- Usuario que la solicito.
- Fecha de inicio.
- Fecha de termino.
- IP y user-agent si estan disponibles.
- Tipo de operacion.
- Scope.
- Job id.
- Operation id.
- Paquete afectado.
- Estado final.
- Error resumido, si corresponde.

Eventos obligatorios:

- Backup automatico solicitado.
- Backup manual solicitado.
- Backup iniciado.
- Backup completado.
- Backup fallido.
- Restore solicitado.
- Restore iniciado.
- Restore completado.
- Restore fallido.
- Purge solicitado.
- Purge completado.
- Purge fallido.

Si existe una tabla de auditoria general, debe reutilizarse. Si no cubre este caso, crear una tabla especifica para auditoria de respaldos y restauraciones.

La auditoria debe permitir generar reportes administrativos sobre estas acciones.

### Decision sobre `audit_log`

La tabla actual `audit_log` no cubre completamente este modulo:

```sql
CREATE TABLE audit_log (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  event_at datetime NOT NULL DEFAULT current_timestamp(),
  actor_user_id char(36) NOT NULL,
  action varchar(80) NOT NULL,
  entity_type varchar(80) NOT NULL,
  entity_id char(36) DEFAULT NULL,
  details_json text DEFAULT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id)
);
```

Problema:

- `actor_user_id` es obligatorio y tiene FK a `users`.
- Durante restore la tabla `users` se limpia e inyecta nuevamente.
- No hay garantia de que el usuario que inicio la operacion exista despues del restore, ni de que el mismo ID represente el mismo contexto operacional.

Decision:

- Crear `system_backup_audit_events`.
- Guardar `actor_user_id` nullable.
- Guardar snapshot del actor: nombre, email y username al momento de solicitar la operacion.
- Guardar eventos de backup, restore y purge fuera de la dependencia estricta con `users`.
- Usar esta tabla como base para reportes de auditoria del modulo.

## Validaciones de paquete

Antes de restaurar:

- Manifest presente.
- Checksums validos.
- Scope esperado.
- App version compatible.
- DB schema version compatible.
- Buckets esperados presentes para backups de objetos/full.
- Tablas esperadas presentes para backups DB/full.
- Paquete no esta marcado como corrupto, incompleto o eliminado.

## Validacion post-restore

Despues de restore:

- Verificar conexion a MariaDB.
- Verificar tablas criticas.
- Verificar conteos basicos o checksums si aplica.
- Verificar buckets MinIO.
- Verificar inventario de objetos.
- Limpiar Redis.
- Limpiar sesiones.
- Limpiar colas incompatibles con el nuevo estado.
- Registrar resultado final.

## Endpoints sugeridos

Primera iteracion:

```txt
GET    /v1/system/backups/config
PUT    /v1/system/backups/config

GET    /v1/system/backups/status
GET    /v1/system/backups/history

POST   /v1/system/backups/run/database
POST   /v1/system/backups/run/objects
POST   /v1/system/backups/run/full
```

Iteraciones posteriores:

```txt

GET    /v1/system/backups/{backup_id}/download
DELETE /v1/system/backups/{backup_id}

POST   /v1/system/backups/{backup_id}/restore
POST   /v1/system/backups/purge
```

Endpoints internos sugeridos:

```txt
POST /internal/v1/backups/tick
POST /internal/v1/backups/jobs/{operation_id}/started
POST /internal/v1/backups/jobs/{operation_id}/completed
POST /internal/v1/backups/jobs/{operation_id}/failed
```

## Persistencia sugerida

Tablas conceptuales:

```txt
system_operation_state
system_backup_settings
system_backup_artifacts
system_backup_operations
system_deferred_tasks
system_backup_audit_events
```

Estos nombres quedan confirmados como nombres finales propuestos.

`system_operation_state`:

- Estado global del sistema.
- Lock operativo.
- Sesion permitida durante restore.

`system_backup_settings`:

- Politicas por scope.
- Cron.
- Retencion.
- Formato.
- Verificacion.
- Notificaciones.

`system_backup_artifacts`:

- Historial de paquetes.
- Ruta.
- Scope.
- Tamano.
- Checksum.
- Manifest.
- Estado.

`system_backup_operations`:

- Ejecuciones.
- Resultado.
- Auditoria tecnica.

`system_deferred_tasks`:

- Tareas saltadas durante mantenimiento.
- Decision posterior.

`system_backup_audit_events`:

- Registro auditable de backup, restore y purge.
- Fuente para reportes de auditoria de acciones criticas.

## Politica de secretos

El respaldo no incluye secretos runtime.

En esta version:

- MariaDB y MinIO respaldan datos aplicativos.
- Las credenciales provienen de `.env`, compose o variables de entorno existentes.
- El backup-worker usa el acceso que ya posee la infraestructura.
- No se respaldan `.env`, secretos JWT, claves SMTP, credenciales MinIO ni variables de compose.
- El backup es una carga transaccional de datos, no una carga estructural ni una copia de infraestructura.

## Marker file de mantenimiento y recuperacion administrativa

El estado en BD no es suficiente durante restore, porque la BD se limpia y se reinyecta.

Debe existir un marker file operacional en la raiz del backend o en una ruta persistente equivalente.

Ruta final:

```txt
/app/maintenance_state.json
```

En el host corresponde al archivo montado dentro del backend:

```txt
APP/volumes/backend/app/maintenance_state.json
```

Contenido sugerido:

```json
{
  "mode": "maintenance_restore",
  "operationId": "uuid",
  "operationType": "restore_backup",
  "backupId": "uuid",
  "startedAt": "2026-05-24T00:00:00Z",
  "startedBy": "user-id",
  "startedBySnapshot": {
    "userId": "user-id",
    "username": "admin",
    "fullName": "Administrador",
    "email": "admin@example.com"
  },
  "status": "running",
  "message": "Restore en ejecucion"
}
```

Reglas:

- El backend debe leer este marker al iniciar.
- Si el marker indica restore activo, el sistema debe iniciar protegido aunque la BD todavia no este disponible.
- El marker debe guardar id, username, nombre y email del usuario que solicito la operacion.
- El snapshot del actor es obligatorio porque al limpiar la BD no hay garantia de que el usuario exista despues, ni de que el ID no choque con otra data restaurada.
- Al completar restore, el marker se elimina o queda marcado como `completed`.
- Si el proceso queda congelado, el marker permite diagnosticar el estado sin depender de BD.
- El inicio y termino de restore deben enviar correo a todos los usuarios con perfil administrador.
- En caso de falla recuperable, el administrador puede ejecutar manualmente el ultimo backup valido usando el procedimiento documentado.
- En caso de desastre mayor, la recuperacion es manual; el sistema solo entrega el lineamiento operativo en documentacion.

## Decisiones cerradas

- Tablas MariaDB restaurables: todas las tablas del sistema en esta version.
- Buckets MinIO respaldables/restaurables: todos los buckets del sistema en esta version.
- Auditoria: registrar backup automatico, backup manual, restore y purge; crear tabla especifica si la auditoria existente no basta.
- Backup manual y automatico: usar modo solo lectura durante la ventana.
- MinIO: usar MinIO Client `mc`.
- Backup-worker: debe incluir todas las herramientas necesarias para su rol.
- `db_schema_version`: usar ultimo SQL manual mas fingerprint SHA-256 de scripts SQL ordenados.
- Secretos: no respaldar secretos runtime.
- Recuperacion administrativa: marker file fuera de la BD, correo a administradores al iniciar/terminar restore y procedimiento manual para desastre.
- Marker file final: `/app/maintenance_state.json` dentro del backend.
- Auditoria: crear `system_backup_audit_events`; `audit_log` no basta por FK obligatoria a `users`.
- Buckets del sistema: `minuetaitor-inputs`, `minuetaitor-json`, `minuetaitor-published`, `minuetaitor-attach`, `minuetaitor-draft`.
- Restore UI: modal bloqueante con timer de 30 segundos, cierre de sesion y login bloqueado.
- Tablas nuevas finales: `system_operation_state`, `system_backup_settings`, `system_backup_artifacts`, `system_backup_operations`, `system_deferred_tasks`, `system_backup_audit_events`.
- Primera iteracion de endpoints: config, status, history y run para database/objects/full.
- Restore y purge van al final de la implementacion.
- Restore debe soportar `database`, `objects` y `full`; `full` es la suma de MariaDB + MinIO.
- Paquete final: `backup-<scope>-<timestamp>.tar.gz` con metadata, manifest, checksums, `mariadb/data.sql.gz` y `minio/<bucket>/data.bucket.tar.gz`.

## Pendientes de implementacion

- Recalcular orden de truncate si se agregan tablas o FKs nuevas.
