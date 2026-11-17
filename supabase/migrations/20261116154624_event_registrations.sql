BEGIN;
ALTER TABLE arm_app.event_programs DROP CONSTRAINT event_programs_registration_status_check;
ALTER TABLE arm_app.event_programs ADD CONSTRAINT event_programs_registration_status_check CHECK(registration_status IN ('pending','open','closed'));
-- Prices and participant details are snapshots: subsequent editor changes never rewrite a booking.
CREATE TABLE arm_app.event_registrations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id uuid NOT NULL REFERENCES arm_app.event_programs(id),
 campus_id bigint NOT NULL REFERENCES arm_app.campuses(id),
 request_hash text NOT NULL,
 email text NOT NULL,
 participant jsonb NOT NULL,
 snapshot jsonb NOT NULL,
 status text NOT NULL CHECK(status IN ('confirmed','pending_payment','waitlisted','expired','payment_review','cancelled')),
 amount numeric(14,2) NOT NULL CHECK(amount >= 0),
 currency text NOT NULL CHECK(currency='CLP'),
 expires_at timestamptz,
 preference_id text,
 checkout_url text,
 payment_id text UNIQUE,
 email_sent_at timestamptz,
 confirmation_sent_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(event_id,request_hash),
 UNIQUE(event_id,email)
);
CREATE INDEX event_registrations_capacity_idx ON arm_app.event_registrations(event_id,status,expires_at);
CREATE INDEX event_registrations_campus_idx ON arm_app.event_registrations(campus_id);
ALTER TABLE arm_app.event_registrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON arm_app.event_registrations FROM PUBLIC,anon,authenticated,arm_api;
GRANT SELECT,INSERT,UPDATE ON arm_app.event_registrations TO arm_api;
CREATE POLICY backend_read ON arm_app.event_registrations FOR SELECT TO arm_api USING(true);
CREATE POLICY backend_insert ON arm_app.event_registrations FOR INSERT TO arm_api WITH CHECK(true);
CREATE POLICY backend_update ON arm_app.event_registrations FOR UPDATE TO arm_api USING(true) WITH CHECK(true);
COMMIT;
