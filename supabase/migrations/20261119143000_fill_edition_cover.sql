-- Covers found later (F1.8 follow-up). Imports used to leave Google Books out whenever SBN
-- knew the book, and SBN has no covers: most Italian editions came in without one. This
-- function fills the cover of an edition that has none, from Open Library or Google Books,
-- and does nothing else: a cover already there, or a photo, is never replaced. As with the
-- other catalog writes, any active account may call it; the image is never copied.
--
-- Returns true when the cover was filled, false when the edition already had one.
-- Errors: 42501 for an account that is not active, 22023 for a source or id that is not an
-- Open Library or Google Books cover, P0002 for an unknown edition.
create function private.fill_edition_cover(
  target_edition_id uuid,
  new_cover_source public.cover_source,
  new_cover_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_active() then
    raise exception 'Only active accounts can correct the catalog' using errcode = '42501';
  end if;
  if new_cover_source is null or new_cover_source not in ('openlibrary', 'googlebooks') then
    raise exception 'Only Open Library and Google Books covers can be filled' using errcode = '22023';
  end if;
  -- Open Library cover ids are numbers, Google Books volume ids short URL-safe strings.
  if new_cover_id is null or new_cover_id !~ (
    case new_cover_source when 'openlibrary' then '^[1-9][0-9]{0,11}$' else '^[A-Za-z0-9_-]{1,40}$' end
  ) then
    raise exception 'Not a cover id of %', new_cover_source using errcode = '22023';
  end if;

  update public.editions e
  set cover_source = new_cover_source, cover_id = new_cover_id
  where e.id = target_edition_id and e.cover_source is null and e.cover_path is null;
  if found then
    return true;
  end if;

  if not exists (select 1 from public.editions e where e.id = target_edition_id) then
    raise exception 'Unknown edition %', target_edition_id using errcode = 'P0002';
  end if;
  return false;
end;
$$;

revoke all on function private.fill_edition_cover(uuid, public.cover_source, text) from public, anon;
grant execute on function private.fill_edition_cover(uuid, public.cover_source, text) to authenticated;

-- API entry point. The security definer work stays in the private schema.
create function public.fill_edition_cover(
  target_edition_id uuid,
  new_cover_source public.cover_source,
  new_cover_id text
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.fill_edition_cover(target_edition_id, new_cover_source, new_cover_id);
$$;

revoke all on function public.fill_edition_cover(uuid, public.cover_source, text) from public, anon;
grant execute on function public.fill_edition_cover(uuid, public.cover_source, text) to authenticated;
