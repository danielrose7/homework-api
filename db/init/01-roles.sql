CREATE ROLE app_owner LOGIN PASSWORD 'app_owner' CREATEDB;
CREATE ROLE app_user LOGIN PASSWORD 'app_user' NOBYPASSRLS;
CREATE ROLE app_readonly LOGIN PASSWORD 'app_readonly' NOBYPASSRLS;

ALTER DATABASE homework OWNER TO app_owner;
GRANT CONNECT ON DATABASE homework TO app_user, app_readonly;

\connect homework

ALTER SCHEMA public OWNER TO app_owner;
GRANT USAGE ON SCHEMA public TO app_user, app_readonly;

ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA public
  GRANT SELECT ON TABLES TO app_readonly;
