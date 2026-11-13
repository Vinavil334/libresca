-- Shelves (F1.7c): only the owner sees and arranges them, while the account is active.
-- Invented accounts and books only.
begin;

select plan(19);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ada@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bruno@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carla@example.com');
update public.profiles set status = 'active'
where id in ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333');

insert into public.works (id, title) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Il bosco degli scaffali'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'La radura');

-- Constraints, as the owner of the database ------------------------------------

select throws_ok(
  $$ insert into public.shelves (owner_id, name) values ('11111111-1111-1111-1111-111111111111', '') $$,
  '23514', null, 'a shelf has a name'
);
select throws_ok(
  $$ insert into public.shelves (owner_id, name) values ('11111111-1111-1111-1111-111111111111', ' Comodino') $$,
  '23514', null, 'a name has no surrounding spaces'
);

-- Ada, active ----------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.shelves (id, name) values ('eeeeeeee-0000-0000-0000-000000000001', 'Comodino') $$,
  'an active account makes a shelf'
);
select results_eq(
  $$ select owner_id, visibility::text from public.shelves $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid, 'private') $$,
  'the owner is the caller, and a shelf is private by default'
);
select throws_ok(
  $$ insert into public.shelves (name) values ('comodino') $$,
  '23505', null, 'two shelves of the same account never share a name, whatever the case'
);
select throws_ok(
  $$ insert into public.shelves (owner_id, name) values ('33333333-3333-3333-3333-333333333333', 'Di Carla') $$,
  '42501', null, 'nobody makes a shelf for someone else'
);
select lives_ok(
  $$ insert into public.shelf_items (shelf_id, work_id) values
     ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001'),
     ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002') $$,
  'the owner puts books on the shelf'
);
select throws_ok(
  $$ insert into public.shelf_items (shelf_id, work_id)
     values ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  '23505', null, 'a book sits on a shelf once'
);
select lives_ok(
  $$ update public.shelves set name = 'Sul comodino' where id = 'eeeeeeee-0000-0000-0000-000000000001' $$,
  'the owner renames a shelf'
);
select throws_ok(
  $$ update public.shelves set owner_id = '33333333-3333-3333-3333-333333333333'
     where id = 'eeeeeeee-0000-0000-0000-000000000001' $$,
  '42501', null, 'a shelf is never handed to another owner'
);

-- Carla, active: another account sees and touches nothing. --------------------------

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

select is_empty($$ select id from public.shelves $$, 'another account does not see someone else''s shelves');
select is_empty($$ select work_id from public.shelf_items $$, 'nor what is on them');
select throws_ok(
  $$ insert into public.shelf_items (shelf_id, work_id)
     values ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  '42501', null, 'nobody puts books on someone else''s shelf'
);
update public.shelves set name = 'Mio' where id = 'eeeeeeee-0000-0000-0000-000000000001';
delete from public.shelf_items where shelf_id = 'eeeeeeee-0000-0000-0000-000000000001';
delete from public.shelves where id = 'eeeeeeee-0000-0000-0000-000000000001';

-- Bruno, pending ----------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select throws_ok(
  $$ insert into public.shelves (name) values ('In attesa') $$,
  '42501', null, 'a pending account cannot make shelves'
);

-- Anonymous ---------------------------------------------------------------------------

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok($$ select id from public.shelves $$, '42501', null, 'anonymous visitors cannot read shelves');

-- Back to Ada: Carla's attempts changed nothing. ----------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select results_eq(
  $$ select s.name, count(i.work_id)::int from public.shelves s
     left join public.shelf_items i on i.shelf_id = s.id group by s.name $$,
  $$ values ('Sul comodino'::text, 2) $$,
  'another account could neither rename, empty nor delete the shelf'
);
select lives_ok(
  $$ delete from public.shelf_items where work_id = 'aaaaaaaa-0000-0000-0000-000000000002' $$,
  'the owner takes a book off the shelf'
);

-- Catalog and account deletion, as the owner of the database ------------------------------

reset role;

delete from public.works where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is_empty(
  $$ select work_id from public.shelf_items where work_id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  'a work leaving the catalog leaves the shelves too'
);

delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
select is_empty(
  $$ select id from public.shelves where owner_id = '11111111-1111-1111-1111-111111111111' $$,
  'deleting the account deletes its shelves'
);

select * from finish();

rollback;
