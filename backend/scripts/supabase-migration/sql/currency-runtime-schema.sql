ALTER TABLE arm_app.tipo_cambio ADD COLUMN IF NOT EXISTS "clpPorUnidad" numeric CHECK("clpPorUnidad">0);
ALTER TABLE arm_app.tipo_cambio_meta ADD COLUMN IF NOT EXISTS rates jsonb;
ALTER TABLE arm_app.tipo_cambio_meta ADD COLUMN IF NOT EXISTS "fetchedAt" timestamptz;
