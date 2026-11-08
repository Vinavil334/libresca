-- Shared catalog (F1.1): who reads it, how it is written, what the constraints refuse, how it is searched.
-- All books and people are invented or public bibliographic facts; no real user data.
begin;

select plan(38);

-- Accounts: Ada active, Bruno pending. ------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ada@example.com', '{"full_name": "Ada Funghetti"}'),
  ('22222222-2222-2222-2222-222222222222', 'bruno@example.com', '{"name": "Bruno Muschio"}');
update public.profiles set status = 'active' where id = '11111111-1111-1111-1111-111111111111';

-- A seeded work, added as the database owner. ----------------------------------

insert into public.works (id, title, original_language, first_published_year) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Delitto e castigo', 'ru', 1866);
insert into public.authors (id, name, sort_name, alternate_names) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Fëdor Dostoevskij', 'Dostoevskij, Fëdor', '{"Фёдор Достоевский", "Fyodor Dostoevsky"}');
insert into public.work_authors (work_id, author_id, position) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 0);
insert into public.editions (id, work_id, title, isbn13, language) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Crime and Punishment', '9780140449136', 'en');
insert into public.works (id, title, merged_into) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Delitto & castigo', 'aaaaaaaa-0000-0000-0000-000000000001');

-- Pure helpers -----------------------------------------------------------------

select ok(private.is_valid_isbn13('9788845292613'), 'a correct ISBN-13 is valid');
select ok(not private.is_valid_isbn13('9788845292614'), 'a wrong check digit is invalid');
select ok(not private.is_valid_isbn13('8845292614'), 'an ISBN-10 is not stored as is');
select is(private.search_text('Perché FËDOR'), 'perche fedor', 'search text ignores case and accents');

-- Constraints, checked as the owner so only the constraint can refuse. ---------

select throws_ok(
  $$ insert into public.external_ids (work_id, edition_id, source, value)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'openlibrary', 'OL1W') $$,
  '23514', null, 'an external id belongs to exactly one work, edition or author'
);

select throws_ok(
  $$ insert into public.external_ids (edition_id, source, value, raw)
     values ('cccccccc-0000-0000-0000-000000000001', 'googlebooks', 'abc123', '{"volumeInfo": {}}') $$,
  '23514', null, 'a Google Books id is never stored with its payload'
);

select throws_ok(
  $$ insert into public.external_ids (work_id, source, value)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'googlebooks', 'abc123') $$,
  '23514', null, 'a Google Books id belongs to an edition'
);

select throws_ok(
  $$ update public.works set merged_into = id where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  '23514', null, 'a work cannot be merged into itself'
);

select throws_ok(
  $$ delete from public.works where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  '23503', null, 'a work with editions cannot be deleted'
);

-- Active account: Ada ------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select results_eq(
  $$ select title from public.works where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  $$ values ('Delitto e castigo') $$,
  'an active account reads works'
);

select isnt_empty($$ select 1 from public.editions $$, 'an active account reads editions');
select isnt_empty($$ select 1 from public.authors $$, 'an active account reads authors');
select isnt_empty($$ select 1 from public.work_authors $$, 'an active account reads work authors');

select throws_ok(
  $$ insert into public.works (title) values ('Scritto di nascosto') $$,
  '42501', null, 'works cannot be inserted directly'
);

select throws_ok(
  $$ update public.editions set page_count = 1 $$,
  '42501', null, 'editions cannot be updated directly'
);

select throws_ok(
  $$ delete from public.authors $$,
  '42501', null, 'authors cannot be deleted directly'
);

-- A new work, two new authors, a translator and external ids, in one call.
select lives_ok(
  $$ select public.create_edition('{
       "work": {
         "title": "Il nome della rosa",
         "original_language": "it",
         "first_published_year": 1980,
         "description": "Un giallo in un monastero.",
         "field_sources": {"title": "sbn", "description": "openlibrary"},
         "external_ids": [{"source": "openlibrary", "value": "OL99W"}],
         "authors": [
           {"name": "Umberto Eco", "sort_name": "Eco, Umberto", "external_ids": [{"source": "openlibrary", "value": "OL99A"}]},
           {"name": "Autrice Inventata", "alternate_names": ["Inventata Autrice"]}
         ]
       },
       "edition": {
         "isbn13": "9788845292613",
         "language": "it",
         "publisher": "Bompiani",
         "published_year": 2012,
         "format": "paperback",
         "page_count": 624,
         "cover_source": "openlibrary",
         "cover_id": "123456",
         "field_sources": {"page_count": "sbn"},
         "contributors": [{"name": "Traduttrice Inventata", "role": "translator"}],
         "external_ids": [{"source": "googlebooks", "value": "vol123"}, {"source": "sbn", "value": "IT\\ICCU\\X\\1", "raw": {"bid": "X1"}}]
       }
     }'::jsonb) $$,
  'an active account adds an edition with a new work'
);

select results_eq(
  $$ select w.title, e.title, e.created_by, w.created_by
     from public.editions e join public.works w on w.id = e.work_id
     where e.isbn13 = '9788845292613' $$,
  $$ values ('Il nome della rosa', 'Il nome della rosa', '11111111-1111-1111-1111-111111111111'::uuid, '11111111-1111-1111-1111-111111111111'::uuid) $$,
  'the edition takes the work title when it has none, and both record who added them'
);

select results_eq(
  $$ select a.name, a.sort_name, wa.position
     from public.work_authors wa
     join public.authors a on a.id = wa.author_id
     join public.editions e on e.work_id = wa.work_id
     where e.isbn13 = '9788845292613'
     order by wa.position $$,
  $$ values ('Umberto Eco', 'Eco, Umberto', 0::smallint), ('Autrice Inventata', 'Autrice Inventata', 1::smallint) $$,
  'authors keep their order; the sort name falls back to the name'
);

select results_eq(
  $$ select c.name, c.role::text
     from public.contributors c join public.editions e on e.id = c.edition_id
     where e.isbn13 = '9788845292613' $$,
  $$ values ('Traduttrice Inventata', 'translator') $$,
  'the translator is stored on the edition'
);

select is(
  (select count(*)::int from public.external_ids where value in ('OL99W', 'OL99A', 'vol123', 'IT\ICCU\X\1')),
  4,
  'external ids are stored for the work, the author and the edition'
);

-- A second edition of an existing work.
select lives_ok(
  $$ select public.create_edition('{
       "work": {"id": "aaaaaaaa-0000-0000-0000-000000000001"},
       "edition": {"title": "Delitto e castigo", "isbn13": "9788806219352", "language": "it"}
     }'::jsonb) $$,
  'an active account adds an edition to an existing work'
);

select is(
  (select count(*)::int from public.editions where work_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  2,
  'the work now has two editions'
);

-- An existing author on a new work.
select lives_ok(
  $$ select public.create_edition('{
       "work": {"title": "Le notti bianche", "authors": [{"id": "bbbbbbbb-0000-0000-0000-000000000001"}]},
       "edition": {"isbn13": "9788804668237"}
     }'::jsonb) $$,
  'a new work can reuse an existing author'
);

select throws_ok(
  $$ select public.create_edition('{"work": {"id": "aaaaaaaa-0000-0000-0000-000000000001"}, "edition": {"isbn13": "9788845292613"}}'::jsonb) $$,
  '23505', null, 'an ISBN already in the catalog is refused'
);

select throws_ok(
  $$ select public.create_edition('{"work": {"id": "aaaaaaaa-0000-0000-0000-000000000001"}, "edition": {"isbn13": "9788845292614"}}'::jsonb) $$,
  '23514', null, 'an ISBN with a wrong check digit is refused'
);

select throws_ok(
  $$ select public.create_edition('{"work": {"id": "aaaaaaaa-0000-0000-0000-000000000002"}, "edition": {}}'::jsonb) $$,
  'P0002', null, 'a merged work cannot receive new editions'
);

select throws_ok(
  $$ select public.create_edition('{"work": {"title": "Senza fonte", "authors": [], "field_sources": {"description": "googlebooks"}}, "edition": {}}'::jsonb) $$,
  '23514', null, 'a description from Google Books is refused'
);

select throws_ok(
  $$ select public.create_edition('{"work": {"title": "Fonte strana", "authors": [], "field_sources": {"title": "wikipedia"}}, "edition": {}}'::jsonb) $$,
  '23514', null, 'an unknown field source is refused'
);

select throws_ok(
  $$ select public.create_edition('{"work": {"title": "Foto mancante", "authors": []}, "edition": {"cover_source": "upload"}}'::jsonb) $$,
  '23514', null, 'an uploaded cover needs its storage path'
);

select is_empty(
  $$ select 1 from public.works where title in ('Senza fonte', 'Fonte strana', 'Foto mancante') $$,
  'a refused entry leaves no work behind'
);

-- Search: accents, alternate names, edition titles, merged works.
select results_eq(
  $$ select title from public.search_works('dostoevsky') $$,
  $$ values ('Delitto e castigo'), ('Le notti bianche') $$,
  'search finds works by an alternate spelling of the author'
);

select results_eq(
  $$ select title from public.search_works('crime and punishment') $$,
  $$ values ('Delitto e castigo') $$,
  'search finds a work by the title of one of its editions, and skips merged works'
);

select results_eq(
  $$ select title from public.search_works('NOME DELLA ROSA') $$,
  $$ values ('Il nome della rosa') $$,
  'search ignores case'
);

select is_empty($$ select 1 from public.search_works('d') $$, 'a one-letter query returns nothing');

-- Pending account: Bruno ---------------------------------------------------------

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select is_empty($$ select 1 from public.works $$, 'a pending account reads no works');

select throws_ok(
  $$ select public.create_edition('{"work": {"title": "Di nascosto", "authors": []}, "edition": {}}'::jsonb) $$,
  '42501', null, 'a pending account cannot add to the catalog'
);

-- Anonymous ----------------------------------------------------------------------

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok($$ select * from public.editions $$, '42501', null, 'anonymous visitors cannot read the catalog');

select * from finish();

rollback;
