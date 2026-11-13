-- Corrections to the catalog: active accounts fix works and editions only through
-- update_work and update_edition, and the changed fields are marked as written by a person.
-- Invented accounts and books only.
begin;

select plan(14);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ada@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bruno@example.com');
update public.profiles set status = 'active' where id = '11111111-1111-1111-1111-111111111111';

insert into public.works (id, title, field_sources) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Le origini del mal', '{"title": "sbn"}');
insert into public.authors (id, name, sort_name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Ada Muskio', 'Muskio, Ada');
insert into public.work_authors (work_id, author_id, position) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 0);
insert into public.editions (id, work_id, title, publisher, field_sources) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Le origini del mal', 'Sottobosco', '{"publisher": "sbn"}');
insert into public.contributors (edition_id, name, role, position) values
  ('cccccccc-0000-0000-0000-000000000001', 'Carla Felce', 'translator', 0),
  ('cccccccc-0000-0000-0000-000000000001', 'Dora Spora', 'illustrator', 1);

-- Bruno, pending ----------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select throws_ok(
  $$ select public.update_work('aaaaaaaa-0000-0000-0000-000000000001', '{"title": "Mio", "authors": []}') $$,
  '42501', null, 'a pending account cannot correct the catalog'
);

-- Ada, active ----------------------------------------------------------------------------

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select throws_ok(
  $$ update public.works set title = 'Diretto' where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  '42501', null, 'nobody writes the catalog directly'
);
select lives_ok(
  $$ select public.update_work('aaaaaaaa-0000-0000-0000-000000000001', '{
       "title": "Le origini del male", "first_published_year": 2016, "description": "Un risveglio.",
       "authors": [{"id": "bbbbbbbb-0000-0000-0000-000000000001"}, {"name": "Bruno Felce", "sort_name": "Felce, Bruno"}]
     }') $$,
  'an active account corrects a work'
);
select results_eq(
  $$ select title, first_published_year::int, description from public.works where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  $$ values ('Le origini del male'::text, 2016, 'Un risveglio.'::text) $$,
  'the work has the new values'
);
select is(
  (select field_sources from public.works where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '{"title": "user", "authors": "user", "description": "user", "first_published_year": "user"}'::jsonb,
  'every changed field is marked as written by a person'
);
select results_eq(
  $$ select a.name from public.work_authors wa join public.authors a on a.id = wa.author_id
     where wa.work_id = 'aaaaaaaa-0000-0000-0000-000000000001' order by wa.position $$,
  $$ values ('Ada Muskio'::text), ('Bruno Felce'::text) $$,
  'authors are kept by id and added in order'
);
select throws_ok(
  $$ select public.update_work('aaaaaaaa-0000-0000-0000-000000000001', '{"title": "", "authors": []}') $$,
  '23514', null, 'the table still refuses an empty title'
);
select throws_ok(
  $$ select public.update_work('aaaaaaaa-0000-0000-0000-000000000009', '{"title": "X", "authors": []}') $$,
  'P0002', null, 'an unknown work is refused'
);

select lives_ok(
  $$ select public.update_edition('cccccccc-0000-0000-0000-000000000001', '{
       "title": null, "publisher": "Edizioni Sottobosco", "published_year": 2019, "page_count": 212,
       "format": "paperback", "language": "it", "translators": ["Carla Felce", "Ezio Muschio"]
     }') $$,
  'an active account corrects an edition'
);
select results_eq(
  $$ select title, publisher, page_count, format::text, language from public.editions
     where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  $$ values ('Le origini del male'::text, 'Edizioni Sottobosco'::text, 212, 'paperback'::text, 'it'::text) $$,
  'the edition has the new values, and without a title it takes the work''s'
);
select results_eq(
  $$ select c.name, c.role::text from public.contributors c
     where c.edition_id = 'cccccccc-0000-0000-0000-000000000001' order by c.role, c.position $$,
  $$ values ('Carla Felce'::text, 'translator'::text), ('Ezio Muschio'::text, 'translator'::text),
            ('Dora Spora'::text, 'illustrator'::text) $$,
  'translators are replaced, other contributors stay'
);
select is(
  (select field_sources ->> 'publisher' from public.editions where id = 'cccccccc-0000-0000-0000-000000000001'),
  'user', 'a corrected source field becomes user'
);
select throws_ok(
  $$ select public.update_edition('cccccccc-0000-0000-0000-000000000001', '{
       "title": null, "publisher": null, "published_year": null, "page_count": null, "format": null,
       "language": null, "translators": [], "cover_path": "not-a-path"
     }') $$,
  '23514', null, 'a cover path of the wrong shape is refused'
);

-- Anonymous ---------------------------------------------------------------------------

reset role;
set local role anon;
select throws_ok(
  $$ select public.update_edition('cccccccc-0000-0000-0000-000000000001', '{"translators": []}') $$,
  '42501', null, 'anonymous visitors cannot correct the catalog'
);

select * from finish();

rollback;
