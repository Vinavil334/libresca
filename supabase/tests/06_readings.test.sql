-- Readings (F1.6): the rules on statuses, dates and ratings, one open reading per work,
-- and owner-only access while the account is active. Invented accounts and books only.
begin;

select plan(20);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ada@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bruno@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carla@example.com');
update public.profiles set status = 'active'
where id in ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333');

insert into public.works (id, title) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Il bosco delle letture'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Un altro bosco');
insert into public.editions (id, work_id, title) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Il bosco delle letture'),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Un altro bosco');

-- Rules, as the owner of the database so only the constraint can refuse -------------

select throws_ok(
  $$ insert into public.readings (user_id, work_id, status, started_on)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'want', '2024-01-01') $$,
  '23514', null, 'a book in the Dispensa has no dates'
);
select throws_ok(
  $$ insert into public.readings (user_id, work_id, status, finished_on)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'reading', '2024-01-01') $$,
  '23514', null, 'a reading in progress has no end date'
);
select throws_ok(
  $$ insert into public.readings (user_id, work_id, status, rating_half)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'want', 8) $$,
  '23514', null, 'a book not read yet has no rating'
);
select throws_ok(
  $$ insert into public.readings (user_id, work_id, status, rating_half)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'read', 11) $$,
  '23514', null, 'a rating goes from half a mushroom to five'
);
select throws_ok(
  $$ insert into public.readings (user_id, work_id, status, started_on, finished_on)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'read', '2024-02-01', '2024-01-01') $$,
  '23514', null, 'a reading does not end before it starts'
);
select throws_ok(
  $$ insert into public.readings (user_id, work_id, edition_id, status)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001',
             'cccccccc-0000-0000-0000-000000000002', 'read') $$,
  '23514', null, 'the edition read must be an edition of the work'
);

-- Ada, active ----------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.readings (id, work_id, edition_id, status)
     values ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
             'cccccccc-0000-0000-0000-000000000001', 'want') $$,
  'an active account puts a book in the Dispensa'
);
select throws_ok(
  $$ insert into public.readings (work_id, status) values ('aaaaaaaa-0000-0000-0000-000000000001', 'reading') $$,
  '23505', null, 'only one open reading per book: starting it updates the Dispensa row'
);
select lives_ok(
  $$ update public.readings set status = 'read', started_on = '2024-03-01', finished_on = '2024-03-20', rating_half = 9,
       review = 'Una topina indimenticabile'
     where id = 'eeeeeeee-0000-0000-0000-000000000001' $$,
  'the owner finishes and rates the reading'
);
select lives_ok(
  $$ insert into public.readings (work_id, status, started_on) values ('aaaaaaaa-0000-0000-0000-000000000001', 'reading', '2025-01-10') $$,
  'a reread is a new row once the first reading is closed'
);
select is(
  (select count(*)::int from public.readings where work_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  2,
  'the owner sees both readings of the book'
);
select throws_ok(
  $$ update public.readings set work_id = 'aaaaaaaa-0000-0000-0000-000000000002'
     where id = 'eeeeeeee-0000-0000-0000-000000000001' $$,
  '42501', null, 'the work of a reading never changes'
);
select throws_ok(
  $$ insert into public.readings (user_id, work_id, status)
     values ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000002', 'want') $$,
  '42501', null, 'nobody adds a reading for someone else'
);

-- Carla, active: sees and touches nothing of Ada's. ------------------------------------

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

select is_empty($$ select id from public.readings $$, 'another account does not see someone else''s readings');
update public.readings set rating_half = 1 where id = 'eeeeeeee-0000-0000-0000-000000000001';
delete from public.readings where id = 'eeeeeeee-0000-0000-0000-000000000001';
select lives_ok(
  $$ insert into public.readings (work_id, status) values ('aaaaaaaa-0000-0000-0000-000000000001', 'want') $$,
  'one open reading per book is per person: Carla has her own'
);

-- Bruno, pending ------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select throws_ok(
  $$ insert into public.readings (work_id, status) values ('aaaaaaaa-0000-0000-0000-000000000002', 'want') $$,
  '42501', null, 'a pending account cannot add readings'
);

-- Anonymous -----------------------------------------------------------------------------

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok($$ select id from public.readings $$, '42501', null, 'anonymous visitors cannot read readings');

-- Back to Ada: Carla's attempts changed nothing. ------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select results_eq(
  $$ select status::text, rating_half::int, review from public.readings where id = 'eeeeeeee-0000-0000-0000-000000000001' $$,
  $$ values ('read', 9, 'Una topina indimenticabile'::text) $$,
  'another account could neither edit nor delete the reading'
);

-- Catalog and account deletion, as the owner of the database ----------------------------

reset role;

-- A work without editions, so only the reading can hold it in place.
insert into public.works (id, title) values ('aaaaaaaa-0000-0000-0000-000000000003', 'Un bosco senza edizioni');
insert into public.readings (user_id, work_id, status)
values ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000003', 'want');
select throws_ok(
  $$ delete from public.works where id = 'aaaaaaaa-0000-0000-0000-000000000003' $$,
  '23503', null, 'a work with readings stays in the catalog'
);

delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
select is_empty(
  $$ select id from public.readings where user_id = '11111111-1111-1111-1111-111111111111' $$,
  'deleting the account deletes its readings'
);

select * from finish();

rollback;
