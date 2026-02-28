/* 40_seeds_minimal.sql
   ============================================================================
   Propósito  : Seed mínimo (FIRST-RUN ONLY) para inicialización del contenedor BD
   Contexto   : Fase ALPHA (modelado en curso). Este archivo es la base “core”
               y se edita (no se duplican inserts por tabla).
   Motor      : MySQL / MariaDB (InnoDB, utf8mb4)
   Dependencias: Respeta el orden requerido por FKs del esquema (10_schema_tables_core.sql)
   ============================================================================
   Reglas internas:
   - Catálogos: un único INSERT por tabla en todo el archivo (single source of truth).
   - Bridges : siempre después de sus catálogos.
   - Defaults lógicos: evitar múltiples defaults por MIME/artifact_type.
*/

-- ----------------------------------------------------------------------------
-- [01] RBAC (roles / permissions / role_permissions)
-- Pool: roles + permissions + role_permissions
-- ----------------------------------------------------------------------------

-- Roles base
INSERT INTO roles (code, name, description, is_active) VALUES
  ('ADMIN',   'Administrador', 'Acceso total a la plataforma', 1),
  ('EDITOR',  'Editor',        'Crea/edita/publica documentos', 1),
  ('VIEWER',  'Lector',        'Solo lectura', 1),
  ('DELETER', 'Eliminador',    'Permite hard delete bajo auditoría', 1);

-- Permisos base (ampliable)
INSERT INTO permissions (code, name, description, is_active) VALUES
  ('records.read',         'Leer documentos', 'Puede listar/ver documentos y versiones', 1),
  ('records.create',       'Crear documentos', 'Puede crear registros y drafts', 1),
  ('records.update',       'Editar documentos', 'Puede modificar cabeceras y drafts', 1),
  ('records.publish',      'Publicar documentos', 'Puede publicar (genera versión+PDF)', 1),
  ('records.soft_delete',  'Soft delete documentos', 'Puede dar de baja lógica registros', 1),
  ('records.hard_delete',  'Hard delete documentos', 'Puede eliminar físicamente (auditoría obligatoria)', 1),
  ('users.manage',         'Administrar usuarios', 'CRUD/roles/estado de usuarios', 1),
  ('clients.manage',       'Administrar clientes', 'CRUD/estado de clientes', 1),
  ('audit.read',           'Leer auditoría', 'Puede consultar audit_log', 1);

-- ADMIN: todo
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code='ADMIN' AND p.is_active=1;

-- EDITOR
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r JOIN permissions p
  ON p.code IN ('records.read','records.create','records.update','records.publish','audit.read')
WHERE r.code='EDITOR';

-- VIEWER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r JOIN permissions p
  ON p.code IN ('records.read','audit.read')
WHERE r.code='VIEWER';

-- DELETER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r JOIN permissions p
  ON p.code IN ('records.read','records.soft_delete','records.hard_delete','audit.read')
WHERE r.code='DELETER';


-- ----------------------------------------------------------------------------
-- [02] Catálogos core de documentos/estados/artefactos/buckets/widgets
-- Pool: record_types + record_statuses + version_statuses + artifact_states +
--       artifact_types + buckets + dashboard_widgets
-- ----------------------------------------------------------------------------

-- Record types
INSERT INTO record_types (code, name, description, is_active) VALUES
  ('MINUTE',  'Minuta',     'Minutas de reunión', 1),
  ('REPORT',  'Informe',    'Informes técnicos/operativos', 1),
  ('EXPENSE', 'Rendición',  'Rendiciones de cuenta', 1);

-- Record statuses
INSERT INTO record_statuses (code, name, description, is_active) VALUES
  ('ACCEPTED',        'Aceptado',        'Estado por defecto', 1),
  ('NON_PRODUCIBLE',  'No producible',   'No debe emitirse/publicarse', 1),
  ('OBSOLETE',        'Obsoleto',        'Reemplazado por reprocesamiento', 1);

-- Version statuses
INSERT INTO version_statuses (code, name, description, is_active) VALUES
  ('PUBLISHED',   'Publicado',   'Versión vigente/publicada', 1),
  ('SUPERSEDED',  'Reemplazado', 'Reemplazada por una posterior', 1),
  ('REVOKED',     'Revocado',    'No vigente por decisión administrativa', 1);

-- Artifact states
INSERT INTO artifact_states (code, name, description, is_active) VALUES
  ('DRAFT',     'Borrador',   'Artefacto del draft vigente', 1),
  ('PUBLISHED', 'Publicado',  'Artefacto de versión publicada', 1),
  ('ARCHIVED',  'Archivado',  'Artefacto histórico/no vigente', 1);

-- Artifact types
INSERT INTO artifact_types (code, name, description, is_active) VALUES
  ('INPUT_TRANSCRIPT',   'Transcripción',        'Input transcripción (txt)', 1),
  ('INPUT_SUMMARY',      'Resumen',              'Input resumen (txt)', 1),
  ('LLM_JSON_ORIGINAL',  'JSON LLM Original',    'JSON original devuelto por LLM (sin edición)', 1),
  ('CANONICAL_JSON',     'JSON Canonical',       'JSON confirmado/editable que origina la publicación', 1),
  ('PUBLISHED_PDF',      'PDF Publicado',        'Documento final publicado (PDF)', 1),
  ('ATTACHMENT_IMAGE',   'Imagen Adjunta',       'Adjuntos (imágenes/otros)', 1);

-- Buckets MinIO
INSERT INTO buckets (code, name, description, is_active) VALUES
  ('inputs_container',      'minuetaitor-inputs',     'Entradas (transcripción/resumen)', 1),
  ('json_container',        'minuetaitor-json',       'JSONs (original/canonical)', 1),
  ('published_container',   'minuetaitor-published',  'Salidas publicadas (PDF)', 1),
  ('attachments_container', 'minuetaitor-attach',     'Adjuntos (imágenes/otros)', 1);

-- Dashboard widgets base (alineado a DASHBOARD_WIDGETS_DEFAULT)
INSERT INTO dashboard_widgets (code, name, description, is_active) VALUES
  ('stats', 'Stats generales', 'KPIs principales', 1),
  ('ultima_conexion', 'Última conexión', 'Último acceso del usuario', 1),
  ('minutas_pendientes', 'Minutas pendientes', 'Pendientes de aprobación', 1),
  ('minutas_participadas', 'Minutas donde participé', 'Historial de participación', 1),
  ('clientes_confidenciales', 'Clientes confidenciales', 'Clientes con acceso confidencial', 1),
  ('proyectos_confidenciales', 'Proyectos confidenciales', 'Proyectos con acceso confidencial', 1),
  ('tags_populares', 'Etiquetas populares', 'Tags más usados', 1);


-- ----------------------------------------------------------------------------
-- [03] Tags (tag_categories / tags)
-- Pool: tag_categories + tags
-- Nota: single source of truth: un único INSERT para tag_categories.
-- ----------------------------------------------------------------------------

-- TAG_CATEGORIES (unificado)
INSERT INTO tag_categories (name, is_active)
VALUES
  ('Infraestructura', 1),
  ('Plataformas', 1),
  ('Redes', 1),
  ('Seguridad', 1),
  ('Identidad y Acceso', 1),
  ('Operaciones', 1),
  ('Continuidad', 1),
  ('Observabilidad', 1),
  ('ITSM', 1),
  ('Datos', 1),
  ('Aplicaciones', 1),
  ('DevOps', 1),
  ('Gobernanza', 1),
  ('Gestión de Proyecto', 1),
  ('Gestión de Proveedores', 1),
  ('Calidad', 1),
  ('Procesos', 1),
  ('Otros', 1);

-- TAGS
-- - Resuelve category_id vía JOIN a tag_categories por name
-- - Evita duplicados por uq_tags_cat_name usando INSERT IGNORE (por seguridad ante
--   cambios de contenido v. estructura durante alpha; first-run esperado, pero
--   esto reduce fricción si ejecutas el contenedor en dev con volumen persistente).
INSERT IGNORE INTO tags (id, category_id, name, description, source, status, is_active)
SELECT UUID(), tc.id, v.name, v.description, 'ai', v.status, 1
FROM (
  SELECT 'Infraestructura' AS category, 'Infraestructura' AS name,
         'Arquitectura y componentes base de TI (cómputo, red, almacenamiento) involucrados en el proyecto.' AS description,
         'activo' AS status
  UNION ALL SELECT 'Infraestructura', 'Servidores',
         'Provisionamiento, configuración, mantenimiento y ciclo de vida de servidores físicos o virtuales.',
         'activo'
  UNION ALL SELECT 'Infraestructura', 'Virtualización',
         'Plataformas y prácticas de virtualización (hipervisores, clústeres, recursos, migraciones).',
         'activo'

  UNION ALL SELECT 'Plataformas', 'Contenedores',
         'Ecosistema Docker/Kubernetes: imágenes, despliegues, redes, volúmenes y operación.',
         'activo'
  UNION ALL SELECT 'Plataformas', 'Kubernetes',
         'Orquestación de contenedores: clúster, namespaces, deployments, services e ingress.',
         'activo'

  UNION ALL SELECT 'Redes', 'Redes',
         'Topología, switching/routing, segmentación y conectividad entre ambientes.',
         'activo'
  UNION ALL SELECT 'Redes', 'DNS',
         'Resolución de nombres, zonas, registros y troubleshooting asociado.',
         'activo'
  UNION ALL SELECT 'Redes', 'VLAN',
         'Segmentación lógica de red mediante VLANs: definición/estandarización de IDs, trunks/access, tagging (802.1Q), ruteo inter-VLAN, ACLs asociadas, alcance por sitio y validación de conectividad.',
         'activo'

  UNION ALL SELECT 'Seguridad', 'Firewall',
         'Reglas de seguridad perimetral e interna, políticas de acceso y apertura de puertos.',
         'activo'
  UNION ALL SELECT 'Seguridad', 'VPN',
         'Acceso remoto seguro, túneles site-to-site y conectividad de usuarios.',
         'activo'
  UNION ALL SELECT 'Seguridad', 'Seguridad',
         'Controles y medidas de protección: hardening, baselines y buenas prácticas.',
         'activo'
  UNION ALL SELECT 'Seguridad', 'Gestión de Vulnerabilidades',
         'Escaneo, priorización, remediación y seguimiento de vulnerabilidades.',
         'activo'

  UNION ALL SELECT 'Identidad y Acceso', 'Active Directory',
         'Gestión de identidad en dominio: OU, grupos, políticas y controladores.',
         'activo'
  UNION ALL SELECT 'Identidad y Acceso', 'GPO',
         'Políticas de grupo: configuración de equipos/usuarios, restricciones y despliegue.',
         'activo'
  UNION ALL SELECT 'Identidad y Acceso', 'IAM',
         'Gestión de identidades y accesos: roles, permisos, MFA y auditoría.',
         'activo'

  UNION ALL SELECT 'Operaciones', 'Parches y Actualizaciones',
         'Planificación y ejecución de updates, hotfixes y ventanas de mantenimiento.',
         'activo'
  UNION ALL SELECT 'Operaciones', 'Capacidad',
         'Planificación de recursos: CPU/RAM/IO, crecimiento y performance.',
         'activo'
  UNION ALL SELECT 'Operaciones', 'Rendimiento',
         'Optimización y diagnóstico de performance en aplicaciones e infraestructura.',
         'activo'

  UNION ALL SELECT 'Continuidad', 'Backups',
         'Respaldo y restauración: políticas, retención, pruebas de recuperación.',
         'activo'
  UNION ALL SELECT 'Continuidad', 'DRP / Continuidad',
         'Plan de recuperación ante desastres y continuidad operacional (RTO/RPO).',
         'activo'

  UNION ALL SELECT 'Observabilidad', 'Monitoreo',
         'Observabilidad: métricas, alertas, umbrales y dashboards.',
         'activo'
  UNION ALL SELECT 'Observabilidad', 'Logs / SIEM',
         'Centralización y análisis de logs, correlación de eventos y seguridad.',
         'activo'

  UNION ALL SELECT 'ITSM', 'Incidentes',
         'Gestión de incidentes: impacto, priorización, mitigación y post-mortem.',
         'activo'
  UNION ALL SELECT 'ITSM', 'Cambios (Change Management)',
         'Gestión de cambios: RFC, aprobación, plan, rollback y comunicación.',
         'activo'
  UNION ALL SELECT 'ITSM', 'Problemas (Problem Management)',
         'Análisis causa raíz, acciones correctivas y prevención de recurrencia.',
         'activo'

  UNION ALL SELECT 'Datos', 'Bases de Datos',
         'Diseño, operación y mantenimiento de motores de BD, respaldos y tuning.',
         'activo'

  UNION ALL SELECT 'Aplicaciones', 'Aplicaciones',
         'Estado y evolución de aplicaciones: releases, dependencias y operación.',
         'activo'
  UNION ALL SELECT 'Aplicaciones', 'Integraciones',
         'Interoperabilidad entre sistemas: APIs, ETL, middleware y mensajería.',
         'activo'
  UNION ALL SELECT 'Aplicaciones', 'APIs',
         'Diseño, versionado, seguridad y consumo de APIs internas/externas.',
         'activo'

  UNION ALL SELECT 'DevOps', 'DevOps',
         'Automatización y colaboración dev/ops: pipelines, IaC, despliegues.',
         'activo'
  UNION ALL SELECT 'DevOps', 'CI/CD',
         'Pipelines de build/test/deploy, gates, artefactos y releases.',
         'activo'
  UNION ALL SELECT 'DevOps', 'Automatización',
         'Scripts y orquestación de tareas repetitivas para mejorar eficiencia.',
         'activo'

  UNION ALL SELECT 'Gobernanza', 'Documentación',
         'Registro formal: diagramas, procedimientos, runbooks y manuales.',
         'activo'
  UNION ALL SELECT 'Gobernanza', 'Cumplimiento',
         'Requisitos normativos y auditoría (ISO, políticas internas, controles).',
         'activo'
  UNION ALL SELECT 'Gobernanza', 'Riesgos',
         'Identificación y tratamiento de riesgos: probabilidad, impacto y mitigación.',
         'activo'

  UNION ALL SELECT 'Gestión de Proyecto', 'Cronograma',
         'Planificación temporal: hitos, fechas, dependencias y seguimiento.',
         'activo'
  UNION ALL SELECT 'Gestión de Proyecto', 'Presupuesto',
         'Costos, licencias, CAPEX/OPEX y control financiero del proyecto.',
         'activo'
  UNION ALL SELECT 'Gestión de Proyecto', 'Compras',
         'Adquisiciones: cotizaciones, órdenes de compra, proveedores y plazos.',
         'activo'
  UNION ALL SELECT 'Gestión de Proyecto', 'Recursos Humanos',
         'Dotación, roles, contrataciones, onboarding y gestión de desempeño.',
         'activo'
  UNION ALL SELECT 'Gestión de Proyecto', 'Capacitación',
         'Entrenamiento técnico/funcional, sesiones de transferencia y adopción.',
         'activo'
  UNION ALL SELECT 'Gestión de Proyecto', 'Gestión de Stakeholders',
         'Comunicación y coordinación con interesados: acuerdos, expectativas y reporting.',
         'activo'
  UNION ALL SELECT 'Gestión de Proyecto', 'Requerimientos',
         'Levantamiento y validación de necesidades funcionales y no funcionales.',
         'activo'
  UNION ALL SELECT 'Gestión de Proyecto', 'Alcance',
         'Definición y control del alcance: inclusiones, exclusiones y cambios.',
         'activo'
  UNION ALL SELECT 'Gestión de Proyecto', 'Entregables',
         'Resultados acordados: artefactos, componentes y criterios de aceptación.',
         'activo'

  UNION ALL SELECT 'Gestión de Proveedores', 'Proveedores',
         'Gestión de terceros: SLA, soporte, contratos y coordinación.',
         'activo'
  UNION ALL SELECT 'Gestión de Proveedores', 'SLA / Soporte',
         'Niveles de servicio, tiempos de respuesta y escalamiento de soporte.',
         'activo'

  UNION ALL SELECT 'Calidad', 'Pruebas / QA',
         'Plan de pruebas, validación, evidencias y control de calidad.',
         'activo'
) v
JOIN tag_categories tc
  ON tc.name = v.category;


-- ----------------------------------------------------------------------------
-- [04] Reglas por tipo de record (record_type_artifact_types)
-- Pool: record_types + artifact_types + record_type_artifact_types
-- ----------------------------------------------------------------------------

-- Requeridos al publicar (por tipo)
INSERT INTO record_type_artifact_types (record_type_id, artifact_type_id, is_required_on_publish, max_count, is_active)
SELECT rt.id, at.id, 1, 1, 1
FROM record_types rt
JOIN artifact_types at ON at.code IN ('CANONICAL_JSON','PUBLISHED_PDF')
WHERE rt.code IN ('MINUTE','REPORT','EXPENSE');

-- MINUTE permite inputs + LLM original (no requeridos)
INSERT INTO record_type_artifact_types (record_type_id, artifact_type_id, is_required_on_publish, max_count, is_active)
SELECT rt.id, at.id, 0, 1, 1
FROM record_types rt
JOIN artifact_types at ON at.code IN ('INPUT_TRANSCRIPT','INPUT_SUMMARY','LLM_JSON_ORIGINAL')
WHERE rt.code='MINUTE';

-- REPORT permite adjuntos
INSERT INTO record_type_artifact_types (record_type_id, artifact_type_id, is_required_on_publish, max_count, is_active)
SELECT rt.id, at.id, 0, 100, 1
FROM record_types rt
JOIN artifact_types at ON at.code='ATTACHMENT_IMAGE'
WHERE rt.code='REPORT';


-- ----------------------------------------------------------------------------
-- [05] MIME / Extensiones / Defaults (mime_types / file_extensions / bridges)
-- Pool: mime_types + file_extensions + mime_type_extensions + artifact_type_mime_types
-- ----------------------------------------------------------------------------

-- MIME types
INSERT INTO mime_types (mime, description, is_active) VALUES
  ('application/pdf', 'PDF', 1),
  ('application/json', 'JSON estándar', 1),
  ('text/plain; charset=utf-8', 'Texto plano UTF-8', 1),
  ('image/png', 'Imagen PNG', 1),
  ('image/jpeg', 'Imagen JPEG', 1);

-- Extensiones
INSERT INTO file_extensions (ext, description, is_active) VALUES
  ('pdf', 'PDF', 1),
  ('json', 'JSON', 1),
  ('txt', 'Texto', 1),
  ('png', 'PNG', 1),
  ('jpg', 'JPEG', 1),
  ('jpeg', 'JPEG', 1);

-- MIME <-> Ext (default único por MIME cuando aplica)
INSERT INTO mime_type_extensions (mime_type_id, file_extension_id, is_default, is_active)
SELECT mt.id, fe.id, 1, 1
FROM mime_types mt
JOIN file_extensions fe ON (mt.mime='application/pdf' AND fe.ext='pdf');

INSERT INTO mime_type_extensions (mime_type_id, file_extension_id, is_default, is_active)
SELECT mt.id, fe.id, 1, 1
FROM mime_types mt
JOIN file_extensions fe ON (mt.mime='application/json' AND fe.ext='json');

INSERT INTO mime_type_extensions (mime_type_id, file_extension_id, is_default, is_active)
SELECT mt.id, fe.id, 1, 1
FROM mime_types mt
JOIN file_extensions fe ON (mt.mime='text/plain; charset=utf-8' AND fe.ext='txt');

INSERT INTO mime_type_extensions (mime_type_id, file_extension_id, is_default, is_active)
SELECT mt.id, fe.id, 1, 1
FROM mime_types mt
JOIN file_extensions fe ON (mt.mime='image/png' AND fe.ext='png');

-- image/jpeg: default = jpg, jpeg no-default
INSERT INTO mime_type_extensions (mime_type_id, file_extension_id, is_default, is_active)
SELECT mt.id, fe.id, 1, 1
FROM mime_types mt
JOIN file_extensions fe ON (mt.mime='image/jpeg' AND fe.ext='jpg');

INSERT INTO mime_type_extensions (mime_type_id, file_extension_id, is_default, is_active)
SELECT mt.id, fe.id, 0, 1
FROM mime_types mt
JOIN file_extensions fe ON (mt.mime='image/jpeg' AND fe.ext='jpeg');

-- Defaults MIME por artifact_type
INSERT INTO artifact_type_mime_types (artifact_type_id, mime_type_id, is_default, is_active)
SELECT at.id, mt.id, 1, 1
FROM artifact_types at
JOIN mime_types mt ON mt.mime='text/plain; charset=utf-8'
WHERE at.code IN ('INPUT_TRANSCRIPT','INPUT_SUMMARY');

INSERT INTO artifact_type_mime_types (artifact_type_id, mime_type_id, is_default, is_active)
SELECT at.id, mt.id, 1, 1
FROM artifact_types at
JOIN mime_types mt ON mt.mime='application/json'
WHERE at.code IN ('LLM_JSON_ORIGINAL','CANONICAL_JSON');

INSERT INTO artifact_type_mime_types (artifact_type_id, mime_type_id, is_default, is_active)
SELECT at.id, mt.id, 1, 1
FROM artifact_types at
JOIN mime_types mt ON mt.mime='application/pdf'
WHERE at.code='PUBLISHED_PDF';

-- ATTACHMENT_IMAGE: default = image/png, habilita jpeg como alternativo
INSERT INTO artifact_type_mime_types (artifact_type_id, mime_type_id, is_default, is_active)
SELECT at.id, mt.id, 1, 1
FROM artifact_types at
JOIN mime_types mt ON mt.mime='image/png'
WHERE at.code='ATTACHMENT_IMAGE';

INSERT INTO artifact_type_mime_types (artifact_type_id, mime_type_id, is_default, is_active)
SELECT at.id, mt.id, 0, 1
FROM artifact_types at
JOIN mime_types mt ON mt.mime='image/jpeg'
WHERE at.code='ATTACHMENT_IMAGE';


-- ----------------------------------------------------------------------------
-- [06] IA (ai_profile_categories / ai_profiles)
-- Pool: ai_profile_categories + ai_profiles
-- ----------------------------------------------------------------------------

-- AI_PROFILE_CATEGORIES
INSERT INTO ai_profile_categories (name, is_active) VALUES
  ('Infraestructura', 1),
  ('TI / Desarrollo', 1),
  ('Seguridad', 1),
  ('Gobierno y Cumplimiento', 1),
  ('Administración', 1),
  ('Personas', 1),
  ('PMO', 1),
  ('TI / Arquitectura', 1),
  ('Producto', 1),
  ('Finanzas', 1),
  ('Operaciones', 1),
  ('Riesgos', 1),
  ('Legal', 1),
  ('Calidad', 1),
  ('Comercial', 1),
  ('Seguridad Ocupacional', 1),
  ('Seguridad Operacional', 1),
  ('Seguridad Física', 1);

-- AI_PROFILES
INSERT INTO ai_profiles
  (id, category_id, name, description, prompt, is_active)
SELECT
  UUID(),
  pc.id,
  v.name,
  v.description,
  v.prompt,
  v.is_active
FROM (
  SELECT
    'Infraestructura' AS category,
    'Análisis de Redes' AS name,
    'Enfocado en decisiones y acciones técnicas sobre redes (LAN/WAN, routing/switching, VLAN, DNS/DHCP, firewall, conectividad).' AS description,
    'Analiza la minuta con enfoque de ingeniería de redes. Delimita el alcance a conectividad y componentes de red. Identifica decisiones, cambios propuestos/ejecutados, impacto esperado, dependencias técnicas, riesgos de indisponibilidad, pasos de validación (antes/durante/después) y tareas accionables. Si aparecen datos incompletos (IPs, VLANs, sitios, equipos), regístralo como brecha y sugiere qué dato falta sin inventarlo. Mantén redacción técnica y precisa.' AS prompt,
    1 AS is_active
  UNION ALL SELECT
    'Infraestructura',
    'Análisis de Servidores',
    'Enfocado en operación y administración de servidores (Windows/Linux), roles, servicios, almacenamiento, rendimiento y continuidad.',
    'Analiza la minuta con enfoque de servidores. Limita el análisis a sistema operativo, roles/servicios, recursos (CPU/RAM/disco), almacenamiento, alta disponibilidad, respaldos, parches y monitoreo. Extrae decisiones, tareas, responsables e impactos. Señala riesgos operacionales (capacidad, fallas, mantenibilidad) y validaciones recomendadas. Registra brechas de información y solicita los datos mínimos necesarios sin asumir valores.',
    1
  UNION ALL SELECT
    'TI / Desarrollo',
    'Implementación de Software',
    'Enfocado en implementación/despliegue de software, ambientes, dependencias, configuración, CI/CD y criterios de aceptación.',
    'Analiza la minuta con enfoque de implementación de software. Delimita a despliegue, configuración, dependencias, ambientes (dev/qa/prod), versionado, CI/CD, migraciones y validación funcional. Identifica decisiones, alcance, entregables, tareas accionables y criterios de aceptación. Explicita riesgos (indisponibilidad, compatibilidad, regresiones) y mitigaciones. No inventes datos; documenta brechas y qué se debe confirmar.',
    1
  UNION ALL SELECT
    'TI / Desarrollo',
    'Implementación de Características',
    'Enfocado en definición e implementación de funcionalidades: requerimientos, alcance, dependencias y criterios de éxito.',
    'Analiza la minuta con enfoque de implementación de características. Delimita el alcance a requerimientos, tareas, reglas de negocio, dependencias y criterios de éxito. Extrae decisiones, acuerdos, definiciones pendientes, riesgos de alcance (desviación de alcance) y tareas con responsables. Si faltan criterios de aceptación o definición de ''hecho'', decláralo como brecha y sugiere preguntas concretas para cerrarlo.',
    1
  UNION ALL SELECT
    'Seguridad',
    'Análisis de Vulnerabilidades',
    'Enfocado en hallazgos de seguridad: evidencia, exposición, severidad/prioridad y plan de remediación.',
    'Analiza la minuta con enfoque de vulnerabilidades. Limita el análisis a hallazgos de seguridad, evidencias mencionadas, alcance de exposición, severidad/prioridad (si se menciona) y acciones de contención/remediación. Extrae decisiones, responsables, plazos, riesgo residual y validaciones post-remediación. Si faltan CVE, evidencia, activos afectados o criterio de severidad, indícalo como brecha sin inferir.',
    1
  UNION ALL SELECT
    'Seguridad',
    'Operaciones de Seguridad',
    'Enfocado en SOC/CSIRT: incidentes, alertas, respuesta, evidencias, contención y seguimiento.',
    'Analiza la minuta con enfoque de operaciones de seguridad. Delimita a incidentes/alertas, investigación, contención, erradicación, recuperación y seguimiento. Identifica cronología, decisiones, acciones ejecutadas, responsables y evidencias/logs citados. Señala brechas (fuentes de log, IOCs, activos, alcance) y plantea las preguntas mínimas para cerrar el análisis. No inventes información.',
    1
  UNION ALL SELECT
    'Gobierno y Cumplimiento',
    'Cumplimiento y Auditoría',
    'Enfocado en evidencia, trazabilidad, controles, aprobaciones, segregación de funciones y riesgos de no conformidad.',
    'Analiza la minuta con enfoque de cumplimiento y auditoría. Delimita a controles, aprobaciones, evidencias requeridas, segregación de funciones, trazabilidad y registro de decisiones. Extrae acuerdos, responsables, plazos y artefactos a generar/adjuntar. Señala riesgos de no conformidad y brechas de evidencia. No asumas controles inexistentes; registra solo lo mencionado y lo faltante.',
    1
  UNION ALL SELECT
    'Administración',
    'Análisis Administrativo',
    'Enfocado en coordinación: acuerdos, pendientes, bloqueos, dependencias, comunicaciones y seguimiento.',
    'Analiza la minuta con enfoque administrativo. Delimita a acuerdos, pendientes, bloqueos, dependencias, comunicaciones, responsables y fechas. Redacta conclusiones claras y lista acciones accionables. Identifica elementos que requieren confirmación. Evita inventar fechas, responsables o compromisos no explícitos.',
    1
  UNION ALL SELECT
    'Personas',
    'Análisis de RRHH',
    'Enfocado en gestión de personas: dotación, roles, desempeño, capacitación, clima, políticas internas y acuerdos.',
    'Analiza la minuta con enfoque de RRHH. Delimita a dotación, roles y responsabilidades, desempeño, capacitación, clima, políticas internas y acuerdos de gestión. Extrae decisiones, acciones, responsables y plazos. Señala riesgos únicamente si están sustentados por lo conversado; si faltan datos, decláralo como brecha y especifica qué se debe confirmar.',
    1
  UNION ALL SELECT
    'PMO',
    'Gestión de Proyectos',
    'Enfocado en alcance, hitos, cronograma, estado, riesgos, dependencias y próximos pasos.',
    'Analiza la minuta con enfoque de gestión de proyectos. Delimita a alcance, entregables, hitos, estado, riesgos, dependencias, cambios y próximos pasos. Extrae decisiones y acciones con responsables y fechas. Identifica bloqueos y criterios de éxito. Si faltan fechas/hitos o definición de alcance, indícalo como brecha y propone las preguntas mínimas.',
    1
  UNION ALL SELECT
    'Infraestructura',
    'Análisis de Bases de Datos',
    'Enfocado en cambios de esquema, migraciones, rendimiento, respaldos/restore, replicación y permisos.',
    'Analiza la minuta con enfoque de bases de datos. Delimita a cambios de esquema, migraciones, rendimiento (consultas/índices), respaldos/restore, replicación y permisos. Extrae decisiones, tareas, responsables e impactos. Señala riesgos (pérdida de datos, indisponibilidad, degradación) y validaciones recomendadas. No infieras estructuras; documenta brechas y datos a confirmar.',
    1
  UNION ALL SELECT
    'Gobierno y Cumplimiento',
    'Gestión de Cambios de Infraestructura',
    'Enfocado en plan de cambio, ventana, impacto, prerequisitos, aprobaciones, rollback y criterio de éxito.',
    'Analiza la minuta con enfoque de control de cambios de infraestructura. Delimita a plan de cambio, ventana, impacto, prerequisitos, aprobaciones, rollback y criterio de éxito. Extrae decisiones, tareas, responsables, dependencias y riesgos. Si faltan pasos de rollback o validación, indícalo explícitamente como brecha.',
    1
  UNION ALL SELECT
    'TI / Arquitectura',
    'Arquitectura y Diseño de Soluciones',
    'Enfocado en decisiones de arquitectura, trade-offs, patrones, integraciones y criterios no funcionales.',
    'Analiza la minuta con enfoque de arquitectura. Delimita a decisiones de diseño, patrones, integraciones, restricciones y atributos de calidad (rendimiento, seguridad, disponibilidad, escalabilidad, mantenibilidad). Registra alternativas evaluadas, criterio de decisión, impactos y acciones derivadas. Si faltan supuestos, diagramas, capacidades objetivo o dependencias, decláralo como brecha y lista preguntas para cerrarla.',
    1
  UNION ALL SELECT
    'Producto',
    'Gestión de Producto',
    'Enfocado en visión, roadmap, prioridades, métricas, feedback de usuarios y definición de valor.',
    'Analiza la minuta con enfoque de gestión de producto. Delimita a objetivos, prioridades, alcance de roadmap, problemas de usuario, hipótesis, métricas de éxito y decisiones de priorización. Extrae acuerdos, próximos pasos y riesgos (desalineación, sobrealcance, dependencia). Si faltan KPI, segmento objetivo o definición de valor, regístralo como brecha y propone preguntas concretas.',
    1
  UNION ALL SELECT
    'Finanzas',
    'Finanzas y Presupuesto',
    'Enfocado en costos, presupuesto, CAPEX/OPEX, aprobaciones, desviaciones y control financiero.',
    'Analiza la minuta con enfoque financiero. Delimita a presupuesto, costos, CAPEX/OPEX, aprobaciones, desviaciones, compras y justificación. Extrae montos si se mencionan, responsables, plazos y dependencias. Señala riesgos de sobrecostos o falta de aprobación solo si se discuten. Si faltan cifras, centros de costo o responsables, regístralo como brecha sin inferir.',
    1
  UNION ALL SELECT
    'Finanzas',
    'Compras y Abastecimiento',
    'Enfocado en adquisiciones: requerimientos, cotizaciones, licitaciones, proveedores y entregas.',
    'Analiza la minuta con enfoque de compras. Delimita a requerimientos de adquisición, especificaciones, cotizaciones, evaluación de proveedores, condiciones comerciales, plazos de entrega y aprobaciones. Extrae acuerdos, tareas, responsables y fechas. Identifica brechas (especificación técnica, presupuesto, proveedor, SLA) sin inventar información.',
    1
  UNION ALL SELECT
    'Operaciones',
    'Gestión de Proveedores y SLA',
    'Enfocado en relación con proveedores, contratos, SLA, penalidades, escalamiento y seguimiento.',
    'Analiza la minuta con enfoque de gestión de proveedores. Delimita a compromisos contractuales, SLA/OLA, escalamiento, incidentes con proveedor, entregables y fechas. Extrae acuerdos, responsables, próximos hitos y riesgos (incumplimiento, dependencia). Si faltan números de ticket, contrato, SLA o fechas, regístralo como brecha.',
    1
  UNION ALL SELECT
    'Operaciones',
    'Gestión de Servicios TI (ITIL)',
    'Enfocado en procesos ITIL: incidentes, problemas, cambios, catálogo, SLAs y mejora continua.',
    'Analiza la minuta con enfoque ITIL. Delimita a incidentes/problemas, cambios, solicitudes, catálogo y niveles de servicio. Extrae decisiones, acciones, responsables, plazos y artefactos (tickets, RFC, KB). Señala riesgos operacionales y brechas (ticket, impacto, prioridad, ventana, aprobaciones) sin asumir datos.',
    1
  UNION ALL SELECT
    'Riesgos',
    'Continuidad de Negocio y DRP',
    'Enfocado en continuidad, RTO/RPO, planes DR, pruebas y lecciones aprendidas.',
    'Analiza la minuta con enfoque de continuidad de negocio. Delimita a RTO/RPO, escenarios de contingencia, planes DR, responsabilidades, pruebas/ejercicios y resultados. Extrae decisiones, acciones y fechas. Si faltan RTO/RPO, alcance de sistemas críticos o evidencia de pruebas, regístralo como brecha y formula preguntas mínimas.',
    1
  UNION ALL SELECT
    'Riesgos',
    'Gestión de Riesgos',
    'Enfocado en identificación, evaluación, mitigación y seguimiento de riesgos organizacionales.',
    'Analiza la minuta con enfoque de gestión de riesgos. Delimita a riesgos discutidos, probabilidad/impacto (si se menciona), mitigaciones, responsables, plazos y riesgo residual. No inventes calificaciones; si faltan criterios, regístralo como brecha. Estructura el resultado con: riesgo, causa, consecuencia, mitigación, dueño y fecha.',
    1
  UNION ALL SELECT
    'Legal',
    'Legal y Contratos',
    'Enfocado en cláusulas, obligaciones, cambios contractuales, cumplimiento legal y riesgos contractuales.',
    'Analiza la minuta con enfoque legal. Delimita a contratos, anexos, obligaciones, confidencialidad, tratamiento de datos, licencias, penalidades y aprobaciones. Extrae acuerdos, responsables y plazos. Señala brechas (número de contrato, cláusula, contraparte, fecha de vigencia) sin inferir.',
    1
  UNION ALL SELECT
    'Legal',
    'Privacidad y Protección de Datos',
    'Enfocado en datos personales: bases legales, minimización, retención, accesos y cumplimiento.',
    'Analiza la minuta con enfoque de privacidad. Delimita a datos personales, finalidad, base legal (si se menciona), minimización, retención, accesos, transferencias y medidas de seguridad. Registra decisiones, acciones y responsables. Si faltan clasificación de datos, flujo, responsables de tratamiento o requisitos regulatorios, decláralo como brecha.',
    1
  UNION ALL SELECT
    'Calidad',
    'Calidad (QA) y Pruebas',
    'Enfocado en estrategia de pruebas, cobertura, defectos, criterios de aceptación y evidencias.',
    'Analiza la minuta con enfoque de QA. Delimita a estrategia de pruebas, planes/casos, cobertura, ambientes, defectos, severidad, evidencias y criterios de aceptación. Extrae decisiones, tareas, responsables y fechas. Si faltan criterios de entrada/salida, evidencias o responsable de aprobación, regístralo como brecha.',
    1
  UNION ALL SELECT
    'Operaciones',
    'Soporte y Atención al Cliente',
    'Enfocado en tickets, reclamos, SLA, comunicación con usuarios y resolución.',
    'Analiza la minuta con enfoque de soporte. Delimita a tickets, incidentes reportados, SLA, comunicación, pasos de resolución y seguimiento. Extrae acuerdos, responsables, plazos y mensajes clave para clientes. Si faltan números de ticket, impacto, prioridad o estado, regístralo como brecha.',
    1
  UNION ALL SELECT
    'Comercial',
    'Ventas y Gestión Comercial',
    'Enfocado en pipeline, oportunidades, propuestas, negociación y próximos pasos comerciales.',
    'Analiza la minuta con enfoque comercial. Delimita a oportunidades, estado del pipeline, necesidades del cliente, propuesta/alcance comercial, riesgos de negociación y próximos pasos. Extrae acuerdos, responsables y fechas. Si faltan monto estimado, decisores, etapa o fecha objetivo, regístralo como brecha.',
    1
  UNION ALL SELECT
    'Comercial',
    'Marketing y Comunicaciones',
    'Enfocado en campañas, mensajes, canales, audiencias, calendario y métricas.',
    'Analiza la minuta con enfoque de marketing. Delimita a campañas, audiencias, mensajes, canales, calendario, presupuesto (si se menciona) y métricas. Extrae decisiones, tareas, responsables y fechas. Registra brechas (objetivo, KPI, audiencia, canal, fechas) sin inventar.',
    1
  UNION ALL SELECT
    'Operaciones',
    'Operaciones y Procesos (Mejora Continua)',
    'Enfocado en procesos internos, eficiencia, cuellos de botella, estandarización y KPIs operacionales.',
    'Analiza la minuta con enfoque de procesos. Delimita a flujos operativos, cuellos de botella, estandarización, automatización, roles y KPIs operacionales. Extrae decisiones, acciones y responsables. Si faltan métricas base o definición del proceso actual vs futuro, regístralo como brecha.',
    1
  UNION ALL SELECT
    'Gobierno y Cumplimiento',
    'Gestión de Activos y CMDB',
    'Enfocado en inventario, CMDB, ciclo de vida, asignación, licencias y trazabilidad de activos.',
    'Analiza la minuta con enfoque de gestión de activos. Delimita a inventario/CMDB, ciclo de vida, asignación, licencias, altas/bajas, auditorías y trazabilidad. Extrae decisiones, tareas, responsables y evidencias. Si faltan identificadores de activo, ubicación o estado, regístralo como brecha.',
    1
  UNION ALL SELECT
    'Gobierno y Cumplimiento',
    'Gestión Documental y Conocimiento',
    'Enfocado en documentación, estándares, repositorios, control de versiones y gestión de conocimiento.',
    'Analiza la minuta con enfoque de gestión documental. Delimita a documentos requeridos, estándares, repositorios, control de versiones, aprobaciones y responsables. Extrae acuerdos y acciones. Señala brechas (plantilla, ubicación, dueño del documento, fecha de revisión) sin asumir.',
    1
  UNION ALL SELECT
    'Personas',
    'Formación y Capacitación',
    'Enfocado en capacitación técnica/funcional, planes, contenidos, audiencias y evaluación.',
    'Analiza la minuta con enfoque de capacitación. Delimita a necesidades de formación, audiencia, contenidos, plan, fechas, responsables y criterios de evaluación. Extrae acuerdos y tareas. Si faltan temario, alcance, modalidad o fechas, regístralo como brecha.',
    1
  UNION ALL SELECT
    'Personas',
    'Gestión del Cambio Organizacional',
    'Enfocado en adopción, comunicaciones, impacto en roles, resistencia y plan de transición.',
    'Analiza la minuta con enfoque de cambio organizacional. Delimita a impactos en roles, adopción, comunicaciones, capacitación, resistencia y plan de transición. Extrae acuerdos, acciones, responsables y fechas. Identifica brechas (audiencias, mensajes, métricas de adopción) sin inventar.',
    1
  UNION ALL SELECT
    'Datos',
    'Gobernanza de Datos y Analítica',
    'Enfocado en calidad de datos, linaje, owners, definiciones, BI y métricas corporativas.',
    'Analiza la minuta con enfoque de gobernanza de datos. Delimita a definiciones de datos, owners, calidad, linaje, acceso, métricas/BI y decisiones sobre modelos o KPIs. Extrae acuerdos y acciones. Si faltan definiciones, diccionario de datos o responsables, regístralo como brecha.',
    1
  UNION ALL SELECT
    'Seguridad Ocupacional',
    'Seguridad y Salud Ocupacional (SSO/HSE)',
    'Enfocado en seguridad de las personas: riesgos laborales, controles, permisos de trabajo, EPP, incidentes/accidentes, investigación y acciones correctivas.',
    'Analiza la minuta con enfoque de Seguridad y Salud Ocupacional (SSO/HSE). Delimita el alcance a riesgos para personas, condiciones inseguras, actos inseguros, controles críticos, EPP, permisos de trabajo (PTW), análisis de riesgo (AST/JSA), procedimientos, capacitaciones y supervisión. Extrae incidentes/accidentes/casi incidentes, evidencias mencionadas, acciones de contención, investigación (causa raíz si se menciona), acciones correctivas/preventivas, responsables y plazos. Señala brechas de información (lugar exacto, tarea ejecutada, tipo de riesgo, severidad, medidas implementadas, evidencia) sin inventar. Mantén redacción técnica, objetiva y trazable.',
    1
  UNION ALL SELECT
    'Seguridad Operacional',
    'Seguridad Operacional (Operaciones/Proceso)',
    'Enfocado en seguridad operacional y continuidad de la operación: controles de operación, maniobras, procedimientos, autorizaciones, riesgos de proceso, fallas operativas y medidas de mitigación.',
    'Analiza la minuta con enfoque de seguridad operacional. Delimita a riesgos operativos derivados de la operación (maniobras, operación de equipos, cambios operacionales, procedimientos críticos, autorizaciones, coordinación entre áreas), incluyendo condiciones que puedan causar daño, detención, pérdida de control del proceso o degradación operacional. Extrae decisiones, acciones ejecutadas/propuestas, prerequisitos, dependencias, controles y validaciones operativas. Identifica riesgos (causa -> consecuencia) solo si están sustentados por lo discutido, y registra mitigaciones/controles acordados. Si faltan parámetros operativos, responsables de autorización, ventanas, condiciones de seguridad o criterios de validación, decláralo como brecha sin asumir.',
    1
  UNION ALL SELECT
    'Seguridad Física',
    'Seguridad Física y de Personal',
    'Enfocado en seguridad física: accesos, control de visitantes, guardias, CCTV, incidentes físicos, amenazas, protocolos y coordinación con instalaciones.',
    'Analiza la minuta con enfoque de seguridad física y de personal. Delimita a control de acceso (personas/vehículos), credenciales, visitantes, guardias, CCTV, rondas, zonas restringidas, incidentes físicos, amenazas, protocolos de emergencia y coordinación con facilities/seguridad. Extrae hechos reportados, decisiones, acciones, responsables, plazos y evidencias (registros de acceso, cámaras, reportes). Señala brechas (lugar, horario, personas involucradas, activos afectados, evidencia disponible, autoridad responsable) sin inventar información. Mantén redacción objetiva, orientada a trazabilidad y seguimiento.',
    1
  UNION ALL SELECT
    'Gobierno y Cumplimiento',
    'Decisiones y Gobernanza (Decision Log / RACI)',
    'Enfocado en formalizar decisiones: qué se decidió, alternativas, criterio, responsables (RACI), aprobaciones, escalaciones y pendientes de definición.',
    'Analiza la minuta con enfoque de decisiones y gobernanza. Delimita el alcance a: decisiones explícitas (y si existe, implícitas pero sustentadas por acuerdos), alternativas evaluadas, criterio de decisión, aprobaciones requeridas, escalaciones, supuestos y restricciones. Construye un ''registro de decisiones'' con: decision, contexto, opcion_elegida, alternativas (si se mencionan), criterio, impacto, responsable (R), accountable (A), consultados (C), informados (I), fecha objetivo (si existe) y evidencia/artefacto asociado. Si falta RACI, aprobación, criterio o impacto, regístralo como brecha y formula preguntas concretas para cerrarlo. No inventes responsables, fechas ni criterios.',
    1
  UNION ALL SELECT
    'Operaciones',
    'Plan de Acción y Seguimiento (Action Tracking)',
    'Enfocado en control de ejecución: acciones, dueños, fechas, dependencias, estado, criterios de cierre y próximos hitos de seguimiento.',
    'Analiza la minuta con enfoque de plan de acción y seguimiento. Delimita el alcance a acciones accionables y verificables. Extrae y normaliza un plan con: accion (verbo + objeto), responsable, fecha_compromiso (si existe), prioridad (si se menciona), dependencias, prerequisitos, bloqueo_actual, criterio_de_cierre (definición de listo), evidencia esperada (log, acta, ticket, reporte, captura), y proximo_punto_de_control (fecha o instancia). Si una acción no tiene dueño o fecha o criterio de cierre, regístralo como brecha y propone la pregunta mínima para completarla. No inventes datos.',
    1
  UNION ALL SELECT
    'Operaciones',
    'Postmortem y Lecciones Aprendidas (RCA)',
    'Enfocado en análisis de causa raíz y mejora continua: qué falló, por qué, impacto, factores contribuyentes, acciones preventivas y controles actualizados.',
    'Analiza la minuta con enfoque de postmortem y lecciones aprendidas. Delimita a eventos problemáticos (incidente, fallo, desviación, interrupción) y su análisis. Estructura el resultado con: resumen_del_evento, linea_de_tiempo (si existe), impacto (personas/operación/servicio/costos), causa_raiz (solo si se menciona), factores_contribuyentes, deteccion (cómo se detectó), respuesta (acciones ejecutadas), recuperacion (cómo se restauró), acciones_correctivas, acciones_preventivas, dueños y plazos. Registra evidencia citada (logs, reportes, tickets, mediciones). Si no hay causa raíz o evidencia suficiente, decláralo como brecha y lista los datos mínimos necesarios (síntoma, alcance, métricas, cambios previos, evidencia). No asumas causas.',
    1
  UNION ALL SELECT
    'Seguridad Ocupacional',
    'Permisos de Trabajo y Controles Críticos (HSE/PTW)',
    'Enfocado en control HSE: permisos de trabajo, análisis de riesgos (AST/JSA), controles críticos, barreras, EPP, autorizaciones y evidencias requeridas.',
    'Analiza la minuta con enfoque HSE centrado en permisos de trabajo y controles críticos. Delimita el alcance a: actividades de riesgo, PTW (permiso de trabajo), AST/JSA, controles críticos/barreras (preventivas y mitigadoras), EPP, señalización/aislamiento (LOTO si se menciona), supervisión, charlas de seguridad, autorizaciones y coordinaciones con seguridad/facilities. Extrae: actividad, ubicación, riesgos identificados, controles acordados, responsables de autorización/ejecución/supervisión, ventana/condiciones de trabajo, evidencias requeridas (permiso firmado, checklist, registros, fotografías, mediciones), y validaciones previas/durante/post. Si falta el permiso, el análisis de riesgo, la autorización, la identificación de controles o la evidencia, regístralo como brecha y formula preguntas concretas. No inventes condiciones ni controles no mencionados.',
    1
  UNION ALL SELECT
    'Operaciones',
    'Reunión de Seguimiento Semanal (Weekly Status)',
    'Enfocado en reuniones recurrentes de seguimiento semanal: estado de avances vs plan, bloqueos, riesgos, próximos pasos y compromisos de la semana.',
    'Analiza la minuta como reunión de seguimiento semanal. Delimita el alcance a: estado del trabajo (hecho/en curso/pendiente), avances relevantes desde la última semana, desviaciones vs plan, bloqueos, riesgos operacionales, dependencias y compromisos para la próxima semana. Normaliza el resultado en: resumen_ejecutivo (3-5 bullets), avances_semana, plan_proxima_semana, bloqueos_y_dependencias, riesgos_y_mitigaciones (solo si se mencionan), decisiones_y_acuerdos, y compromisos (accion, responsable, fecha si existe, criterio_de_cierre, evidencia esperada). No inventes fechas ni responsables: si faltan, regístralo como brecha y formula la pregunta mínima.',
    1
  UNION ALL SELECT
    'PMO',
    'Seguimiento de Proyecto (Ejecución y Control)',
    'Enfocado en control de ejecución del proyecto: hitos, cronograma, alcance, cambios, issues, decisiones y gobernanza de seguimiento.',
    'Analiza la minuta con enfoque de seguimiento de proyecto (control de ejecución). Delimita a: avance por entregables/hitos, cronograma (fechas comprometidas vs reales si se mencionan), variaciones de alcance, issues y bloqueos, cambios (RFC si aplica), decisiones pendientes, dependencias y próximos puntos de control. Extrae un estado consolidado: semaforo_general (solo si se menciona o puede inferirse de forma explícita por acuerdos; si no, marca ''no definido''), estado_por_hito (hito, estado, fecha objetivo si existe, bloqueo), riesgos_y_mitigaciones acordadas, decisiones_tomadas, decisiones_pendientes, y acciones_con_dueño. No asumas métricas ni fechas: registra brechas y preguntas concretas.',
    1
  UNION ALL SELECT
    'Operaciones',
    'Seguimiento de Servicios (Service Review Semanal)',
    'Enfocado en reuniones semanales con cliente para revisar estado del servicio: cumplimiento de SLA, tickets, incidentes, cambios, capacidad y mejoras.',
    'Analiza la minuta como reunión semanal de seguimiento de servicios (service review). Delimita a: estado del servicio, tickets/incidentes (volumen y estado si se menciona), cumplimiento de SLA/OLA (si se menciona), causas recurrentes/problemas, cambios ejecutados y planificados (ventanas si existen), capacidad/rendimiento (si se discute), comunicaciones con cliente y próximos compromisos. Estructura el resultado en: resumen_del_servicio, tickets_e_incidentes (id/ticket si existe, estado, impacto, responsable), cumplimiento_sla (brechas si faltan métricas), cambios_y_ventanas, problemas_recurrentes_y_rca (solo si se menciona), riesgos_operacionales, y compromisos_para_la_proxima_semana (accion, dueño, fecha, criterio_de_cierre, evidencia). Si faltan IDs de ticket, métricas SLA, alcance del impacto o ventana, regístralo como brecha y solicita los datos mínimos necesarios sin inferir.',
    1
) v
JOIN ai_profile_categories pc
  ON pc.name = v.category;