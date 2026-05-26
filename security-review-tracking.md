# Seguimiento de Seguridad

Este documento sirve para trazar los frentes de revision y mitigacion de seguridad del sistema.

## Checklist

- [x] Mitigar RBAC inicial en AI Provider Configs, SMTP Configs y Objects.
- [x] Mitigar acceso transversal a minutas por `record_id`, adjuntos, PDFs, versiones, SSE y previews temporales.
- [x] Agregar proteccion SSRF basica en validaciones remotas AI/SMTP.
- [x] Agregar rate limit basico en login, recuperacion de password y OTP de vistas publicas.
- [x] Revisar RBAC pendiente en routers activos marcados con TODO.
- [x] Revisar frontend y exposicion de tokens.
- [x] Revisar reportes y analitica.
- [x] Revisar vistas publicas de minuta.
- [x] Revisar uploads y archivos.
- [x] Revisar backups y restore.
- [x] Revisar Internal API.
- [x] Revisar jobs Redis y workers.
- [x] Revisar auditoria de acciones sensibles.
- [x] Revisar headers, CORS y configuracion de produccion.
- [x] Revisar secretos almacenados en BD.
- [x] Revisar SQL, seeds y compatibilidad de permisos.
- [x] Segunda pasada de seguridad: verificar cierres, bypasses residuales y nuevos hallazgos.

## Segunda Pasada - 2026-05-26

Resultado general: no aparecio un vector nuevo de alto impacto fuera de los frentes ya identificados, pero si se encontraron bordes residuales que quedaban abiertos despues del primer cierre.

Cierres aplicados en esta pasada:
- `/v1/docs` ya no responde en `prod`; antes OpenAPI/Redoc estaban deshabilitados, pero el Swagger custom seguia disponible.
- Endpoints SSE autenticados ya no aceptan JWT por query param; ahora requieren `Authorization: Bearer` en header.
- Auditoria de login fallido ya no guarda el identificador crudo; registra hash SHA-256 normalizado.
- Importacion de backups ahora valida checksums reales contra el contenido del `.tar.gz`, no solo que las rutas existan.
- Handler global de validacion 422 ya no devuelve valores sensibles como password, token, OTP, secret o API key.

Vectores revisados y sin nuevo hallazgo critico:
- RBAC/IDOR de minutas, reportes, previews y adjuntos.
- Exposicion de tokens en frontend despues del cambio a streaming con `fetch`.
- Rutas internas protegidas por `X-Internal-Secret` y bloqueo de nginx para `/api/internal/`.
- Validacion de jobs Redis contra dispatch cruzado por `queue` declarada en payload.
- Extraccion de paquetes de backup en backend y backup-worker.

Pendientes residuales que no estan cerrados:
- JWT principal y token publico de minuta siguen en `localStorage`; requiere decision de cookies `HttpOnly`/`Secure`/`SameSite` o cambio de modelo de sesion.
- Secretos AI/SMTP siguen persistidos en BD en claro; requiere cifrado con key externa, KMS o secrets manager.
- Redis sigue siendo bus interno confiable; si alguien escribe directo en Redis, podria inyectar jobs validos. Para PRD considerar red privada estricta y firma HMAC en jobs criticos.
- Falta auditoria explicita para solicitud/verificacion OTP publica, descargas de PDF publico y cambios/test de AI/SMTP.
- No se agrego CSP estricta; requiere validacion visual del frontend para evitar romper assets.
- `health` publico aun expone `env`; bajo impacto, pero se puede reducir a solo `status` si monitoreo no depende de ese dato.

## Validacion OWASP Top 10:2025 - 2026-05-26

Referencia: OWASP Top 10:2025, version oficial actual publicada por OWASP.

### A01 Broken Access Control

Estado: mitigado en los flujos revisados, con validacion funcional pendiente.

Evidencia:
- RBAC aplicado a catalogos/configuracion, AI/SMTP, auditoria y backups.
- Minutas, adjuntos, PDFs, previews, versiones, SSE y reportes usan scope por usuario/cliente/proyecto.
- Vistas publicas validan OTP/sesion visitante/version activa.

Residual:
- Validar manualmente con usuarios no admin y usuarios con scope reducido para confirmar que el frontend no muestra acciones que backend rechaza.

### A02 Security Misconfiguration

Estado: parcialmente mitigado.

Evidencia:
- CORS abierto solo en `dev`; en otros entornos depende de `CORS_ALLOWED_ORIGINS`.
- OpenAPI/Redoc/Swagger custom no quedan expuestos en `prod`.
- Headers basicos agregados en backend y nginx.
- `/api/internal/` bloqueado en nginx.

Residual:
- Falta CSP estricta.
- `/health` publico expone `env`.
- Gateway mantiene `/minio/` y `/minio-console/`; antes de PRD hay que confirmar si deben estar publicos o restringidos por red/autenticacion adicional.

### A03 Software Supply Chain Failures

Estado: pendiente de cierre PRD.

Evidencia:
- Frontend tiene `package-lock.json`.
- Dependencias backend/worker estan en `requirements.txt`.

Residual:
- Hay dependencias Python con rangos o sin pin exacto (`openai>=1.0.0`, `pydantic[email]`, `pymysql`, `watchdog>=`, `apscheduler>=`, `redis>=`, etc.).
- No se ejecuto auditoria de dependencias (`npm audit`, `pip-audit`, Safety, SCA o equivalente) por restriccion operativa del entorno.
- No hay politica visible de firma/verificacion de imagenes Docker o SBOM.

### A04 Cryptographic Failures

Estado: parcialmente mitigado.

Evidencia:
- Passwords de usuario usan bcrypt.
- JWT tiene expiracion y secret requerido por configuracion.
- Internal API compara secret con `compare_digest`.

Residual:
- JWT principal y token publico de minuta siguen en `localStorage`.
- Secretos AI/SMTP siguen en claro en BD.
- Para PRD conviene migrar a cookies `HttpOnly`/`Secure`/`SameSite` y cifrado con key externa/KMS/secrets manager.

### A05 Injection

Estado: sin hallazgo activo critico en la revision estatica.

Evidencia:
- No se encontro `dangerouslySetInnerHTML`, `eval`, `new Function` ni escritura directa de HTML en frontend.
- Consultas revisadas usan SQLAlchemy o `text()` parametrizado; no se vio interpolacion directa de SQL con input usuario en rutas principales.
- Comandos externos del backup-worker usan listas de argumentos y no `shell=True`.
- Uploads y backups tienen validacion de tipo, rutas y checksums.

Residual:
- Mantener revision puntual si se agregan nuevas consultas `text()` o plantillas HTML con contenido de usuario.

### A06 Insecure Design

Estado: parcialmente mitigado, con decisiones de arquitectura pendientes.

Evidencia:
- Se agregaron limites/rate limits en login, recuperacion, OTP publico y generacion de minutas.
- Restore/import de backups quedo restringido y validado.
- Redis jobs ya no confian en la cola declarada por payload.

Residual:
- Redis sigue como bus interno confiable sin firma HMAC de jobs criticos.
- Backup import/restore usa checksums internos, pero no firma externa del paquete.
- Modelo de secretos en BD y persistencia de JWT en frontend requieren decision de diseno para PRD.

### A07 Authentication Failures

Estado: mitigado en controles base, con endurecimiento pendiente.

Evidencia:
- Bcrypt, expiracion JWT, sesiones en Redis, refresh con invalidacion y rate limit en login/reset.
- SSE ya no usa JWT en query params.
- Reset token se elimina del address bar en frontend despues de cargarlo.

Residual:
- No se observa MFA.
- Tokens siguen accesibles por JS mientras se use `localStorage`.

### A08 Software or Data Integrity Failures

Estado: parcialmente mitigado.

Evidencia:
- Backups importados validan estructura, tipos de miembros, rutas y checksums reales.
- Workers validan envelopes de jobs y evitan dispatch cruzado por payload.

Residual:
- Jobs Redis no estan firmados.
- Backups no tienen firma detached/externa.
- No hay evidencia de verificacion de integridad de imagenes/deploys.

### A09 Security Logging and Alerting Failures

Estado: parcialmente mitigado.

Evidencia:
- Auditoria restringida con `audit.read`.
- Eventos auth criticos y backups quedan auditados.
- Intentos fallidos de Internal API se registran sin secret.

Residual:
- Falta auditoria explicita para OTP publico, descarga PDF publico y cambios/test AI/SMTP.
- No hay pipeline visible de alertas operativas sobre eventos sensibles.

### A10 Mishandling of Exceptional Conditions

Estado: mitigado parcialmente en esta pasada.

Evidencia:
- Handler global responde errores internos con mensaje generico.
- Handler 422 ahora redacta valores sensibles en errores de validacion.

Residual:
- Validar que servicios externos/worker no propaguen mensajes de proveedor con datos sensibles en UI o logs.
- Revisar errores de nginx/MinIO en PRD para evitar banners o detalles de infraestructura.

## Frentes

### 1. RBAC pendiente fuera de lo ya mitigado

Revisar routers activos con TODO RBAC en `APP/volumes/backend/app/main.py`: catalogos, MIME, estados, dashboards, tags, tipos de artefacto/registro y similares. Definir que endpoints quedan como lectura para usuarios autenticados y cuales requieren `ADMIN`.

Mitigacion aplicada:
- `GET` y `/list` de catalogos quedan para usuario autenticado.
- `POST`, `PUT`, `PATCH` y `DELETE` de catalogos/configuracion quedan restringidos a `ADMIN`.
- Metricas IA quedan restringidas por `audit.read` y mantienen scope por cliente/proyecto en servicio.

Estado: mitigado inicialmente. Pendiente validar manualmente con usuarios no admin en frontend para confirmar que solo pierden acciones de administracion.

### 2. Frontend y exposicion de tokens

Revisar persistencia de JWT en `localStorage`, uso de tokens en query params para SSE y logging de request/params/token parcial. Requiere diseno de transicion para no romper sesion ni eventos SSE.

Mitigacion aplicada:
- SSE autenticado con `Authorization: Bearer` via `fetch`, sin `?token=` en URL.
- Logs de Axios ya no imprimen body, params, token parcial ni objeto de error completo con headers.
- El token de reset de password se carga desde URL y luego se elimina del address bar con `replace`.

Riesgo residual:
- El JWT principal y el token publico de vista de minuta siguen persistidos en `localStorage`. Para PRD conviene migrar a cookies `HttpOnly`/`Secure`/`SameSite` o, como mitigacion intermedia, `sessionStorage` si se acepta perder persistencia entre reinicios del navegador.

Estado: mitigado inicialmente. Pendiente decision de arquitectura para sacar tokens persistentes de storage accesible por JS.

### 3. Reportes y analitica

Validar que reportes administrativos y analiticos apliquen scope por usuario, cliente o proyecto cuando corresponda. Evitar que usuarios sin permiso vean datos globales.

Mitigacion aplicada:
- Endpoints de reportes de gestion requieren `records.read`; reporte de auditoria requiere `audit.read`.
- Reportes de gestion ligados a minutas aplican scope backend por cliente/proyecto/actor sobre `Record`.
- Reportes de auditoria global quedan acotados a eventos propios para usuarios no admin.
- Reportes de auditoria ligados a minutas aplican scope por `Record`.
- Previews PDF de reportes quedan ligados al `user_id` creador; `status/result` ya no aceptan un `preview_id` de otro usuario.

Estado: mitigado inicialmente. Pendiente validacion funcional en navegador con usuarios admin y no admin.

### 4. Vistas publicas de minuta

Revisar expiracion, reintentos por request, enumeracion de emails/record_id, contenido visible, observaciones y comportamiento de OTP.

Mitigacion aplicada:
- Solicitud OTP responde con mensaje generico aunque la minuta/correo no exista o no tenga acceso, reduciendo enumeracion.
- Verificacion OTP usa error generico para solicitud inexistente, codigo invalido o expirado.
- Sesiones visitantes se invalidan si el participante ya no pertenece a la version activa actual.
- Observaciones visibles en la vista publica quedan limitadas a la sesion visitante actual.
- PDF publico solo usa el artefacto publicado; se elimina fallback a PDF borrador.
- Creacion de observaciones publicas tiene rate limit por minuta, visitante y sesion.

Riesgo residual:
- El token visitante sigue persistido en `localStorage` del frontend, ya registrado en el frente de tokens.
- No se agrego auditoria nueva para solicitud/verificacion OTP y descarga PDF; queda en el frente de auditoria.

Estado: mitigado inicialmente. Pendiente validacion funcional con enlace publico real.

### 5. Uploads y archivos

Revisar validacion real de MIME/contenido para avatares, logos, adjuntos, imports de backup y plantillas PDF. Varias validaciones dependen de `content_type` declarado por el cliente.

Mitigacion aplicada:
- Avatares y logos de organizacion, clientes, proyectos y participantes validan firma real del archivo antes de almacenar; ya no se confia solo en `content_type` declarado.
- Las extensiones y `content_type` persistidos para imagenes se derivan del contenido detectado, no del nombre subido por el usuario.
- Adjuntos de minuta validan firmas minimas para PDF, DOC, DOCX y JSON.
- Descarga de adjuntos de minuta usa `Content-Disposition: attachment` y `X-Content-Type-Options: nosniff` para evitar ejecucion inline de archivos subidos por usuarios.
- Respuestas de imagenes y PDFs servidos por endpoints propios agregan `nosniff` y nombres de descarga saneados.

Riesgo residual:
- Imports de backup/restore quedan fuera de este cierre y se revisan en el frente 6 por su impacto operativo.
- No se agrego antivirus/sandbox de archivos; si PRD permite documentos de usuarios externos, conviene integrar escaneo asincrono.

Estado: mitigado inicialmente. Pendiente validacion manual subiendo imagen valida, imagen con MIME falso y adjunto PDF/DOCX valido.

### 6. Backups y restore

Revisar seguridad de importacion `.tar.gz`, path traversal, tamano maximo, contenido inesperado y restore. Aunque el modulo esta bajo `ADMIN`, el impacto operativo es alto.

Mitigacion aplicada:
- Importacion de paquetes limita tamano maximo y exige extension `.tar.gz`.
- Validacion de paquete rechaza miembros con rutas absolutas, `..`, symlinks, hardlinks, devices, tipos inesperados, demasiados miembros y tamano descomprimido excesivo.
- `checksums.sha256` ya no puede referenciar rutas inseguras ni archivos faltantes.
- Inspeccion de respaldos reporta paquetes con miembros inseguros.
- Restore en backup-worker rechaza symlinks, hardlinks y devices antes de extraer paquete principal y archivos internos de MinIO.
- Descarga de respaldos agrega `nosniff`.

Estado: mitigado inicialmente. Pendiente prueba operativa de import/inspect/restore con un paquete real dentro de Docker.

### 7. Internal API

Confirmar que `/internal/*` no quede expuesto por nginx/gateway y que todos los consumidores usen `X-Internal-Secret` correctamente.

Mitigacion aplicada:
- Nginx bloquea `/api/internal/` con 404 antes del proxy general a backend.
- `verify_internal_secret` mantiene fail-safe cuando `INTERNAL_API_SECRET` no esta configurado y registra IP/path en intentos sin secret o con secret invalido.
- Routers internos revisados: minutas, mantenimiento, notificaciones y backups usan dependencia global `verify_internal_secret`.

Estado: mitigado inicialmente. Pendiente validar con `curl /api/internal/...` desde gateway y llamada interna desde scheduler/worker.

### 8. Jobs Redis y workers

Revisar que jobs no acepten payloads forjados que permitan leer objetos ajenos, sobrescribir PDFs, mandar correos arbitrarios o generar trazas con datos sensibles.

Mitigacion aplicada:
- Worker principal, pdf-worker y backup-worker ya no confian en `queue` declarado dentro del JSON; la cola efectiva es siempre la entregada por `BLPOP`.
- Los envelopes validan que `type` y `queue` tengan formato seguro, que `payload` sea objeto JSON y que `attempt` este en rango.
- Esto evita dispatch cruzado entre colas y reintentos hacia colas arbitrarias indicadas por payload forjado.

Riesgo residual:
- Redis sigue siendo un bus confiable interno. Si un actor obtiene escritura directa en Redis, aun podria inyectar jobs validos de alto impacto. Para PRD conviene aislar Redis en red privada estricta y considerar firma HMAC de jobs criticos.

Estado: mitigado inicialmente. Pendiente prueba funcional de colas en Docker.

### 9. Auditoria

Verificar que acciones sensibles queden auditadas: cambios RBAC, AI/SMTP, backups, login fallido, reset, accesos publicos y descargas de minutas.

Mitigacion aplicada:
- `/v1/audit-logs` ahora exige `audit.read` para lectura/listado y `ADMIN` para creacion manual.
- Se agrego auditoria para login exitoso, login fallido con usuario existente, logout, cambio de password propio y reset de password.
- Backups ya registran eventos propios para solicitud, import, purge, restore, completado/fallo y enqueue fallido.

Riesgo residual:
- No se agrego aun auditoria para solicitud/verificacion OTP publica ni descargas de PDF publico; queda como mejora puntual si se quiere trazabilidad completa de accesos externos.
- Cambios AI/SMTP tienen control RBAC, pero conviene agregar audit log explicito por create/update/activate/delete/test.

Estado: mitigado parcialmente con cierre de exposicion y eventos auth criticos.

### 10. Headers, CORS y produccion

Revisar CSP, cookies, headers de seguridad, `ENV_NAME`, Swagger/OpenAPI, nginx y CORS para PRD. CORS abierto en dev es esperable, pero debe quedar cerrado antes de produccion.

Mitigacion aplicada:
- Backend agrega `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` y HSTS en `prod`.
- Nginx agrega headers equivalentes en gateway.
- CORS queda abierto solo en `dev`; en otros entornos usa `CORS_ALLOWED_ORIGINS`.
- OpenAPI/Redoc ya estaban deshabilitados en `prod` desde FastAPI.

Riesgo residual:
- No se agrego CSP estricta porque el frontend Vite/React y recursos servidos por gateway requieren validacion visual para evitar romper assets.
- Validar que `ENV_NAME=prod` y `CORS_ALLOWED_ORIGINS` esten definidos correctamente antes de PRD.

Estado: mitigado inicialmente.

### 11. Secretos almacenados en BD

Revisar AI provider secrets y SMTP passwords, que actualmente se almacenan en claro. Para PRD conviene cifrado en reposo o integracion con secrets manager.

Resultado:
- AI Provider y SMTP no exponen secretos completos en respuestas de administracion; AI solo entrega secreto completo por endpoint interno protegido para ejecucion del worker.
- Persistencia sigue en claro en columnas `ai_provider_configs.token_secret`, `ai_provider_configs.password_secret` y `smtp_configs.password`.

Riesgo residual:
- Este frente requiere decision de arquitectura: cifrado de aplicacion con key externa, KMS/secrets manager o mover credenciales fuera de BD. No se implemento cifrado ad hoc para no crear una falsa sensacion de seguridad con una key guardada junto a la app.

Estado: revisado, con residual aceptado para decision PRD.

### 12. SQL, seeds y compatibilidad de permisos

Revisar seeds de permisos/roles contra los checks nuevos para asegurar que perfiles reales tienen permisos como `records.create`, `records.update`, `records.publish`, etc.

Mitigacion aplicada:
- Seed base mantiene permisos requeridos por flujos de minutas: `records.read`, `records.create`, `records.update`, `records.publish`.
- `audit.read` se restringe a `ADMIN` en el seed base.
- Se agrego SQL manual `20260526_0132_restrict_audit_read_to_admin.sql` para corregir bases ya inicializadas.

Estado: mitigado inicialmente. Pendiente aplicar/reseed segun el flujo Docker del entorno.
