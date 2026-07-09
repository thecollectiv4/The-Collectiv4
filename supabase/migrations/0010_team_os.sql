-- =====================================================================
-- 0010 — Team OS (/os): the internal operating hub. The Collectiv4.
--        Applied via Supabase CLI (db push).
--
-- The internal work app for the team — tasks, content pipeline, activity,
-- and saved intel. It lives INSIDE the platform: real Supabase logins, real
-- profiles/worlds. Access = the "our network" verified badge (or an owner).
-- Non-members never see it. Nothing here is public or anon-readable.
--
-- Four tables (os_tasks / os_content / os_activity / os_intel), one shared
-- access gate reused for RLS AND the /api/brainstorm endpoint, plus an
-- identity RPC the client uses to gate the route and resolve the session
-- profile (owner_profile_id + display) in one call.
--
-- Reuses 0008's is_owner() + caller_is_verified() (unforgeable JWT email /
-- own-profile verified flag). Touches NO prices, tickets, or lock_verified.
-- Additive + idempotent.
-- =====================================================================

begin;

-- ---------- shared gate: is the caller a network member? ----------
-- owner (JWT email allowlist) OR a verified member (own profile.verified).
-- SECURITY DEFINER so the inner reads bypass RLS → no policy recursion when
-- this is called from the os_* policies below. anon → false.
create or replace function public.caller_is_network()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_owner() or public.caller_is_verified();
$$;

-- ---------- identity: member? + the session profile (one round-trip) ----------
-- Client gates the /os route on `member`, and uses `profile.id` as the owner
-- of anything it creates (identity is the real session profile — no pickers).
-- The /api/brainstorm endpoint calls this too, to auth-gate itself.
create or replace function public.my_os_identity()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile jsonb;
begin
  if not public.caller_is_network() then
    return jsonb_build_object('member', false);
  end if;
  select to_jsonb(t) into v_profile
  from (
    select id, full_name, username, avatar_url, verified
    from public.profiles
    where id = auth.uid()
  ) t;
  return jsonb_build_object('member', true, 'profile', v_profile);
end;
$$;

-- ---------- tables ----------
-- NOTE: the board lane column is named `board_column`, not `column` — `column`
-- is a SQL reserved word and quoting it everywhere is a footgun. The 4 lanes are
-- the same: ideas / this_week / in_motion / done.
create table if not exists public.os_tasks (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  type             text,
  due_date         date,
  board_column     text not null default 'ideas'
                     check (board_column in ('ideas','this_week','in_motion','done')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.os_content (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  format           text,          -- Pro camera / iPhone raw / Casual in-car / Scripted
  concept          text,
  caption          text,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  status           text not null default 'idea',
  planned_date     date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.os_activity (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  action     text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.os_intel (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,
  finding    text not null,
  created_at timestamptz not null default now()
);

-- ---------- RLS: members only (verified OR owner). nothing anon/public. ----------
alter table public.os_tasks    enable row level security;
alter table public.os_content  enable row level security;
alter table public.os_activity enable row level security;
alter table public.os_intel    enable row level security;

-- one permissive policy per table; RLS default-deny covers everyone else.
-- for all -> using gates SELECT/UPDATE/DELETE, with check gates INSERT/UPDATE.
drop policy if exists os_tasks_member_rw    on public.os_tasks;
drop policy if exists os_content_member_rw  on public.os_content;
drop policy if exists os_activity_member_rw on public.os_activity;
drop policy if exists os_intel_member_rw    on public.os_intel;

create policy os_tasks_member_rw    on public.os_tasks
  for all using (public.caller_is_network()) with check (public.caller_is_network());
create policy os_content_member_rw  on public.os_content
  for all using (public.caller_is_network()) with check (public.caller_is_network());
create policy os_activity_member_rw on public.os_activity
  for all using (public.caller_is_network()) with check (public.caller_is_network());
create policy os_intel_member_rw    on public.os_intel
  for all using (public.caller_is_network()) with check (public.caller_is_network());

-- ---------- grants: authenticated only (RLS still the real gate); never anon ----------
grant select, insert, update, delete on public.os_tasks    to authenticated;
grant select, insert, update, delete on public.os_content  to authenticated;
grant select, insert, update, delete on public.os_activity to authenticated;
grant select, insert, update, delete on public.os_intel    to authenticated;
revoke all on public.os_tasks    from anon;
revoke all on public.os_content  from anon;
revoke all on public.os_activity from anon;
revoke all on public.os_intel    from anon;

revoke all     on function public.caller_is_network() from public;
grant  execute on function public.caller_is_network() to anon, authenticated;
revoke all     on function public.my_os_identity()    from public;
grant  execute on function public.my_os_identity()    to anon, authenticated;

commit;

-- ---------- verify (simulated, rolled back) ----------
--   Owner/verified caller: select public.my_os_identity();  -- { member:true, profile:{...} }
--   Anon:                  select public.my_os_identity();  -- { member:false }
--   Anon insert into os_tasks -> denied (no policy match).
