# Workers y colas

## Objetivo
Validar que los procesos asincronos mantengan contratos estables y recuperacion controlada.

## Alcance
- Worker de negocio/IA.
- Context worker.
- Scheduler.
- Backup worker.
- Colas Redis.
- Rutas internas usadas por workers.

## Tipos de prueba
- Contrato de job.
- Idempotencia basica.
- Reintentos.
- Fallos controlados.
- Estados finales esperados.

## Checklist inicial
- [ ] Inventariar colas.
- [ ] Inventariar `type` de jobs.
- [ ] Documentar productor y consumidor por job.
- [ ] Definir payload minimo valido.
- [ ] Definir payload invalido esperado.
- [ ] Definir estados terminales.
- [ ] Definir comportamiento ante timeout.
- [ ] Definir comportamiento ante provider IA sin token.

## Casos base sugeridos
| Caso | Esperado |
| --- | --- |
| Job minuta valido | Termina completed |
| Job minuta con archivo invalido | Termina failed controlado |
| Provider IA sin token | Error visible, no queda colgado |
| Backend interno no disponible | Retry o failed controlado |
| Job duplicado | No duplica artefactos criticos |

## Evidencia
Logs relevantes, payload usado, estado final en DB/Redis y accion de recuperacion si aplica.
