# Integraciones IA

## Objetivo
Validar providers, perfiles, costos, errores y trazabilidad de IA.

## Alcance
- Configuracion de providers.
- Bindings por proposito.
- Validacion de token.
- Generacion de minutas.
- Context search.
- Registro de uso/costos.
- Manejo de errores.

## Tipos de prueba
- Provider valido.
- Provider invalido.
- Token ausente.
- Timeout.
- Respuesta IA mal formada.
- Costeo y tokens.

## Checklist inicial
- [ ] Definir provider QA real o mock controlado.
- [ ] Definir caso sin token.
- [ ] Definir caso de timeout.
- [ ] Definir respuesta mal formada.
- [ ] Validar que no se inventa informacion.
- [ ] Validar que queda evento de uso IA.
- [ ] Validar que errores son visibles y recuperables.

## Casos base sugeridos
| Caso | Esperado |
| --- | --- |
| Provider valido | Validacion OK |
| Provider sin token | Error claro |
| Generacion IA exitosa | Minuta creada |
| Respuesta IA invalida | Failed controlado |
| Context query sin indice | Mensaje controlado |

## Evidencia
Payload anonimo, evento de uso IA, estado final y mensaje visible al usuario.
