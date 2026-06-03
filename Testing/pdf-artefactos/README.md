# PDF y artefactos

## Objetivo
Validar generacion, almacenamiento y descarga de PDFs y adjuntos.

## Alcance
- Preview PDF.
- PDF de revision.
- PDF final.
- MinIO.
- Gotenberg.
- Adjuntos originales.
- Headers de descarga.

## Tipos de prueba
- Smoke PDF.
- Contrato de job PDF.
- Validacion de acceso.
- Validacion de contenido basico.
- Fallos controlados.

## Checklist inicial
- [ ] Definir minuta QA con contenido minimo.
- [ ] Generar preview PDF.
- [ ] Validar status de job PDF.
- [ ] Descargar PDF.
- [ ] Validar que usuario sin acceso no descarga.
- [ ] Validar error cuando Gotenberg no responde.
- [ ] Validar headers `Content-Type` y `Content-Disposition`.

## Casos base sugeridos
| Caso | Esperado |
| --- | --- |
| Preview PDF valido | 200 application/pdf |
| Job PDF valido | completed |
| Descargar adjunto con permiso | 200 |
| Descargar adjunto sin permiso | 403 |
| Archivo inexistente | 404 |

## Evidencia
PDF generado, respuesta HTTP, headers y registro del artefacto.
