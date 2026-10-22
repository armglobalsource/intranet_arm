-- Temporary, private archive for migration rehearsals. Never query this from the application.
-- Intentionally fails if the schema already exists: inspect the destination before reapplying.
create schema arm_migration;
comment on schema arm_migration is 'ARM Firestore migration staging v1; not the application data model';
revoke all on schema arm_migration from public, anon, authenticated, service_role;
alter default privileges in schema arm_migration revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema arm_migration revoke execute on functions from public, anon, authenticated, service_role;

create table arm_migration.runs (
  run_sha256 text primary key check (run_sha256 ~ '^[0-9a-f]{64}$'),
  source_project_id text not null,
  target_project_ref text not null,
  expected_documents integer not null check (expected_documents >= 0),
  expected_missing_parents integer not null check (expected_missing_parents >= 0),
  manifest jsonb not null,
  status text not null default 'loading' check (status in ('loading', 'verified')),
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create table arm_migration.source_documents (
  run_sha256 text not null references arm_migration.runs(run_sha256),
  path text not null,
  source_ordinal integer not null check (source_ordinal >= 0),
  source_exists boolean not null,
  -- Keep exact tagged JSON text for byte-level comparison and values unsupported
  -- by jsonb (e.g. embedded Unicode NUL in original strings).
  raw_record text not null,
  record_sha256 text not null check (record_sha256 ~ '^[0-9a-f]{64}$'),
  primary key (run_sha256, path),
  unique (run_sha256, source_ordinal),
  check (path <> '' and path !~ '(^/|/$|//)' and cardinality(string_to_array(path, '/')) % 2 = 0)
);

alter table arm_migration.runs enable row level security;
alter table arm_migration.source_documents enable row level security;
revoke all on all tables in schema arm_migration from public, anon, authenticated, service_role;
