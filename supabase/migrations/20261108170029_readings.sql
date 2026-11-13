-- Readings (F1.6): what a person wants to read, is reading, has read or abandoned.
--
-- Every reading is an event: a reread is a new row with its own dates and rating
-- (DATA_MODEL.md). At most one reading per work is "open" (want or reading). Readings
-- never reference copies: owning and reading stay independent. Dates are exact and
-- optional; the domain refuses dates in the future.

create type public.reading_status as enum ('want', 'reading', 'read', 'abandoned');

create table public.readings (
  id uuid primary key default gen_random_uuid(),
  -- Deleting the account deletes its readings.
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Ratings and readings belong to the work (ADR-0002).
  work_id uuid not null references public.works (id) on delete restrict,
  -- The edition read, when known; it must be an edition of the work.
  edition_id uuid references public.editions (id) on delete set null,
  status public.reading_status not null,
  started_on date check (started_on >= date '1450-01-01'),
  finished_on date check (finished_on >= date '1450-01-01'),
  -- Half mushrooms, 1 to 10. NULL means no rating, which is not a low rating.
  rating_half smallint check (rating_half between 1 and 10),
  review text check (btrim(review) <> '' and char_length(review) <= 5000),
  visibility public.visibility not null default 'friends',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint readings_dates_in_order check (started_on is null or finished_on is null or started_on <= finished_on),
  -- A book still in the Dispensa has not been started.
  constraint readings_want_has_no_dates check (status <> 'want' or (started_on is null and finished_on is null)),
  -- Only a finished reading, read or abandoned, has an end date and a rating.
  constraint readings_finish_when_done check (finished_on is null or status in ('read', 'abandoned')),
  constraint readings_rating_when_done check (rating_half is null or status in ('read', 'abandoned'))
);

comment on table public.readings is 'Reading events of an account. A reread is a new row.';

-- One open reading per person and work: starting a book from the Dispensa updates that row.
create unique index readings_one_open_per_work on public.readings (user_id, work_id)
where status in ('want', 'reading');
create index readings_user_id_status_idx on public.readings (user_id, status);
create index readings_work_id_idx on public.readings (work_id);
create index readings_edition_id_idx on public.readings (edition_id) where edition_id is not null;

create trigger readings_set_updated_at before update on public.readings
for each row execute function private.set_updated_at();

-- The edition must belong to the work. Security definer, so the check does not depend
-- on what the caller may read.
create function private.check_reading_edition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.edition_id is not null and not exists (
    select 1 from public.editions e where e.id = new.edition_id and e.work_id = new.work_id
  ) then
    raise exception 'edition % is not an edition of work %', new.edition_id, new.work_id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.check_reading_edition() from public, anon, authenticated;

create trigger readings_check_edition before insert or update of edition_id, work_id on public.readings
for each row execute function private.check_reading_edition();

alter table public.readings enable row level security;

revoke all on table public.readings from anon, authenticated;
grant select, insert, delete on table public.readings to authenticated;
-- The person and the work never change: a different book is a different reading.
grant update (edition_id, status, started_on, finished_on, rating_half, review, visibility)
on table public.readings to authenticated;

-- Only the owner, and only while the account is active. Friends get read access in F2.2.
create policy "readings are readable by their owner"
on public.readings for select
to authenticated
using (user_id = (select auth.uid()) and (select private.is_active()));

create policy "readings are created by their owner"
on public.readings for insert
to authenticated
with check (user_id = (select auth.uid()) and (select private.is_active()));

create policy "readings are editable by their owner"
on public.readings for update
to authenticated
using (user_id = (select auth.uid()) and (select private.is_active()))
with check (user_id = (select auth.uid()) and (select private.is_active()));

create policy "readings are deletable by their owner"
on public.readings for delete
to authenticated
using (user_id = (select auth.uid()) and (select private.is_active()));
