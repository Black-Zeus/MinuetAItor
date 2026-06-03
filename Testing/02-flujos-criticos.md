# 02 - Flujos criticos

## Objetivo
Definir los caminos que deben funcionar antes de cualquier demo, piloto o promocion.

## Flujo 1 - Acceso y sesion
- Login con usuario valido.
- Rechazo de credenciales invalidas.
- Carga de `/auth/me`.
- Refresh de token.
- Logout.
- Cierre remoto de sesion.

## Flujo 2 - Gobierno de acceso
- Admin crea usuario.
- Admin asigna rol/permisos.
- Usuario con permiso entra a modulo permitido.
- Usuario sin permiso recibe 403 o pantalla forbidden.
- Usuario sin scope no ve datos de otro cliente/proyecto.

## Flujo 3 - Gestion base
- Crear cliente.
- Crear proyecto asociado.
- Crear participante.
- Validar listados, filtros y estados.

## Flujo 4 - Generacion de minuta
- Subir archivo valido.
- Encolar job.
- Worker procesa.
- Estado cambia correctamente.
- Editor muestra resultado.
- Se conserva trazabilidad de transaccion.

Dataset recomendado:
- Por defecto: `mini`.
- Funcional corto: `simple`.
- Bajo demanda directa: `normal` o `extenso`.

## Flujo 5 - Revision y publicacion
- Editor guarda cambios.
- Genera PDF preview.
- Envia revision por correo.
- Visitante accede con OTP/token.
- Visitante deja observacion.
- Editor resuelve observacion.
- Minuta se publica.

## Flujo 6 - Operacion y recuperacion
- Ver estado de colas.
- Detectar job fallido.
- Reprocesar minuta fallida.
- Ejecutar backup.
- Validar restore en entorno controlado.

## Flujo 7 - Reporteria y auditoria
- Reporte de gestion responde.
- Reporte de auditoria responde.
- Usuario sin permiso no accede a auditoria.
- Eventos sensibles quedan registrados.

## Flujo 8 - Demo comercial
- Login demo.
- Dashboard con datos.
- Crear o mostrar minuta existente.
- Mostrar revision externa.
- Mostrar reportes.
- Mostrar configuracion IA sin exponer secretos.
