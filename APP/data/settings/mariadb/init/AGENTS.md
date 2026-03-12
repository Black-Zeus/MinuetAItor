# AGENTS.md

## Ambito
Este archivo aplica a `APP/data/settings/mariadb/init`.

Aqui vive el bootstrap SQL y la evolucion manual del esquema MariaDB/MySQL. No hay framework de migraciones visible en el repo.

## Orden observado
- `00_preamble.sql`
- `10_schema_tables_core.sql`
- `15_schema_alter_tables_core.sql`
- `20_schema_alter_indexes.sql`
- `30_triggers.sql`
- `40_seeds_minimal.sql`
- `50_seeds_minimal.sql`
- `99_postamble.sql`

## Reglas de cambio
- Mantener el orden numerico de ejecucion.
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
