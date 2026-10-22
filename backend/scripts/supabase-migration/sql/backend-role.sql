DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='arm_api') THEN
    CREATE ROLE arm_api NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA arm_app TO arm_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA arm_app TO arm_api;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA arm_app TO arm_api;
DO $$
DECLARE tab record;
BEGIN
  FOR tab IN SELECT tablename FROM pg_tables WHERE schemaname='arm_app' LOOP
    EXECUTE format('CREATE POLICY arm_api_backend ON arm_app.%I TO arm_api USING (true) WITH CHECK (true)',tab.tablename);
  END LOOP;
END $$;
