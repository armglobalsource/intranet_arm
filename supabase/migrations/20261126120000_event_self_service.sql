BEGIN;
-- Fase 3: quien compra gestiona sus entradas (transferir, cancelar), recordatorios y lista de espera automática.

-- 1. El QR de cada entrada usa un código propio que se renueva al transferirla:
--    el QR anterior deja de servir. Las entradas existentes conservan su código actual (su ID).
ALTER TABLE arm_app.event_registrations
 ADD COLUMN ticket_code uuid,
 ADD COLUMN transferred_at timestamptz;
UPDATE arm_app.event_registrations SET ticket_code=id;
ALTER TABLE arm_app.event_registrations
 ALTER COLUMN ticket_code SET DEFAULT gen_random_uuid(),
 ALTER COLUMN ticket_code SET NOT NULL,
 ADD CONSTRAINT event_registrations_ticket_code_key UNIQUE(ticket_code);

-- 2. Recordatorios enviados (una vez cada uno) y compras que pasaron desde la lista de espera.
ALTER TABLE arm_app.event_orders
 ADD COLUMN reminder_week_sent_at timestamptz,
 ADD COLUMN reminder_day_sent_at timestamptz,
 ADD COLUMN promoted_at timestamptz;

-- 3. «Mis entradas» busca las compras por correo.
CREATE INDEX event_orders_email_idx ON arm_app.event_orders(lower(email));
COMMIT;
