-- Table privileges for the PostgREST roles.
--
-- RLS decides *which rows* a user may touch; GRANT decides whether the role may
-- touch the table at all. Both are required — without these grants every request
-- fails with "permission denied for table …" before any policy is evaluated.
--
-- `anon` is deliberately given nothing: every page in this app is behind auth.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;

-- Same treatment for anything a later migration adds.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to authenticated, service_role;
