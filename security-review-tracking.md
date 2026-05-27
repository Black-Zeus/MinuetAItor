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

## Escaneo Agresivo RCE/LFI/RFI/SQLi - 2026-05-26

Alcance: busqueda estatica dirigida sobre backend, frontend, worker, pdf-worker, backup-worker y scheduler. Se revisaron sinks tipicos: `eval/exec`, `dangerouslySetInnerHTML`, Jinja `from_string`, comandos externos, SQL crudo, `tar.extractall`, paths locales, `urlopen/requests`, base64/adjuntos, MinIO keys y restore.

Hallazgos mitigados:
- LFI via `inline_assets[].path` en jobs de email: el worker ya solo lee assets inline desde directorios permitidos (`/app/assets/images`, `/app/email_assets`) y limita tamano a 2 MB.
- DoS por base64 grande en email: inline assets y adjuntos ahora se rechazan antes de decodificar si exceden limites.
- Endpoint `/v1/sendmail` dev/qa: ahora requiere rol `ADMIN`, no solo usuario autenticado.
- SSTI/RCE latente en subjects de email: `subject_override` ya no se renderiza con Jinja; solo se renderizan los subjects definidos en templates del repo.
- Restore de backups: el manifest ya no puede restaurar buckets arbitrarios ni paths fuera del paquete; database y objects se validan en backend al importar y en backup-worker al restaurar.

Sin hallazgo activo en esta pasada:
- RCE directa por `eval`, `exec`, `os.system`, `shell=True` o `pickle/yaml.load`.
- XSS directo por `dangerouslySetInnerHTML`, `innerHTML` o `document.write`.
- SQLi directo en rutas principales; los casos de SQL crudo revisados usan parametros, quoting defensivo o whitelist.
- RFI/SSRF nuevo fuera de AI/SMTP; esos flujos siguen pasando por `network_guard`.
- Tar traversal activo; los `extractall` residuales estan precedidos por validacion de paths, symlinks, hardlinks y devices.

Residual:
- Redis sigue siendo frontera de confianza interna; si un atacante escribe jobs validos en Redis, aun puede provocar acciones internas permitidas. Ya se redujeron varios impactos, pero para PRD sigue recomendada firma HMAC de jobs criticos.
- `allow_private_provider_hosts=True` por defecto permite endpoints privados para AI/SMTP en entornos no endurecidos. En PRD debe configurarse en `false` salvo excepcion controlada.
- No se ejecuto scanner SAST externo como Bandit/Semgrep porque no estan disponibles localmente y no se instalan dependencias desde el agente.

## Barridos Ejecutables por el Agente - 2026-05-26

Ejecutado localmente sin administrar Docker:
- Preflight de herramientas SAST/SCA: `bandit`, `semgrep`, `pip-audit` y `safety` no estan instalados localmente.
- Barrido de Dockerfiles, compose y nginx por puertos expuestos, usuarios root/no-root, instalaciones en build, MinIO/Redis/MariaDB y comandos de desarrollo.
- Barrido de dependencias Python por pins exactos/rangos.
- Barrido de frontend/backend por storage de tokens, cookies, CORS, CSP y headers.
- Barrido de TODO/FIXME/debug/default secret/change_me.

Hallazgos de hardening PRD:
- `docker-compose-dev.yml` y `docker-compose-qa.yml` exponen MariaDB, Redis, MinIO, MinIO Console, backend, frontend y RedisInsight por puertos del host. Correcto para dev/qa, pero no debe heredarse a PRD.
- Gateway nginx mantiene rutas `/minio/` y `/minio-console/`; antes de PRD hay que decidir si se bloquean, se restringen por red/VPN o quedan detras de autenticacion fuerte.
- `Data/dokerFile/prd/Dockerfile.frontend` instala con `npm install` y ejecuta `npm run dev`; para PRD conviene build estatico y servir artefactos, idealmente con `npm ci`.
- Imagenes/runtime PRD revisadas: backend, frontend, nginx, workers, scheduler, backup-worker, MinIO, Mailpit, MariaDB, Redis y Gotenberg ejecutan procesos como usuarios no-root.
- Dependencias Python con rangos o sin pin exacto: `openai>=1.0.0`, `pydantic[email]`, `jsonschema>=4.0.0`, `pymysql`, `watchdog>=`, `python-dotenv>=`, `apscheduler>=`, `redis>=`, `tzlocal>=`, `tzdata>=`.
- `allow_private_provider_hosts=True` sigue siendo default de configuracion; en PRD debe quedar `false`.

No ejecutado por falta de entorno/credenciales o herramientas:
- DAST/IDOR autenticado con usuarios reales.
- `npm audit`, `pip-audit`, Safety, Bandit, Semgrep o escaneo de imagenes Docker.
- Verificacion runtime de headers/CORS/CSP con navegador/proxy.

## DAST Local con Docker - 2026-05-26

Alcance: validacion dinamica local contra el stack Docker ya levantado. Se revisaron puertos publicados, gateway nginx, backend directo, OpenAPI, rutas sin autenticacion, pruebas simples de traversal, controles IDOR con usuario temporal de baja autorizacion y redaccion de errores 422.

Resultado:
- El proyecto ya estaba levantado; no fue necesario recrear, reiniciar ni reseedear contenedores.
- Gateway `/api/internal/...` devuelve 404, por lo que la API interna no queda publicada por nginx.
- No se detecto exposicion no autenticada de datos de negocio en el barrido GET de OpenAPI. Solo respondieron publicamente `/health`, `/` y `/v1/system/maintenance/operation-state/public`.
- Pruebas simples de LFI/traversal contra rutas de PDF, avatar y artefactos de backup devolvieron 404 sin filtrar contenido de archivos del sistema.
- Usuario temporal `VIEWER` sin asignaciones recibio 403 al intentar leer minuta, versiones y PDF de una minuta fuera de su scope.
- `/v1/sendmail/templates` queda protegido: sin token devuelve 403 y con admin devuelve 200.
- Se detecto eco de `credential` en errores 422 de login invalido; se corrigio agregando `credential`, `email` y `username` a la redaccion global de campos sensibles.

Superficie dev observada:
- Puertos abiertos en host: nginx 80, backend 8000, frontend 5173, MariaDB 3306, Redis 6379, MinIO 9000/9001, RedisInsight 5540 y Mailpit 8025/1025.
- Redis responde `PING` sin autenticacion desde host. Aceptable solo en dev local aislado; en PRD/QA compartido implica riesgo de inyeccion de jobs.
- MariaDB expone handshake desde host. Aceptable solo en dev local; en PRD debe quedar en red interna.
- MinIO Console es accesible por puerto directo y por `/minio-console/` via gateway. Antes de PRD debe bloquearse, restringirse por red/VPN o protegerse explicitamente.
- Swagger/OpenAPI queda expuesto porque el entorno corre como dev; esperado en desarrollo, no valido para PRD.

Estado: DAST local inicial ejecutado. Queda pendiente, si se requiere mayor profundidad, correr OWASP ZAP baseline/authenticated scan o scanner equivalente contra un entorno QA aislado.

## DAST Kali sobre PRD Local - 2026-05-26

Alcance: escaneo desde contenedor `kalilinux/kali-rolling` con red `host`, contra el stack levantado con `docker-compose.yml` de produccion. Se usaron `nmap`, `curl`, `whatweb` y `nikto` con pruebas no destructivas.

Resultado inicial:
- Puertos dev del stack ya no estan expuestos: `1025`, `3306`, `5173`, `5540`, `6379`, `8000`, `8025`, `9000` y `9001` no aparecen abiertos desde fuera.
- Del stack MinuetAItor, Docker publica solo nginx en `80`.
- El host completo mantiene otros puertos ajenos al stack, especialmente Portainer en `9002`, ademas de servicios locales del host detectados por `nmap`.
- `/api/internal/...` y OpenAPI/Swagger no quedan publicados.
- `/mailpit/` queda accesible por nginx, como herramienta PRD solicitada.

Hallazgos mitigados durante la prueba:
- `/minio-console/` seguia accesible por nginx. Se creo configuracion nginx especifica de PRD y ahora `/minio/` y `/minio-console/` responden 404.
- El fallback SPA devolvia `200` para rutas sensibles inexistentes como `/.env`, `/.git/config`, `/.htpasswd` y `/.bash_history`. Ahora dotfiles y rutas con segmentos ocultos responden 404 en PRD.
- Nikto marco ausencia de HSTS/CSP en la raiz frontend. Ahora PRD agrega HSTS global y CSP para la app frontend.

Validacion posterior:
- `/`, `/api/health` y `/mailpit/` responden 200.
- `/openapi.json`, `/api/openapi.json`, `/api/internal/v1/minutes/health`, `/minio/`, `/minio-console/`, `/.env`, `/.git/config`, `/.htpasswd` y `/.bash_history` responden 404.
- `whatweb` confirma HSTS y CSP en `/`, y HSTS en `/mailpit/`.
- Preflight CORS desde origen no permitido responde `400 Disallowed CORS origin`.

Riesgo residual:
- Portainer sigue publicado en el host por fuera de este stack (`9002`). No pertenece a MinuetAItor, pero desde una mirada externa es superficie expuesta de la misma maquina.
- Mailpit queda publicado por decision funcional. Para PRD real en internet conviene proteger `/mailpit/` por VPN, allowlist IP o autenticacion en nginx.

## Hardening Runtime PRD - 2026-05-26

Objetivo: ejecutar contenedores de produccion sin procesos root.

Cambios aplicados:
- Nginx PRD usa imagen propia, corre como usuario `nginx`, escucha internamente en `8080` y el host publica solo `80:8080`.
- Frontend PRD genera build durante la imagen y corre `vite preview` como usuario `node`.
- Backend, worker, pdf-worker, backup-worker y scheduler usan usuario `appuser` no-root.
- MariaDB y Redis fijan usuario interno no-root (`999:999`).
- MinIO y Mailpit corren con UID/GID `1000:1000`; el volumen de MinIO fue ajustado para escritura no-root.
- Se retiraron bind mounts de logs que forzaban rutas con permisos de root en runtime.
- `backup-worker` mueve su estado operativo a `/app/remote_data/maintenance_state.json` para usar volumen writable no-root.

Validacion:
- `docker top` confirma que nginx corre como `systemd+`/UID no-root, backend/frontend/workers/MinIO/Mailpit como UID `1000`, MariaDB/Redis como UID `999` y Gotenberg como UID `1001`.
- Stack PRD levanta sano: backend, MariaDB, Redis, MinIO y Mailpit quedan healthy; nginx responde por puerto 80.
- `/api/health` responde 200.
- Rutas sensibles siguen cerradas: `/openapi.json`, `/api/internal/v1/minutes/health`, `/minio-console/` y `/.env` responden 404.

## Pentest Web Kali PRD Puerto 80 - 2026-05-26

Alcance: contenedor `kalilinux/kali-rolling` con red `host`, limitado a `http://127.0.0.1:80`. Pruebas no destructivas: `nmap` HTTP scripts, `whatweb`, `nikto` con timeout, `curl` para headers/CORS/metodos/rutas sensibles/LFI basico y `gobuster` con wordlist corta de rutas web/API comunes.

Resultado:
- Puerto analizado: solo `80/tcp`.
- Servicio detectado: `nginx/1.25.5`.
- Headers defensivos presentes en frontend: `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` y `Content-Security-Policy`.
- CORS con origen hostil responde `400 Disallowed CORS origin`.
- `/api/health` responde 200 y `/mailpit/` responde 200 por decision funcional.
- OpenAPI, internal API, MinIO y dotfiles siguen cerrados: `/openapi.json`, `/api/openapi.json`, `/api/internal/v1/minutes/health`, `/minio/`, `/minio-console/`, `/.env` y `/.git/config` responden 404.
- Pruebas LFI/traversal basicas no devolvieron contenido sensible; las variantes codificadas respondieron 400/404 o fallback SPA sin datos del sistema.
- `nikto` no reporto hallazgos criticos antes del timeout; marco `/css/` y `/js` como rutas estaticas interesantes.

Hallazgos mitigados durante este barrido:
- El fallback SPA devolvia 200 para sondas de archivos sensibles inexistentes (`/backup.zip`, `/dump.sql`, `/config.php`, `/server-status`, `/nginx_status`, `/phpinfo.php`). Se agrego bloqueo nginx PRD para nombres/extensiones sensibles y ahora responden 404.
- Los redirects `/api` y `/mailpit` filtraban el puerto interno `8080` en `Location`. Se desactivo redirect absoluto/puerto interno y ahora responden `Location: /api/` y `Location: /mailpit/`.

Resultado final del retest:
- `/api/health` 200.
- `/mailpit/` 200.
- `/openapi.json`, `/api/openapi.json`, `/api/internal/v1/minutes/health`, `/minio/`, `/minio-console/`, `/.env`, `/.git/config`, `/backup.zip`, `/dump.sql`, `/config.php`, `/server-status`, `/nginx_status` y `/phpinfo.php` responden 404.
- `gobuster` filtrando fallback SPA solo enumera redirects esperados: `/api -> /api/` y `/mailpit -> /mailpit/`.

## Correccion CSP Frontend PRD - 2026-05-26

Incidente observado: en PRD el navegador bloqueo un script inline por `Content-Security-Policy: script-src 'self'` y luego aparecio `Cannot access 'pe' before initialization` en un chunk `components-modal-*`.

Causa:
- `index.html` tenia un script inline anti-FOUC para aplicar tema antes de montar React. Con CSP estricta, ese script queda bloqueado si no se habilita `unsafe-inline`, hash o nonce.
- El build PRD tenia particion manual de chunks. Durante rebuild Vite reporto un ciclo `vendor-misc -> vendor-react -> vendor-misc`, coherente con errores de inicializacion temporal en bundles minificados.

Mitigacion aplicada:
- Se movio el anti-FOUC a un modulo externo servido desde `self`, compatible con `script-src 'self'`.
- Se removio el chunking manual de Vite para que Rollup resuelva el grafo sin forzar ciclos entre vendor/app/modal.
- Se mantiene CSP estricta sin agregar `unsafe-inline` a `script-src`.

Validacion:
- Build PRD ejecutado correctamente.
- El HTML servido ya no contiene `<script>` inline; solo carga `/js/index-*.js`.
- Header CSP mantiene `script-src 'self'`.
- El build ya no emite el warning de ciclo de chunks `vendor-misc -> vendor-react -> vendor-misc`.
- `/api/health` responde 200 en PRD.

## Recuperacion de Chunks Frontend PRD - 2026-05-26

Incidente observado: despues de un rebuild, una pestana del navegador seguia ejecutando un entry antiguo (`index-C-LVjhKs.js`) que intentaba importar chunks ya inexistentes (`Dashboard-*`, `AsyncEChart-*`, `vendor-charts-*`, etc.). El servidor respondia 404 porque el contenedor nuevo solo contiene los assets del build actual.

Causa:
- Estado normal de una SPA con code splitting si se reemplaza el build completo mientras usuarios mantienen pestanas abiertas.
- No es una exposicion de seguridad; es un problema de coherencia entre bundle activo en cliente y assets disponibles en servidor.

Mitigacion aplicada:
- Se agrego recuperacion global de fallos de dynamic import/script chunk.
- Si aparece `Failed to fetch dynamically imported module`, `ChunkLoadError` o falla de carga de `/js/*.js`, la app recarga una vez por version de build para tomar el `index.html` y entry actuales.
- La proteccion evita bucles: usa `__BUILD_TIME__` como version de intento en `sessionStorage`.

Validacion:
- Build PRD ejecutado correctamente.
- El entry servido es el actual: `/js/index-QkxZD5OC.js`.
- El bundle contiene el handler `minuetaitor:chunk-reload-attempted`.
- `/api/health` responde 200.

## Correccion Precedencia Nginx API PRD - 2026-05-26

Incidente observado: `/api/v1/system/backups/config` respondia 404 en PRD.

Causa:
- El bloqueo nginx para rutas sensibles (`backup`, `config`, `dump`, etc.) era una regex global.
- Nginx evaluaba esa regex antes que el proxy `/api/`, por lo que una ruta valida de backend terminada en `/config` quedaba bloqueada por el gateway.

Mitigacion aplicada:
- Se cambio `location /api/` a `location ^~ /api/` en la configuracion PRD, para que las rutas API tengan precedencia y no sean interceptadas por regex de archivos sensibles.

Validacion:
- `/api/v1/system/backups/config` sin token ya no devuelve 404 de nginx; devuelve 403 del backend con ruta `/v1/system/backups/config`, lo esperado para endpoint protegido.
- `/api/health` responde 200.
- `/backup.zip` sigue respondiendo 404.

## Correccion CSP Frame Blob PRD - 2026-05-26

Incidente observado: el visor PDF intentaba cargar `blob:http://localhost/...` dentro de un frame y el navegador lo bloqueaba porque `frame-src` no estaba definido; CSP caia a `default-src 'self'`.

Causa:
- La app usa `URL.createObjectURL(...)` para PDFs y los muestra en `iframe`.
- `img-src` ya permitia `blob:`, pero los frames requieren la directiva especifica `frame-src`.

Mitigacion aplicada:
- CSP PRD agrega `frame-src 'self' blob:`.
- Se mantiene `script-src 'self'` y `object-src 'none'`.

Validacion:
- Header CSP servido incluye `frame-src 'self' blob:`.
- `/api/health` responde 200.
- `/backup.zip` sigue respondiendo 404.

## Correccion Proxy Mailpit PRD - 2026-05-26

Incidente observado: al abrir `/mailpit` aparecia en consola un timeout de MinuetAItor contra `/v1/system/maintenance/operation-state/public`.

Revision:
- `/mailpit/` sirve correctamente HTML de Mailpit por nginx.
- Assets y API de Mailpit cargan por el prefijo `/mailpit`.
- El endpoint publico de MinuetAItor responde 200 en milisegundos; el timeout observado fue transitorio o de una pestana de MinuetAItor activa en paralelo durante rebuild.

Mitigacion aplicada:
- Se agregaron headers WebSocket al proxy `/mailpit/` (`Upgrade` y `Connection`) y `proxy_read_timeout 3600s`, porque Mailpit usa websocket para eventos.

Validacion:
- `/mailpit/` responde 200.
- `/mailpit/dist/app.js` responde 200.
- `/mailpit/api/v1/messages` responde 200.
- `/api/v1/system/maintenance/operation-state/public` responde 200.

## Validacion URL Publica Organizacion - 2026-05-26

Incidente observado: el campo "URL pública de la plataforma" aceptaba valores sin esquema, por ejemplo `minuetaitor.vsoto.cl/`. Luego los enlaces enviados por correo quedaban mal formados, como `minuetaitor.vsoto.cl/minutes/process/...`.

Mitigacion aplicada:
- Frontend valida el campo antes de guardar y muestra error inline si falta `http://` o `https://`.
- El boton de guardado queda deshabilitado mientras la URL informada sea invalida.
- Backend valida de nuevo el valor para evitar bypass por API directa.
- Se permite dejar el campo vacio.
- Si se informa valor, debe ser una URL absoluta con esquema `http` o `https`.
- La URL publica debe ser base, sin rutas, query ni fragmento.
- Se mantiene la normalizacion de `/` final, por ejemplo `https://minuetaitor.vsoto.cl/` se guarda como `https://minuetaitor.vsoto.cl`.

Validacion:
- `minuetaitor.vsoto.cl/` se rechaza.
- `https://minuetaitor.vsoto.cl/` se acepta y se guarda sin slash final.
- `http://minuetaitor.vsoto.cl/` se acepta.
- `https://minuetaitor.vsoto.cl/minutes` se rechaza.
- `/api/health` responde 200 tras rebuild.

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
