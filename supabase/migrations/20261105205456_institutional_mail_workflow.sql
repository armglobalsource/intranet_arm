-- Private workflow; all end-user authorization is enforced by the NestJS API.
CREATE TABLE arm_app.mail_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id bigint NOT NULL REFERENCES arm_app.users(id),
  manager_id bigint NOT NULL REFERENCES arm_app.users(id),
  status text NOT NULL DEFAULT 'approval' CHECK (status IN ('approval','validation','creating','observed','delivered','rejected')),
  details jsonb NOT NULL CHECK (jsonb_typeof(details) = 'object'),
  version integer NOT NULL DEFAULT 1,
  assigned_to bigint REFERENCES arm_app.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_id <> manager_id)
);
CREATE INDEX mail_requests_requester_idx ON arm_app.mail_requests(requester_id, created_at DESC);
CREATE INDEX mail_requests_manager_idx ON arm_app.mail_requests(manager_id, status);
CREATE INDEX mail_requests_status_idx ON arm_app.mail_requests(status, created_at);
CREATE INDEX mail_requests_assignee_idx ON arm_app.mail_requests(assigned_to);

CREATE TABLE arm_app.mail_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES arm_app.mail_requests(id),
  actor_id bigint NOT NULL REFERENCES arm_app.users(id),
  action text NOT NULL,
  note text NOT NULL DEFAULT '',
  snapshot jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mail_request_events_request_idx ON arm_app.mail_request_events(request_id, created_at);
CREATE INDEX mail_request_events_actor_idx ON arm_app.mail_request_events(actor_id);

CREATE TABLE arm_app.mail_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(email) AND email ~ '^[a-z0-9][a-z0-9._-]*@(armglobal[.]org|arschoolglobal[.]com)$'),
  primary_id uuid REFERENCES arm_app.mail_accounts(id),
  identity_key text NOT NULL,
  owner_name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('collaborator','temporary','functional','alias')),
  active boolean NOT NULL DEFAULT true,
  expires_on date,
  review_on date GENERATED ALWAYS AS (expires_on - 7) STORED,
  license text NOT NULL,
  groups_text text NOT NULL DEFAULT '',
  last_request_id uuid NOT NULL REFERENCES arm_app.mail_requests(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'alias') = (primary_id IS NOT NULL)),
  CHECK (kind <> 'temporary' OR expires_on IS NOT NULL),
  CHECK (primary_id IS NULL OR primary_id <> id)
);
CREATE UNIQUE INDEX mail_accounts_one_principal_idx ON arm_app.mail_accounts(identity_key)
  WHERE active AND primary_id IS NULL AND kind <> 'functional';
CREATE INDEX mail_accounts_primary_idx ON arm_app.mail_accounts(primary_id);
CREATE INDEX mail_accounts_request_idx ON arm_app.mail_accounts(last_request_id);
CREATE INDEX mail_accounts_review_idx ON arm_app.mail_accounts(review_on) WHERE active AND expires_on IS NOT NULL;

ALTER TABLE arm_app.mail_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE arm_app.mail_request_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE arm_app.mail_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON arm_app.mail_requests, arm_app.mail_request_events, arm_app.mail_accounts FROM PUBLIC, anon, authenticated, arm_api;
GRANT SELECT, INSERT, UPDATE ON arm_app.mail_requests, arm_app.mail_accounts TO arm_api;
GRANT SELECT, INSERT ON arm_app.mail_request_events TO arm_api;
CREATE POLICY mail_requests_read ON arm_app.mail_requests FOR SELECT TO arm_api USING (true);
CREATE POLICY mail_requests_insert ON arm_app.mail_requests FOR INSERT TO arm_api WITH CHECK (true);
CREATE POLICY mail_requests_update ON arm_app.mail_requests FOR UPDATE TO arm_api USING (true) WITH CHECK (true);
CREATE POLICY mail_accounts_read ON arm_app.mail_accounts FOR SELECT TO arm_api USING (true);
CREATE POLICY mail_accounts_insert ON arm_app.mail_accounts FOR INSERT TO arm_api WITH CHECK (true);
CREATE POLICY mail_accounts_update ON arm_app.mail_accounts FOR UPDATE TO arm_api USING (true) WITH CHECK (true);
CREATE POLICY mail_events_read ON arm_app.mail_request_events FOR SELECT TO arm_api USING (true);
CREATE POLICY mail_events_insert ON arm_app.mail_request_events FOR INSERT TO arm_api WITH CHECK (true);
