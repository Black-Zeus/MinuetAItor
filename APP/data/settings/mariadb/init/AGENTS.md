# AGENTS.md

## Ambito
Este archivo aplica a `APP/data/settings/mariadb/init`.

Aqui vive el bootstrap SQL y la evolucion manual del esquema MariaDB/MySQL. No hay framework de migraciones visible en el repo.

## Orden observado
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

## Reglas de cambio
- Mantener el orden lexico de ejecucion definido por la convención `YYYYMMDD_HHMM_finalidad.sql`.
- Para nuevos archivos, usar convención `YYYYMMDD_HHMM_finalidad.sql` en formato de 24 horas para asegurar orden léxico estable y evitar solapamientos.
- Mantener `SET NAMES utf8mb4;` al inicio del primer SQL real del bootstrap para fijar el charset de la sesión.
- Separar claramente:
  - esquema
  - alteraciones
  - indices
  - triggers
  - seeds
- Si agregas tablas o columnas, revisar tambien:
  - `APP/volumes/backend/app/models`
  - `APP/volumes/backend/app/schemas`
  - `APP/volumes/backend/app/services`
- No editar seeds para corregir errores que pertenecen a backend o esquema.
- Evitar cambios incompatibles con datos ya sembrados, salvo que el requerimiento lo exija y quede documentado.
- Mantener naming coherente con el backend actual.

## Operacion
- No ejecutar imports, restores, reseeds ni recreacion de base de datos.
- No tocar volumenes o persistencia.
- Si el cambio requiere reaplicar init o reconstruir la base, dejarlo indicado al usuario como paso manual.

## Validacion sugerida
- Verificar consistencia semantica entre SQL y modelos del backend.
- Confirmar claves, indices y defaults necesarios para los servicios afectados.
