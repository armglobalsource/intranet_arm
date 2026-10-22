ALTER TABLE arm_app.org_teams ADD COLUMN "parentTeamId" bigint REFERENCES arm_app.org_teams(id);
ALTER TABLE arm_app.org_teams ADD COLUMN icon text;
CREATE INDEX ON arm_app.org_teams("parentTeamId");
CREATE UNIQUE INDEX ON arm_app.org_areas(slug);
ALTER TABLE arm_app.org_memberships ADD CONSTRAINT membership_owner_scope CHECK (
 ("areaId" IS NOT NULL AND "teamId" IS NULL AND role='area_leader') OR
 ("areaId" IS NULL AND "teamId" IS NOT NULL)
);
