-- No passwords or plaintext activation tokens. Only the backend can access jobs.
CREATE TABLE arm_app.mail_workspace_jobs (
  request_id uuid PRIMARY KEY REFERENCES arm_app.mail_requests(id),
  plan jsonb NOT NULL CHECK (jsonb_typeof(plan)='object'),
  state text NOT NULL DEFAULT 'prepared' CHECK (state IN ('prepared','failed','ready')),
  google_id text,
  last_error text,
  token_hash text UNIQUE,
  token_expires_at timestamptz,
  token_used_at timestamptz,
  invitation_sent_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE arm_app.mail_workspace_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON arm_app.mail_workspace_jobs FROM PUBLIC, anon, authenticated, arm_api;
GRANT SELECT, INSERT, UPDATE ON arm_app.mail_workspace_jobs TO arm_api;
CREATE POLICY mail_workspace_jobs_read ON arm_app.mail_workspace_jobs FOR SELECT TO arm_api USING (true);
CREATE POLICY mail_workspace_jobs_insert ON arm_app.mail_workspace_jobs FOR INSERT TO arm_api WITH CHECK (true);
CREATE POLICY mail_workspace_jobs_update ON arm_app.mail_workspace_jobs FOR UPDATE TO arm_api USING (true) WITH CHECK (true);
