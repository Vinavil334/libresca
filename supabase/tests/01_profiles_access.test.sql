-- Profiles and access (F0.7): who reads what, who changes the status.
begin;

select plan(19);

-- Three fake accounts. The auth trigger creates their profiles.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ada@example.com', '{"full_name": "Ada Funghetti"}'),
  ('22222222-2222-2222-2222-222222222222', 'bruno@example.com', '{"name": "Bruno Muschio"}'),
  ('33333333-3333-3333-3333-333333333333', 'chiara@example.com', '{}');

-- Trigger and bootstrap ----------------------------------------------------

select results_eq(
  $$ select status::text from public.profiles order by id $$,
  $$ values ('pending'), ('pending'), ('pending') $$,
  'with invite_only every new account starts pending'
);

select results_eq(
  $$ select display_name from public.profiles order by id $$,
  $$ values ('Ada Funghetti'), ('Bruno Muschio'), ('chiara') $$,
  'the display name comes from Google, or from the email when missing'
);

select is(
  private.activate_profile('  ADA@example.com '),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'activate_profile finds the account by email, ignoring case and spaces'
);

select throws_ok(
  $$ select private.activate_profile('nobody@example.com') $$,
  'P0002',
  null,
  'activate_profile fails on an unknown email'
);

update public.app_settings set value = '"open"' where key = 'signup_mode';
insert into auth.users (id, email) values ('44444444-4444-4444-4444-444444444444', 'dario@example.com');
select is(
  (select status::text from public.profiles where id = '44444444-4444-4444-4444-444444444444'),
  'active',
  'with signup_mode open a new account starts active'
);
update public.app_settings set value = '"invite_only"' where key = 'signup_mode';

-- Active account: Ada --------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select results_eq(
  $$ select id from public.profiles $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid) $$,
  'an account reads only its own profile'
);

select ok(private.is_active(), 'is_active is true for an active account');

select lives_ok(
  $$ update public.profiles set display_name = 'Ada dei Funghi', handle = 'ada_funghi' where id = (select auth.uid()) $$,
  'an account edits its own name and handle'
);

select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Ada dei Funghi',
  'the edit is saved'
);

select throws_ok(
  $$ update public.profiles set handle = 'Ada Funghi!' where id = (select auth.uid()) $$,
  '23514',
  null,
  'a handle with spaces or symbols is rejected'
);

select is_empty(
  $$ update public.profiles set display_name = 'Hacked' where id = '22222222-2222-2222-2222-222222222222' returning id $$,
  'an account cannot edit someone else''s profile'
);

select throws_ok(
  $$ update public.profiles set status = 'suspended' where id = (select auth.uid()) $$,
  '42501',
  null,
  'an account cannot change its own status'
);

select throws_ok(
  $$ insert into public.profiles (id, display_name) values (gen_random_uuid(), 'Intruder') $$,
  '42501',
  null,
  'profiles cannot be created through the API'
);

select throws_ok(
  $$ select * from public.app_settings $$,
  '42501',
  null,
  'app settings are not readable through the API'
);

select throws_ok(
  $$ select private.activate_profile('bruno@example.com') $$,
  '42501',
  null,
  'an account cannot activate others, or itself'
);

-- Pending account: Bruno -----------------------------------------------------

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select results_eq(
  $$ select status::text from public.profiles $$,
  $$ values ('pending') $$,
  'a pending account reads its own status, so the app can route it'
);

select ok(not private.is_active(), 'is_active is false for a pending account');

-- Anonymous ------------------------------------------------------------------

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$ select * from public.profiles $$,
  '42501',
  null,
  'anonymous visitors cannot read profiles'
);

select throws_ok(
  $$ select private.is_active() $$,
  '42501',
  null,
  'anonymous visitors cannot call private functions'
);

select * from finish();

rollback;
