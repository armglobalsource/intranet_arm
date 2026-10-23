-- Password recovery for the NestJS identity system. Apply before deploying.
ALTER TABLE arm_app.users ADD COLUMN IF NOT EXISTS "authVersion" integer NOT NULL DEFAULT 0;

CREATE TABLE arm_app.password_reset_tokens (
  "tokenHash" text PRIMARY KEY,
  "userId" bigint NOT NULL REFERENCES arm_app.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  "authVersion" integer NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "expiresAt" timestamptz NOT NULL DEFAULT now() + interval '15 minutes',
  "usedAt" timestamptz,
  CHECK (length("tokenHash") = 64)
);
CREATE INDEX password_reset_tokens_user_created_idx ON arm_app.password_reset_tokens("userId", "createdAt");
ALTER TABLE arm_app.password_reset_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON arm_app.password_reset_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON arm_app.password_reset_tokens TO arm_api;
CREATE POLICY arm_api_backend ON arm_app.password_reset_tokens FOR ALL TO arm_api USING (true) WITH CHECK (true);
