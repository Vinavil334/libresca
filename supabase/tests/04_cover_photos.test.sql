-- Cover photos (F1.3b): the bucket, who uploads, sees and deletes, and what editions may point to.
-- Invented accounts and files only.
begin;

select plan(16);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ada@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bruno@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'carla@example.com');
update public.profiles set status = 'active'
where id in ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333');

-- The bucket -------------------------------------------------------------------

select results_eq(
  $$ select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'covers' $$,
  $$ values (true, 1048576::bigint, array['image/jpeg']::text[]) $$,
  'covers is a public bucket for small JPEGs'
);

select ok(
  private.is_cover_path('11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-4000-8000-000000000001.jpg'),
  'a path is the account folder and a uuid file name'
);
select ok(not private.is_cover_path('11111111-1111-1111-1111-111111111111/cover.png'), 'any other name is refused');
select ok(not private.is_cover_path('../11111111-1111-1111-1111-111111111111/x.jpg'), 'no relative paths');

-- The catalog accepts only paths of that shape. ---------------------------------

insert into public.works (id, title) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Il bosco fotografato');

select throws_ok(
  $$ insert into public.editions (work_id, title, cover_source, cover_path)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'Il bosco', 'upload', 'https://example.com/cover.jpg') $$,
  '23514', null, 'an edition cannot point to an arbitrary URL'
);

-- Ada, active ----------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('covers', '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-4000-8000-000000000001.jpg'),
            ('covers', '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-4000-8000-000000000002.jpg') $$,
  'an active account uploads into its own folder'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('covers', '33333333-3333-3333-3333-333333333333/aaaaaaaa-0000-4000-8000-000000000003.jpg') $$,
  '42501', null, 'nobody uploads into another account''s folder'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('covers', '11111111-1111-1111-1111-111111111111/copertina.jpg') $$,
  '42501', null, 'the file name must be a uuid'
);

select lives_ok(
  $$ select public.create_edition('{
       "work": {"id": "aaaaaaaa-0000-0000-0000-000000000001"},
       "edition": {"cover_source": "upload",
                   "cover_path": "11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-4000-8000-000000000001.jpg"}
     }'::jsonb) $$,
  'create_edition saves an uploaded cover'
);

select is(
  (select count(*)::int from storage.objects where bucket_id = 'covers'),
  2,
  'an account sees its own covers'
);

-- The Storage API sets this flag before deleting rows; the policy still decides which ones.
set local storage.allow_delete_query = 'true';
delete from storage.objects
where name = '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-4000-8000-000000000001.jpg';
delete from storage.objects
where name = '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-4000-8000-000000000002.jpg';

select results_eq(
  $$ select name from storage.objects where bucket_id = 'covers' $$,
  $$ values ('11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-4000-8000-000000000001.jpg'::text) $$,
  'an unused photo can be deleted, one an edition uses cannot'
);

-- Carla, active: sees nothing of Ada's. ---------------------------------------------

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

select is_empty(
  $$ select name from storage.objects where bucket_id = 'covers' $$,
  'another account does not list someone else''s covers'
);

-- Bruno, pending ------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('covers', '22222222-2222-2222-2222-222222222222/aaaaaaaa-0000-4000-8000-000000000004.jpg') $$,
  '42501', null, 'a pending account cannot upload'
);

-- Anonymous ---------------------------------------------------------------------------

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('covers', '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-4000-8000-000000000005.jpg') $$,
  '42501', null, 'anonymous visitors cannot upload'
);

select is_empty(
  $$ select name from storage.objects where bucket_id = 'covers' $$,
  'anonymous visitors cannot list covers: public URLs are the only way in'
);

reset role;

select ok(
  not has_function_privilege('anon', 'private.is_cover_in_use(text)', 'execute'),
  'anon cannot ask which covers are in use'
);

select * from finish();

rollback;
