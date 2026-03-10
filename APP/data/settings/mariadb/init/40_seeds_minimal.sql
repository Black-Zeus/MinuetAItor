/* 40_seeds_minimal.sql
   ============================================================================
   Propósito  : Seed mínimo del SISTEMA (FIRST-RUN ONLY) - Datos de configuración
                y catálogos necesarios para que la aplicación funcione.
   Contexto   : Este archivo contiene los datos base del dominio que la aplicación
                necesita para operar (catálogos, tipos, perfiles de IA, roles).
   Motor      : MySQL / MariaDB (InnoDB, utf8mb4)
   Dependencias: Ejecutar después de 10_schema_tables_core.sql
   ============================================================================
   Reglas:
   - Catálogos: un único INSERT por tabla (single source of truth)
   - Defaults lógicos: configuraciones base del sistema
   - NO incluye datos de prueba (clientes, proyectos, usuarios reales)
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
  ('records.read',         'Leer documentos',         'Puede listar/ver documentos y versiones', 1),
  ('records.create',       'Crear documentos',        'Puede crear registros y drafts', 1),
  ('records.update',       'Editar documentos',       'Puede modificar cabeceras y drafts', 1),
  ('records.publish',      'Publicar documentos',     'Puede publicar (genera versión+PDF)', 1),
  ('records.soft_delete',  'Soft delete documentos',  'Puede dar de baja lógica registros', 1),
  ('records.hard_delete',  'Hard delete documentos',  'Puede eliminar físicamente (auditoría obligatoria)', 1),
  ('users.manage',         'Administrar usuarios',    'CRUD/roles/estado de usuarios', 1),
  ('clients.manage',       'Administrar clientes',    'CRUD/estado de clientes', 1),
  ('audit.read',           'Leer auditoría',          'Puede consultar audit_log', 1);

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
  ('in-progress',       'En procesamiento',   'LLM procesando (TX1 committed, TX2 en curso)', 1),
  ('ready-for-edit',    'Listo para editar',  'LLM completó OK, borrador disponible', 1),
  ('llm-failed',        'Fallo LLM',          'OpenAI retornó error (timeout, rate limit, bad request)', 1),
  ('processing-error',  'Error de proceso',   'Error interno del backend (MinIO, BD, validación)', 1),
  ('pending',           'En edición',         'Usuario editando activamente', 1),
  ('preview',           'En revisión',        'Hard lock de edición, en revisión previa a publicación', 1),
  ('completed',         'Completado',         'Publicada oficialmente (terminal, no eliminable)', 1),
  ('cancelled',         'Cancelado',          'Anulada', 1),
  ('deleted',           'Eliminado',          'Soft delete (terminal, no visible en operaciones normales)', 1);

-- Version statuses
INSERT INTO version_statuses (code, name, description, is_active) VALUES
  ('snapshot',  'Snapshot',  'Versión creada al transicionar de estado', 1),
  ('final',     'Final',     'Versión al llegar a completed', 1);

-- Artifact states
INSERT INTO artifact_states (code, name, description, is_active) VALUES
  ('DRAFT',       'Borrador',    'Artefacto del draft vigente', 1),
  ('PUBLISHED',   'Publicado',   'Artefacto de versión publicada', 1),
  ('ARCHIVED',    'Archivado',   'Artefacto histórico/no vigente', 1),
  ('ORIGINAL',    'Original',    'Artefacto original de la IA, inmutable', 1),
  ('VERSIONED',   'Versionado',  'Versión derivada por edición del usuario', 1),
  ('GENERATING',  'Generando',   'En proceso de generación', 1),
  ('READY',       'Listo',       'Disponible y verificado', 1),
  ('FAILED',      'Fallido',     'Error durante la generación', 1);

-- Artifact types
INSERT INTO artifact_types (code, name, description, is_active) VALUES
  ('INPUT_TRANSCRIPT',  'Transcripción',    'Input transcripción (txt)', 1),
  ('INPUT_SUMMARY',     'Resumen',          'Input resumen (txt)', 1),
  ('LLM_JSON_ORIGINAL', 'JSON LLM Original','JSON original devuelto por LLM (sin edición)', 1),
  ('CANONICAL_JSON',    'JSON Canonical',   'JSON confirmado/editable que origina la publicación', 1),
  ('PUBLISHED_PDF',     'PDF Publicado',    'Documento final publicado (PDF)', 1),
  ('ATTACHMENT_IMAGE',  'Imagen Adjunta',   'Adjuntos (imágenes/otros)', 1);

-- Buckets MinIO
INSERT INTO buckets (code, name, description, is_active) VALUES
  ('inputs_container',      'minuetaitor-inputs',     'Entradas (transcripción/resumen)', 1),
  ('json_container',        'minuetaitor-json',       'JSONs (original/canonical)', 1),
  ('published_container',   'minuetaitor-published',  'Salidas publicadas (PDF)', 1),
  ('attachments_container', 'minuetaitor-attach',     'Adjuntos (imágenes/otros)', 1),
  ('draft_container',       'minuetaitor-draft',      'Draft actual editable (draft_current.json)', 1);

-- Dashboard widgets base
INSERT INTO dashboard_widgets (code, name, description, is_active) VALUES
  ('stats',                    'Stats generales',          'KPIs principales', 1),
  ('ultima_conexion',          'Última conexión',          'Último acceso del usuario', 1),
  ('minutas_pendientes',       'Minutas pendientes',       'Pendientes de aprobación', 1),
  ('minutas_participadas',     'Minutas donde participé',  'Historial de participación', 1),
  ('clientes_confidenciales',  'Clientes confidenciales',  'Clientes con acceso confidencial', 1),
  ('proyectos_confidenciales', 'Proyectos confidenciales', 'Proyectos con acceso confidencial', 1),
  ('tags_populares',           'Etiquetas populares',      'Tags más usados', 1);


-- ----------------------------------------------------------------------------
-- [03] Tags (tag_categories / tags)
-- Pool: tag_categories + tags
-- ----------------------------------------------------------------------------

-- TAG_CATEGORIES
INSERT INTO tag_categories (name, is_active) VALUES
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

-- CANONICAL_JSON y PUBLISHED_PDF: requeridos al publicar, max 1 por defecto
INSERT INTO record_type_artifact_types (record_type_id, artifact_type_id, is_required_on_publish, max_count, is_active)
SELECT rt.id, at.id, 1, 1, 1
FROM record_types rt
JOIN artifact_types at ON at.code IN ('CANONICAL_JSON','PUBLISHED_PDF')
WHERE rt.code IN ('REPORT','EXPENSE');

-- MINUTE: CANONICAL_JSON y PUBLISHED_PDF requeridos al publicar, pero con N versiones
INSERT INTO record_type_artifact_types (record_type_id, artifact_type_id, is_required_on_publish, max_count, is_active)
SELECT rt.id, at.id, 1, 999, 1
FROM record_types rt
JOIN artifact_types at ON at.code IN ('CANONICAL_JSON','PUBLISHED_PDF')
WHERE rt.code = 'MINUTE';

-- MINUTE: inputs y LLM original (no requeridos al publicar, únicos por minuta)
INSERT INTO record_type_artifact_types (record_type_id, artifact_type_id, is_required_on_publish, max_count, is_active)
SELECT rt.id, at.id, 0, 1, 1
FROM record_types rt
JOIN artifact_types at ON at.code IN ('INPUT_TRANSCRIPT','INPUT_SUMMARY','LLM_JSON_ORIGINAL')
WHERE rt.code = 'MINUTE';

-- REPORT: permite adjuntos
INSERT INTO record_type_artifact_types (record_type_id, artifact_type_id, is_required_on_publish, max_count, is_active)
SELECT rt.id, at.id, 0, 100, 1
FROM record_types rt
JOIN artifact_types at ON at.code = 'ATTACHMENT_IMAGE'
WHERE rt.code = 'REPORT';


-- ----------------------------------------------------------------------------
-- [05] MIME / Extensiones / Defaults (mime_types / file_extensions / bridges)
-- Pool: mime_types + file_extensions + mime_type_extensions + artifact_type_mime_types
-- ----------------------------------------------------------------------------

-- MIME types
INSERT INTO mime_types (mime, description, is_active) VALUES
  ('application/pdf',            'PDF', 1),
  ('application/json',           'JSON estándar', 1),
  ('text/plain',                 'Texto plano UTF-8', 1),
  ('image/png',                  'Imagen PNG', 1),
  ('image/jpeg',                 'Imagen JPEG', 1);

-- Extensiones
INSERT INTO file_extensions (ext, description, is_active) VALUES
  ('pdf',  'PDF', 1),
  ('json', 'JSON', 1),
  ('txt',  'Texto', 1),
  ('png',  'PNG', 1),
  ('jpg',  'JPEG', 1),
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
JOIN file_extensions fe ON (mt.mime='text/plain' AND fe.ext='txt');

INSERT INTO mime_type_extensions (mime_type_id, file_extension_id, is_default, is_active)
SELECT mt.id, fe.id, 1, 1
FROM mime_types mt
JOIN file_extensions fe ON (mt.mime='image/png' AND fe.ext='png');

-- image/jpeg: default=jpg, jpeg no-default
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
JOIN mime_types mt ON mt.mime='text/plain'
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
WHERE at.code = 'PUBLISHED_PDF';

-- ATTACHMENT_IMAGE: default=image/png, jpeg como alternativo
INSERT INTO artifact_type_mime_types (artifact_type_id, mime_type_id, is_default, is_active)
SELECT at.id, mt.id, 1, 1
FROM artifact_types at
JOIN mime_types mt ON mt.mime='image/png'
WHERE at.code = 'ATTACHMENT_IMAGE';

INSERT INTO artifact_type_mime_types (artifact_type_id, mime_type_id, is_default, is_active)
SELECT at.id, mt.id, 0, 1
FROM artifact_types at
JOIN mime_types mt ON mt.mime='image/jpeg'
WHERE at.code = 'ATTACHMENT_IMAGE';


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
(id, category_id, name, description, prompt, is_active, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
VALUES
('70a8baf7-1593-11f1-8403-da1169052fe5', 1, 'Análisis de Redes', 'Enfocado en decisiones y acciones técnicas sobre redes (LAN/WAN, routing/switching, VLAN, DNS/DHCP, firewall, conectividad).', 'Analiza la reunión con enfoque de ingeniería de redes. Al analizar, prioriza temas de conectividad, VLANs, routing/switching, DNS/DHCP, firewall y componentes de red. Extrae todos los temas tratados; para temas de red usa etiquetas: ''Decisión'' para cambios acordados, ''Pendiente'' para tareas de red sin iniciar, ''Bloqueo'' para problemas de conectividad activos, ''Riesgo'' para riesgos de indisponibilidad. Documenta IPs, VLANs, sitios o equipos mencionados; si faltan datos técnicos, regístralo como brecha sin inventar. Registra todos los acuerdos y puntos de acción con responsable.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a8c078-1593-11f1-8403-da1169052fe5', 1, 'Análisis de Servidores', 'Enfocado en operación y administración de servidores (Windows/Linux), roles, servicios, almacenamiento, rendimiento y continuidad.', 'Analiza la reunión con enfoque de servidores y sistemas. Al analizar, prioriza temas de sistema operativo, roles/servicios, almacenamiento, respaldos, parches y monitoreo. Extrae todos los temas tratados; para temas de servidor usa etiquetas: ''Hecho'' para acciones completadas, ''Pendiente'' para tareas pendientes, ''Riesgo'' para riesgos de capacidad o continuidad, ''Decisión'' para decisiones de configuración. Si faltan datos como hostname, SO, versión o capacidad, regístralo como brecha. Registra todos los puntos de acción con responsable.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a8c35d-1593-11f1-8403-da1169052fe5', 2, 'Implementación de Software', 'Enfocado en implementación/despliegue de software, ambientes, dependencias, configuración, CI/CD y criterios de aceptación.', 'Analiza la reunión con enfoque de implementación y despliegue de software. Al analizar, prioriza temas de despliegue, configuración, ambientes, versionado, dependencias y validación funcional. Extrae todos los temas tratados; para temas de implementación usa etiquetas: ''Completado'' para despliegues exitosos, ''En curso'' para implementaciones en progreso, ''Pendiente'' para pasos no iniciados, ''Bloqueo'' para impedimentos técnicos, ''Riesgo'' para riesgos de compatibilidad o regresión. Documenta brechas si faltan criterios de aceptación o versiones. Registra todos los acuerdos con responsable.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a8c50e-1593-11f1-8403-da1169052fe5', 2, 'Implementación de Características', 'Enfocado en definición e implementación de funcionalidades: requerimientos, alcance, dependencias y criterios de éxito.', 'Analiza la reunión con enfoque de definición e implementación de funcionalidades. Al analizar, prioriza requerimientos, alcance, reglas de negocio, dependencias y criterios de éxito. Extrae todos los temas tratados; usa etiquetas: ''Definido'' para requerimientos cerrados, ''En revisión'' para aspectos en discusión, ''Pendiente'' para definiciones faltantes, ''Bloqueo'' para impedimentos de avance, ''Riesgo'' para desviación de alcance. Si faltan criterios de aceptación o definición de hecho, regístralo como brecha con la pregunta concreta para cerrarlo.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a8c6e1-1593-11f1-8403-da1169052fe5', 3, 'Análisis de Vulnerabilidades', 'Enfocado en hallazgos de seguridad: evidencia, exposición, severidad/prioridad y plan de remediación.', 'Analiza la reunión con enfoque de seguridad y hallazgos de vulnerabilidades. Al analizar, prioriza hallazgos de seguridad, evidencias, alcance de exposición y acciones de remediación. Extrae todos los temas tratados; para hallazgos usa etiquetas: ''Hallazgo'' para vulnerabilidades identificadas, ''Remediado'' para vulnerabilidades resueltas, ''En remediación'' para acciones en curso, ''Pendiente'' para remediaciones no iniciadas, ''Riesgo residual'' para riesgo conocido y aceptado. Si faltan CVE, activos afectados o severidad, regístralo como brecha sin inferir.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a8c866-1593-11f1-8403-da1169052fe5', 3, 'Operaciones de Seguridad', 'Enfocado en SOC/CSIRT: incidentes, alertas, respuesta, evidencias, contención y seguimiento.', 'Analiza la reunión con enfoque de operaciones de seguridad (SOC/CSIRT). Al analizar, prioriza incidentes, alertas, respuesta, contención y seguimiento. Extrae todos los temas tratados; para incidentes usa etiquetas: ''Detectado'' para incidentes identificados, ''Contenido'' para incidentes mitigados, ''Cerrado'' para incidentes resueltos, ''En investigación'' para análisis en curso, ''Pendiente'' para acciones de seguimiento. Documenta cronología, decisiones y evidencias citadas. Si faltan fuentes de log, IOCs o alcance, regístralo como brecha.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a8c9ef-1593-11f1-8403-da1169052fe5', 4, 'Cumplimiento y Auditoría', 'Enfocado en evidencia, trazabilidad, controles, aprobaciones, segregación de funciones y riesgos de no conformidad.', 'Analiza la reunión con enfoque de cumplimiento, auditoría y gobierno. Al analizar, prioriza controles, aprobaciones, evidencias requeridas, segregación de funciones y trazabilidad. Extrae todos los temas tratados; usa etiquetas: ''Conforme'' para controles validados, ''No conforme'' para brechas de control, ''Pendiente de evidencia'' para controles sin respaldo documental, ''Aprobado'' para decisiones formalizadas. Registra artefactos a generar o adjuntar. Si faltan números de control, evidencia o responsable, regístralo como brecha.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a8ce90-1593-11f1-8403-da1169052fe5', 5, 'Análisis Administrativo', 'Enfocado en coordinación: acuerdos, pendientes, bloqueos, dependencias, comunicaciones y seguimiento.', 'Analiza la reunión con enfoque administrativo y de coordinación. Al analizar, prioriza acuerdos, pendientes, bloqueos, dependencias y comunicaciones entre partes. Extrae todos los temas tratados usando etiquetas: ''Acuerdo'' para compromisos formalizados, ''Pendiente'' para tareas sin responsable o fecha, ''Bloqueo'' para impedimentos de avance, ''Decisión'' para decisiones tomadas. Redacta conclusiones claras con acción verificable. No inventes fechas, responsables ni compromisos no explícitos en la reunión.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a8d0cb-1593-11f1-8403-da1169052fe5', 6, 'Análisis de RRHH', 'Enfocado en gestión de personas: dotación, roles, desempeño, capacitación, clima, políticas internas y acuerdos.', 'Analiza la reunión con enfoque de gestión de personas y RRHH. Al analizar, prioriza dotación, roles, desempeño, capacitación, clima y políticas internas. Extrae todos los temas tratados; usa etiquetas: ''Decisión de personal'' para cambios de roles o dotación, ''Capacitación'' para necesidades formativas, ''Riesgo'' para situaciones de clima o retención sustentadas por lo conversado, ''Pendiente'' para acciones sin iniciar. Si faltan datos como cargo, área o criterio de evaluación, regístralo como brecha.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a8d2b9-1593-11f1-8403-da1169052fe5', 7, 'Gestión de Proyectos', 'Enfocado en alcance, hitos, cronograma, estado, riesgos, dependencias y próximos pasos.', 'Analiza la reunión con enfoque de gestión de proyectos. Al analizar, prioriza alcance, hitos, cronograma, estado, riesgos y dependencias. Extrae todos los temas tratados; usa etiquetas: ''Hito completado'' para entregables cerrados, ''En ejecución'' para trabajo en curso, ''Pendiente'' para hitos no iniciados, ''Bloqueo'' para impedimentos que afectan el cronograma, ''Riesgo'' para amenazas al proyecto, ''Cambio de alcance'' para variaciones. Si faltan fechas o criterios de éxito, regístralo como brecha con la pregunta concreta.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a8d3de-1593-11f1-8403-da1169052fe5', 1, 'Análisis de Bases de Datos', 'Enfocado en cambios de esquema, migraciones, rendimiento, respaldos/restore, replicación y permisos.', 'Analiza la reunión con enfoque de administración de bases de datos. Al analizar, prioriza cambios de esquema, migraciones, rendimiento, respaldos y permisos. Extrae todos los temas tratados; usa etiquetas: ''Ejecutado'' para cambios aplicados, ''Pendiente'' para cambios no iniciados, ''Riesgo'' para riesgos de pérdida de datos o indisponibilidad, ''Decisión'' para decisiones de diseño o configuración. No infiras estructuras de datos; si faltan versiones, tablas afectadas o tamaños, regístralo como brecha.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a8d514-1593-11f1-8403-da1169052fe5', 4, 'Gestión de Cambios de Infraestructura', 'Enfocado en plan de cambio, ventana, impacto, prerequisitos, aprobaciones, rollback y criterio de éxito.', 'Analiza la reunión con enfoque de gestión y control de cambios de infraestructura. Al analizar, prioriza plan de cambio, ventana de mantenimiento, impacto, aprobaciones y rollback. Extrae todos los temas tratados; usa etiquetas: ''Aprobado'' para cambios autorizados, ''Ejecutado'' para cambios aplicados, ''Rechazado'' para cambios no aprobados, ''Pendiente de aprobación'' para cambios en revisión, ''Riesgo'' para impactos potenciales. Si faltan pasos de rollback, criterio de éxito o aprobaciones, regístralo explícitamente como brecha.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a8d649-1593-11f1-8403-da1169052fe5', 8, 'Arquitectura y Diseño de Soluciones', 'Enfocado en decisiones de arquitectura, trade-offs, patrones, integraciones y criterios no funcionales.', 'Analiza la reunión con enfoque de arquitectura y diseño de soluciones. Al analizar, prioriza decisiones de diseño, patrones, integraciones, trade-offs y atributos de calidad (rendimiento, seguridad, disponibilidad, escalabilidad). Extrae todos los temas tratados; usa etiquetas: ''Decisión arquitectural'' para elecciones de diseño tomadas, ''Alternativa evaluada'' para opciones consideradas, ''Pendiente de definición'' para decisiones no cerradas, ''Riesgo técnico'' para riesgos de diseño. Si faltan supuestos, capacidades objetivo o dependencias, decláralo como brecha.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a8d7b2-1593-11f1-8403-da1169052fe5', 9, 'Gestión de Producto', 'Enfocado en visión, roadmap, prioridades, métricas, feedback de usuarios y definición de valor.', 'Analiza la reunión con enfoque de gestión de producto. Al analizar, prioriza objetivos, prioridades, roadmap, problemas de usuario y métricas de éxito. Extrae todos los temas tratados; usa etiquetas: ''Prioridad confirmada'' para ítems del roadmap validados, ''En revisión'' para ítems en evaluación, ''Descartado'' para ítems rechazados, ''Hipótesis'' para suposiciones a validar, ''Decisión de producto'' para decisiones de priorización tomadas. Si faltan KPI, segmento objetivo o criterio de valor, regístralo como brecha.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a8d8e7-1593-11f1-8403-da1169052fe5', 10, 'Finanzas y Presupuesto', 'Enfocado en costos, presupuesto, CAPEX/OPEX, aprobaciones, desviaciones y control financiero.', 'Analiza la reunión con enfoque financiero y de presupuesto. Al analizar, prioriza costos, presupuesto, CAPEX/OPEX, aprobaciones y desviaciones. Extrae todos los temas tratados; usa etiquetas: ''Aprobado'' para gastos autorizados, ''Pendiente de aprobación'' para solicitudes en revisión, ''Desviación'' para diferencias entre presupuestado y ejecutado, ''Riesgo financiero'' para sobrecostos potenciales. Documenta montos solo si se mencionan explícitamente. Si faltan cifras, centros de costo o responsables, regístralo como brecha sin inferir.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a8da03-1593-11f1-8403-da1169052fe5', 10, 'Compras y Abastecimiento', 'Enfocado en adquisiciones: requerimientos, cotizaciones, licitaciones, proveedores y entregas.', 'Analiza la reunión con enfoque de compras y abastecimiento. Al analizar, prioriza requerimientos de adquisición, cotizaciones, evaluación de proveedores y plazos de entrega. Extrae todos los temas tratados; usa etiquetas: ''Requerimiento'' para necesidades de compra identificadas, ''En cotización'' para procesos abiertos, ''Adjudicado'' para compras aprobadas, ''Pendiente'' para acciones sin iniciar. Si faltan especificación técnica, presupuesto, proveedor o SLA, regístralo como brecha sin inventar.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a8dbca-1593-11f1-8403-da1169052fe5', 11, 'Gestión de Proveedores y SLA', 'Enfocado en relación con proveedores, contratos, SLA, penalidades, escalamiento y seguimiento.', 'Analiza la reunión con enfoque de gestión de proveedores y SLA. Al analizar, prioriza compromisos contractuales, SLA/OLA, escalamientos, entregables y fechas. Extrae todos los temas tratados; usa etiquetas: ''Cumplido'' para compromisos satisfechos, ''Incumplimiento'' para brechas de SLA, ''Escalado'' para issues con el proveedor formalmente escalados, ''Pendiente'' para acciones de seguimiento, ''Riesgo'' para incumplimientos potenciales. Si faltan números de contrato, métricas SLA o fechas, regístralo como brecha.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a8dcd4-1593-11f1-8403-da1169052fe5', 11, 'Gestión de Servicios TI (ITIL)', 'Enfocado en procesos ITIL: incidentes, problemas, cambios, catálogo, SLAs y mejora continua.', 'Analiza la reunión con enfoque ITIL de gestión de servicios TI. Al analizar, prioriza incidentes, problemas, cambios, solicitudes y niveles de servicio. Extrae todos los temas tratados; usa etiquetas: ''Incidente'' para interrupciones de servicio, ''Problema'' para causas raíz en análisis, ''Cambio'' para RFC o modificaciones, ''Solicitud'' para requerimientos de usuario, ''Riesgo operacional'' para situaciones que pueden afectar el servicio. Documenta IDs de ticket cuando se mencionen. Si faltan impacto, prioridad, ventana o aprobaciones, regístralo como brecha.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a8dde0-1593-11f1-8403-da1169052fe5', 12, 'Continuidad de Negocio y DRP', 'Enfocado en continuidad, RTO/RPO, planes DR, pruebas y lecciones aprendidas.', 'Analiza la reunión con enfoque de continuidad de negocio y recuperación ante desastres. Al analizar, prioriza RTO/RPO, escenarios de contingencia, planes DR y resultados de pruebas. Extrae todos los temas tratados; usa etiquetas: ''Validado'' para controles de continuidad probados, ''Pendiente de prueba'' para controles no validados, ''Brecha de continuidad'' para riesgos de interrupción identificados, ''Decisión'' para cambios al plan DR. Si faltan RTO/RPO, alcance de sistemas críticos o evidencia de pruebas, regístralo como brecha.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a8ded6-1593-11f1-8403-da1169052fe5', 12, 'Gestión de Riesgos', 'Enfocado en identificación, evaluación, mitigación y seguimiento de riesgos organizacionales.', 'Analiza la reunión con enfoque de gestión de riesgos. Al analizar, prioriza riesgos discutidos, mitigaciones acordadas y estado de seguimiento. Extrae todos los temas tratados; para cada riesgo identificado usa: etiqueta ''Riesgo'' con causa y consecuencia si se mencionan, mitigación acordada, responsable y plazo. No inventes probabilidad o impacto si no se mencionan; si faltan, regístralo como brecha. Incluye también los acuerdos generales de la reunión aunque no sean riesgos.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a8dfec-1593-11f1-8403-da1169052fe5', 13, 'Legal y Contratos', 'Enfocado en cláusulas, obligaciones, cambios contractuales, cumplimiento legal y riesgos contractuales.', 'Analiza la reunión con enfoque legal y contractual. Al analizar, prioriza contratos, obligaciones, cambios contractuales, cumplimiento legal y aprobaciones. Extrae todos los temas tratados; usa etiquetas: ''Obligación'' para compromisos contractuales, ''Aprobado'' para cláusulas o cambios aceptados, ''Pendiente de revisión legal'' para aspectos sin validar, ''Riesgo contractual'' para posibles incumplimientos. Si faltan número de contrato, cláusula, contraparte o fecha de vigencia, regístralo como brecha sin inferir.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a8e0e5-1593-11f1-8403-da1169052fe5', 13, 'Privacidad y Protección de Datos', 'Enfocado en datos personales: bases legales, minimización, retención, accesos y cumplimiento.', 'Analiza la reunión con enfoque de privacidad y protección de datos personales. Al analizar, prioriza tratamiento de datos personales, bases legales, minimización, retención y accesos. Extrae todos los temas tratados; usa etiquetas: ''Tratamiento de datos'' para usos de datos personales identificados, ''Conforme'' para prácticas alineadas a normativa, ''Brecha de privacidad'' para prácticas no conformes, ''Pendiente'' para acciones de adecuación. Si faltan clasificación, base legal, responsable de tratamiento o requisito regulatorio, regístralo como brecha.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a8e1f7-1593-11f1-8403-da1169052fe5', 14, 'Calidad (QA) y Pruebas', 'Enfocado en estrategia de pruebas, cobertura, defectos, criterios de aceptación y evidencias.', 'Analiza la reunión con enfoque de calidad y pruebas (QA). Al analizar, prioriza estrategia de pruebas, cobertura, defectos y criterios de aceptación. Extrae todos los temas tratados; usa etiquetas: ''Aprobado'' para artefactos que pasaron pruebas, ''Defecto'' para fallas identificadas, ''Bloqueado'' para pruebas detenidas por impedimento, ''Pendiente'' para pruebas no iniciadas, ''Criterio faltante'' para brechas de definición de aceptación. Si faltan evidencias, responsable de aprobación o ambiente de pruebas, regístralo como brecha.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a8e2fd-1593-11f1-8403-da1169052fe5', 11, 'Soporte y Atención al Cliente', 'Enfocado en tickets, reclamos, SLA, comunicación con usuarios y resolución.', 'Analiza la reunión con enfoque de soporte y atención a usuarios. Al analizar, prioriza tickets, incidentes reportados, SLA, resolución y comunicación. Extrae todos los temas tratados; usa etiquetas: ''Resuelto'' para casos cerrados, ''En atención'' para casos en progreso, ''Escalado'' para casos derivados a segundo o tercer nivel, ''Pendiente'' para casos sin asignar o iniciar, ''Brecha de SLA'' para incumplimientos de tiempo de respuesta. Documenta IDs de ticket cuando se mencionen; si faltan, registrarlo como brecha.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a8e406-1593-11f1-8403-da1169052fe5', 15, 'Ventas y Gestión Comercial', 'Enfocado en pipeline, oportunidades, propuestas, negociación y próximos pasos comerciales.', 'Analiza la reunión con enfoque comercial y de ventas. Al analizar, prioriza oportunidades, estado del pipeline, propuestas y próximos pasos. Extrae todos los temas tratados; usa etiquetas: ''Oportunidad activa'' para negocios en seguimiento, ''Propuesta enviada'' para ofertas en revisión, ''Ganado'' para negocios cerrados, ''Perdido'' para negocios no concretados, ''Pendiente'' para acciones comerciales sin iniciar. Si faltan monto estimado, decisor, etapa o fecha objetivo, regístralo como brecha.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a8e506-1593-11f1-8403-da1169052fe5', 15, 'Marketing y Comunicaciones', 'Enfocado en campañas, mensajes, canales, audiencias, calendario y métricas.', 'Analiza la reunión con enfoque de marketing y comunicaciones. Al analizar, prioriza campañas, audiencias, canales, calendario y métricas. Extrae todos los temas tratados; usa etiquetas: ''Campaña activa'' para iniciativas en ejecución, ''Planificado'' para campañas en preparación, ''Completado'' para campañas cerradas, ''Pendiente'' para acciones sin iniciar. Documenta KPIs o métricas solo si se mencionan. Si faltan objetivo, audiencia, canal o fechas, regístralo como brecha sin inventar.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a8e611-1593-11f1-8403-da1169052fe5', 11, 'Operaciones y Procesos (Mejora Continua)', 'Enfocado en procesos internos, eficiencia, cuellos de botella, estandarización y KPIs operacionales.', 'Analiza la reunión con enfoque de operaciones y mejora continua de procesos. Al analizar, prioriza flujos operativos, cuellos de botella, estandarización y KPIs. Extrae todos los temas tratados; usa etiquetas: ''Proceso mejorado'' para cambios implementados, ''Cuello de botella'' para ineficiencias identificadas, ''Propuesta de mejora'' para iniciativas en evaluación, ''Pendiente'' para acciones sin iniciar. Si faltan métricas base, dueño del proceso o definición del estado futuro, regístralo como brecha.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a8e726-1593-11f1-8403-da1169052fe5', 4, 'Gestión de Activos y CMDB', 'Enfocado en inventario, CMDB, ciclo de vida, asignación, licencias y trazabilidad de activos.', 'Analiza la reunión con enfoque de gestión de activos y CMDB. Al analizar, prioriza inventario, ciclo de vida, asignación, licencias y trazabilidad de activos. Extrae todos los temas tratados; usa etiquetas: ''Alta de activo'' para incorporaciones, ''Baja de activo'' para retiros, ''Reasignado'' para cambios de responsable, ''Brecha de inventario'' para activos sin identificar o con datos incompletos, ''Pendiente'' para acciones de registro. Si faltan identificadores, ubicación o estado, regístralo como brecha.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a991f4-1593-11f1-8403-da1169052fe5', 4, 'Gestión Documental y Conocimiento', 'Enfocado en documentación, estándares, repositorios, control de versiones y gestión de conocimiento.', 'Analiza la reunión con enfoque de gestión documental y conocimiento. Al analizar, prioriza documentos requeridos, estándares, repositorios, versiones y aprobaciones. Extrae todos los temas tratados; usa etiquetas: ''Documento aprobado'' para documentos formalizados, ''En revisión'' para documentos en validación, ''Pendiente de creación'' para documentos requeridos no existentes, ''Desactualizado'' para documentos que requieren actualización. Si faltan ubicación, dueño del documento o fecha de revisión, regístralo como brecha.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a99526-1593-11f1-8403-da1169052fe5', 6, 'Formación y Capacitación', 'Enfocado en capacitación técnica/funcional, planes, contenidos, audiencias y evaluación.', 'Analiza la reunión con enfoque de formación y capacitación. Al analizar, prioriza necesidades de formación, audiencias, contenidos, planes y evaluación. Extrae todos los temas tratados; usa etiquetas: ''Necesidad identificada'' para brechas de conocimiento detectadas, ''Capacitación planificada'' para formaciones agendadas, ''Completado'' para formaciones realizadas, ''Pendiente'' para acciones sin iniciar. Si faltan temario, modalidad, fecha o responsable de facilitar, regístralo como brecha.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a99634-1593-11f1-8403-da1169052fe5', 6, 'Gestión del Cambio Organizacional', 'Enfocado en adopción, comunicaciones, impacto en roles, resistencia y plan de transición.', 'Analiza la reunión con enfoque de gestión del cambio organizacional. Al analizar, prioriza impactos en roles, adopción, comunicaciones y resistencia. Extrae todos los temas tratados; usa etiquetas: ''Impacto en rol'' para cambios de responsabilidades, ''Resistencia identificada'' para barreras a la adopción, ''Comunicación'' para mensajes clave acordados, ''Acción de adopción'' para iniciativas de gestión del cambio, ''Pendiente'' para acciones sin iniciar. Si faltan audiencias, métricas de adopción o plan de transición, regístralo como brecha.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a997f3-1593-11f1-8403-da1169052fe5', 16, 'Seguridad y Salud Ocupacional (SSO/HSE)', 'Enfocado en seguridad de las personas: riesgos laborales, controles, permisos de trabajo, EPP, incidentes/accidentes, investigación y acciones correctivas.', 'Analiza la reunión con enfoque de Seguridad y Salud Ocupacional (SSO/HSE). Al analizar, prioriza riesgos para personas, condiciones inseguras, controles, EPP, permisos de trabajo e incidentes. Extrae todos los temas tratados; usa etiquetas: ''Incidente/Accidente'' para eventos de seguridad reportados, ''Condición insegura'' para situaciones de riesgo identificadas, ''Control implementado'' para barreras aplicadas, ''Pendiente'' para acciones correctivas sin iniciar, ''Brecha de control'' para controles faltantes. Si faltan lugar, tarea ejecutada, tipo de riesgo o evidencia, regístralo como brecha sin inventar.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a99948-1593-11f1-8403-da1169052fe5', 17, 'Seguridad Operacional (Operaciones/Proceso)', 'Enfocado en seguridad operacional y continuidad de la operación: controles de operación, maniobras, procedimientos, autorizaciones, riesgos de proceso, fallas operativas y medidas de mitigación.', 'Analiza la reunión con enfoque de seguridad operacional y continuidad de la operación. Al analizar, prioriza riesgos operativos de maniobras, procedimientos críticos, autorizaciones y coordinación entre áreas. Extrae todos los temas tratados; usa etiquetas: ''Riesgo operacional'' para situaciones que pueden causar daño o detención del proceso, ''Control acordado'' para medidas de mitigación formalizadas, ''Autorización requerida'' para acciones que necesitan aprobación, ''Pendiente'' para acciones sin iniciar. Si faltan parámetros operativos, responsables de autorización o criterios de validación, regístralo como brecha.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a99b49-1593-11f1-8403-da1169052fe5', 18, 'Seguridad Física y de Personal', 'Enfocado en seguridad física: accesos, control de visitantes, guardias, CCTV, incidentes físicos, amenazas, protocolos y coordinación con instalaciones.', 'Analiza la reunión con enfoque de seguridad física y de personal. Al analizar, prioriza control de acceso, credenciales, CCTV, incidentes físicos y protocolos de emergencia. Extrae todos los temas tratados; usa etiquetas: ''Incidente físico'' para eventos de seguridad reportados, ''Control de acceso'' para cambios en credenciales o perímetros, ''Pendiente'' para acciones de seguimiento, ''Riesgo físico'' para amenazas identificadas. Documenta lugar, horario y personas involucradas cuando se mencionen. Si falta evidencia (registros, cámaras, reportes), regístralo como brecha.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a99c89-1593-11f1-8403-da1169052fe5', 4, 'Decisiones y Gobernanza (Decision Log / RACI)', 'Enfocado en formalizar decisiones: qué se decidió, alternativas, criterio, responsables (RACI), aprobaciones, escalaciones y pendientes de definición.', 'Analiza la reunión con enfoque de registro de decisiones y gobernanza (Decision Log / RACI). Al analizar, prioriza decisiones explícitas, alternativas evaluadas, criterios de decisión y aprobaciones requeridas. Extrae todos los temas tratados; para cada decisión registra: qué se decidió, contexto, alternativas consideradas si se mencionan, criterio de elección, responsable y aprobación requerida. Usa etiquetas: ''Decisión tomada'', ''Pendiente de aprobación'', ''Escalada'' para decisiones que requieren nivel superior. Si falta RACI, criterio o impacto, regístralo como brecha sin inventar responsables.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a99e4c-1593-11f1-8403-da1169052fe5', 11, 'Plan de Acción y Seguimiento (Action Tracking)', 'Enfocado en control de ejecución: acciones, dueños, fechas, dependencias, estado, criterios de cierre y próximos hitos de seguimiento.', 'Analiza la reunión con enfoque de plan de acción y seguimiento (Action Tracking). Al analizar, extrae TODOS los puntos de acción identificados en la reunión sin excepción. Para cada acción registra: descripción (verbo + objeto), responsable, fecha comprometida si se menciona, dependencias o prerequisitos si existen, y criterio de cierre si se define. Usa etiquetas: ''Acción nueva'' para compromisos nuevos, ''En seguimiento'' para acciones de reuniones anteriores, ''Completado'' para acciones cerradas. Si falta responsable, fecha o criterio de cierre, regístralo como brecha con la pregunta mínima para completarla.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a99fa5-1593-11f1-8403-da1169052fe5', 11, 'Postmortem y Lecciones Aprendidas (RCA)', 'Enfocado en análisis de causa raíz y mejora continua: qué falló, por qué, impacto, factores contribuyentes, acciones preventivas y controles actualizados.', 'Analiza la reunión con enfoque de postmortem y lecciones aprendidas (RCA). Al analizar, prioriza eventos problemáticos, análisis de causa raíz y acciones correctivas. Extrae todos los temas tratados; para cada evento analizado registra: qué ocurrió, cuándo y cómo se detectó si se menciona, impacto (personas/operación/servicio), causa raíz solo si se menciona explícitamente, acciones correctivas y preventivas acordadas con responsable y plazo. Usa etiquetas: ''Causa raíz'' solo con evidencia explícita, ''Factor contribuyente'' para causas secundarias, ''Acción correctiva'', ''Acción preventiva''. Si falta evidencia o causa raíz, decláralo como brecha sin asumir causas.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70a9a19c-1593-11f1-8403-da1169052fe5', 16, 'Permisos de Trabajo y Controles Críticos (HSE/PTW)', 'Enfocado en control HSE: permisos de trabajo, análisis de riesgos (AST/JSA), controles críticos, barreras, EPP, autorizaciones y evidencias requeridas.', 'Analiza la minuta con enfoque HSE centrado en permisos de trabajo y controles críticos. Delimita el alcance a: actividades de riesgo, PTW (permiso de trabajo), AST/JSA, controles críticos/barreras (preventivas y mitigadoras), EPP, señalización/aislamiento (LOTO si se menciona), supervisión, charlas de seguridad, autorizaciones y coordinaciones con seguridad/facilities. Extrae: actividad, ubicación, riesgos identificados, controles acordados, responsables de autorización/ejecución/supervisión, ventana/condiciones de trabajo, evidencias requeridas (permiso firmado, checklist, registros, fotografías, mediciones), y validaciones previas/durante/post. Si falta el permiso, el análisis de riesgo, la autorización, la identificación de controles o la evidencia, regístralo como brecha y formula preguntas concretas. No inventes condiciones ni controles no mencionados.', 1, '2026-03-01 17:24:01.000', NULL, NULL, NULL, NULL, NULL),
('70aa9c64-1593-11f1-8403-da1169052fe5', 11, 'Reunión de Seguimiento Semanal (Weekly Status)', 'Enfocado en reuniones recurrentes de seguimiento semanal: estado de avances vs plan, bloqueos, riesgos, próximos pasos y compromisos de la semana.', 'Analiza la reunión como sesión de seguimiento semanal de servicio de TI. Extrae TODOS los temas tratados sin omitir ninguno. Para cada tema, clasifica los detalles usando las etiquetas: ''Hecho'' para avances completados, ''En curso'' para trabajo en progreso, ''Pendiente'' para tareas sin iniciar, ''Bloqueo'' para impedimentos que frenan avance, ''Riesgo'' para situaciones de riesgo operacional, ''Decisión'' para decisiones tomadas. Registra TODOS los puntos de acción como acuerdos con su responsable cuando esté mencionado. No filtres temas por considerarlos poco relevantes; en reuniones de seguimiento técnico todos los puntos tienen valor operacional.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70aa9e74-1593-11f1-8403-da1169052fe5', 7, 'Seguimiento de Proyecto (Ejecución y Control)', 'Enfocado en control de ejecución del proyecto: hitos, cronograma, alcance, cambios, issues, decisiones y gobernanza de seguimiento.', 'Analiza la reunión como sesión de seguimiento y control de ejecución de proyecto. Extrae TODOS los temas tratados. Para cada tema, clasifica los detalles usando: ''Avance'' para progreso confirmado, ''En curso'' para trabajo en ejecución, ''Pendiente'' para tareas sin iniciar, ''Bloqueo'' para impedimentos que afectan el cronograma, ''Riesgo'' para situaciones que pueden afectar el proyecto, ''Decisión'' para decisiones tomadas, ''Cambio'' para variaciones de alcance o cronograma. Registra todos los puntos de acción con responsable y fecha cuando se mencionen. Si no hay fecha o responsable, registrarlo como brecha. No omitas temas aunque sean operativos o administrativos.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL),
('70aaa035-1593-11f1-8403-da1169052fe5', 11, 'Seguimiento de Servicios (Service Review Semanal)', 'Enfocado en reuniones semanales con cliente para revisar estado del servicio: cumplimiento de SLA, tickets, incidentes, cambios, capacidad y mejoras.', 'Analiza la reunión como revisión semanal del estado del servicio con cliente. Extrae TODOS los temas tratados. Para cada tema, clasifica usando: ''Estado OK'' para servicios funcionando correctamente, ''Incidencia'' para problemas reportados o en curso, ''Pendiente'' para acciones sin iniciar, ''Bloqueo'' para impedimentos que afectan el servicio, ''Cambio'' para cambios ejecutados o planificados, ''Riesgo'' para situaciones que pueden afectar el SLA, ''Compromiso'' para acciones acordadas con el cliente. Registra tickets si se mencionan IDs; si faltan, documentarlo como brecha. No filtres temas por no estar directamente relacionados con el SLA.', 1, '2026-03-01 17:24:01.000', NULL, '2026-03-02 02:31:01.000', NULL, NULL, NULL);