# Backend API

## Objetivo
Cubrir contratos HTTP, permisos y reglas de negocio principales del backend.

## Ejecucion esperada
El runner vive como servicio auxiliar en `docker-compose.testing.yml`.

Uso sugerido cuando el stack dev ya esta arriba:

```bash
docker compose -f docker-compose-dev.yml -f docker-compose.testing.yml run --rm qa-tools
```

Para pruebas autenticadas, definir credenciales QA:

```bash
QA_ADMIN_CREDENTIAL=admin@example.local \
QA_ADMIN_PASSWORD='password-segura' \
docker compose -f docker-compose-dev.yml -f docker-compose.testing.yml run --rm qa-tools
```

## Outputs
Los resultados persistentes quedan en:

```txt
Testing/reports/
```

El reporte JUnit inicial queda en:

```txt
Testing/reports/backend-api-junit.xml
```

Los reportes generados estan ignorados por Git, salvo el `README.md` y `.gitkeep`.

## Prioridad
1. Auth.
2. RBAC.
3. Minutas.
4. Clientes/proyectos/participantes.
5. Reportes.
6. Sistema/backups/configuracion.

## Tipos de prueba
- Smoke de endpoints principales.
- Contrato request/response.
- Permisos por rol.
- Scopes por cliente/proyecto/minuta.
- Errores esperados.

## Checklist inicial
- [ ] Crear matriz de endpoints publicos.
- [ ] Clasificar endpoints por riesgo.
- [ ] Definir usuario QA admin.
- [ ] Definir usuario QA editor.
- [ ] Definir usuario QA viewer.
- [ ] Definir usuario QA sin scope.
- [ ] Crear casos de 200/201 esperados.
- [ ] Crear casos de 401/403 esperados.
- [ ] Crear casos de 422 esperados.

## Casos base sugeridos
| Caso | Esperado |
| --- | --- |
| Login valido | 200 + access_token |
| Login invalido | 401 |
| `/auth/me` sin token | 401 |
| `/auth/me` con token | 200 |
| Crear cliente sin permiso | 403 |
| Crear cliente con permiso | 201 |
| Listar minutas sin scope | No retorna datos ajenos |
| Crear minuta sin `records.create` | 403 |
| Crear minuta con payload invalido | 422 |

## Evidencia
Guardar resultados relevantes en una carpeta de evidencias del frente cuando se ejecuten pruebas manuales o automatizadas.
