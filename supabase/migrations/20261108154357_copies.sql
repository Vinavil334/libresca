-- Owned copies (F1.5): the volumes on a person's shelves. The first personal data.
--
-- A copy belongs to one account and points to an edition of the shared catalog.
-- Owning and reading stay independent: copies never reference readings (DATA_MODEL.md).
-- Format lives on the edition only. Condition and location are left out for now.

-- Who may see a personal row. Friends arrive in F2: until then only the owner reads.
create type public.visibility as enum ('private', 'friends', 'public');

create table public.copies (
  id uuid primary key default gen_random_uuid(),
  -- Deleting the account deletes its copies.
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- An edition with copies cannot disappear from the catalog.
  edition_id uuid not null references public.editions (id) on delete restrict,
  is_lendable boolean not null default true,
  -- A date, not an instant; the domain refuses dates in the future.
  acquired_on date check (acquired_on >= date '1450-01-01'),
  visibility public.visibility not null default 'friends',
  notes text check (btrim(notes) <> '' and char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.copies is 'Volumes owned by an account. Several copies of the same edition are allowed.';

create index copies_owner_id_idx on public.copies (owner_id);
create index copies_edition_id_idx on public.copies (edition_id);

create trigger copies_set_updated_at before update on public.copies
for each row execute function private.set_updated_at();

alter table public.copies enable row level security;

revoke all on table public.copies from anon, authenticated;
grant select, insert, delete on table public.copies to authenticated;
-- The owner and the edition never change: a different book is a different copy.
grant update (is_lendable, acquired_on, visibility, notes) on table public.copies to authenticated;

-- Only the owner, and only while the account is active. Friends get read access in F2.2.
create policy "copies are readable by their owner"
on public.copies for select
to authenticated
using (owner_id = (select auth.uid()) and (select private.is_active()));

create policy "copies are created by their owner"
on public.copies for insert
to authenticated
with check (owner_id = (select auth.uid()) and (select private.is_active()));

create policy "copies are editable by their owner"
on public.copies for update
to authenticated
using (owner_id = (select auth.uid()) and (select private.is_active()))
with check (owner_id = (select auth.uid()) and (select private.is_active()));

create policy "copies are deletable by their owner"
on public.copies for delete
to authenticated
using (owner_id = (select auth.uid()) and (select private.is_active()));
