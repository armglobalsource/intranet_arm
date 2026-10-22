-- Read-only checks plus deliberately rejected writes inside a rolled-back transaction.
BEGIN;
DO $$
DECLARE item record; denied boolean; seq_next bigint; max_id bigint;
BEGIN
  FOR item IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') LOOP
    IF has_schema_privilege(item.rolname,'arm_app','USAGE') THEN
      RAISE EXCEPTION 'Unexpected client access to private schema';
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='arm_app' AND c.relkind='r' AND NOT c.relrowsecurity) THEN
    RAISE EXCEPTION 'RLS missing';
  END IF;
  FOR item IN SELECT table_name FROM information_schema.columns
    WHERE table_schema='arm_app' AND column_name='id' AND is_identity='YES' LOOP
    EXECUTE format('SELECT last_value FROM %s',pg_get_serial_sequence(format('arm_app.%I',item.table_name),'id')) INTO seq_next;
    EXECUTE format('SELECT coalesce(max(id),0) FROM arm_app.%I',item.table_name) INTO max_id;
    IF seq_next <= max_id THEN RAISE EXCEPTION 'Sequence behind imported IDs'; END IF;
  END LOOP;
  denied := false;
  BEGIN
    INSERT INTO arm_app.users (id,document_id,email)
      SELECT -9223372036854775807,'__constraint_probe__',upper(email) FROM arm_app.users WHERE email IS NOT NULL LIMIT 1;
  EXCEPTION WHEN unique_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Normalized email uniqueness not enforced'; END IF;
  denied := false;
  BEGIN
    INSERT INTO arm_app.org_teams (id,document_id,"areaId")
      VALUES (-9223372036854775807,'__constraint_probe__',-9223372036854775807);
  EXCEPTION WHEN foreign_key_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Area foreign key not enforced'; END IF;
  denied := false;
  BEGIN
    INSERT INTO arm_app.campus_turnos (id,document_id,"campusId",tipo,modalidad,fecha)
      SELECT -9223372036854775807,'__constraint_probe__',"campusId",tipo,modalidad,fecha
      FROM arm_app.campus_turnos WHERE modalidad IS NULL LIMIT 1;
  EXCEPTION WHEN unique_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Null-modality shift uniqueness not enforced'; END IF;
END $$;
ROLLBACK;
SELECT 'Operational constraints, sequence positions and schema isolation verified' AS result;
