# Base de datos

## Objetivo
Validar consistencia entre SQL manual, modelos, servicios y datos QA.

## Alcance
- Scripts SQL de bootstrap.
- Scripts incrementales.
- Seeds.
- Modelos SQLAlchemy.
- Datos QA.
- Upgrade de esquema.

## Tipos de prueba
- Bootstrap limpio.
- Upgrade con datos.
- Integridad referencial.
- Seeds esperados.
- Compatibilidad modelo/tabla.

## Checklist inicial
- [ ] Inventariar scripts SQL por orden.
- [ ] Definir version de esquema esperada.
- [ ] Definir dataset QA minimo.
- [ ] Validar que modelos reflejan columnas actuales.
- [ ] Validar seeds requeridos por UI/backend.
- [ ] Probar upgrade con datos representativos.

## Casos base sugeridos
| Caso | Esperado |
| --- | --- |
| Bootstrap limpio | DB queda operativa |
| Seed roles/permisos | Roles base existen |
| Seed catalogos | UI carga catalogos |
| Upgrade agrega campo | Modelo y servicio lo usan |
| Rollback no disponible | Queda documentado |

## Evidencia
Orden SQL aplicado, conteos base, errores encontrados y correcciones.
