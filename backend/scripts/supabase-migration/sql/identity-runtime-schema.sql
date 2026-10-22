-- Required by the PostgreSQL identity API; no production cutover or grants.
CREATE TABLE arm_app.revoked_tokens (
  jti text PRIMARY KEY,
  "expiresAt" timestamptz NOT NULL
);
CREATE INDEX ON arm_app.revoked_tokens ("expiresAt");
ALTER TABLE arm_app.revoked_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON arm_app.revoked_tokens FROM PUBLIC,anon,authenticated,service_role;
CREATE UNIQUE INDEX roles_name_normalized_unique ON arm_app.roles(lower(btrim(name)));
CREATE UNIQUE INDEX refresh_tokens_hash_unique ON arm_app.refresh_tokens("tokenHash");
