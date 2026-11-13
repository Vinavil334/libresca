-- Corrections to the shared catalog (F1.8 follow-up): any active account can fix the card
-- of a work or an edition, as among friends. Like `create_edition`, these functions are
-- the only way to write the catalog; the shape is validated first by `validateWorkEdit`
-- and `validateEditionEdit` in packages/domain, and every changed field is marked as
-- written by a person (`user`) in `field_sources`. Moderation comes with F5.4.

-- Changes a work. Body:
--   {"title", "first_published_year": int | null, "description": text | null,
--    "authors": [{"id": uuid} | {"name", "sort_name"?, "alternate_names"?}]}
-- Errors: 42501 for an account that is not active, P0002 for an unknown work or author,
-- 23514 for values the table refuses.
create function private.update_work(target_work_id uuid, changes jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  current_work public.works%rowtype;
  sources jsonb;
  new_title text := changes ->> 'title';
  new_year smallint := (changes ->> 'first_published_year')::smallint;
  new_description text := changes ->> 'description';
  author_input jsonb;
  author_id uuid;
  new_authors uuid[] := '{}';
  old_authors uuid[];
begin
  if not private.is_active() then
    raise exception 'Only active accounts can correct the catalog' using errcode = '42501';
  end if;
  if jsonb_typeof(changes -> 'authors') is distinct from 'array' then
    raise exception 'A correction needs the list of authors, even an empty one' using errcode = '22023';
  end if;

  select * into current_work from public.works w where w.id = target_work_id and w.merged_into is null for update;
  if not found then
    raise exception 'Unknown work %', target_work_id using errcode = 'P0002';
  end if;

  for author_input in select value from jsonb_array_elements(changes -> 'authors') loop
    if author_input ? 'id' then
      select a.id into author_id from public.authors a
      where a.id = (author_input ->> 'id')::uuid and a.merged_into is null;
      if author_id is null then
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
      returning id into author_id;
    end if;
    if author_id = any (new_authors) then
      raise exception 'The same author twice' using errcode = '23505';
    end if;
    new_authors := new_authors || author_id;
  end loop;

  sources := current_work.field_sources;
  if new_title is distinct from current_work.title then sources := sources || '{"title": "user"}'; end if;
  if new_year is distinct from current_work.first_published_year then
    sources := sources || '{"first_published_year": "user"}';
  end if;
  if new_description is distinct from current_work.description then
    sources := sources || '{"description": "user"}';
  end if;

  select coalesce(array_agg(wa.author_id order by wa.position), '{}') into old_authors
  from public.work_authors wa where wa.work_id = target_work_id;
  if old_authors is distinct from new_authors then
    sources := sources || '{"authors": "user"}';
    delete from public.work_authors where work_id = target_work_id;
    insert into public.work_authors (work_id, author_id, position)
    select target_work_id, a.id, (a.ordinality - 1)::smallint
    from unnest(new_authors) with ordinality as a (id, ordinality);
  end if;

  update public.works
  set title = new_title, first_published_year = new_year, description = new_description, field_sources = sources
  where id = target_work_id;
end;
$$;

-- Changes an edition. Body:
--   {"title", "publisher", "published_year", "page_count", "format", "language": value | null,
--    "translators": [name], "cover_path"?: a new uploaded photo}
-- Other contributors (editors, illustrators) are kept as they are.
create function private.update_edition(target_edition_id uuid, changes jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_edition public.editions%rowtype;
  sources jsonb;
  new_title text := changes ->> 'title';
  new_publisher text := changes ->> 'publisher';
  new_year smallint := (changes ->> 'published_year')::smallint;
  new_pages integer := (changes ->> 'page_count')::integer;
  new_format public.edition_format := (changes ->> 'format')::public.edition_format;
  new_language text := changes ->> 'language';
  new_translators text[];
  old_translators text[];
begin
  if not private.is_active() then
    raise exception 'Only active accounts can correct the catalog' using errcode = '42501';
  end if;
  if jsonb_typeof(changes -> 'translators') is distinct from 'array' then
    raise exception 'A correction needs the list of translators, even an empty one' using errcode = '22023';
  end if;

  select * into current_edition from public.editions e where e.id = target_edition_id for update;
  if not found then
    raise exception 'Unknown edition %', target_edition_id using errcode = 'P0002';
  end if;

  -- As when adding: an edition without its own title takes the work's.
  if new_title is null then
    select w.title into new_title from public.works w where w.id = current_edition.work_id;
  end if;

  sources := current_edition.field_sources;
  if new_title is distinct from current_edition.title then sources := sources || '{"title": "user"}'; end if;
  if new_publisher is distinct from current_edition.publisher then sources := sources || '{"publisher": "user"}'; end if;
  if new_year is distinct from current_edition.published_year then
    sources := sources || '{"published_year": "user"}';
  end if;
  if new_pages is distinct from current_edition.page_count then sources := sources || '{"page_count": "user"}'; end if;
  if new_format is distinct from current_edition.format then sources := sources || '{"format": "user"}'; end if;
  if new_language is distinct from current_edition.language then sources := sources || '{"language": "user"}'; end if;

  new_translators := array(select jsonb_array_elements_text(changes -> 'translators'));
  select coalesce(array_agg(c.name order by c.position), '{}') into old_translators
  from public.contributors c where c.edition_id = target_edition_id and c.role = 'translator';
  if old_translators is distinct from new_translators then
    sources := sources || '{"contributors": "user"}';
    delete from public.contributors where edition_id = target_edition_id and role = 'translator';
    insert into public.contributors (edition_id, name, role, position)
    select target_edition_id, t.name, 'translator', (100 + t.ordinality - 1)::smallint
    from unnest(new_translators) with ordinality as t (name, ordinality);
  end if;

  update public.editions
  set title = new_title,
      publisher = new_publisher,
      published_year = new_year,
      page_count = new_pages,
      format = new_format,
      language = new_language,
      field_sources = sources
  where id = target_edition_id;

  -- A new photo replaces the cover; the old photo, if any, is left for the cleaning job (F4.6).
  if changes ? 'cover_path' then
    update public.editions
    set cover_source = 'upload', cover_id = null, cover_path = changes ->> 'cover_path',
        field_sources = field_sources || '{"cover": "user"}'
    where id = target_edition_id;
  end if;
end;
$$;

revoke all on function private.update_work(uuid, jsonb) from public, anon;
revoke all on function private.update_edition(uuid, jsonb) from public, anon;
grant execute on function private.update_work(uuid, jsonb) to authenticated;
grant execute on function private.update_edition(uuid, jsonb) to authenticated;

-- API entry points. The security definer work stays in the private schema.
create function public.update_work(target_work_id uuid, changes jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.update_work(target_work_id, changes);
$$;

create function public.update_edition(target_edition_id uuid, changes jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.update_edition(target_edition_id, changes);
$$;

revoke all on function public.update_work(uuid, jsonb) from public, anon;
revoke all on function public.update_edition(uuid, jsonb) from public, anon;
grant execute on function public.update_work(uuid, jsonb) to authenticated;
grant execute on function public.update_edition(uuid, jsonb) to authenticated;
