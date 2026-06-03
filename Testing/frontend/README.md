# Frontend

## Objetivo
Validar que las pantallas criticas rendericen, respeten permisos y permitan completar flujos sin errores visibles.

## Prioridad
1. Login y recuperacion.
2. Guards de rutas.
3. Dashboard.
4. Minutas.
5. Editor de minuta.
6. Vista publica/revision externa.
7. Configuracion sistema.
8. Reportes.

## Tipos de prueba
- Smoke de render por ruta.
- Pruebas de guards.
- Estados vacios.
- Estados de carga/error.
- Acciones permitidas/denegadas.
- E2E guiado.

## Checklist inicial
- [ ] Definir rutas criticas.
- [ ] Definir rutas solo admin.
- [ ] Definir rutas por permiso.
- [ ] Validar que no haya pantallas UnderConstruction en demo.
- [ ] Validar que errores API se muestren de forma accionable.
- [ ] Validar responsive minimo en dashboard, minutas y editor.

## Casos base sugeridos
| Caso | Esperado |
| --- | --- |
| Usuario no autenticado entra a `/dashboard` | Redirige a login |
| Usuario no admin entra a sistema | Forbidden |
| Login correcto | Redirige a dashboard |
| Token expirado | Modal o logout controlado |
| Lista de minutas vacia | Estado vacio claro |
| Error backend 500 | Mensaje no tecnico o controlado |

## Evidencia
Capturas de pantalla para flujos demo y errores corregidos.
