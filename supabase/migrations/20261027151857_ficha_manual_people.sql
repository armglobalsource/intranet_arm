CREATE TABLE arm_app.ficha_manual_people (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
  campus_id bigint NOT NULL REFERENCES arm_app.campuses(id),
  created_by bigint NOT NULL REFERENCES arm_app.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ficha_manual_people_campus_idx ON arm_app.ficha_manual_people (campus_id);
ALTER TABLE arm_app.ficha_manual_people ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON arm_app.ficha_manual_people FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON arm_app.ficha_manual_people TO arm_api;
CREATE POLICY ficha_manual_people_read ON arm_app.ficha_manual_people FOR SELECT TO arm_api USING (true);
CREATE POLICY ficha_manual_people_create ON arm_app.ficha_manual_people FOR INSERT TO arm_api WITH CHECK (true);
