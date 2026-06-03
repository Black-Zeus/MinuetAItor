# Minutas Input

## Proposito
Dataset de entrada para pruebas de generacion de minutas.

Estos archivos provienen de `request/newMinute` y quedan normalizados por tamano para usarse en pruebas manuales, smoke tests o pruebas de contrato.

## Estructura
Cada caso contiene:
- `resumen.txt`
- `transcripcion.txt`

Casos disponibles:

| Caso | Uso sugerido | Resumen | Transcripcion |
| --- | --- | ---: | ---: |
| `mini` | Smoke rapido y validacion basica | 12 lineas | 20 lineas |
| `simple` | Flujo funcional corto | 50 lineas | 46 lineas |
| `normal` | Caso representativo de demo/QA | 65 lineas | 64 lineas |
| `extenso` | Prueba de volumen y tolerancia | 220 lineas | 235 lineas |

## Uso esperado
Los tests de generacion de minutas deben tomar estos archivos como insumos de entrada, no como evidencia de salida.

## Politica de consumo IA
Para evitar consumo innecesario de tokens:

- Usar `mini` como caso por defecto para smoke tests.
- Usar `simple` como caso funcional corto cuando se requiera un flujo un poco mas representativo.
- Usar `normal` solo bajo demanda directa.
- Usar `extenso` solo bajo demanda directa para pruebas de volumen, tolerancia o rendimiento.

Los pipelines automaticos no deben ejecutar `normal` ni `extenso` salvo que exista una marca, variable o instruccion explicita.

Ejemplo de ruta:

```txt
Testing/datos-qa/minutas-input/normal/transcripcion.txt
Testing/datos-qa/minutas-input/normal/resumen.txt
```

## Regla
No reemplazar estos archivos con datos reales de clientes. Si se agrega un nuevo caso, debe ser sintetico, anonimizado o expresamente autorizado para QA.
