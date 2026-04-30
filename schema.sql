-- =============================================================================
-- INTRANET CORPORATIVA — Schema SQL
-- Versión: 1.0 MVP
-- Motor: PostgreSQL 15
-- =============================================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE content_type AS ENUM ('news', 'page', 'announcement');
CREATE TYPE content_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE notification_channel AS ENUM ('in_app', 'email', 'both');
CREATE TYPE document_status AS ENUM ('active', 'deleted');

-- =============================================================================
-- ROLES Y PERMISOS
-- =============================================================================

CREATE TABLE roles (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50) UNIQUE NOT NULL,          -- admin, editor, employee, guest
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE permissions (
  id          SERIAL PRIMARY KEY,
  role_id     INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  resource    VARCHAR(100) NOT NULL,                -- users, documents, content, orgchart
  action      VARCHAR(50)  NOT NULL,                -- create, read, update, delete, upload
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role_id, resource, action)
);

-- =============================================================================
-- DEPARTAMENTOS / ORGANIGRAMA
-- =============================================================================

CREATE TABLE departments (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  description TEXT,
  parent_id   INTEGER REFERENCES departments(id) ON DELETE SET NULL,  -- jerarquía
  manager_id  INTEGER,                              -- FK a users (se añade después)
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- USUARIOS
-- =============================================================================

CREATE TABLE users (
  id             SERIAL PRIMARY KEY,
  email          VARCHAR(255) UNIQUE NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  first_name     VARCHAR(100) NOT NULL,
  last_name      VARCHAR(100) NOT NULL,
  display_name   VARCHAR(200) GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  avatar_url     TEXT,
  phone          VARCHAR(30),
  job_title      VARCHAR(150),
  bio            TEXT,
  role_id        INTEGER NOT NULL REFERENCES roles(id),
  department_id  INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  status         user_status NOT NULL DEFAULT 'active',
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK circular: departments.manager_id → users
ALTER TABLE departments
  ADD CONSTRAINT fk_departments_manager
  FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;

-- =============================================================================
-- SESIONES / TOKENS JWT
-- =============================================================================

CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL UNIQUE,          -- SHA-256 del token real
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  user_agent  TEXT,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE revoked_tokens (
  jti         VARCHAR(36) PRIMARY KEY,               -- JWT ID (claim jti)
  expires_at  TIMESTAMPTZ NOT NULL,                  -- para limpieza automática
  revoked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- CONTENIDO (CMS BÁSICO)
-- =============================================================================

CREATE TABLE content (
  id           SERIAL PRIMARY KEY,
  title        VARCHAR(255) NOT NULL,
  slug         VARCHAR(255) UNIQUE NOT NULL,
  body         TEXT NOT NULL DEFAULT '',
  excerpt      TEXT,
  type         content_type   NOT NULL DEFAULT 'news',
  status       content_status NOT NULL DEFAULT 'draft',
  author_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  thumbnail    TEXT,                                 -- URL en MinIO
  pinned       BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Full-text search
  search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(excerpt,'')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(body,'')), 'C')
  ) STORED
);

-- =============================================================================
-- DOCUMENTOS
-- =============================================================================

CREATE TABLE documents (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(255) NOT NULL,
  description    TEXT,
  minio_key      TEXT NOT NULL,                      -- path en MinIO
  mime_type      VARCHAR(100),
  size_bytes     BIGINT,
  uploader_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  department_id  INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  min_role_id    INTEGER REFERENCES roles(id),       -- rol mínimo para descargar
  status         document_status NOT NULL DEFAULT 'active',
  downloaded_count INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Full-text search
  search_vector  TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish', coalesce(name,'')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(description,'')), 'B')
  ) STORED
);

-- =============================================================================
-- NOTIFICACIONES
-- =============================================================================

CREATE TABLE notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(255) NOT NULL,
  body        TEXT,
  link        TEXT,                                  -- URL interna opcional
  channel     notification_channel NOT NULL DEFAULT 'in_app',
  read_at     TIMESTAMPTZ,                           -- NULL = no leída
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- JOBS ASÍNCRONOS (pg-boss usa su propio schema, esta tabla es de auditoría)
-- =============================================================================

CREATE TABLE job_logs (
  id          SERIAL PRIMARY KEY,
  job_name    VARCHAR(100) NOT NULL,
  status      VARCHAR(20)  NOT NULL,                 -- success, failed, retrying
  payload     JSONB,
  result      JSONB,
  error       TEXT,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- =============================================================================
-- ÍNDICES
-- =============================================================================

-- Usuarios
CREATE INDEX idx_users_email          ON users(email);
CREATE INDEX idx_users_role_id        ON users(role_id);
CREATE INDEX idx_users_department_id  ON users(department_id);
CREATE INDEX idx_users_status         ON users(status);
CREATE INDEX idx_users_search         ON users USING GIN (
  to_tsvector('spanish', coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' || coalesce(job_title,''))
);

-- Tokens
CREATE INDEX idx_refresh_tokens_user_id    ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX idx_revoked_tokens_expires_at ON revoked_tokens(expires_at);

-- Departamentos
CREATE INDEX idx_departments_parent_id   ON departments(parent_id);
CREATE INDEX idx_departments_manager_id  ON departments(manager_id);

-- Contenido
CREATE INDEX idx_content_status       ON content(status);
CREATE INDEX idx_content_type         ON content(type);
CREATE INDEX idx_content_author_id    ON content(author_id);
CREATE INDEX idx_content_published_at ON content(published_at DESC);
CREATE INDEX idx_content_search       ON content USING GIN (search_vector);

-- Documentos
CREATE INDEX idx_documents_uploader_id   ON documents(uploader_id);
CREATE INDEX idx_documents_department_id ON documents(department_id);
CREATE INDEX idx_documents_min_role_id   ON documents(min_role_id);
CREATE INDEX idx_documents_status        ON documents(status);
CREATE INDEX idx_documents_search        ON documents USING GIN (search_vector);

-- Notificaciones
CREATE INDEX idx_notifications_user_id   ON notifications(user_id);
CREATE INDEX idx_notifications_read_at   ON notifications(read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_created   ON notifications(created_at DESC);

-- =============================================================================
-- FUNCIONES DE UTILIDAD
-- =============================================================================

-- Actualiza updated_at automáticamente
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_content_updated_at
  BEFORE UPDATE ON content
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- DATOS INICIALES (SEED)
-- =============================================================================

-- Roles base
INSERT INTO roles (name, description) VALUES
  ('admin',    'Acceso total a la plataforma'),
  ('editor',   'Puede crear y editar contenido y documentos'),
  ('employee', 'Acceso estándar de empleado'),
  ('guest',    'Acceso de solo lectura a recursos públicos');

-- Permisos por rol
INSERT INTO permissions (role_id, resource, action)
SELECT r.id, p.resource, p.action
FROM roles r
CROSS JOIN (VALUES
  ('users',     'read'),
  ('users',     'update'),
  ('content',   'read'),
  ('documents', 'read'),
  ('documents', 'download'),
  ('orgchart',  'read'),
  ('notifications', 'read')
) AS p(resource, action)
WHERE r.name = 'employee';

INSERT INTO permissions (role_id, resource, action)
SELECT r.id, p.resource, p.action
FROM roles r
CROSS JOIN (VALUES
  ('users',     'read'),
  ('users',     'update'),
  ('content',   'read'),
  ('content',   'create'),
  ('content',   'update'),
  ('documents', 'read'),
  ('documents', 'create'),
  ('documents', 'update'),
  ('documents', 'download'),
  ('orgchart',  'read'),
  ('orgchart',  'update'),
  ('notifications', 'read'),
  ('notifications', 'create')
) AS p(resource, action)
WHERE r.name = 'editor';

INSERT INTO permissions (role_id, resource, action)
SELECT r.id, p.resource, p.action
FROM roles r
CROSS JOIN (VALUES
  ('users',     'read'),
  ('users',     'create'),
  ('users',     'update'),
  ('users',     'delete'),
  ('content',   'read'),
  ('content',   'create'),
  ('content',   'update'),
  ('content',   'delete'),
  ('documents', 'read'),
  ('documents', 'create'),
  ('documents', 'update'),
  ('documents', 'delete'),
  ('documents', 'download'),
  ('orgchart',  'read'),
  ('orgchart',  'create'),
  ('orgchart',  'update'),
  ('orgchart',  'delete'),
  ('notifications', 'read'),
  ('notifications', 'create'),
  ('notifications', 'delete'),
  ('jobs',      'read'),
  ('jobs',      'manage')
) AS p(resource, action)
WHERE r.name = 'admin';

INSERT INTO permissions (role_id, resource, action)
SELECT r.id, p.resource, p.action
FROM roles r
CROSS JOIN (VALUES
  ('content',   'read'),
  ('orgchart',  'read')
) AS p(resource, action)
WHERE r.name = 'guest';

-- Departamento raíz
INSERT INTO departments (name, description, parent_id, sort_order) VALUES
  ('Organización', 'Departamento raíz de la organización', NULL, 0);

-- Usuario administrador inicial (password: Admin1234!)
-- IMPORTANTE: cambiar en primer inicio de sesión
INSERT INTO users (email, password_hash, first_name, last_name, role_id, department_id) VALUES (
  'admin@empresa.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGod12eYxJ5JBnGbm1HJfMiCJiK', -- bcrypt de 'Admin1234!'
  'Admin',
  'Sistema',
  (SELECT id FROM roles WHERE name = 'admin'),
  (SELECT id FROM departments WHERE name = 'Organización')
);
