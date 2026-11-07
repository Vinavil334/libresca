-- Keep-alive check (F0.8): callable without signing in, reads the database, leaks nothing.
begin;

select plan(4);

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select ok(public.health_check(), 'anonymous callers get true while the database holds the settings');

select throws_ok(
  $$ select * from public.app_settings $$,
  '42501',
  null,
  'the check does not open app_settings to anonymous callers'
);

reset role;

select is(
  (select prosecdef from pg_proc where oid = 'public.health_check()'::regprocedure),
  true,
  'the check runs as security definer, so anonymous callers need no table grants'
);

delete from public.app_settings where key = 'signup_mode';
set local role anon;
select ok(not public.health_check(), 'the check reports false when the settings are missing');

select * from finish();

rollback;
