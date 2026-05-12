-- Drop old table and enum
DROP TABLE IF EXISTS "org_nodes";
DROP TYPE IF EXISTS "OrgNodeType";

-- New enum
CREATE TYPE "OrgRole" AS ENUM ('area_leader', 'team_leader', 'member');

-- Teams
CREATE TABLE "org_teams" (
  "id"           SERIAL PRIMARY KEY,
  "area_id"      INTEGER NOT NULL REFERENCES "org_areas"("id") ON DELETE CASCADE,
  "name"         VARCHAR(150) NOT NULL,
  "icon"         VARCHAR(10),
  "desc"         TEXT,
  "col_position" INTEGER NOT NULL DEFAULT 1,
  "sort_order"   INTEGER NOT NULL DEFAULT 0,
  "is_active"    BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Memberships
CREATE TABLE "org_memberships" (
  "id"         SERIAL PRIMARY KEY,
  "user_id"    INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "area_id"    INTEGER REFERENCES "org_areas"("id") ON DELETE CASCADE,
  "team_id"    INTEGER REFERENCES "org_teams"("id") ON DELETE CASCADE,
  "role"       "OrgRole" NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "org_memberships_user_area_team_role_key" UNIQUE ("user_id", "area_id", "team_id", "role")
);

-- Auto-update updated_at on org_teams
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW."updated_at" = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "org_teams_updated_at"
BEFORE UPDATE ON "org_teams"
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
