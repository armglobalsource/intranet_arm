BEGIN;
-- Equipaje del evento: cada bolso tiene su etiqueta impresa con QR, ligada a una entrada.
-- Se registra en la puerta o en la mesa de equipaje, y se entrega escaneando la etiqueta y la entrada del dueño.
CREATE TABLE arm_app.event_luggage (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id uuid NOT NULL REFERENCES arm_app.event_programs(id) ON DELETE CASCADE,
 registration_id uuid NOT NULL REFERENCES arm_app.event_registrations(id) ON DELETE CASCADE,
 number integer NOT NULL CHECK(number BETWEEN 1 AND 50),
 code text NOT NULL UNIQUE CHECK(code ~ '^[A-Z0-9]{8}$'),
 description text CHECK(char_length(description)<=80),
 status text NOT NULL DEFAULT 'stored' CHECK(status IN ('stored','delivered','void')),
 created_at timestamptz NOT NULL DEFAULT now(),
 created_by bigint REFERENCES arm_app.users(id),
 delivered_at timestamptz,
 delivered_by bigint REFERENCES arm_app.users(id),
 delivered_method text CHECK(delivered_method IN ('ticket','id_check')),
 voided_at timestamptz,
 voided_by bigint REFERENCES arm_app.users(id),
 UNIQUE(registration_id,number)
);
CREATE INDEX event_luggage_event_idx ON arm_app.event_luggage(event_id,status);

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['event_luggage'] LOOP
  EXECUTE format('ALTER TABLE arm_app.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON arm_app.%I FROM PUBLIC,anon,authenticated,arm_api',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON arm_app.%I TO arm_api',t);
  EXECUTE format('CREATE POLICY backend_read ON arm_app.%I FOR SELECT TO arm_api USING (true)',t);
  EXECUTE format('CREATE POLICY backend_insert ON arm_app.%I FOR INSERT TO arm_api WITH CHECK (true)',t);
  EXECUTE format('CREATE POLICY backend_update ON arm_app.%I FOR UPDATE TO arm_api USING (true) WITH CHECK (true)',t);
 END LOOP;
END $$;
COMMIT;
