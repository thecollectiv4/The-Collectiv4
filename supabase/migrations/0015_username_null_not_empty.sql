-- =====================================================================
-- 0015 — Handle collisions: '' is not a handle, NULL is "no handle yet".
--        The Collectiv4. Applied via Supabase CLI (db push).
--
-- WHY (caught LIVE by the QA walkthrough, 11 jul 2026):
--   profiles.username carries a UNIQUE index (profiles_username_key,
--   Base44-era). Every "no handle yet" row born with username = '' takes
--   the ONE allowed empty slot — the SECOND such member collides, the
--   lazy client insert swallowed the error, and every later save
--   updated ZERO rows in silence: a member "builds their world" into a
--   void. NULLs never collide on a unique btree index.
--
--   1) Existing ''-handle rows become NULL (one exists at most — the
--      slot holder). 2) admin_set_verified()'s ensure-row insert (0014)
--      writes NULL, not ''. 3) A CHECK keeps '' out for good, from any
--      client. The client-side lazy insert is fixed in the same PR.
--
-- Touches no prices, tickets, verified values, or RLS. Idempotent.
-- =====================================================================

begin;

-- 1) free the '' slot: it always meant "no handle yet"
update public.profiles set username = null where username = '';

-- 2) keep '' out at the DB layer, from every writer
alter table public.profiles drop constraint if exists profiles_username_not_empty;
alter table public.profiles add  constraint profiles_username_not_empty
  check (username is null or length(trim(username)) > 0);

-- 3) the ensure-row insert stops minting '' handles
create or replace function public.admin_set_verified(p_user uuid, p_verified boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name  text;
  v_new   boolean;
  v_actor uuid;
begin
  if not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;

  select coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
                  split_part(u.email, '@', 1), 'Member')
    into v_name
    from auth.users u
   where u.id = p_user and u.deleted_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  perform set_config('app.grant_verified', '1', true);
  insert into public.profiles (id, user_id, full_name, username, bio, city, verified)
  values (p_user, p_user::text, v_name, null, '', '', p_verified)
  on conflict (id) do update set verified = excluded.verified
  returning verified into v_new;
  perform set_config('app.grant_verified', '0', true);

  select auth.uid() into v_actor;
  if v_actor is not null and exists (select 1 from public.profiles where id = v_actor) then
    insert into public.os_activity (profile_id, action)
    values (v_actor, case when p_verified then 'verified ' else 'unverified ' end || v_name);
  end if;

  return jsonb_build_object('ok', true, 'id', p_user, 'verified', v_new);
end;
$$;

commit;

-- ---------- verify ----------
-- select count(*) from public.profiles where username = '';   -- 0
-- insert with username '' as any client → check violation.
