ALTER TABLE users
  ADD COLUMN avatar_object_id CHAR(36) NULL AFTER last_login_at,
  ADD KEY idx_users_avatar_object_id (avatar_object_id),
  ADD CONSTRAINT fk_users_avatar_object FOREIGN KEY (avatar_object_id) REFERENCES objects(id);
