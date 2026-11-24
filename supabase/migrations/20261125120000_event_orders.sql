BEGIN;
-- Fase 2: compras con varias entradas, reglas por tipo de entrada y códigos de descuento.

-- 1. Reglas por tipo de entrada. Los tipos ya vendidos se archivan en vez de borrarse.
ALTER TABLE arm_app.event_ticket_types
 ADD COLUMN description text NOT NULL DEFAULT '' CHECK(char_length(description)<=300),
 ADD COLUMN capacity integer CHECK(capacity>0),
 ADD COLUMN sales_start timestamptz,
 ADD COLUMN sales_end timestamptz,
 ADD COLUMN hidden boolean NOT NULL DEFAULT false,
 ADD COLUMN max_per_order integer NOT NULL DEFAULT 10 CHECK(max_per_order BETWEEN 1 AND 10),
 ADD COLUMN archived boolean NOT NULL DEFAULT false,
 ADD CONSTRAINT event_ticket_types_sales_window_check CHECK(sales_start IS NULL OR sales_end IS NULL OR sales_start<sales_end);
-- La posición se reasigna al guardar; con tipos archivados deja de ser única.
ALTER TABLE arm_app.event_ticket_types DROP CONSTRAINT event_ticket_types_event_id_position_key;

-- 2. Códigos de descuento (o de acceso a entradas ocultas, con descuento 0).
CREATE TABLE arm_app.event_discount_codes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id uuid NOT NULL REFERENCES arm_app.event_programs(id),
 code text NOT NULL CHECK(code ~ '^[A-Z0-9_-]{3,30}$'),
 kind text NOT NULL CHECK(kind IN ('percent','amount')),
 value numeric(14,2) NOT NULL CHECK(value>=0 AND (kind<>'percent' OR value<=100)),
 max_uses integer CHECK(max_uses>0),
 starts_at timestamptz,
 ends_at timestamptz,
 ticket_type_ids uuid[] NOT NULL DEFAULT '{}',
 active boolean NOT NULL DEFAULT true,
 created_by bigint NOT NULL REFERENCES arm_app.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(event_id,code),
 CHECK(starts_at IS NULL OR ends_at IS NULL OR starts_at<ends_at)
);

-- 3. La compra: quién compra, cuánto paga y el pago de Mercado Pago. Cada entrada sigue en event_registrations.
CREATE TABLE arm_app.event_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id uuid NOT NULL REFERENCES arm_app.event_programs(id),
 campus_id bigint NOT NULL REFERENCES arm_app.campuses(id),
 request_hash text NOT NULL,
 email text NOT NULL,
 buyer jsonb NOT NULL,
 snapshot jsonb NOT NULL,
 status text NOT NULL CHECK(status IN ('confirmed','pending_payment','waitlisted','expired','payment_review','cancelled')),
 subtotal numeric(14,2) NOT NULL CHECK(subtotal>=0),
 discount numeric(14,2) NOT NULL DEFAULT 0 CHECK(discount>=0),
 amount numeric(14,2) NOT NULL CHECK(amount>=0 AND amount=subtotal-discount),
 currency text NOT NULL CHECK(currency='CLP'),
 discount_code_id uuid REFERENCES arm_app.event_discount_codes(id),
 expires_at timestamptz,
 preference_id text,
 checkout_url text,
 payment_id text UNIQUE,
 email_sent_at timestamptz,
 confirmation_sent_at timestamptz,
 source text NOT NULL DEFAULT 'public' CHECK(source IN ('public','manual')),
 created_by bigint REFERENCES arm_app.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(event_id,request_hash)
);
CREATE INDEX event_orders_event_idx ON arm_app.event_orders(event_id,status,expires_at);
CREATE INDEX event_orders_code_idx ON arm_app.event_orders(discount_code_id) WHERE discount_code_id IS NOT NULL;

-- Cada inscripción existente pasa a ser una compra de una entrada con el mismo ID:
-- los enlaces enviados y las referencias de Mercado Pago siguen apuntando al mismo lugar.
INSERT INTO arm_app.event_orders(id,event_id,campus_id,request_hash,email,buyer,snapshot,status,subtotal,discount,amount,currency,expires_at,preference_id,checkout_url,payment_id,email_sent_at,confirmation_sent_at,source,created_by,created_at,updated_at)
SELECT id,event_id,campus_id,request_hash,email,
 jsonb_build_object('firstName',participant->>'firstName','lastName',participant->>'lastName','phone',coalesce(participant->>'phone','')),
 snapshot,status,amount,0,amount,currency,expires_at,preference_id,checkout_url,payment_id,email_sent_at,confirmation_sent_at,source,created_by,created_at,updated_at
FROM arm_app.event_registrations;

-- 4. Cada entrada sabe a qué compra y tipo pertenece, y guarda las respuestas del asistente.
ALTER TABLE arm_app.event_registrations
 ADD COLUMN order_id uuid REFERENCES arm_app.event_orders(id),
 ADD COLUMN ticket_type_id uuid REFERENCES arm_app.event_ticket_types(id),
 ADD COLUMN answers jsonb NOT NULL DEFAULT '{}'::jsonb;
UPDATE arm_app.event_registrations SET order_id=id;
UPDATE arm_app.event_registrations r SET ticket_type_id=t.id FROM arm_app.event_ticket_types t
 WHERE t.event_id=r.event_id AND t.name=r.snapshot->>'ticketName';
ALTER TABLE arm_app.event_registrations ALTER COLUMN order_id SET NOT NULL;
CREATE INDEX event_registrations_order_idx ON arm_app.event_registrations(order_id);
CREATE INDEX event_registrations_ticket_idx ON arm_app.event_registrations(ticket_type_id,status);
-- Varias entradas de una compra comparten el correo de quien compra: el correo deja de ser único por evento.
DROP INDEX arm_app.event_registrations_active_email_idx;

-- 5. Permisos del backend, igual que el resto del módulo.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['event_discount_codes','event_orders'] LOOP
  EXECUTE format('ALTER TABLE arm_app.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON arm_app.%I FROM PUBLIC,anon,authenticated,arm_api',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON arm_app.%I TO arm_api',t);
  EXECUTE format('CREATE POLICY backend_read ON arm_app.%I FOR SELECT TO arm_api USING (true)',t);
  EXECUTE format('CREATE POLICY backend_insert ON arm_app.%I FOR INSERT TO arm_api WITH CHECK (true)',t);
  EXECUTE format('CREATE POLICY backend_update ON arm_app.%I FOR UPDATE TO arm_api USING (true) WITH CHECK (true)',t);
 END LOOP;
END $$;
COMMIT;
