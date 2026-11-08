-- Cover photos (F1.3b): users photograph covers that no source has.
--
-- The bucket is public: a cover is not personal data, public URLs cache well and the
-- future mobile app loads them like Open Library covers. Paths are unguessable
-- ("{user id}/{random uuid}.jpg"), so files are reachable only through an edition.
-- Writing is reserved to active accounts, each in its own folder. The browser resizes
-- the photo to a small JPEG before upload; the limits below refuse anything else.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 1048576, array['image/jpeg']);

-- The shape of an uploaded cover's path, shared by the storage policies and the catalog.
create function private.is_cover_path(path text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$';
$$;

revoke all on function private.is_cover_path(text) from public, anon;
grant execute on function private.is_cover_path(text) to authenticated;

-- Whether an edition uses this photo. Security definer, so the answer does not depend
-- on whether the caller may read the catalog (a suspended account may not).
create function private.is_cover_in_use(path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.editions e where e.cover_path = path);
$$;

revoke all on function private.is_cover_in_use(text) from public, anon;
grant execute on function private.is_cover_in_use(text) to authenticated;

-- An edition only points to a path of that shape: no arbitrary objects, no other buckets.
alter table public.editions
  add constraint editions_cover_path_format check (cover_path is null or private.is_cover_path(cover_path));

-- Active accounts upload into their own folder, with the expected file name.
create policy "active accounts upload covers into their folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'covers'
  and (select private.is_active())
  and private.is_cover_path(objects.name)
  and split_part(objects.name, '/', 1) = (select auth.uid())::text
);

-- Listing and deleting go through SELECT: an account sees only its own files.
-- Public URLs do not need this policy.
create policy "accounts see their own covers"
on storage.objects for select
to authenticated
using (
  bucket_id = 'covers'
  and split_part(objects.name, '/', 1) = (select auth.uid())::text
);

-- An account removes its own photo, for example after replacing it in the form,
-- but never one an edition already uses.
create policy "accounts delete their unused covers"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'covers'
  and split_part(objects.name, '/', 1) = (select auth.uid())::text
  and not private.is_cover_in_use(objects.name)
);

-- is_cover_in_use looks editions up by path.
create index editions_cover_path_idx on public.editions (cover_path) where cover_path is not null;
