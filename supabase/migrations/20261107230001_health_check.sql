-- Daily keep-alive (F0.8). A free Supabase project pauses after 7 days of low activity:
-- a scheduled GitHub Action calls this function through the API with the publishable key.
-- It performs a real read, so it also proves the database answers, and reveals nothing.
create function public.health_check()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_settings where key = 'signup_mode');
$$;

revoke all on function public.health_check() from public;
grant execute on function public.health_check() to anon, authenticated;
