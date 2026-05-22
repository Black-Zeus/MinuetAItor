/* 20260521_2235_alter_clients_projects_pdf_templates.sql */

-- ----------------------------------------------------------------------------
-- Template PDF por defecto en cliente y override opcional en proyecto
-- ----------------------------------------------------------------------------
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS default_pdf_template VARCHAR(40) NULL
    AFTER avatar_object_id;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS pdf_template_override VARCHAR(40) NULL
    AFTER avatar_object_id;
