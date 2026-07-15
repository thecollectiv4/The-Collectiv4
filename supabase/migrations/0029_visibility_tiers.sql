-- =====================================================================
-- 0029 — VISIBILIDAD DE TRES NIVELES (D5). El Mundo v7.
--        Applied via Supabase CLI (db push).
--
-- Pato pidió el modelo Close Friends de Instagram, textual: PÚBLICO /
-- AMIGOS / CLOSE FRIENDS (un subconjunto que TÚ curas, dentro de amigos).
-- Aplica a planes/kickbacks Y a asistencia a eventos. Default: AMIGOS.
-- El "SEE WHO" de un evento solo muestra a quien eligió ser visible.
--
-- Superset chain public ⊇ friends ⊇ close (a close friend is also a mutual
-- friend). One predicate — can_see(owner, tier) — decides every read. Anon
-- (auth.uid() null) clears only 'public'. A founder / an event's host see
-- their full list for ops.
--
-- Additive: two new tables (close_friends, event_attendance_prefs), one new
-- defaulted column (plans.visibility), predicates + doors, and a filtered
-- confirmed_attendees (same signature → create-or-replace, no drop, callers
-- unchanged). Touches no price, no ticket write path, no Stripe file. The
-- ticket wall shrinks to the viewer-permitted set; confirmed_count stays the
-- honest TOTAL (a count, not PII).
-- =====================================================================

begin;

-- ---------- (1) CLOSE FRIENDS — the curated subset within friends ----------
create table if not exists public.close_friends (
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  friend_id  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, friend_id),
  constraint close_no_self check (owner_id <> friend_id)
);
create index if not exists close_friends_owner_idx on public.close_friends (owner_id);

-- PRIVATE like friendships: only the owner sees their own close list. Writes
-- via doors only (no insert/update/delete grants).
alter table public.close_friends enable row level security;
revoke all    on public.close_friends from anon, authenticated;
grant  select on public.close_friends to   authenticated;
drop policy if exists close_friends_owner_read on public.close_friends;
create policy close_friends_owner_read on public.close_friends
  for select using (owner_id::text = auth.uid()::text);

-- ---------- (2) predicates: is_close + the single can_see gate ----------
-- is_close self-heals: a de-friended close row silently stops matching
-- (are_friends baked in), so unfriending needs no cleanup.
create or replace function public.is_close(p_owner uuid, p_viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_viewer is not null and exists (
    select 1 from public.close_friends c
    where c.owner_id = p_owner and c.friend_id = p_viewer
      and public.are_friends(p_owner, p_viewer)
  );
$$;

-- can_see(owner, tier): does the CURRENT caller clear this owner's tier?
-- self + founder always; else by tier. All inner calls are SECURITY DEFINER
-- (are_friends / is_close) so there is no RLS recursion.
create or replace function public.can_see(p_owner uuid, p_tier text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_owner = auth.uid()
      or public.is_owner()
      or case coalesce(p_tier, 'friends')
           when 'public'  then true
           when 'friends' then public.are_friends(p_owner, auth.uid())
           when 'close'   then public.is_close(p_owner, auth.uid())
           else false
         end;
$$;
grant execute on function public.is_close(uuid, uuid) to anon, authenticated;
grant execute on function public.can_see(uuid, text) to anon, authenticated;

-- ---------- (3) close-friend curation doors (gated on are_friends) ----------
create or replace function public.add_close_friend(p_other uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'not_signed_in'); end if;
  if p_other is null or p_other = v_uid then return jsonb_build_object('ok', false, 'error', 'bad_target'); end if;
  if not public.are_friends(v_uid, p_other) then
    return jsonb_build_object('ok', false, 'error', 'not_your_friend');  -- close ⊂ friends
  end if;
  insert into public.close_friends (owner_id, friend_id)
  values (v_uid, p_other)
  on conflict (owner_id, friend_id) do nothing;
  return jsonb_build_object('ok', true, 'id', p_other);
end;
$$;

create or replace function public.remove_close_friend(p_other uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'not_signed_in'); end if;
  delete from public.close_friends where owner_id = v_uid and friend_id = p_other;
  return jsonb_build_object('ok', true, 'id', p_other);
end;
$$;

create or replace function public.my_close_friends()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('ok', true, 'close', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.id, 'name', p.full_name, 'username', p.username, 'avatar_url', p.avatar_url)
           order by lower(coalesce(p.full_name, p.username, '')))
    from public.close_friends c
    join public.profiles p on p.id = c.friend_id
    where c.owner_id = auth.uid()
      and p.deleted_at is null
      and public.are_friends(auth.uid(), c.friend_id)   -- only still-friends
  ), '[]'::jsonb));
$$;

revoke all     on function public.add_close_friend(uuid)    from public;
revoke all     on function public.remove_close_friend(uuid) from public;
revoke all     on function public.my_close_friends()        from public;
grant  execute on function public.add_close_friend(uuid)    to authenticated;
grant  execute on function public.remove_close_friend(uuid) to authenticated;
grant  execute on function public.my_close_friends()        to authenticated;

-- ---------- (4) PLANS visibility — default amigos, con la opción de abrirlo ----------
alter table public.plans
  add column if not exists visibility text not null default 'friends'
    check (visibility in ('public', 'friends', 'close'));

-- creator-only door to open/close a plan's tier
create or replace function public.set_plan_visibility(p_plan uuid, p_tier text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'not_signed_in'); end if;
  if p_tier is null or p_tier not in ('public', 'friends', 'close') then
    return jsonb_build_object('ok', false, 'error', 'bad_visibility');
  end if;
  update public.plans set visibility = p_tier
    where id = p_plan and creator_id = auth.uid()
    returning id into v_id;
  if v_id is null then return jsonb_build_object('ok', false, 'error', 'not_creator'); end if;
  return jsonb_build_object('ok', true, 'id', p_plan, 'visibility', p_tier);
end;
$$;
revoke all     on function public.set_plan_visibility(uuid, text) from public;
grant  execute on function public.set_plan_visibility(uuid, text) to authenticated;

-- discovery: a plan is readable by its members OR by anyone the creator's tier
-- admits. plan_members stays members-only (the ROSTER never widens) — a
-- discoverer sees the plan card, not who is in it.
drop policy if exists plans_member_read on public.plans;
drop policy if exists plans_visible_read on public.plans;
create policy plans_visible_read on public.plans
  for select using (
    public.is_plan_member(id)
    or public.can_see(creator_id, visibility)
  );

-- ---------- (5) EVENT ATTENDANCE visibility (kept off the frozen tickets path) ----------
create table if not exists public.event_attendance_prefs (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event_id   uuid not null references public.events(id)   on delete cascade,
  visibility text not null default 'friends'
    check (visibility in ('public', 'friends', 'close')),
  updated_at timestamptz not null default now(),
  primary key (profile_id, event_id)
);
alter table public.event_attendance_prefs enable row level security;
revoke all    on public.event_attendance_prefs from anon, authenticated;
grant  select on public.event_attendance_prefs to   authenticated;
drop policy if exists eap_self_read on public.event_attendance_prefs;
create policy eap_self_read on public.event_attendance_prefs
  for select using (profile_id::text = auth.uid()::text);   -- you can see your own choice

create or replace function public.set_attendance_visibility(p_event uuid, p_tier text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'not_signed_in'); end if;
  if p_tier is null or p_tier not in ('public', 'friends', 'close') then
    return jsonb_build_object('ok', false, 'error', 'bad_visibility');
  end if;
  if not exists (select 1 from public.events e where e.id = p_event) then
    return jsonb_build_object('ok', false, 'error', 'no_event');
  end if;
  insert into public.event_attendance_prefs (profile_id, event_id, visibility, updated_at)
  values (v_uid, p_event, p_tier, now())
  on conflict (profile_id, event_id) do update set visibility = excluded.visibility, updated_at = now();
  return jsonb_build_object('ok', true, 'event_id', p_event, 'visibility', p_tier);
end;
$$;
revoke all     on function public.set_attendance_visibility(uuid, text) from public;
grant  execute on function public.set_attendance_visibility(uuid, text) to authenticated;

-- ---------- (6) confirmed_attendees — the SEE WHO wall, now tier-filtered ----------
-- Same signature (id text, name, avatar_url) → no DROP, callers unchanged.
-- A person shows only if the viewer clears their chosen tier (default amigos).
-- Founder + the event's host always see the full list (door / check-in ops).
create or replace function public.confirmed_attendees(p_event uuid default null)
returns table (id text, name text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.name, d.avatar_url
  from (
    select distinct on (t.buyer_id)
      t.buyer_id::text                                as id,
      coalesce(p.full_name, t.buyer_name, 'Attendee') as name,
      p.avatar_url                                    as avatar_url,
      t.created_at                                    as created_at
    from public.tickets t
    left join public.profiles p on p.id::text = t.buyer_id::text
    left join public.events   e on e.id = t.event_id
    left join public.event_attendance_prefs ap
           on ap.profile_id::text = t.buyer_id::text and ap.event_id = t.event_id
    where t.status = 'confirmed'
      and (p_event is null or t.event_id = p_event)
      and t.buyer_id <> '00000000-0000-0000-0000-000000000000'
      and (
        public.is_owner()
        or (e.host_id is not null and e.host_id::text = auth.uid()::text)  -- the room's host, for door ops
        or (p.id is not null and public.can_see(p.id, coalesce(ap.visibility, 'friends')))
      )
    order by t.buyer_id, t.created_at desc
  ) d
  order by d.created_at desc;
$$;

commit;

-- ---------- verify ----------
-- anon:  select public.can_see('<owner>','public')  -> true;  '...friends'/'close' -> false
-- anon:  select * from public.confirmed_attendees('<event>')  -> only 'public'-tier attendees
-- friend: after are_friends, a 'friends'-tier attendee appears; a 'close' one only after add_close_friend
-- add_close_friend on a non-friend -> {ok:false, error:'not_your_friend'}
-- set_plan_visibility by a non-creator -> {ok:false, error:'not_creator'}
