-- Columnas que existen en el schema de Prisma pero que se habían agregado
-- directamente en producción sin migración formal. Se usa IF NOT EXISTS
-- para que no falle si ya existen en la base de datos de producción.

-- OrgArea: icon_url (logo de área)
ALTER TABLE "org_areas"
  ADD COLUMN IF NOT EXISTS "icon_url" TEXT;

-- OrgTeam: icon_url (logo de equipo)
ALTER TABLE "org_teams"
  ADD COLUMN IF NOT EXISTS "icon_url" TEXT;

-- OrgMembership: custom_title (título personalizado para un miembro)
ALTER TABLE "org_memberships"
  ADD COLUMN IF NOT EXISTS "custom_title" VARCHAR(200);
