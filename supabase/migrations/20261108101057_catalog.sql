-- Shared catalog (F1.1, ADR-0002, ADR-0008): works, editions, authors, contributors, external ids.
-- Every active account reads the whole catalog. Nobody writes the tables through the API:
-- new entries go through public.create_edition(), which validates and runs as one transaction.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Types ------------------------------------------------------------------------

-- Where a value or an identifier comes from. 'user' only appears in field_sources.
create type public.metadata_source as enum ('openlibrary', 'googlebooks', 'sbn', 'goodreads', 'user');
-- Where the cover comes from. NULL on an edition means no cover yet.
create type public.cover_source as enum ('openlibrary', 'googlebooks', 'upload', 'generated');
-- 'incomplete' editions are retried later against the open sources (ADR-0008).
create type public.metadata_status as enum ('incomplete', 'complete');
create type public.edition_format as enum ('hardcover', 'paperback', 'ebook', 'audiobook', 'other');
create type public.contributor_role as enum ('translator', 'editor', 'illustrator', 'introduction', 'other');

-- Pure helpers -----------------------------------------------------------------

-- True for a well-formed ISBN-13 with a correct check digit. The app normalises first
-- (packages/domain/src/isbn.ts); this is the last line of defence.
create function private.is_valid_isbn13(isbn text)
returns boolean
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select case
    when isbn !~ '^97[89][0-9]{10}$' then false
    else (
      select (10 - sum(substr(isbn, i, 1)::int * case when i % 2 = 1 then 1 else 3 end) % 10) % 10
      from generate_series(1, 12) as i
    ) = substr(isbn, 13, 1)::int
  end;
$$;

-- field_sources maps a column name to the metadata_source its value came from,
-- for example {"title": "sbn", "page_count": "googlebooks"}. A later job replaces
-- Google Books values with open data, as ADR-0008 requires.
create function private.is_field_sources(value jsonb)
returns boolean
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select jsonb_typeof(value) = 'object'
    and not exists (
      select 1
      from jsonb_each(value) as e
      where jsonb_typeof(e.value) <> 'string'
        or not ((e.value #>> '{}') = any (enum_range(null::public.metadata_source)::text[]))
    );
$$;

-- Lowercase and without accents: "Perché" and "perche" match. unaccent() is only stable,
-- so it is wrapped with an explicit dictionary to be usable in indexes.
create function private.search_text(value text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, value));
$$;

-- An author is found by any of their names, including transliterations.
create function private.author_search_text(name text, alternate_names text[])
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select private.search_text(concat_ws(' ', name, array_to_string(alternate_names, ' ')));
$$;

-- Tables -----------------------------------------------------------------------

create table public.works (
  id uuid primary key default gen_random_uuid(),
  title text not null check (btrim(title) <> '' and char_length(title) <= 500),
  original_title text check (btrim(original_title) <> '' and char_length(original_title) <= 500),
  original_language text check (original_language ~ '^[a-z]{2,3}$'),
  first_published_year smallint check (first_published_year between -3000 and 2100),
  description text check (char_length(description) <= 10000),
  field_sources jsonb not null default '{}' check (private.is_field_sources(field_sources)),
  -- A duplicate points to the work that replaces it, so references never break.
  merged_into uuid references public.works (id) on delete restrict check (merged_into <> id),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Google Books descriptions are shown live, never stored (ADR-0008).
  constraint works_no_googlebooks_description check (field_sources ->> 'description' is distinct from 'googlebooks')
);

create table public.editions (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works (id) on delete restrict,
  title text not null check (btrim(title) <> '' and char_length(title) <= 500),
  -- Unique when present; many older books have none.
  isbn13 text unique check (private.is_valid_isbn13(isbn13)),
  language text check (language ~ '^[a-z]{2,3}$'),
  publisher text check (btrim(publisher) <> '' and char_length(publisher) <= 200),
  published_year smallint check (published_year between 1450 and 2100),
  format public.edition_format,
  page_count integer check (page_count between 1 and 100000),
  cover_source public.cover_source,
  -- Open Library cover id or Google Books volume id: the image is never copied.
  cover_id text check (btrim(cover_id) <> '' and char_length(cover_id) <= 100),
  -- Path in Supabase Storage for an uploaded photo.
  cover_path text check (btrim(cover_path) <> '' and char_length(cover_path) <= 500),
  metadata_status public.metadata_status not null default 'incomplete',
  field_sources jsonb not null default '{}' check (private.is_field_sources(field_sources)),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint editions_cover_reference check (
    case cover_source
      when 'openlibrary' then cover_id is not null
      when 'googlebooks' then cover_id is not null
      when 'upload' then cover_path is not null
      else true
    end
  )
);

create table public.authors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> '' and char_length(name) <= 200),
  -- "Eco, Umberto": proposed by packages/domain, editable.
  sort_name text not null check (btrim(sort_name) <> '' and char_length(sort_name) <= 200),
  -- Transliterations and original scripts: Open Library writes some authors in their alphabet.
  alternate_names text[] not null default '{}' check (array_position(alternate_names, null) is null),
  merged_into uuid references public.authors (id) on delete restrict check (merged_into <> id),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.work_authors (
  work_id uuid not null references public.works (id) on delete cascade,
  author_id uuid not null references public.authors (id) on delete restrict,
  position smallint not null check (position >= 0),
  primary key (work_id, author_id),
  unique (work_id, position)
);

-- Translators and editors belong to the edition: they matter a lot in Italian publishing.
create table public.contributors (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  name text not null check (btrim(name) <> '' and char_length(name) <= 200),
  role public.contributor_role not null,
  position smallint not null default 0 check (position >= 0),
  unique (edition_id, role, name)
);

-- Identifiers at the sources, with provenance. Each row belongs to exactly one work, edition or author.
create table public.external_ids (
  id uuid primary key default gen_random_uuid(),
  work_id uuid references public.works (id) on delete cascade,
  edition_id uuid references public.editions (id) on delete cascade,
  author_id uuid references public.authors (id) on delete cascade,
  source public.metadata_source not null check (source <> 'user'),
  value text not null check (btrim(value) <> '' and char_length(value) <= 200),
  raw jsonb,
  created_at timestamptz not null default now(),
  constraint external_ids_one_target check (num_nonnulls(work_id, edition_id, author_id) = 1),
  -- Google Books: only the volume id of an edition, never the payload (ADR-0008).
  constraint external_ids_googlebooks_id_only check (source <> 'googlebooks' or (raw is null and edition_id is not null))
);

-- Indexes ----------------------------------------------------------------------

create index editions_work_id_idx on public.editions (work_id);
create index works_merged_into_idx on public.works (merged_into) where merged_into is not null;
create index authors_merged_into_idx on public.authors (merged_into) where merged_into is not null;
create index work_authors_author_id_idx on public.work_authors (author_id);
create index contributors_edition_id_idx on public.contributors (edition_id);
create index external_ids_work_id_idx on public.external_ids (work_id) where work_id is not null;
create index external_ids_edition_id_idx on public.external_ids (edition_id) where edition_id is not null;
create index external_ids_author_id_idx on public.external_ids (author_id) where author_id is not null;

-- The same source id cannot point to two works, two editions or two authors.
create unique index external_ids_work_source_value_key on public.external_ids (source, value) where work_id is not null;
create unique index external_ids_edition_source_value_key on public.external_ids (source, value) where edition_id is not null;
create unique index external_ids_author_source_value_key on public.external_ids (source, value) where author_id is not null;

-- Accent-insensitive search on titles and every name of an author.
create index works_title_search_idx on public.works using gin (private.search_text(title) extensions.gin_trgm_ops);
create index editions_title_search_idx on public.editions using gin (private.search_text(title) extensions.gin_trgm_ops);
create index authors_name_search_idx on public.authors
  using gin (private.author_search_text(name, alternate_names) extensions.gin_trgm_ops);

-- Timestamps -------------------------------------------------------------------

create trigger works_set_updated_at before update on public.works
for each row execute function private.set_updated_at();
create trigger editions_set_updated_at before update on public.editions
for each row execute function private.set_updated_at();
create trigger authors_set_updated_at before update on public.authors
for each row execute function private.set_updated_at();

-- Access -----------------------------------------------------------------------
-- Read-only for active accounts; writes only through the functions below.

alter table public.works enable row level security;
alter table public.editions enable row level security;
alter table public.authors enable row level security;
alter table public.work_authors enable row level security;
alter table public.contributors enable row level security;
alter table public.external_ids enable row level security;

revoke all on table public.works, public.editions, public.authors, public.work_authors, public.contributors, public.external_ids
from anon, authenticated;
grant select on table public.works, public.editions, public.authors, public.work_authors, public.contributors, public.external_ids
to authenticated;

create policy "works are readable by active accounts"
on public.works for select to authenticated using ((select private.is_active()));

create policy "editions are readable by active accounts"
on public.editions for select to authenticated using ((select private.is_active()));

create policy "authors are readable by active accounts"
on public.authors for select to authenticated using ((select private.is_active()));

create policy "work authors are readable by active accounts"
on public.work_authors for select to authenticated using ((select private.is_active()));

create policy "contributors are readable by active accounts"
on public.contributors for select to authenticated using ((select private.is_active()));

create policy "external ids are readable by active accounts"
on public.external_ids for select to authenticated using ((select private.is_active()));

-- Writing ----------------------------------------------------------------------

-- Inserts a list of {source, value, raw?} for one target. Only called by create_edition.
create function private.add_external_ids(ids jsonb, target_work uuid, target_edition uuid, target_author uuid)
returns void
language sql
set search_path = ''
as $$
  insert into public.external_ids (work_id, edition_id, author_id, source, value, raw)
  select
    target_work,
    target_edition,
    target_author,
    (e ->> 'source')::public.metadata_source,
    e ->> 'value',
    nullif(e -> 'raw', 'null'::jsonb)
  from jsonb_array_elements(coalesce(ids, '[]'::jsonb)) as e;
$$;

revoke all on function private.add_external_ids(jsonb, uuid, uuid, uuid) from public, anon, authenticated;

-- Adds an edition, with a new work or an existing one, in a single transaction.
-- The shape is validated first by validateCatalogEntry in packages/domain:
--   {
--     "work": {"id": uuid}
--           | {"title", "original_title"?, "original_language"?, "first_published_year"?,
--              "description"?, "field_sources"?, "external_ids"?,
--              "authors": [{"id": uuid} | {"name", "sort_name"?, "alternate_names"?, "external_ids"?}]},
--     "edition": {"title"?, "isbn13"?, "language"?, "publisher"?, "published_year"?, "format"?,
--                 "page_count"?, "cover_source"?, "cover_id"?, "cover_path"?, "metadata_status"?,
--                 "field_sources"?, "contributors"?: [{"name", "role"}], "external_ids"?}
--   }
-- Returns {"work_id", "edition_id"}. Errors keep their SQLSTATE: 23505 for an ISBN already
-- in the catalog, 23514 or 23502 for invalid values, P0002 for an unknown work or author.
create function private.create_edition(entry jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  work_input jsonb := entry -> 'work';
  edition_input jsonb := entry -> 'edition';
  target_work_id uuid;
  target_work_title text;
  target_author_id uuid;
  new_edition_id uuid;
  author_input jsonb;
  author_index integer := 0;
begin
  if not private.is_active() then
    raise exception 'Only active accounts can add to the catalog' using errcode = '42501';
  end if;

  if jsonb_typeof(work_input) is distinct from 'object' or jsonb_typeof(edition_input) is distinct from 'object' then
    raise exception 'The entry needs a work and an edition' using errcode = '22023';
  end if;

  if work_input ? 'id' then
    select w.id, w.title into target_work_id, target_work_title
    from public.works w
    where w.id = (work_input ->> 'id')::uuid and w.merged_into is null;

    if target_work_id is null then
      raise exception 'Unknown work %', work_input ->> 'id' using errcode = 'P0002';
    end if;
  else
    if jsonb_typeof(work_input -> 'authors') is distinct from 'array' then
      raise exception 'A new work needs a list of authors, even an empty one' using errcode = '22023';
    end if;

    insert into public.works (
      title, original_title, original_language, first_published_year, description, field_sources, created_by
    ) values (
      work_input ->> 'title',
      work_input ->> 'original_title',
      work_input ->> 'original_language',
      (work_input ->> 'first_published_year')::smallint,
      work_input ->> 'description',
      coalesce(work_input -> 'field_sources', '{}'::jsonb),
      caller
    )
    returning id, title into target_work_id, target_work_title;

    for author_input in select value from jsonb_array_elements(work_input -> 'authors') loop
      if author_input ? 'id' then
        select a.id into target_author_id
        from public.authors a
        where a.id = (author_input ->> 'id')::uuid and a.merged_into is null;

        if target_author_id is null then
          raise exception 'Unknown author %', author_input ->> 'id' using errcode = 'P0002';
        end if;
      else
        insert into public.authors (name, sort_name, alternate_names, created_by)
        values (
          author_input ->> 'name',
          coalesce(author_input ->> 'sort_name', author_input ->> 'name'),
          array(select jsonb_array_elements_text(coalesce(author_input -> 'alternate_names', '[]'::jsonb))),
          caller
        )
        returning id into target_author_id;

        perform private.add_external_ids(author_input -> 'external_ids', null, null, target_author_id);
      end if;

      insert into public.work_authors (work_id, author_id, position)
      values (target_work_id, target_author_id, author_index);
      author_index := author_index + 1;
    end loop;

    perform private.add_external_ids(work_input -> 'external_ids', target_work_id, null, null);
  end if;

  insert into public.editions (
    work_id, title, isbn13, language, publisher, published_year, format, page_count,
    cover_source, cover_id, cover_path, metadata_status, field_sources, created_by
  ) values (
    target_work_id,
    coalesce(edition_input ->> 'title', target_work_title),
    edition_input ->> 'isbn13',
    edition_input ->> 'language',
    edition_input ->> 'publisher',
    (edition_input ->> 'published_year')::smallint,
    (edition_input ->> 'format')::public.edition_format,
    (edition_input ->> 'page_count')::integer,
    (edition_input ->> 'cover_source')::public.cover_source,
    edition_input ->> 'cover_id',
    edition_input ->> 'cover_path',
    coalesce((edition_input ->> 'metadata_status')::public.metadata_status, 'incomplete'),
    coalesce(edition_input -> 'field_sources', '{}'::jsonb),
    caller
  )
  returning id into new_edition_id;

  insert into public.contributors (edition_id, name, role, position)
  select new_edition_id, c.value ->> 'name', (c.value ->> 'role')::public.contributor_role, (c.ordinality - 1)::smallint
  from jsonb_array_elements(coalesce(edition_input -> 'contributors', '[]'::jsonb)) with ordinality as c;

  perform private.add_external_ids(edition_input -> 'external_ids', null, new_edition_id, null);

  return jsonb_build_object('work_id', target_work_id, 'edition_id', new_edition_id);
end;
$$;

revoke all on function private.create_edition(jsonb) from public, anon;
grant execute on function private.create_edition(jsonb) to authenticated;

-- API entry point. The security definer work stays in the private schema.
create function public.create_edition(entry jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.create_edition(entry);
$$;

revoke all on function public.create_edition(jsonb) from public, anon;
grant execute on function public.create_edition(jsonb) to authenticated;

-- Searching --------------------------------------------------------------------

-- Works whose title, edition titles or author names contain the query or resemble it,
-- ignoring case and accents. Runs with the caller's rights, so RLS applies.
-- Exact substrings rank above fuzzy matches. Queries shorter than 2 characters return nothing.
create function public.search_works(query text, max_results integer default 20)
returns setof public.works
language sql
stable
security invoker
set search_path = ''
as $$
  with term as (
    select
      t.normalized,
      '%' || replace(replace(replace(t.normalized, '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern
    from (select private.search_text(btrim(coalesce(query, ''))) as normalized) as t
    where char_length(t.normalized) >= 2
  ),
  hits as (
    select w.id as work_id, private.search_text(w.title) as haystack
    from public.works w, term
    where private.search_text(w.title) like term.pattern
       or term.normalized operator(extensions.<%) private.search_text(w.title)
    union all
    select e.work_id, private.search_text(e.title)
    from public.editions e, term
    where private.search_text(e.title) like term.pattern
       or term.normalized operator(extensions.<%) private.search_text(e.title)
    union all
    select wa.work_id, private.author_search_text(a.name, a.alternate_names)
    from public.authors a
    join public.work_authors wa on wa.author_id = a.id
    cross join term
    where private.author_search_text(a.name, a.alternate_names) like term.pattern
       or term.normalized operator(extensions.<%) private.author_search_text(a.name, a.alternate_names)
  ),
  ranked as (
    select
      h.work_id,
      max(
        (case when h.haystack like term.pattern then 1 else 0 end)
        + extensions.word_similarity(term.normalized, h.haystack)
      ) as score
    from hits h, term
    group by h.work_id
  )
  select w.*
  from ranked r
  join public.works w on w.id = r.work_id
  where w.merged_into is null
  order by r.score desc, w.title
  limit least(greatest(coalesce(max_results, 20), 1), 50);
$$;

revoke all on function public.search_works(text, integer) from public, anon;
grant execute on function public.search_works(text, integer) to authenticated;
