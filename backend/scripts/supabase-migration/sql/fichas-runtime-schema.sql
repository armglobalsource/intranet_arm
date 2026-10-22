ALTER TABLE arm_app.fichas ADD COLUMN IF NOT EXISTS "splitFrom" text;
ALTER TABLE arm_app.fichas ADD COLUMN IF NOT EXISTS "splitInto" jsonb;
CREATE INDEX IF NOT EXISTS fichas_campus_date_idx ON arm_app.fichas("campusId", date DESC);
CREATE INDEX IF NOT EXISTS fichas_published_date_idx ON arm_app.fichas(date) WHERE published AND archived IS DISTINCT FROM true;
