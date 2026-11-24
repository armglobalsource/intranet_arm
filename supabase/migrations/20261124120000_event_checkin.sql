BEGIN;
-- Día del evento: control de acceso, inscripciones agregadas por el equipo y anulaciones.
ALTER TABLE arm_app.event_registrations
 ADD COLUMN source text NOT NULL DEFAULT 'public' CHECK(source IN ('public','manual')),
 ADD COLUMN created_by bigint REFERENCES arm_app.users(id),
 ADD COLUMN note text CHECK(char_length(note)<=300),
 ADD COLUMN checked_in_at timestamptz,
 ADD COLUMN checked_in_by bigint REFERENCES arm_app.users(id),
 ADD COLUMN cancelled_at timestamptz,
 ADD COLUMN cancelled_by bigint REFERENCES arm_app.users(id);
-- Un correo con una inscripción anulada o vencida puede volver a inscribirse; las vigentes siguen siendo únicas.
ALTER TABLE arm_app.event_registrations DROP CONSTRAINT event_registrations_event_id_email_key;
CREATE UNIQUE INDEX event_registrations_active_email_idx ON arm_app.event_registrations(event_id,email) WHERE status NOT IN ('cancelled','expired');
CREATE INDEX event_registrations_checkin_idx ON arm_app.event_registrations(event_id,checked_in_at);
COMMIT;
