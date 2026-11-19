-- Covers found later: fill_edition_cover gives a cover to an edition that has none, only
-- from Open Library or Google Books, never over an existing cover or photo.
-- Invented accounts and books only.
begin;

select plan(12);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ada@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bruno@example.com');
update public.profiles set status = 'active' where id = '11111111-1111-1111-1111-111111111111';

insert into public.works (id, title) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Il bosco dei funghi');
insert into public.editions (id, work_id, title, cover_source, cover_id) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Il bosco dei funghi', null, null),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Il bosco dei funghi', 'openlibrary', '4242');

-- Bruno, pending ----------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select throws_ok(
  $$ select public.fill_edition_cover('cccccccc-0000-0000-0000-000000000001', 'googlebooks', 'vol_Ab-1') $$,
  '42501', null, 'a pending account cannot fill a cover'
);

-- Ada, active ----------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  public.fill_edition_cover('cccccccc-0000-0000-0000-000000000001', 'googlebooks', 'vol_Ab-1'),
  true, 'an active account fills a missing cover'
);
select results_eq(
  $$ select cover_source::text, cover_id from public.editions where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  $$ values ('googlebooks'::text, 'vol_Ab-1'::text) $$,
  'the edition has the new cover'
);
select is(
  public.fill_edition_cover('cccccccc-0000-0000-0000-000000000001', 'openlibrary', '99'),
  false, 'a cover already filled is not replaced'
);
select is(
  public.fill_edition_cover('cccccccc-0000-0000-0000-000000000002', 'googlebooks', 'vol_Zz-9'),
  false, 'an existing cover is not replaced'
);
select results_eq(
  $$ select id::text, cover_source::text, cover_id from public.editions
     where work_id = 'aaaaaaaa-0000-0000-0000-000000000001' order by id $$,
  $$ values ('cccccccc-0000-0000-0000-000000000001'::text, 'googlebooks'::text, 'vol_Ab-1'::text),
            ('cccccccc-0000-0000-0000-000000000002'::text, 'openlibrary'::text, '4242'::text) $$,
  'both covers are as they were'
);
select throws_ok(
  $$ select public.fill_edition_cover('cccccccc-0000-0000-0000-000000000001', 'upload', 'x') $$,
  '22023', null, 'a photo cannot be set this way'
);
select throws_ok(
  $$ select public.fill_edition_cover('cccccccc-0000-0000-0000-000000000001', 'openlibrary', 'abc') $$,
  '22023', null, 'an Open Library cover id is a number'
);
select throws_ok(
  $$ select public.fill_edition_cover('cccccccc-0000-0000-0000-000000000001', 'googlebooks', 'not a volume/id') $$,
  '22023', null, 'a Google Books volume id is a short URL-safe string'
);
select throws_ok(
  $$ select public.fill_edition_cover('cccccccc-0000-0000-0000-000000000009', 'openlibrary', '42') $$,
  'P0002', null, 'an unknown edition is refused'
);
select throws_ok(
  $$ update public.editions set cover_id = '1' where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  '42501', null, 'nobody writes covers directly'
);

-- Anonymous ---------------------------------------------------------------------------

reset role;
set local role anon;
select throws_ok(
  $$ select public.fill_edition_cover('cccccccc-0000-0000-0000-000000000001', 'openlibrary', '42') $$,
  '42501', null, 'anonymous visitors cannot fill covers'
);

select * from finish();

rollback;
