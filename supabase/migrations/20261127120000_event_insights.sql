BEGIN;
-- Fase 4: devoluciones con Mercado Pago, mensajes a inscritos y encuesta posterior al evento.

-- 1. Devoluciones: cuánto se devolvió de cada compra y qué entradas quedaron devueltas.
ALTER TABLE arm_app.event_orders
 ADD COLUMN refunded_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK(refunded_amount>=0),
 ADD COLUMN refunds jsonb NOT NULL DEFAULT '[]'::jsonb,
 ADD COLUMN refunded_at timestamptz,
 ADD CONSTRAINT event_orders_refund_le_amount CHECK(refunded_amount<=amount);
ALTER TABLE arm_app.event_registrations ADD COLUMN refunded_at timestamptz;

-- 2. Mensajes enviados a los inscritos (registro de quién envió qué y a cuántas personas).
CREATE TABLE arm_app.event_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id uuid NOT NULL REFERENCES arm_app.event_programs(id),
 subject text NOT NULL CHECK(char_length(subject) BETWEEN 1 AND 150),
 body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 5000),
 audience jsonb NOT NULL,
 recipients integer NOT NULL CHECK(recipients>=0),
 sent integer NOT NULL DEFAULT 0,
 failed integer NOT NULL DEFAULT 0,
 sent_by bigint NOT NULL REFERENCES arm_app.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_messages_event_idx ON arm_app.event_messages(event_id,created_at DESC);

-- 3. Encuesta de satisfacción: anónima, una respuesta por correo y evento.
ALTER TABLE arm_app.event_programs ADD COLUMN survey_sent_at timestamptz;
CREATE TABLE arm_app.event_survey_responses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id uuid NOT NULL REFERENCES arm_app.event_programs(id),
 respondent_hash text NOT NULL,
 rating smallint NOT NULL CHECK(rating BETWEEN 1 AND 5),
 nps smallint CHECK(nps BETWEEN 0 AND 10),
 liked text CHECK(char_length(liked)<=1000),
 improve text CHECK(char_length(improve)<=1000),
 extra text CHECK(char_length(extra)<=1000),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(event_id,respondent_hash)
);

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['event_messages','event_survey_responses'] LOOP
  EXECUTE format('ALTER TABLE arm_app.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON arm_app.%I FROM PUBLIC,anon,authenticated,arm_api',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON arm_app.%I TO arm_api',t);
  EXECUTE format('CREATE POLICY backend_read ON arm_app.%I FOR SELECT TO arm_api USING (true)',t);
  EXECUTE format('CREATE POLICY backend_insert ON arm_app.%I FOR INSERT TO arm_api WITH CHECK (true)',t);
  EXECUTE format('CREATE POLICY backend_update ON arm_app.%I FOR UPDATE TO arm_api USING (true) WITH CHECK (true)',t);
 END LOOP;
END $$;
COMMIT;
