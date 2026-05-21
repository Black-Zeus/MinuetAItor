ALTER TABLE projects
  ADD COLUMN avatar_object_id CHAR(36) NULL AFTER auto_send_on_completed,
  ADD KEY idx_projects_avatar_object_id (avatar_object_id),
  ADD CONSTRAINT fk_projects_avatar_object FOREIGN KEY (avatar_object_id) REFERENCES objects(id);
