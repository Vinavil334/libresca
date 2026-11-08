-- Owned copies (F1.5): only the owner sees and changes them, while the account is active.
-- Invented accounts and books only.
begin;

select plan(17);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ada@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bruno@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carla@example.com');
update public.profiles set status = 'active'
where id in ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333');

insert into public.works (id, title) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Il bosco delle copie');
insert into public.editions (id, work_id, title) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Il bosco delle copie');

-- Constraints, as the owner of the database ------------------------------------

select throws_ok(
  $$ insert into public.copies (owner_id, edition_id, notes)
     values ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000001', '   ') $$,
  '23514', null, 'notes are either text or absent'
);
select throws_ok(
  $$ insert into public.copies (owner_id, edition_id, acquired_on)
     values ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000001', '1200-01-01') $$,
  '23514', null, 'an acquisition date before printing is refused'
);

-- Ada, active ----------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.copies (id, edition_id, acquired_on, notes)
     values ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', '2024-05-01', 'Regalo di compleanno') $$,
  'an active account adds a copy'
);
select results_eq(
  $$ select owner_id, is_lendable, visibility::text from public.copies $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid, true, 'friends') $$,
  'the owner is the caller, lendable and friends by default'
);
select lives_ok(
  $$ insert into public.copies (edition_id) values ('cccccccc-0000-0000-0000-000000000001') $$,
  'a second copy of the same edition is allowed'
);
select throws_ok(
  $$ insert into public.copies (owner_id, edition_id)
     values ('33333333-3333-3333-3333-333333333333', 'cccccccc-0000-0000-0000-000000000001') $$,
  '42501', null, 'nobody adds a copy for someone else'
);
select lives_ok(
  $$ update public.copies set is_lendable = false, visibility = 'private'
     where id = 'dddddddd-0000-0000-0000-000000000001' $$,
  'the owner edits a copy'
);
select throws_ok(
  $$ update public.copies set edition_id = 'cccccccc-0000-0000-0000-000000000001'
     where id = 'dddddddd-0000-0000-0000-000000000001' $$,
  '42501', null, 'the edition of a copy never changes'
);
select throws_ok(
  $$ update public.copies set owner_id = '33333333-3333-3333-3333-333333333333'
     where id = 'dddddddd-0000-0000-0000-000000000001' $$,
  '42501', null, 'a copy is never handed to another owner by update'
);

-- Carla, active: another account sees and touches nothing. --------------------------

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

select is_empty($$ select id from public.copies $$, 'another account does not see someone else''s copies');
update public.copies set notes = 'mia' where id = 'dddddddd-0000-0000-0000-000000000001';
delete from public.copies where id = 'dddddddd-0000-0000-0000-000000000001';

-- Bruno, pending ----------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select throws_ok(
  $$ insert into public.copies (edition_id) values ('cccccccc-0000-0000-0000-000000000001') $$,
  '42501', null, 'a pending account cannot add copies'
);

-- Anonymous ---------------------------------------------------------------------------

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok($$ select id from public.copies $$, '42501', null, 'anonymous visitors cannot read copies');

-- Back to Ada: Carla's attempts changed nothing. ----------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select results_eq(
  $$ select notes, is_lendable, visibility::text from public.copies where id = 'dddddddd-0000-0000-0000-000000000001' $$,
  $$ values ('Regalo di compleanno'::text, false, 'private') $$,
  'another account could neither edit nor delete the copy'
);

select lives_ok(
  $$ delete from public.copies where id <> 'dddddddd-0000-0000-0000-000000000001' $$,
  'the owner deletes a copy'
);
select is((select count(*)::int from public.copies), 1, 'only the deleted copy is gone');

-- Catalog and account deletion, as the owner of the database ------------------------------

reset role;

select throws_ok(
  $$ delete from public.editions where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  '23503', null, 'an edition with copies stays in the catalog'
);

delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
select is_empty(
  $$ select id from public.copies where owner_id = '11111111-1111-1111-1111-111111111111' $$,
  'deleting the account deletes its copies'
);

select * from finish();

rollback;
