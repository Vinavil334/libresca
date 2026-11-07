-- Accounts and access (F0.7, ADR-0006).
-- Anyone can authenticate with Google; using the app requires profiles.status = 'active'.
-- With signup_mode = 'invite_only' a new account starts 'pending'; with 'open' it starts 'active'.

create type public.profile_status as enum ('pending', 'active', 'suspended');

-- App-wide settings. No policies: only security definer functions and the service role read them.
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
revoke all on table public.app_settings from anon, authenticated;

insert into public.app_settings (key, value) values ('signup_mode', '"invite_only"');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text unique check (handle ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_creature text,
  locale text not null default 'it',
  status public.profile_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Nobody writes status, id or timestamps through the API: only the columns below are updatable.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (handle, display_name, avatar_creature, locale) on table public.profiles to authenticated;

-- Every account reads its own profile, active or not: the app needs the status to route.
-- Friends will read each other's profiles from F2, through private.are_friends().
create policy "profiles are readable by their owner"
on public.profiles for select
to authenticated
using (id = (select auth.uid()));

create policy "profiles are editable by their owner"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Keeps updated_at current on every table that has it.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

-- Creates the profile when Supabase Auth creates the user.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  signup_mode text;
  name text;
begin
  select s.value #>> '{}' into signup_mode from public.app_settings s where s.key = 'signup_mode';

  name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'reader'
  );

  insert into public.profiles (id, display_name, status)
  values (
    new.id,
    left(name, 80),
    case when signup_mode = 'open' then 'active'::public.profile_status else 'pending'::public.profile_status end
  );

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- True when the caller has an active profile. Every policy on shared data uses it.
create function private.is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status = 'active'
  );
$$;

revoke all on function private.is_active() from public, anon;
grant execute on function private.is_active() to authenticated;

-- Activates an account by email. Run it by hand from the SQL editor (role postgres):
--   select private.activate_profile('name@example.com');
-- Invites replace it for friends in F2; it stays as the bootstrap for the first account.
create function private.activate_profile(target_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
begin
  select u.id into target_id from auth.users u where lower(u.email) = lower(trim(target_email));
  if target_id is null then
    raise exception 'No account with email %', target_email using errcode = 'no_data_found';
  end if;

  update public.profiles set status = 'active' where id = target_id;
  return target_id;
end;
$$;

revoke all on function private.activate_profile(text) from public, anon, authenticated;
