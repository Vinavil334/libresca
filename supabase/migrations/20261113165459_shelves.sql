-- Shelves (F1.7c): how a person arranges their Tana, such as "Comodino" or "Da regalare".
--
-- A shelf holds works, not copies: a book read at the library can sit on a shelf too.
-- A work can sit on several shelves. Shelves are personal; friends may see them from F2.2.

create table public.shelves (
  id uuid primary key default gen_random_uuid(),
  -- Deleting the account deletes its shelves, and with them what they hold.
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (btrim(name) = name and char_length(name) between 1 and 60),
  -- Shelves are "solo tuoi" until friends arrive: private by default.
  visibility public.visibility not null default 'private',
  -- Order chosen by the owner; ties fall back to creation time.
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.shelves is 'Shelves an account arranges its books on. Names are unique per account, ignoring case.';

create index shelves_owner_id_idx on public.shelves (owner_id);
create unique index shelves_owner_name_key on public.shelves (owner_id, lower(name));

create trigger shelves_set_updated_at before update on public.shelves
for each row execute function private.set_updated_at();

create table public.shelf_items (
  shelf_id uuid not null references public.shelves (id) on delete cascade,
  -- A placement is not worth keeping a work for: it goes with the work.
  work_id uuid not null references public.works (id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (shelf_id, work_id)
);

comment on table public.shelf_items is 'Works on a shelf. A work is on a shelf at most once.';

create index shelf_items_work_id_idx on public.shelf_items (work_id);

alter table public.shelves enable row level security;
alter table public.shelf_items enable row level security;

revoke all on table public.shelves from anon, authenticated;
grant select, insert, delete on table public.shelves to authenticated;
-- The owner never changes.
grant update (name, visibility, position) on table public.shelves to authenticated;

revoke all on table public.shelf_items from anon, authenticated;
grant select, insert, delete on table public.shelf_items to authenticated;
grant update (position) on table public.shelf_items to authenticated;

-- Only the owner, and only while the account is active. Friends get read access in F2.2.
create policy "shelves are readable by their owner"
on public.shelves for select
to authenticated
using (owner_id = (select auth.uid()) and (select private.is_active()));

create policy "shelves are created by their owner"
on public.shelves for insert
to authenticated
with check (owner_id = (select auth.uid()) and (select private.is_active()));

create policy "shelves are editable by their owner"
on public.shelves for update
to authenticated
using (owner_id = (select auth.uid()) and (select private.is_active()))
with check (owner_id = (select auth.uid()) and (select private.is_active()));

create policy "shelves are deletable by their owner"
on public.shelves for delete
to authenticated
using (owner_id = (select auth.uid()) and (select private.is_active()));

-- An item belongs to whoever owns its shelf. The subquery runs under the shelves policy,
-- so it also requires an active account.
create policy "shelf items are readable by the shelf owner"
on public.shelf_items for select
to authenticated
using (exists (select 1 from public.shelves s where s.id = shelf_id and s.owner_id = (select auth.uid())));

create policy "shelf items are added by the shelf owner"
on public.shelf_items for insert
to authenticated
with check (exists (select 1 from public.shelves s where s.id = shelf_id and s.owner_id = (select auth.uid())));

create policy "shelf items are reordered by the shelf owner"
on public.shelf_items for update
to authenticated
using (exists (select 1 from public.shelves s where s.id = shelf_id and s.owner_id = (select auth.uid())))
with check (exists (select 1 from public.shelves s where s.id = shelf_id and s.owner_id = (select auth.uid())));

create policy "shelf items are removed by the shelf owner"
on public.shelf_items for delete
to authenticated
using (exists (select 1 from public.shelves s where s.id = shelf_id and s.owner_id = (select auth.uid())));
