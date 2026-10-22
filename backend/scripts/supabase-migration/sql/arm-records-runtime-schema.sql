CREATE TABLE arm_app.encuentros (
 document_id text PRIMARY KEY,
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 campus text GENERATED ALWAYS AS (data->>'campus') STORED,
 campus_id bigint GENERATED ALWAYS AS ((data->>'campusId')::bigint) STORED REFERENCES arm_app.campuses(id),
 record_user text GENERATED ALWAYS AS (data->'registradoPor'->>'uid') STORED,
 record_date text GENERATED ALWAYS AS (coalesce(data->>'fecha',data->>'date')) STORED,
 idempotency_key text GENERATED ALWAYS AS (data->>'idempotencyKey') STORED
);
ALTER TABLE arm_app.encuentros ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON arm_app.encuentros FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX encuentros_campus_date_idx ON arm_app.encuentros(campus,record_date);
CREATE INDEX encuentros_campus_id_idx ON arm_app.encuentros(campus_id);
CREATE INDEX encuentros_record_date_idx ON arm_app.encuentros(record_date);
CREATE UNIQUE INDEX encuentros_retry_key_idx ON arm_app.encuentros(record_user,idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE arm_app.siembra (
 document_id text PRIMARY KEY,
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 campus text GENERATED ALWAYS AS (data->>'campus') STORED,
 campus_id bigint GENERATED ALWAYS AS ((data->>'campusId')::bigint) STORED REFERENCES arm_app.campuses(id),
 record_user text GENERATED ALWAYS AS (data->'registradoPor'->>'uid') STORED,
 record_date text GENERATED ALWAYS AS (coalesce(data->>'fecha',data->>'date')) STORED,
 idempotency_key text GENERATED ALWAYS AS (data->>'idempotencyKey') STORED
);
ALTER TABLE arm_app.siembra ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON arm_app.siembra FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX siembra_campus_date_idx ON arm_app.siembra(campus,record_date);
CREATE INDEX siembra_campus_id_idx ON arm_app.siembra(campus_id);
CREATE INDEX siembra_record_date_idx ON arm_app.siembra(record_date);
CREATE UNIQUE INDEX siembra_retry_key_idx ON arm_app.siembra(record_user,idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE arm_app.kiloamor (
 document_id text PRIMARY KEY,
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 campus text GENERATED ALWAYS AS (data->>'campus') STORED,
 campus_id bigint GENERATED ALWAYS AS ((data->>'campusId')::bigint) STORED REFERENCES arm_app.campuses(id),
 record_user text GENERATED ALWAYS AS (data->'registradoPor'->>'uid') STORED,
 record_date text GENERATED ALWAYS AS (coalesce(data->>'fecha',data->>'date')) STORED,
 idempotency_key text GENERATED ALWAYS AS (data->>'idempotencyKey') STORED
);
ALTER TABLE arm_app.kiloamor ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON arm_app.kiloamor FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX kiloamor_campus_date_idx ON arm_app.kiloamor(campus,record_date);
CREATE INDEX kiloamor_campus_id_idx ON arm_app.kiloamor(campus_id);
CREATE INDEX kiloamor_record_date_idx ON arm_app.kiloamor(record_date);
CREATE UNIQUE INDEX kiloamor_retry_key_idx ON arm_app.kiloamor(record_user,idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE arm_app.anuncios (
 document_id text PRIMARY KEY,
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 campus text GENERATED ALWAYS AS (data->>'campus') STORED,
 campus_id bigint GENERATED ALWAYS AS ((data->>'campusId')::bigint) STORED REFERENCES arm_app.campuses(id),
 record_user text GENERATED ALWAYS AS (data->'registradoPor'->>'uid') STORED,
 record_date text GENERATED ALWAYS AS (coalesce(data->>'fecha',data->>'date')) STORED,
 idempotency_key text GENERATED ALWAYS AS (data->>'idempotencyKey') STORED
);
ALTER TABLE arm_app.anuncios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON arm_app.anuncios FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX anuncios_campus_date_idx ON arm_app.anuncios(campus,record_date);
CREATE INDEX anuncios_campus_id_idx ON arm_app.anuncios(campus_id);
CREATE INDEX anuncios_record_date_idx ON arm_app.anuncios(record_date);
CREATE UNIQUE INDEX anuncios_retry_key_idx ON arm_app.anuncios(record_user,idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE arm_app.events (
 document_id text PRIMARY KEY,
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 campus text GENERATED ALWAYS AS (data->>'campus') STORED,
 campus_id bigint GENERATED ALWAYS AS ((data->>'campusId')::bigint) STORED REFERENCES arm_app.campuses(id),
 record_user text GENERATED ALWAYS AS (data->'registradoPor'->>'uid') STORED,
 record_date text GENERATED ALWAYS AS (coalesce(data->>'fecha',data->>'date')) STORED,
 idempotency_key text GENERATED ALWAYS AS (data->>'idempotencyKey') STORED
);
ALTER TABLE arm_app.events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON arm_app.events FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX events_campus_date_idx ON arm_app.events(campus,record_date);
CREATE INDEX events_campus_id_idx ON arm_app.events(campus_id);
CREATE INDEX events_record_date_idx ON arm_app.events(record_date);
CREATE UNIQUE INDEX events_retry_key_idx ON arm_app.events(record_user,idempotency_key) WHERE idempotency_key IS NOT NULL;
