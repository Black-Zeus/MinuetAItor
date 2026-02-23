/* 10_schema_tables_core.sql */

-- ----------------------------------------------------------------------------
-- 1) Users (base) - primero para permitir FKs posteriores
-- ----------------------------------------------------------------------------
CREATE TABLE users (
  id              CHAR(36) PRIMARY KEY,
  username        VARCHAR(80) NOT NULL,
  email           VARCHAR(200) NULL,
  password_hash   VARCHAR(255) NOT NULL,
  full_name       VARCHAR(200) NULL,
  description     VARCHAR(500) NULL,
  job_title       VARCHAR(250) NULL,

  phone           VARCHAR(20) NULL,
  area            VARCHAR(80) NULL,

  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at   DATETIME NULL,

  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by      CHAR(36) NULL,
  updated_at      DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  updated_by      CHAR(36) NULL,

  deleted_at      DATETIME NULL,
  deleted_by      CHAR(36) NULL,

  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_active (is_active),
  KEY idx_users_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Auto-referencias (audit actors)
ALTER TABLE users
  ADD CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  ADD CONSTRAINT fk_users_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  ADD CONSTRAINT fk_users_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id);

-- ----------------------------------------------------------------------------
-- 2) RBAC: roles / permissions / bridges
-- ----------------------------------------------------------------------------
CREATE TABLE roles (
  id            SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  code          VARCHAR(50) NOT NULL,
  name          VARCHAR(120) NOT NULL,
  description   VARCHAR(255) NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,

  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    CHAR(36) NULL,
  updated_at    DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  updated_by    CHAR(36) NULL,

  deleted_at    DATETIME NULL,
  deleted_by    CHAR(36) NULL,

  UNIQUE KEY uq_roles_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE permissions (
  id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  code          VARCHAR(100) NOT NULL,
  name          VARCHAR(150) NOT NULL,
  description   VARCHAR(255) NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,

  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    CHAR(36) NULL,
  updated_at    DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  updated_by    CHAR(36) NULL,

  deleted_at    DATETIME NULL,
  deleted_by    CHAR(36) NULL,

  UNIQUE KEY uq_permissions_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE role_permissions (
  role_id       SMALLINT UNSIGNED NOT NULL,
  permission_id INT UNSIGNED NOT NULL,

  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    CHAR(36) NULL,

  deleted_at    DATETIME NULL,
  deleted_by    CHAR(36) NULL,

  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id),
  CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES permissions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_roles (
  user_id       CHAR(36) NOT NULL,
  role_id       SMALLINT UNSIGNED NOT NULL,

  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    CHAR(36) NULL,

  deleted_at    DATETIME NULL,
  deleted_by    CHAR(36) NULL,

  PRIMARY KEY (user_id, role_id),
  CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES roles(id),
  CONSTRAINT fk_ur_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_ur_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Auditoría de roles/perms con users
ALTER TABLE roles
  ADD CONSTRAINT fk_roles_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  ADD CONSTRAINT fk_roles_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  ADD CONSTRAINT fk_roles_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id);

ALTER TABLE permissions
  ADD CONSTRAINT fk_perms_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  ADD CONSTRAINT fk_perms_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  ADD CONSTRAINT fk_perms_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id);

ALTER TABLE role_permissions
  ADD CONSTRAINT fk_rp_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  ADD CONSTRAINT fk_rp_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id);

-- ----------------------------------------------------------------------------
-- 3) Clients + relación user_clients (feature flag backend)
-- ----------------------------------------------------------------------------
CREATE TABLE clients (
  id                  CHAR(36)        NOT NULL,

  name                VARCHAR(200)    NOT NULL,
  legal_name          VARCHAR(200)    NULL,
  description         VARCHAR(600)    NULL,
  industry            VARCHAR(120)    NULL,
  email               VARCHAR(254)    NULL,
  phone               VARCHAR(30)     NULL,
  website             VARCHAR(500)    NULL,
  address             VARCHAR(400)    NULL,
  
  contact_name        VARCHAR(200)    NULL,
  contact_email       VARCHAR(254)    NULL,
  contact_phone       VARCHAR(30)     NULL,
  contact_position    VARCHAR(120)    NULL,
  contact_department  VARCHAR(120)    NULL,
  
  status              VARCHAR(20)     NULL        DEFAULT 'activo',
  priority            VARCHAR(20)     NULL        DEFAULT 'media',
  
  notes               TEXT            NULL,
  tags                VARCHAR(500)    NULL,
  
  is_confidential     TINYINT(1)      NOT NULL    DEFAULT 0,
  is_active           TINYINT(1)      NOT NULL    DEFAULT 1,
  
  created_at          DATETIME        NOT NULL    DEFAULT CURRENT_TIMESTAMP,
  created_by          CHAR(36)        NULL,
  updated_at          DATETIME        NULL        ON UPDATE CURRENT_TIMESTAMP,
  updated_by          CHAR(36)        NULL,
  deleted_at          DATETIME        NULL,
  deleted_by          CHAR(36)        NULL,
  
  PRIMARY KEY (id),
  
  UNIQUE KEY uq_clients_name (name),
  
  KEY idx_clients_status          (status),
  KEY idx_clients_priority        (priority),
  KEY idx_clients_confidential    (is_confidential),
  KEY idx_clients_active          (is_active),
  KEY idx_clients_deleted_at      (deleted_at),
  
  CONSTRAINT fk_clients_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_clients_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_clients_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3.1) Projects (1..N por client)
-- ----------------------------------------------------------------------------
CREATE TABLE projects (
  id              CHAR(36) PRIMARY KEY,
  client_id       CHAR(36) NOT NULL,

  name            VARCHAR(220) NOT NULL,
  code            VARCHAR(50) NULL,
  description     VARCHAR(900) NULL,
  status          VARCHAR(40) NOT NULL DEFAULT 'activo',
  is_confidential TINYINT(1) NOT NULL DEFAULT 0,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,

  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by      CHAR(36) NULL,
  updated_at      DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  updated_by      CHAR(36) NULL,

  deleted_at      DATETIME NULL,
  deleted_by      CHAR(36) NULL,

  CONSTRAINT fk_projects_client     FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT fk_projects_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_projects_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_projects_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id),

  UNIQUE KEY uq_projects_client_name (client_id, name),
  UNIQUE KEY uq_projects_code (code),
  KEY idx_projects_client (client_id),
  KEY idx_projects_status (status),
  KEY idx_projects_confidential (is_confidential),
  KEY idx_projects_active (is_active),
  KEY idx_projects_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_clients (
  user_id       CHAR(36) NOT NULL,
  client_id     CHAR(36) NOT NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,

  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    CHAR(36) NULL,
  updated_at    DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  updated_by    CHAR(36) NULL,

  deleted_at    DATETIME NULL,
  deleted_by    CHAR(36) NULL,

  PRIMARY KEY (user_id, client_id),

  CONSTRAINT fk_uc_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_uc_client FOREIGN KEY (client_id) REFERENCES clients(id),

  CONSTRAINT fk_uc_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_uc_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_uc_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id),

  KEY idx_uc_active (is_active),
  KEY idx_uc_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 3.2) ACL fina (equivalente a dataTeams.json: assignmentMode + permisos por cliente/proyecto)
--      Nota: esto NO reemplaza RBAC; es un overlay por dominio (cliente/proyecto).
-- ----------------------------------------------------------------------------
CREATE TABLE user_client_acl (
  user_id     CHAR(36) NOT NULL,
  client_id   CHAR(36) NOT NULL,
  permission  ENUM('read','edit','owner') NOT NULL DEFAULT 'read',
  is_active   TINYINT(1) NOT NULL DEFAULT 1,

  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by  CHAR(36) NULL,
  updated_at  DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  updated_by  CHAR(36) NULL,
  deleted_at  DATETIME NULL,
  deleted_by  CHAR(36) NULL,

  PRIMARY KEY (user_id, client_id),
  CONSTRAINT fk_uca_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_uca_client FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT fk_uca_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_uca_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_uca_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id),
  KEY idx_uca_permission (permission),
  KEY idx_uca_active (is_active),
  KEY idx_uca_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_project_acl (
  user_id     CHAR(36) NOT NULL,
  project_id  CHAR(36) NOT NULL,
  permission  ENUM('read','edit','owner') NOT NULL DEFAULT 'read',
  is_active   TINYINT(1) NOT NULL DEFAULT 1,

  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by  CHAR(36) NULL,
  updated_at  DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  updated_by  CHAR(36) NULL,
  deleted_at  DATETIME NULL,
  deleted_by  CHAR(36) NULL,

  PRIMARY KEY (user_id, project_id),
  CONSTRAINT fk_upa_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_upa_project FOREIGN KEY (project_id) REFERENCES projects(id),
  CONSTRAINT fk_upa_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_upa_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_upa_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id),
  KEY idx_upa_permission (permission),
  KEY idx_upa_active (is_active),
  KEY idx_upa_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 3.3) Dashboard (equivalente dataUserProfile.json / dataDashBoard.json)
-- ----------------------------------------------------------------------------
CREATE TABLE dashboard_widgets (
  id           SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  code         VARCHAR(80) NOT NULL,
  name         VARCHAR(160) NOT NULL,
  description  VARCHAR(400) NULL,
  is_active    TINYINT(1) NOT NULL DEFAULT 1,

  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by   CHAR(36) NULL,
  updated_at   DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  updated_by   CHAR(36) NULL,
  deleted_at   DATETIME NULL,
  deleted_by   CHAR(36) NULL,

  UNIQUE KEY uq_dw_code (code),
  KEY idx_dw_active (is_active),
  KEY idx_dw_deleted_at (deleted_at),
  CONSTRAINT fk_dw_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_dw_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_dw_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_dashboard_widgets (
  user_id     CHAR(36) NOT NULL,
  widget_id   SMALLINT UNSIGNED NOT NULL,
  enabled     TINYINT(1) NOT NULL DEFAULT 1,
  sort_order  SMALLINT UNSIGNED NULL,

  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by  CHAR(36) NULL,
  updated_at  DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  updated_by  CHAR(36) NULL,
  deleted_at  DATETIME NULL,
  deleted_by  CHAR(36) NULL,

  PRIMARY KEY (user_id, widget_id),
  CONSTRAINT fk_udw_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_udw_widget FOREIGN KEY (widget_id) REFERENCES dashboard_widgets(id),
  CONSTRAINT fk_udw_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_udw_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_udw_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id),
  KEY idx_udw_enabled (enabled),
  KEY idx_udw_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Perfil extendido del usuario (UI/branding y metadatos no críticos)
CREATE TABLE user_profiles (
  user_id        CHAR(36) PRIMARY KEY,
  initials       VARCHAR(10) NULL,
  color          VARCHAR(20) NULL,
  position       VARCHAR(120) NULL,
  department     VARCHAR(80) NULL,
  notes          VARCHAR(600) NULL,
  last_activity  DATE NULL,
  assignment_mode VARCHAR(50) DEFAULT 'specific',
  CONSTRAINT fk_up_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 3.4) IA: Catálogo de perfiles de análisis (analysisProfilesCatalog.json)
-- ----------------------------------------------------------------------------
CREATE TABLE ai_profile_categories (
  id          SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(120) NOT NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_ai_pc_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ai_profiles (
  id              CHAR(36) PRIMARY KEY,
  category_id     SMALLINT UNSIGNED NOT NULL,
  name            VARCHAR(180) NOT NULL,
  description     VARCHAR(900) NULL,
  prompt          MEDIUMTEXT NOT NULL,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,

  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by      CHAR(36) NULL,
  updated_at      DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  updated_by      CHAR(36) NULL,
  deleted_at      DATETIME NULL,
  deleted_by      CHAR(36) NULL,

  CONSTRAINT fk_ai_p_cat FOREIGN KEY (category_id) REFERENCES ai_profile_categories(id),
  CONSTRAINT fk_ai_p_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_ai_p_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_ai_p_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id),

  UNIQUE KEY uq_ai_profiles_name (name),
  KEY idx_ai_profiles_cat (category_id),
  KEY idx_ai_profiles_active (is_active),
  KEY idx_ai_profiles_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 3.5) Tags (dataTags.json) + Tags IA (minuteIAResponse.json)
-- ----------------------------------------------------------------------------
CREATE TABLE tag_categories (
  id          SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(120) NOT NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_tag_cat_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tags (
  id            CHAR(36) PRIMARY KEY,
  category_id   SMALLINT UNSIGNED NOT NULL,
  name          VARCHAR(140) NOT NULL,
  description   VARCHAR(900) NULL,
  source        ENUM('user','ai') NOT NULL DEFAULT 'user',
  status        VARCHAR(30) NOT NULL DEFAULT 'activo',
  is_active     TINYINT(1) NOT NULL DEFAULT 1,

  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    CHAR(36) NULL,
  updated_at    DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  updated_by    CHAR(36) NULL,
  deleted_at    DATETIME NULL,
  deleted_by    CHAR(36) NULL,

  CONSTRAINT fk_tags_cat FOREIGN KEY (category_id) REFERENCES tag_categories(id),
  CONSTRAINT fk_tags_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_tags_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_tags_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id),

  UNIQUE KEY uq_tags_cat_name (category_id, name),
  KEY idx_tags_source (source),
  KEY idx_tags_status (status),
  KEY idx_tags_active (is_active),
  KEY idx_tags_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tags IA por "slug" (name normalizado) para evitar duplicar por versión
CREATE TABLE ai_tags (
  id            CHAR(36) PRIMARY KEY,
  slug          VARCHAR(180) NOT NULL,
  description   VARCHAR(900) NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_ai_tags_slug (slug),
  KEY idx_ai_tags_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ai_tag_conversions (
  ai_tag_id     CHAR(36) NOT NULL,
  tag_id        CHAR(36) NOT NULL,
  converted_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  converted_by  CHAR(36) NULL,

  PRIMARY KEY (ai_tag_id, tag_id),
  CONSTRAINT fk_atc_ai_tag FOREIGN KEY (ai_tag_id) REFERENCES ai_tags(id),
  CONSTRAINT fk_atc_tag    FOREIGN KEY (tag_id) REFERENCES tags(id),
  CONSTRAINT fk_atc_by     FOREIGN KEY (converted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 4) Catálogos parametrizables (documentos/estados/artefactos/buckets)
-- ----------------------------------------------------------------------------
CREATE TABLE record_types (
  id            SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  code          VARCHAR(50) NOT NULL,
  name          VARCHAR(120) NOT NULL,
  description   VARCHAR(255) NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,

  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    CHAR(36) NULL,
  updated_at    DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  updated_by    CHAR(36) NULL,

  deleted_at    DATETIME NULL,
  deleted_by    CHAR(36) NULL,

  UNIQUE KEY uq_record_types_code (code),

  CONSTRAINT fk_rt_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_rt_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_rt_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE record_statuses (
  id            SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  code          VARCHAR(50) NOT NULL,
  name          VARCHAR(120) NOT NULL,
  description   VARCHAR(255) NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,

  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    CHAR(36) NULL,
  updated_at    DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  updated_by    CHAR(36) NULL,

  deleted_at    DATETIME NULL,
  deleted_by    CHAR(36) NULL,

  UNIQUE KEY uq_record_statuses_code (code),

  CONSTRAINT fk_rs_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_rs_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_rs_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE version_statuses (
  id            SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  code          VARCHAR(50) NOT NULL,
  name          VARCHAR(120) NOT NULL,
  description   VARCHAR(255) NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,

  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    CHAR(36) NULL,
  updated_at    DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  updated_by    CHAR(36) NULL,

  deleted_at    DATETIME NULL,
  deleted_by    CHAR(36) NULL,

  UNIQUE KEY uq_version_statuses_code (code),

  CONSTRAINT fk_vs_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_vs_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_vs_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE artifact_types (
  id            SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  code          VARCHAR(80) NOT NULL,
  name          VARCHAR(150) NOT NULL,
  description   VARCHAR(255) NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,

  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    CHAR(36) NULL,
  updated_at    DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  updated_by    CHAR(36) NULL,

  deleted_at    DATETIME NULL,
  deleted_by    CHAR(36) NULL,

  UNIQUE KEY uq_artifact_types_code (code),

  CONSTRAINT fk_at_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_at_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_at_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE artifact_states (
  id            SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  code          VARCHAR(50) NOT NULL,
  name          VARCHAR(120) NOT NULL,
  description   VARCHAR(255) NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,

  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    CHAR(36) NULL,
  updated_at    DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  updated_by    CHAR(36) NULL,

  deleted_at    DATETIME NULL,
  deleted_by    CHAR(36) NULL,

  UNIQUE KEY uq_artifact_states_code (code),

  CONSTRAINT fk_as_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_as_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_as_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE buckets (
  id            SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  code          VARCHAR(80) NOT NULL,
  name          VARCHAR(200) NOT NULL,
  description   VARCHAR(255) NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,

  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    CHAR(36) NULL,
  updated_at    DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  updated_by    CHAR(36) NULL,

  deleted_at    DATETIME NULL,
  deleted_by    CHAR(36) NULL,

  UNIQUE KEY uq_buckets_code (code),
  UNIQUE KEY uq_buckets_name (name),

  CONSTRAINT fk_bk_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_bk_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_bk_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE record_type_artifact_types (
  record_type_id         SMALLINT UNSIGNED NOT NULL,
  artifact_type_id       SMALLINT UNSIGNED NOT NULL,
  is_required_on_publish TINYINT(1) NOT NULL DEFAULT 0,
  max_count              INT UNSIGNED NOT NULL DEFAULT 1,
  is_active              TINYINT(1) NOT NULL DEFAULT 1,

  created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by             CHAR(36) NULL,
  updated_at             DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  updated_by             CHAR(36) NULL,

  deleted_at             DATETIME NULL,
  deleted_by             CHAR(36) NULL,

  PRIMARY KEY (record_type_id, artifact_type_id),

  CONSTRAINT fk_rtat_rt FOREIGN KEY (record_type_id) REFERENCES record_types(id),
  CONSTRAINT fk_rtat_at FOREIGN KEY (artifact_type_id) REFERENCES artifact_types(id),
  CONSTRAINT fk_rtat_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_rtat_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_rtat_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 5) Objects (MinIO pointers)
-- ----------------------------------------------------------------------------
CREATE TABLE objects (
  id            CHAR(36) PRIMARY KEY,
  bucket_id     SMALLINT UNSIGNED NOT NULL,
  object_key    VARCHAR(500) NOT NULL,          -- UUID.ext

  -- Snapshot/compatibilidad (se sincroniza con IDs mediante triggers)
  content_type  VARCHAR(120) NOT NULL,
  file_ext      VARCHAR(20) NOT NULL,

  size_bytes    BIGINT UNSIGNED NULL,
  etag          VARCHAR(128) NULL,
  sha256        CHAR(64) NULL,

  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    CHAR(36) NULL,

  deleted_at    DATETIME NULL,
  deleted_by    CHAR(36) NULL,

  CONSTRAINT fk_obj_bucket FOREIGN KEY (bucket_id) REFERENCES buckets(id),
  CONSTRAINT fk_obj_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_obj_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id),

  UNIQUE KEY uq_obj_bucket_key (bucket_id, object_key),
  KEY idx_obj_sha256 (sha256),
  KEY idx_obj_content_type (content_type),
  KEY idx_obj_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 6) Records + Draft + Versions + Commits
-- ----------------------------------------------------------------------------
CREATE TABLE records (
  id                  CHAR(36) PRIMARY KEY,
  client_id           CHAR(36) NOT NULL,
  project_id          CHAR(36) NULL,
  record_type_id      SMALLINT UNSIGNED NOT NULL,
  status_id           SMALLINT UNSIGNED NOT NULL,

  ai_profile_id       CHAR(36) NULL,

  title               VARCHAR(300) NOT NULL,
  document_date       DATE NULL,
  location            VARCHAR(220) NULL,
  scheduled_start_time TIME NULL,
  scheduled_end_time   TIME NULL,
  actual_start_time    TIME NULL,
  actual_end_time      TIME NULL,
  prepared_by_user_id CHAR(36) NOT NULL,

  intro_snippet       VARCHAR(800) NULL,

  active_version_id   CHAR(36) NULL,
  latest_version_num  INT UNSIGNED NOT NULL DEFAULT 0,

  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by          CHAR(36) NOT NULL,
  updated_at          DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  updated_by          CHAR(36) NULL,

  deleted_at          DATETIME NULL,
  deleted_by          CHAR(36) NULL,

  CONSTRAINT fk_rec_client FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT fk_rec_project FOREIGN KEY (project_id) REFERENCES projects(id),
  CONSTRAINT fk_rec_type FOREIGN KEY (record_type_id) REFERENCES record_types(id),
  CONSTRAINT fk_rec_status FOREIGN KEY (status_id) REFERENCES record_statuses(id),
  CONSTRAINT fk_rec_ai_profile FOREIGN KEY (ai_profile_id) REFERENCES ai_profiles(id),
  CONSTRAINT fk_rec_prepared_by FOREIGN KEY (prepared_by_user_id) REFERENCES users(id),
  CONSTRAINT fk_rec_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_rec_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_rec_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id),

  KEY idx_rec_client (client_id),
  KEY idx_rec_project (project_id),
  KEY idx_rec_type (record_type_id),
  KEY idx_rec_status (status_id),
  KEY idx_rec_docdate (document_date),
  KEY idx_rec_location (location),
  KEY idx_rec_ai_profile (ai_profile_id),
  KEY idx_rec_prepared_by (prepared_by_user_id),
  KEY idx_rec_latest_version_num (latest_version_num),
  KEY idx_rec_deleted_at (deleted_at),
  KEY idx_rec_title (title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE record_drafts (
  record_id      CHAR(36) PRIMARY KEY,

  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by     CHAR(36) NOT NULL,
  updated_at     DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  updated_by     CHAR(36) NULL,

  deleted_at     DATETIME NULL,
  deleted_by     CHAR(36) NULL,

  CONSTRAINT fk_draft_record FOREIGN KEY (record_id) REFERENCES records(id),
  CONSTRAINT fk_draft_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_draft_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_draft_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id),

  KEY idx_draft_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE record_versions (
  id               CHAR(36) PRIMARY KEY,
  record_id        CHAR(36) NOT NULL,
  version_num      INT UNSIGNED NOT NULL,
  status_id        SMALLINT UNSIGNED NOT NULL,

  published_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_by     CHAR(36) NOT NULL,

  schema_version   VARCHAR(40) NOT NULL,
  template_version VARCHAR(40) NOT NULL,

  -- Índices de búsqueda (NO reemplazan el JSON completo; el JSON vive en MinIO vía objects/record_artifacts)
  summary_text     MEDIUMTEXT NULL,
  decisions_text   MEDIUMTEXT NULL,
  agreements_text  MEDIUMTEXT NULL,
  risks_text       MEDIUMTEXT NULL,
  next_steps_text  MEDIUMTEXT NULL,

  ai_provider      VARCHAR(40) NULL,
  ai_model         VARCHAR(80) NULL,
  ai_run_id        VARCHAR(80) NULL,

  deleted_at       DATETIME NULL,
  deleted_by       CHAR(36) NULL,

  CONSTRAINT fk_ver_record FOREIGN KEY (record_id) REFERENCES records(id),
  CONSTRAINT fk_ver_status FOREIGN KEY (status_id) REFERENCES version_statuses(id),
  CONSTRAINT fk_ver_published_by FOREIGN KEY (published_by) REFERENCES users(id),
  CONSTRAINT fk_ver_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id),

  UNIQUE KEY uq_ver_record_num (record_id, version_num),
  KEY idx_ver_record (record_id),
  KEY idx_ver_published_at (published_at),
  KEY idx_ver_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Participantes SCOPED a la versión (evita la "people" global y mantiene 3FN por contexto)
CREATE TABLE record_version_participants (
  id               BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  record_version_id CHAR(36) NOT NULL,
  role             ENUM('required','optional','observer','unknown') NOT NULL DEFAULT 'unknown',
  display_name     VARCHAR(220) NOT NULL,
  organization     VARCHAR(220) NULL,
  title            VARCHAR(160) NULL,
  email            VARCHAR(200) NULL,

  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_rvp_ver FOREIGN KEY (record_version_id) REFERENCES record_versions(id),
  KEY idx_rvp_ver (record_version_id),
  KEY idx_rvp_name (display_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tags de usuario por versión (para búsquedas y analítica)
CREATE TABLE record_version_tags (
  record_version_id CHAR(36) NOT NULL,
  tag_id            CHAR(36) NOT NULL,
  added_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  added_by          CHAR(36) NULL,

  PRIMARY KEY (record_version_id, tag_id),
  CONSTRAINT fk_rvt_ver FOREIGN KEY (record_version_id) REFERENCES record_versions(id),
  CONSTRAINT fk_rvt_tag FOREIGN KEY (tag_id) REFERENCES tags(id),
  CONSTRAINT fk_rvt_by  FOREIGN KEY (added_by) REFERENCES users(id),

  KEY idx_rvt_tag (tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tags IA detectados por versión (para UI y potencial conversión)
CREATE TABLE record_version_ai_tags (
  record_version_id CHAR(36) NOT NULL,
  ai_tag_id         CHAR(36) NOT NULL,
  detected_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (record_version_id, ai_tag_id),
  CONSTRAINT fk_rvat_ver FOREIGN KEY (record_version_id) REFERENCES record_versions(id),
  CONSTRAINT fk_rvat_ai_tag FOREIGN KEY (ai_tag_id) REFERENCES ai_tags(id),
  KEY idx_rvat_ai_tag (ai_tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE record_version_commits (
  id                BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  record_version_id CHAR(36) NOT NULL,
  parent_version_id CHAR(36) NULL,

  commit_title      VARCHAR(160) NOT NULL,
  commit_body       TEXT NULL,

  actor_user_id     CHAR(36) NOT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  deleted_at        DATETIME NULL,
  deleted_by        CHAR(36) NULL,

  CONSTRAINT fk_rvc_ver FOREIGN KEY (record_version_id) REFERENCES record_versions(id),
  CONSTRAINT fk_rvc_parent FOREIGN KEY (parent_version_id) REFERENCES record_versions(id),
  CONSTRAINT fk_rvc_actor FOREIGN KEY (actor_user_id) REFERENCES users(id),
  CONSTRAINT fk_rvc_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id),

  UNIQUE KEY uq_rvc_one_per_version (record_version_id),
  KEY idx_rvc_parent (parent_version_id),
  KEY idx_rvc_actor (actor_user_id),
  KEY idx_rvc_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Link tardío active_version_id -> record_versions
ALTER TABLE records
  ADD CONSTRAINT fk_rec_active_version FOREIGN KEY (active_version_id) REFERENCES record_versions(id);

-- ----------------------------------------------------------------------------
-- 7) Record artifacts (link semántico record/version/draft -> object)
-- ----------------------------------------------------------------------------
CREATE TABLE record_artifacts (
  id                 BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,

  record_id           CHAR(36) NOT NULL,
  record_version_id   CHAR(36) NULL,
  is_draft            TINYINT(1) NOT NULL DEFAULT 0,

  artifact_type_id    SMALLINT UNSIGNED NOT NULL,
  artifact_state_id   SMALLINT UNSIGNED NOT NULL,

  object_id           CHAR(36) NOT NULL,
  natural_name        VARCHAR(300) NULL,

  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by          CHAR(36) NOT NULL,

  deleted_at          DATETIME NULL,
  deleted_by          CHAR(36) NULL,

  CONSTRAINT fk_ra_record FOREIGN KEY (record_id) REFERENCES records(id),
  CONSTRAINT fk_ra_version FOREIGN KEY (record_version_id) REFERENCES record_versions(id),
  CONSTRAINT fk_ra_type FOREIGN KEY (artifact_type_id) REFERENCES artifact_types(id),
  CONSTRAINT fk_ra_state FOREIGN KEY (artifact_state_id) REFERENCES artifact_states(id),
  CONSTRAINT fk_ra_object FOREIGN KEY (object_id) REFERENCES objects(id),
  CONSTRAINT fk_ra_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_ra_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id),

  KEY idx_ra_record (record_id),
  KEY idx_ra_version (record_version_id),
  KEY idx_ra_type (artifact_type_id),
  KEY idx_ra_state (artifact_state_id),
  KEY idx_ra_is_draft (is_draft),
  KEY idx_ra_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 8) Audit log (append-only por política)
-- ----------------------------------------------------------------------------
CREATE TABLE audit_log (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  event_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  actor_user_id   CHAR(36) NOT NULL,
  action          VARCHAR(80) NOT NULL,
  entity_type     VARCHAR(80) NOT NULL,
  entity_id       CHAR(36) NULL,
  details_json    TEXT NULL,

  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id),
  KEY idx_audit_event_at (event_at),
  KEY idx_audit_entity (entity_type, entity_id),
  KEY idx_audit_actor (actor_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 9) MIME/Extensions catalog (paramétrico)
-- ----------------------------------------------------------------------------
CREATE TABLE mime_types (
  id            SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  mime          VARCHAR(120) NOT NULL,
  description   VARCHAR(255) NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,

  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    CHAR(36) NULL,
  updated_at    DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  updated_by    CHAR(36) NULL,

  deleted_at    DATETIME NULL,
  deleted_by    CHAR(36) NULL,

  UNIQUE KEY uq_mime_types_mime (mime),

  CONSTRAINT fk_mt_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_mt_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_mt_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE file_extensions (
  id            SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  ext           VARCHAR(20) NOT NULL,
  description   VARCHAR(255) NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,

  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    CHAR(36) NULL,
  updated_at    DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  updated_by    CHAR(36) NULL,

  deleted_at    DATETIME NULL,
  deleted_by    CHAR(36) NULL,

  UNIQUE KEY uq_file_extensions_ext (ext),

  CONSTRAINT fk_fe_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_fe_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_fe_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE mime_type_extensions (
  mime_type_id      SMALLINT UNSIGNED NOT NULL,
  file_extension_id SMALLINT UNSIGNED NOT NULL,
  is_default         TINYINT(1) NOT NULL DEFAULT 0,
  is_active          TINYINT(1) NOT NULL DEFAULT 1,

  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by         CHAR(36) NULL,
  updated_at         DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  updated_by         CHAR(36) NULL,

  deleted_at         DATETIME NULL,
  deleted_by         CHAR(36) NULL,

  PRIMARY KEY (mime_type_id, file_extension_id),

  CONSTRAINT fk_mte_mt FOREIGN KEY (mime_type_id) REFERENCES mime_types(id),
  CONSTRAINT fk_mte_fe FOREIGN KEY (file_extension_id) REFERENCES file_extensions(id),

  CONSTRAINT fk_mte_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_mte_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_mte_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE artifact_type_mime_types (
  artifact_type_id  SMALLINT UNSIGNED NOT NULL,
  mime_type_id      SMALLINT UNSIGNED NOT NULL,
  is_default        TINYINT(1) NOT NULL DEFAULT 0,
  is_active         TINYINT(1) NOT NULL DEFAULT 1,

  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by        CHAR(36) NULL,
  updated_at        DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  updated_by        CHAR(36) NULL,

  deleted_at        DATETIME NULL,
  deleted_by        CHAR(36) NULL,

  PRIMARY KEY (artifact_type_id, mime_type_id),

  CONSTRAINT fk_atmt_at FOREIGN KEY (artifact_type_id) REFERENCES artifact_types(id),
  CONSTRAINT fk_atmt_mt FOREIGN KEY (mime_type_id) REFERENCES mime_types(id),

  CONSTRAINT fk_atmt_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_atmt_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_atmt_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- Sesiones del usuario
CREATE TABLE user_sessions (
  id            CHAR(36) NOT NULL,
  user_id       CHAR(36) NOT NULL,
  jti           VARCHAR(36) NOT NULL,

  ip_v4         VARCHAR(45) NULL,
  ip_v6         VARCHAR(45) NULL,
  user_agent    VARCHAR(500) NULL,
  device        VARCHAR(200) NULL,

  country_code  CHAR(2) NULL,
  country_name  VARCHAR(100) NULL,
  city          VARCHAR(100) NULL,
  location      VARCHAR(200) NULL,

  logged_out_at DATETIME NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_us_jti (jti),
  KEY idx_us_user (user_id),
  KEY idx_us_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE user_sessions
  ADD CONSTRAINT fk_us_user FOREIGN KEY (user_id) REFERENCES users(id);