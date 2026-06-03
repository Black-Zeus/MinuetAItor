# 01 - Mapa de cobertura

## Estado inicial
Este mapa parte como inventario. Se debe ir marcando cobertura real a medida que se creen checklists o pruebas automatizadas.

Leyenda:
- Sin cubrir: no hay prueba documentada.
- Manual: existe checklist manual.
- Smoke: existe prueba corta automatizable o automatizada.
- Contrato: valida payloads/response.
- E2E: valida flujo completo.

| Modulo | Riesgo | Cobertura objetivo | Estado |
| --- | --- | --- | --- |
| Auth y sesiones | Alto | Manual + Smoke + Contrato + Permisos | Sin cubrir |
| RBAC y scopes | Alto | Manual + Contrato + Permisos | Sin cubrir |
| Clientes | Medio | Manual + Smoke + Permisos | Sin cubrir |
| Proyectos | Medio | Manual + Smoke + Permisos | Sin cubrir |
| Participantes | Medio | Manual + Smoke | Sin cubrir |
| Minutas | Alto | Manual + Smoke + Contrato + E2E | Sin cubrir |
| Revision externa | Alto | Manual + Smoke + Permisos | Sin cubrir |
| PDF y artefactos | Alto | Manual + Smoke + Contrato | Sin cubrir |
| Workers y colas | Alto | Contrato + Smoke | Sin cubrir |
| Integraciones IA | Alto | Manual + Contrato + fallos controlados | Sin cubrir |
| Reportes gestion | Medio | Manual + Smoke | Sin cubrir |
| Reportes auditoria | Alto | Manual + Permisos | Sin cubrir |
| Configuracion sistema | Alto | Manual + Permisos | Sin cubrir |
| Backups/restore | Alto | Manual + evidencia operativa | Sin cubrir |
| Notificaciones/SSE | Medio | Manual + Smoke | Sin cubrir |
| Onboarding/demo | Medio | Manual guiado | Sin cubrir |

## Proxima accion
Elegir 3 modulos para primera cobertura:
1. Auth y sesiones.
2. RBAC y scopes.
3. Minutas.
