-- Imports (F1.8): only the owner sees and changes jobs and rows; the shared cache of the
-- open sources is reachable only through its functions, by active accounts.
-- Invented accounts and books only.
begin;

select plan(18);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ada@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bruno@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carla@example.com');
update public.profiles set status = 'active'
where id in ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333');

-- Ada, active ----------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.import_jobs (id, source) values ('99999999-0000-0000-0000-000000000001', 'goodreads') $$,
  'an active account starts an import'
);
select throws_ok(
  $$ insert into public.import_jobs (source) values ('librarything') $$,
  '23514', null, 'only known sources'
);
select lives_ok(
  $$ insert into public.import_rows (job_id, line, source_key, raw) values
     ('99999999-0000-0000-0000-000000000001', 2, '101', '{"title": "La topina"}'),
     ('99999999-0000-0000-0000-000000000001', 3, '102', '{"title": "La radura"}') $$,
  'the owner adds the rows of the file'
);
select throws_ok(
  $$ insert into public.import_rows (job_id, line, source_key, raw)
     values ('99999999-0000-0000-0000-000000000001', 4, '101', '{}') $$,
  '23505', null, 'a book is in a job once'
);
select lives_ok(
  $$ update public.import_rows set status = 'review', candidates = '[]' where source_key = '101' $$,
  'the owner records what happened to a row'
);
select throws_ok(
  $$ update public.import_rows set raw = '{}' where source_key = '101' $$,
  '42501', null, 'the parsed row never changes'
);
select throws_ok(
  $$ update public.import_rows set status = 'lost' where source_key = '101' $$,
  '23514', null, 'a row has a known status'
);

-- The shared cache ---------------------------------------------------------------------

select lives_ok(
  $$ select public.metadata_cache_put('https://openlibrary.org/api/books?bibkeys=ISBN:9791234567896',
       '{"status": "ok", "data": {"title": "La radura"}}', 3600) $$,
  'an active account caches an open source response'
);
select is(
  public.metadata_cache_get('https://openlibrary.org/api/books?bibkeys=ISBN:9791234567896')->>'status',
  'ok', 'and reads it back'
);
select throws_ok(
  $$ select public.metadata_cache_put('https://www.googleapis.com/books/v1/volumes?q=isbn:1', '{"status": "ok"}', 3600) $$,
  '23514', null, 'Google Books is never cached'
);
select throws_ok(
  $$ select public.metadata_cache_put('https://openlibrary.org/x', '{"status": "unavailable"}', 3600) $$,
  '22023', null, 'a failure is not cached'
);
select throws_ok($$ select url from private.metadata_cache $$, '42501', null, 'the cache table is out of reach');

-- Carla, active: another account sees and touches nothing of Ada's import. -------------

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

select is_empty($$ select id from public.import_jobs $$, 'another account does not see someone else''s imports');
select is_empty($$ select id from public.import_rows $$, 'nor their rows');
select throws_ok(
  $$ insert into public.import_rows (job_id, line, source_key, raw)
     values ('99999999-0000-0000-0000-000000000001', 9, '999', '{}') $$,
  '42501', null, 'nobody adds rows to someone else''s import'
);
select is(
  public.metadata_cache_get('https://openlibrary.org/api/books?bibkeys=ISBN:9791234567896')->>'status',
  'ok', 'the cache is shared among active accounts'
);

-- Bruno, pending ----------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select is(
  public.metadata_cache_get('https://openlibrary.org/api/books?bibkeys=ISBN:9791234567896'),
  null, 'a pending account reads nothing from the cache'
);

-- Account deletion, as the owner of the database ----------------------------------------

reset role;

delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
select is_empty(
  $$ select id from public.import_rows where job_id = '99999999-0000-0000-0000-000000000001' $$,
  'deleting the account deletes its imports and their rows'
);

select * from finish();

rollback;
