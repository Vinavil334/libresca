-- Schema for helpers that the API must never expose, such as the
-- security definer functions used by RLS policies (are_friends, is_active).
-- It is not listed in config.toml [api].schemas, so PostgREST cannot reach it.
create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;
