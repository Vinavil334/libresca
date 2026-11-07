-- Guard for the project rule: every table exposed by the API has RLS enabled.
-- It fails as soon as a migration adds a table in an exposed schema without RLS.
begin;

select plan(2);

select is_empty(
  $$
    select format('%I.%I', n.nspname, c.relname)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'private')
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  $$,
  'every table in public and private has row level security enabled'
);

select ok(
  not has_schema_privilege('anon', 'private', 'usage'),
  'anon cannot use the private schema'
);

select * from finish();

rollback;
