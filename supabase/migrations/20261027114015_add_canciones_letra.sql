-- Catálogo privado existente: conserva todas las canciones y políticas actuales.
ALTER TABLE arm_app.canciones ADD COLUMN IF NOT EXISTS letra text;
