-- Imports (F1.8): a library brought in from Goodreads, in small steps driven by the browser,
-- and a shared cache of the open metadata sources so a big import stays within their limits.
--
-- A job holds the parsed rows; each step processes a few pending rows and records what
-- happened to each one. Jobs and rows are personal: only their owner sees them.

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  -- Deleting the account deletes its imports.
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  source text not null check (source = 'goodreads'),
  status text not null default 'running' check (status in ('running', 'finished')),
  -- Google Books calls made today for this job: it is only asked for the gaps of the open
  -- sources, with a daily cap (docs/ARCHITECTURE.md).
  google_day date,
  google_calls integer not null default 0 check (google_calls >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.import_jobs is 'A library import from another app, processed a few rows at a time.';

create index import_jobs_user_id_idx on public.import_jobs (user_id);

create trigger import_jobs_set_updated_at before update on public.import_jobs
for each row execute function private.set_updated_at();

create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.import_jobs (id) on delete cascade,
  -- The line of the file, for the report.
  line integer not null check (line > 0),
  -- The id of the book in the source app (Goodreads Book Id): a book is imported once per job.
  source_key text not null check (char_length(source_key) between 1 and 64),
  -- The parsed row, as the domain parser produced it. Personal: it may hold notes.
  raw jsonb not null,
  -- pending: not processed yet. imported: in the Tana. review: the user has to choose the
  -- book among candidates. skipped: left out by the user or already in the Tana. failed: an error.
  status text not null default 'pending' check (status in ('pending', 'imported', 'review', 'skipped', 'failed')),
  work_id uuid references public.works (id) on delete set null,
  -- Candidate books for a row in review, as found by the sources.
  candidates jsonb,
  -- A short code explaining the outcome, such as `created_from_goodreads` or `already_in_tana`.
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, source_key)
);

comment on table public.import_rows is 'The rows of an import and what happened to each one.';

create index import_rows_job_status_idx on public.import_rows (job_id, status, line);

create trigger import_rows_set_updated_at before update on public.import_rows
for each row execute function private.set_updated_at();

alter table public.import_jobs enable row level security;
alter table public.import_rows enable row level security;

revoke all on table public.import_jobs from anon, authenticated;
grant select, insert, delete on table public.import_jobs to authenticated;
grant update (status, google_day, google_calls) on table public.import_jobs to authenticated;

revoke all on table public.import_rows from anon, authenticated;
grant select, insert, delete on table public.import_rows to authenticated;
grant update (status, work_id, candidates, note) on table public.import_rows to authenticated;

create policy "imports are readable by their owner"
on public.import_jobs for select
to authenticated
using (user_id = (select auth.uid()) and (select private.is_active()));

create policy "imports are started by their owner"
on public.import_jobs for insert
to authenticated
with check (user_id = (select auth.uid()) and (select private.is_active()));

create policy "imports are updated by their owner"
on public.import_jobs for update
to authenticated
using (user_id = (select auth.uid()) and (select private.is_active()))
with check (user_id = (select auth.uid()) and (select private.is_active()));

create policy "imports are deletable by their owner"
on public.import_jobs for delete
to authenticated
using (user_id = (select auth.uid()) and (select private.is_active()));

-- A row belongs to whoever owns its job; the subquery runs under the jobs policy.
create policy "import rows are readable by the job owner"
on public.import_rows for select
to authenticated
using (exists (select 1 from public.import_jobs j where j.id = job_id and j.user_id = (select auth.uid())));

create policy "import rows are added by the job owner"
on public.import_rows for insert
to authenticated
with check (exists (select 1 from public.import_jobs j where j.id = job_id and j.user_id = (select auth.uid())));

create policy "import rows are updated by the job owner"
on public.import_rows for update
to authenticated
using (exists (select 1 from public.import_jobs j where j.id = job_id and j.user_id = (select auth.uid())))
with check (exists (select 1 from public.import_jobs j where j.id = job_id and j.user_id = (select auth.uid())));

create policy "import rows are deletable by the job owner"
on public.import_rows for delete
to authenticated
using (exists (select 1 from public.import_jobs j where j.id = job_id and j.user_id = (select auth.uid())));

-- Shared cache of the open sources ------------------------------------------------------
--
-- Responses of Open Library and OPAC SBN, keyed by URL, shared by every account: the
-- same book imported by two friends is asked once. Never Google Books: its terms forbid
-- keeping copies (ADR-0008). The table sits in the private schema, out of the API; the
-- functions below are the only way in, and only for active accounts.

create table private.metadata_cache (
  url text primary key check (url ~ '^https://(openlibrary\.org|opac\.sbn\.it)/'),
  -- `{"status": "ok", "data": ...}` or `{"status": "not_found"}`.
  response jsonb not null,
  expires_at timestamptz not null
);

alter table private.metadata_cache enable row level security;
revoke all on table private.metadata_cache from public, anon, authenticated;

create index metadata_cache_expires_at_idx on private.metadata_cache (expires_at);

create function public.metadata_cache_get(cache_url text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select c.response from private.metadata_cache c
  where c.url = cache_url and c.expires_at > now() and (select private.is_active());
$$;

create function public.metadata_cache_put(cache_url text, cache_response jsonb, ttl_seconds integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_active()) then
    raise exception 'account not active' using errcode = '42501';
  end if;
  if ttl_seconds not between 60 and 60 * 60 * 24 * 90 then
    raise exception 'cache time out of range' using errcode = '22023';
  end if;
  if cache_response->>'status' not in ('ok', 'not_found') or pg_column_size(cache_response) > 200000 then
    raise exception 'not a cacheable response' using errcode = '22023';
  end if;
  insert into private.metadata_cache (url, response, expires_at)
  values (cache_url, cache_response, now() + make_interval(secs => ttl_seconds))
  on conflict (url) do update set response = excluded.response, expires_at = excluded.expires_at;
  -- Keep the cache small: expired entries go as new ones arrive.
  delete from private.metadata_cache where expires_at < now() - interval '1 day';
end;
$$;

revoke all on function public.metadata_cache_get(text) from public, anon;
revoke all on function public.metadata_cache_put(text, jsonb, integer) from public, anon;
grant execute on function public.metadata_cache_get(text) to authenticated;
grant execute on function public.metadata_cache_put(text, jsonb, integer) to authenticated;
