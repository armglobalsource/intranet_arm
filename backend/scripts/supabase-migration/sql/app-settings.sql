-- Configuración compartida de la aplicación (p. ej. destinatarios del reporte semanal).
-- Solo la usa el backend con su conexión; RLS sin políticas bloquea el acceso directo.
CREATE TABLE IF NOT EXISTS arm_app.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "updatedBy" text
);
ALTER TABLE arm_app.app_settings ENABLE ROW LEVEL SECURITY;
