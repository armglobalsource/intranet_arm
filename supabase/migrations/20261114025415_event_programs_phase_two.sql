-- Phase 2 only. Reviewed locally; do not apply to a shared database without approval.
BEGIN;
CREATE TABLE arm_app.event_categories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
 active boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX event_categories_name_idx ON arm_app.event_categories(lower(btrim(name)));
CREATE TABLE arm_app.event_programs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
 category_id uuid REFERENCES arm_app.event_categories(id),
 campus_id bigint NOT NULL REFERENCES arm_app.campuses(id),
 organizer_id bigint NOT NULL REFERENCES arm_app.users(id),
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL CHECK (ends_at >= starts_at),
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','finished','cancelled')),
 registration_status text NOT NULL DEFAULT 'pending' CHECK (registration_status IN ('pending','closed')),
 capacity integer CHECK (capacity > 0),
 details jsonb NOT NULL CHECK (jsonb_typeof(details)='object'),
 version integer NOT NULL DEFAULT 1 CHECK(version > 0),
 created_by bigint NOT NULL REFERENCES arm_app.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 published_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_programs_campus_idx ON arm_app.event_programs(campus_id,starts_at);
CREATE INDEX event_programs_organizer_idx ON arm_app.event_programs(organizer_id,starts_at);
CREATE INDEX event_programs_category_idx ON arm_app.event_programs(category_id);
CREATE INDEX event_programs_creator_idx ON arm_app.event_programs(created_by);
CREATE INDEX event_programs_public_idx ON arm_app.event_programs(starts_at) WHERE status='published';
CREATE TABLE arm_app.event_program_campuses (
 event_id uuid NOT NULL REFERENCES arm_app.event_programs(id),
 campus_id bigint NOT NULL REFERENCES arm_app.campuses(id),
 PRIMARY KEY(event_id,campus_id)
);
CREATE INDEX event_program_campuses_campus_idx ON arm_app.event_program_campuses(campus_id);
CREATE TABLE arm_app.event_ticket_types (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id uuid NOT NULL REFERENCES arm_app.event_programs(id),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 80),
 price numeric(14,2) NOT NULL CHECK(price >= 0),
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 position integer NOT NULL CHECK(position >= 0),
 UNIQUE(event_id,position)
);
CREATE TABLE arm_app.event_audit_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id uuid NOT NULL REFERENCES arm_app.event_programs(id),
 actor_id bigint NOT NULL REFERENCES arm_app.users(id),
 action text NOT NULL,
 version integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_audit_logs_event_idx ON arm_app.event_audit_logs(event_id,created_at);
CREATE INDEX event_audit_logs_actor_idx ON arm_app.event_audit_logs(actor_id);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['event_categories','event_programs','event_program_campuses','event_ticket_types','event_audit_logs'] LOOP
  EXECUTE format('ALTER TABLE arm_app.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON arm_app.%I FROM PUBLIC,anon,authenticated,arm_api',t);
  EXECUTE format('GRANT SELECT,INSERT ON arm_app.%I TO arm_api',t);
  EXECUTE format('CREATE POLICY backend_read ON arm_app.%I FOR SELECT TO arm_api USING (true)',t);
  EXECUTE format('CREATE POLICY backend_insert ON arm_app.%I FOR INSERT TO arm_api WITH CHECK (true)',t);
  IF t <> 'event_audit_logs' THEN
   EXECUTE format('GRANT UPDATE ON arm_app.%I TO arm_api',t);
   EXECUTE format('CREATE POLICY backend_update ON arm_app.%I FOR UPDATE TO arm_api USING (true) WITH CHECK (true)',t);
  END IF;
  IF t IN ('event_program_campuses','event_ticket_types') THEN
   EXECUTE format('GRANT DELETE ON arm_app.%I TO arm_api',t);
   EXECUTE format('CREATE POLICY backend_delete ON arm_app.%I FOR DELETE TO arm_api USING (true)',t);
  END IF;
 END LOOP;
END $$;
COMMIT;
