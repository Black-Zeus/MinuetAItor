/* 50_seeds_minimal.sql
   ============================================================================
   Propósito  : Datos transaccionales MÍNIMOS para operar
                - Usuario administrador (con hash y UUID proporcionados)
                - Clientes de ejemplo
                - Proyectos asociados a esos clientes
                - Asignaciones usuario-proyecto
   Contexto   : Datos necesarios para que la aplicación tenga usuarios,
                clientes y proyectos con los cuales operar en desarrollo.
   Motor      : MySQL / MariaDB (InnoDB, utf8mb4)
   Dependencias: Requiere 40_seeds_minimal.sql ejecutado previamente
   ============================================================================
   Nota: 
     - UUID Admin: c168b91d-e16f-468c-afd1-547efd2c486b
     - Hash: $2b$12$mLiqAf2M.LBJ2Zl/GQ4H/OdpIHQXCc3R6XSgZTNxvMcKoVoZIuzi.
     - Password correspondiente: (definido en documentación interna)
*/

-- ============================================================
-- USUARIO ADMINISTRADOR (1)
-- ============================================================

INSERT IGNORE INTO users (
  id, username, email, password_hash, full_name, job_title,
  description, phone, area, is_active, last_login_at, 
  created_at, updated_at
) VALUES
(
  'c168b91d-e16f-468c-afd1-547efd2c486b',
  'admin',
  'admin@minuetaitor.local',
  '$2b$12$mLiqAf2M.LBJ2Zl/GQ4H/OdpIHQXCc3R6XSgZTNxvMcKoVoZIuzi.',
  'Administrador del Sistema',
  'Administrador Inicial',
  'Cuenta maestra para la configuración inicial y administración general de la plataforma. Creada durante el bootstrap del sistema, tiene privilegios completos sobre todas las funcionalidades. Se recomienda cambiar la contraseña en el primer ingreso y usarla solo para tareas administrativas.',
  '+56 9 1234 5678',
  'IT',
  1,
  null,
  NOW(),
  NOW()
);

-- Asignar rol ADMIN al usuario
INSERT IGNORE INTO user_roles (user_id, role_id, created_at, created_by)
SELECT 
  'c168b91d-e16f-468c-afd1-547efd2c486b',
  id,
  NOW(),
  'c168b91d-e16f-468c-afd1-547efd2c486b'
FROM roles 
WHERE code = 'ADMIN';

-- Crear perfil base del usuario
INSERT IGNORE INTO user_profiles (user_id, initials, color, position)
VALUES (
  'c168b91d-e16f-468c-afd1-547efd2c486b',
  'AD',
  '#6366f1',
  'Administrador'
);

-- ============================================================
-- CLIENTES DE PRUEBA (3)
-- ============================================================

INSERT IGNORE INTO clients (
  id, name, legal_name, industry, email, phone,
  contact_name, contact_email, contact_position,
  status, priority, is_confidential, is_active,
  created_at, created_by, updated_at, updated_by
) VALUES
(
  'c1000000-0000-4000-a000-000000000001',
  'Clínica Santa Aurora',
  'Clínica Santa Aurora S.A.',
  'Salud',
  'contacto@santaaurora.cl',
  '+56 2 2345 6789',
  'Dr. Felipe Contreras',
  'fcontreras@santaaurora.cl',
  'Gerente de TI',
  'activo', 'alta', 0, 1,
  NOW(), 'c168b91d-e16f-468c-afd1-547efd2c486b',
  NOW(), 'c168b91d-e16f-468c-afd1-547efd2c486b'
),
(
  'c1000000-0000-4000-a000-000000000002',
  'Constructora Del Valle',
  'Constructora Del Valle Ltda.',
  'Construcción',
  'info@delvalle.cl',
  '+56 2 2987 6543',
  'Ing. Rosa Valenzuela',
  'rvalenzuela@delvalle.cl',
  'Jefa de Proyectos',
  'activo', 'media', 0, 1,
  NOW(), 'c168b91d-e16f-468c-afd1-547efd2c486b',
  NOW(), 'c168b91d-e16f-468c-afd1-547efd2c486b'
),
(
  'c1000000-0000-4000-a000-000000000003',
  'Retail Pacífico',
  'Retail Pacífico SpA',
  'Comercio',
  'operaciones@retailpacifico.cl',
  '+56 9 8765 4321',
  'Andrea Matus',
  'amatus@retailpacifico.cl',
  'Directora de Operaciones',
  'activo', 'media', 0, 1,
  NOW(), 'c168b91d-e16f-468c-afd1-547efd2c486b',
  NOW(), 'c168b91d-e16f-468c-afd1-547efd2c486b'
);

-- ============================================================
-- PROYECTOS DE PRUEBA (5)
-- ============================================================

INSERT IGNORE INTO projects (
  id, client_id, name, code, description, status, is_confidential, is_active,
  created_at, created_by, updated_at, updated_by
) VALUES
-- Clínica Santa Aurora → 2 proyectos
(
  'p1000000-0000-4000-a000-000000000001',
  'c1000000-0000-4000-a000-000000000001',
  'Implementación HIS',
  'CSA-HIS-2026',
  'Implementación del sistema de información hospitalaria (HIS). Módulos: admisiones, urgencias y pabellón.',
  'activo', 0, 1,
  NOW(), 'c168b91d-e16f-468c-afd1-547efd2c486b',
  NOW(), 'c168b91d-e16f-468c-afd1-547efd2c486b'
),
(
  'p1000000-0000-4000-a000-000000000002',
  'c1000000-0000-4000-a000-000000000001',
  'Ciberseguridad y Cumplimiento',
  'CSA-SEC-2026',
  'Auditoría de seguridad y plan de remediación para cumplimiento normativa MINSAL.',
  'activo', 1, 1,
  NOW(), 'c168b91d-e16f-468c-afd1-547efd2c486b',
  NOW(), 'c168b91d-e16f-468c-afd1-547efd2c486b'
),
-- Constructora Del Valle → 2 proyectos
(
  'p1000000-0000-4000-a000-000000000003',
  'c1000000-0000-4000-a000-000000000002',
  'Digitalización de Obra',
  'CDV-DIG-2026',
  'Plataforma móvil para control de avance de obra, reportes y firma digital de documentos en terreno.',
  'activo', 0, 1,
  NOW(), 'c168b91d-e16f-468c-afd1-547efd2c486b',
  NOW(), 'c168b91d-e16f-468c-afd1-547efd2c486b'
),
(
  'p1000000-0000-4000-a000-000000000004',
  'c1000000-0000-4000-a000-000000000002',
  'ERP Integración SAP',
  'CDV-ERP-2025',
  'Migración e integración del ERP corporativo con módulo de proveedores y facturación electrónica.',
  'en_pausa', 0, 1,
  NOW(), 'c168b91d-e16f-468c-afd1-547efd2c486b',
  NOW(), 'c168b91d-e16f-468c-afd1-547efd2c486b'
),
-- Retail Pacífico → 1 proyecto
(
  'p1000000-0000-4000-a000-000000000005',
  'c1000000-0000-4000-a000-000000000003',
  'Omnicanalidad 360',
  'RPC-OMN-2026',
  'Integración de canales online y tiendas físicas: inventario unificado, click & collect y CRM.',
  'activo', 0, 1,
  NOW(), 'c168b91d-e16f-468c-afd1-547efd2c486b',
  NOW(), 'c168b91d-e16f-468c-afd1-547efd2c486b'
);

-- ============================================================
-- Participantes y correos de prueba (5)
-- ============================================================

INSERT INTO participants (
  id, display_name, normalized_name, organization, title, notes, is_active
) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Juan Pérez', 'juan perez', 'Acme Chile', 'Consultor', NULL, 1),
  ('22222222-2222-2222-2222-222222222222', 'María González', 'maria gonzalez', 'NovaCorp', 'Jefa de Proyecto', NULL, 1),
  ('33333333-3333-3333-3333-333333333333', 'Carlos Rodríguez', 'carlos rodriguez', 'Innova TI', 'Arquitecto de Soluciones', NULL, 1),
  ('44444444-4444-4444-4444-444444444444', 'Juan Pérez', 'juan perez', 'Global Data', 'Gerente Comercial', NULL, 1),
  ('55555555-5555-5555-5555-555555555555', 'María González', 'maria gonzalez', 'Servicios Andinos', 'Analista Funcional', NULL, 1);

INSERT INTO participant_emails (
  participant_id, email, is_primary, is_active
) VALUES
  ('11111111-1111-1111-1111-111111111111', 'juan.perez@acme.cl', 1, 1),
  ('11111111-1111-1111-1111-111111111111', 'jperez.consultor@gmail.com', 0, 1),
  ('11111111-1111-1111-1111-111111111111', 'juan.perez@partner-acme.com', 0, 1),

  ('22222222-2222-2222-2222-222222222222', 'maria.gonzalez@novacorp.com', 1, 1),
  ('22222222-2222-2222-2222-222222222222', 'm.gonzalez.pm@outlook.com', 0, 1),
  ('22222222-2222-2222-2222-222222222222', 'maria.g@cliente-nova.net', 0, 1),

  ('33333333-3333-3333-3333-333333333333', 'carlos.rodriguez@innovati.com', 1, 1),
  ('33333333-3333-3333-3333-333333333333', 'crodriguez.tech@gmail.com', 0, 1),
  ('33333333-3333-3333-3333-333333333333', 'carlos.r@arquitectura-cloud.io', 0, 1),

  ('44444444-4444-4444-4444-444444444444', 'juan.perez@globaldata.com', 1, 1),
  ('44444444-4444-4444-4444-444444444444', 'jperez.sales@consulting.biz', 0, 1),

  ('55555555-5555-5555-5555-555555555555', 'maria.gonzalez@serviciosandinos.cl', 1, 1),
  ('55555555-5555-5555-5555-555555555555', 'maria.g.functional@proton.me', 0, 1);
