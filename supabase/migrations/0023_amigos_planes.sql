-- =====================================================================
-- 0023 — EL CORAZÓN: amigos, crews y planes (El Mundo v6, D3).
--        The Collectiv4 platform. Applied via Supabase CLI (db push).
--
-- WHAT / WHY:
--   v6's psychological heart: the people you DO things with. Follows
--   (0017) stay the public admiration graph; AMIGOS is a different bond —
--   mutual, private, and the key that opens doing-things-together:
--
--   * friendships   — request → accept. PRIVATE at RLS level: only the
--                     two people in a friendship can see it exists. No
--                     public friend lists, no counts — the circle is
--                     intimate by architecture (same doctrine as 0022).
--   * threads widen — kind gains 'group' (tu crew, titled) and 'plan'
--                     (every plan is born with its room). All the 0017
--                     machinery — membership RLS, realtime, unread,
--                     the pin trigger — is inherited unchanged.
--   * plans         — the kickback: what / where / when, invite friends,
--                     RSVP in|out|maybe. Real interactions, zero vanity:
--                     no likes, no view counts, just who's in.
--
--   MEMBERSHIP DOCTRINE: crews and plans are built FROM friendship.
--   Every invite door checks are_friends() — you cannot pull strangers
--   into a room; you bring your people ("interacciones reales, gente
--   presente no fabricada"). DMs stay the door for meeting someone new.
--
-- HONEST-BY-CODE / SAFETY (mirrors 0017/0019/0020/0022):
--   * ADDITIVE: two new tables, new thread kinds via constraint widening
--     (no data rewritten; every existing dm/event row satisfies the new
--     checks), new columns nullable. Zero changes to prices, tickets,
--     verified, Stripe, or any existing policy.
--   * All writes go through SECURITY DEFINER doors pinned to auth.uid()
--     (no client insert/update/delete grants on any new table — the
--     0017/0022 door discipline).
--   * Idempotent: create-if-not-exists, drop-then-create policies and
--     constraints, create-or-replace functions.
-- =====================================================================

begin;

-- =====================================================================
-- 1. FRIENDSHIPS — the mutual bond
-- =====================================================================
create table if not exists public.friendships (
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','accepted')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  primary key (requester_id, addressee_id),
  constraint friendships_no_self check (requester_id <> addressee_id)
);
-- one live edge per pair, whichever direction asked first
create unique index if not exists friendships_pair_uidx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee_idx on public.friendships (addressee_id, status);

-- PRIVATE by architecture: only the two people in the bond can see it.
-- No public read branch at all — a friend list is nobody's directory.
alter table public.friendships enable row level security;
revoke all    on public.friendships from anon, authenticated;
grant  select on public.friendships to   authenticated;

drop policy if exists friendships_participant_read on public.friendships;
create policy friendships_participant_read on public.friendships
  for select using (
    requester_id::text = auth.uid()::text
    or addressee_id::text = auth.uid()::text
  );
-- No write policies — request_friend / respond_friend / remove_friend
-- are the only doors.

-- are_friends(): the key every crew/plan door turns.
create or replace function public.are_friends(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = p_a and f.addressee_id = p_b)
        or (f.requester_id = p_b and f.addressee_id = p_a))
  );
$$;
revoke all     on function public.are_friends(uuid, uuid) from public;
grant  execute on function public.are_friends(uuid, uuid) to authenticated;

-- ---------- request_friend: ask, or complete a mutual ask ----------
-- If the other person already asked ME, asking back IS the acceptance —
-- two reaches meet in the middle, no ceremony.
create or replace function public.request_friend(p_other uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.friendships;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if p_other is null or p_other = v_uid then
    return jsonb_build_object('ok', false, 'error', 'bad_target');
  end if;
  perform public.ensure_own_profile();
  -- target must be a visible, real person (mirror start_dm's gate)
  if not exists (
    select 1 from public.profiles p
    where p.id = p_other
      and (p.is_demo = false or public.is_owner() or public.caller_is_verified())
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select * into v_row from public.friendships f
  where (f.requester_id = v_uid and f.addressee_id = p_other)
     or (f.requester_id = p_other and f.addressee_id = v_uid);

  if v_row.requester_id is not null then
    if v_row.status = 'accepted' then
      return jsonb_build_object('ok', true, 'status', 'accepted');
    end if;
    if v_row.requester_id = v_uid then
      return jsonb_build_object('ok', true, 'status', 'pending');
    end if;
    -- they asked me first — this ask completes the bond
    update public.friendships
       set status = 'accepted', responded_at = now()
     where requester_id = v_row.requester_id and addressee_id = v_row.addressee_id;
    return jsonb_build_object('ok', true, 'status', 'accepted');
  end if;

  insert into public.friendships (requester_id, addressee_id)
  values (v_uid, p_other);
  return jsonb_build_object('ok', true, 'status', 'pending');
end;
$$;
revoke all     on function public.request_friend(uuid) from public;
grant  execute on function public.request_friend(uuid) to authenticated;

-- ---------- respond_friend: accept, or quietly decline ----------
-- Decline DELETES the row (honest absence; they may ask again later —
-- the request is a hand extended, not a record held against anyone).
create or replace function public.respond_friend(p_other uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_found int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if p_accept then
    update public.friendships
       set status = 'accepted', responded_at = now()
     where requester_id = p_other and addressee_id = v_uid and status = 'pending';
    get diagnostics v_found = row_count;
    if v_found = 0 then
      return jsonb_build_object('ok', false, 'error', 'no_request');
    end if;
    return jsonb_build_object('ok', true, 'status', 'accepted');
  else
    delete from public.friendships
     where requester_id = p_other and addressee_id = v_uid and status = 'pending';
    get diagnostics v_found = row_count;
    if v_found = 0 then
      return jsonb_build_object('ok', false, 'error', 'no_request');
    end if;
    return jsonb_build_object('ok', true, 'status', 'declined');
  end if;
end;
$$;
revoke all     on function public.respond_friend(uuid, boolean) from public;
grant  execute on function public.respond_friend(uuid, boolean) to authenticated;

-- ---------- remove_friend: either side, either state ----------
create or replace function public.remove_friend(p_other uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  delete from public.friendships f
   where (f.requester_id = v_uid and f.addressee_id = p_other)
      or (f.requester_id = p_other and f.addressee_id = v_uid);
  return jsonb_build_object('ok', true);
end;
$$;
revoke all     on function public.remove_friend(uuid) from public;
grant  execute on function public.remove_friend(uuid) to authenticated;

-- ---------- my_circle: one call, the whole social truth ----------
-- friends + requests waiting on me + requests I sent. Cards only carry
-- what the person's public profile already shows.
create or replace function public.my_circle()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ok', true,
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'name', p.full_name, 'username', p.username,
               'avatar_url', p.avatar_url, 'verified', p.verified, 'city', p.city)
             order by lower(coalesce(p.full_name, p.username, '')))
      from public.friendships f
      join public.profiles p
        on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
      where f.status = 'accepted'
        and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
    ), '[]'::jsonb),
    'pending_in', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'name', p.full_name, 'username', p.username,
               'avatar_url', p.avatar_url, 'verified', p.verified, 'city', p.city)
             order by f.created_at desc)
      from public.friendships f
      join public.profiles p on p.id = f.requester_id
      where f.status = 'pending' and f.addressee_id = auth.uid()
    ), '[]'::jsonb),
    'pending_out', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'name', p.full_name, 'username', p.username,
               'avatar_url', p.avatar_url, 'verified', p.verified, 'city', p.city)
             order by f.created_at desc)
      from public.friendships f
      join public.profiles p on p.id = f.addressee_id
      where f.status = 'pending' and f.requester_id = auth.uid()
    ), '[]'::jsonb)
  );
$$;
revoke all     on function public.my_circle() from public;
grant  execute on function public.my_circle() to authenticated;

-- =====================================================================
-- 2. PLANS — the kickback (created BEFORE threads.plan_id FK needs it)
-- =====================================================================
create table if not exists public.plans (
  id         uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title      text not null check (char_length(btrim(title)) between 1 and 80),
  detail     text check (detail is null or char_length(detail) <= 500),
  spot       text check (spot is null or char_length(spot) <= 120),
  starts_at  timestamptz,
  status     text not null default 'live' check (status in ('live','canceled')),
  created_at timestamptz not null default now()
);
create index if not exists plans_creator_idx on public.plans (creator_id, created_at desc);

create table if not exists public.plan_members (
  plan_id      uuid not null references public.plans(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'invited' check (status in ('invited','in','out','maybe')),
  invited_by   uuid references public.profiles(id) on delete set null,
  joined_at    timestamptz not null default now(),
  responded_at timestamptz,
  primary key (plan_id, profile_id)
);
create index if not exists plan_members_profile_idx on public.plan_members (profile_id);

-- is_plan_member(): SECURITY DEFINER to break RLS recursion,
-- exactly the is_thread_member pattern (0017).
create or replace function public.is_plan_member(p_plan uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.plan_members m
    where m.plan_id = p_plan and m.profile_id::text = auth.uid()::text
  );
$$;
revoke all     on function public.is_plan_member(uuid) from public;
grant  execute on function public.is_plan_member(uuid) to authenticated, anon;

-- Plans are PRIVATE rooms: members-only read, RPC-only writes.
alter table public.plans enable row level security;
revoke all    on public.plans from anon, authenticated;
grant  select on public.plans to   authenticated;
drop policy if exists plans_member_read on public.plans;
create policy plans_member_read on public.plans
  for select using (public.is_plan_member(id));

alter table public.plan_members enable row level security;
revoke all    on public.plan_members from anon, authenticated;
grant  select on public.plan_members to   authenticated;
drop policy if exists plan_members_member_read on public.plan_members;
create policy plan_members_member_read on public.plan_members
  for select using (public.is_plan_member(plan_id));

-- =====================================================================
-- 3. THREADS WIDEN — 'group' and 'plan' rooms on the 0017 machine
-- =====================================================================
-- Widening a CHECK is additive: every existing dm/event row satisfies the
-- new constraints untouched. title/plan_id arrive nullable.
alter table public.threads add column if not exists title text
  check (title is null or char_length(btrim(title)) between 1 and 60);
alter table public.threads add column if not exists plan_id uuid unique
  references public.plans(id) on delete cascade;

alter table public.threads drop constraint if exists threads_kind_check;
alter table public.threads add  constraint threads_kind_check
  check (kind in ('dm','event','group','plan'));

alter table public.threads drop constraint if exists threads_shape;
alter table public.threads add  constraint threads_shape check (
  (kind = 'dm'    and dm_key is not null and event_id is null and plan_id is null) or
  (kind = 'event' and event_id is not null and dm_key is null and plan_id is null) or
  (kind = 'group' and title is not null and dm_key is null and event_id is null and plan_id is null) or
  (kind = 'plan'  and plan_id is not null and dm_key is null and event_id is null)
);

-- ---------- create_group_thread: start a crew ----------
-- Members must be YOUR FRIENDS — a crew is made of your people, never
-- of strangers pulled in cold. Cap 24 (a crew, not a broadcast list).
create or replace function public.create_group_thread(
  p_title      text,
  p_member_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_title  text := btrim(coalesce(p_title, ''));
  v_thread uuid;
  v_added  int := 0;
  m        uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;
  perform public.ensure_own_profile();
  if char_length(v_title) < 1 or char_length(v_title) > 60 then
    raise exception 'bad_title';
  end if;

  insert into public.threads (kind, title, created_by)
  values ('group', v_title, v_uid)
  returning id into v_thread;

  insert into public.thread_members (thread_id, profile_id)
  values (v_thread, v_uid);

  for m in select distinct u from unnest(coalesce(p_member_ids, '{}'::uuid[])) u loop
    exit when v_added >= 23;                       -- 24 with the creator
    if m is null or m = v_uid then continue; end if;
    if not public.are_friends(v_uid, m) then continue; end if;
    insert into public.thread_members (thread_id, profile_id)
    values (v_thread, m)
    on conflict do nothing;
    v_added := v_added + 1;
  end loop;

  return v_thread;
end;
$$;
revoke all     on function public.create_group_thread(text, uuid[]) from public;
grant  execute on function public.create_group_thread(text, uuid[]) to authenticated;

-- ---------- add_group_member: bring one of YOUR friends in ----------
create or replace function public.add_group_member(p_thread uuid, p_other uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_kind text;
  v_cnt  int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  select kind into v_kind from public.threads where id = p_thread;
  if v_kind is distinct from 'group' then
    return jsonb_build_object('ok', false, 'error', 'not_a_group');
  end if;
  if not public.is_thread_member(p_thread) then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;
  if p_other is null or not public.are_friends(v_uid, p_other) then
    return jsonb_build_object('ok', false, 'error', 'not_your_friend');
  end if;
  select count(*) into v_cnt from public.thread_members where thread_id = p_thread;
  if v_cnt >= 24 then
    return jsonb_build_object('ok', false, 'error', 'group_full');
  end if;
  insert into public.thread_members (thread_id, profile_id)
  values (p_thread, p_other)
  on conflict do nothing;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all     on function public.add_group_member(uuid, uuid) from public;
grant  execute on function public.add_group_member(uuid, uuid) to authenticated;

-- ---------- leave_thread: walk out of a crew ----------
-- Groups only: DMs are permanent doors, event rooms belong to tickets,
-- plan rooms follow the plan (RSVP 'out' instead — the room continues).
-- Last one out turns off the lights: an empty crew is deleted.
create or replace function public.leave_thread(p_thread uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_kind text;
  v_left int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  select kind into v_kind from public.threads where id = p_thread;
  if v_kind is distinct from 'group' then
    return jsonb_build_object('ok', false, 'error', 'not_a_group');
  end if;
  delete from public.thread_members
   where thread_id = p_thread and profile_id = v_uid;
  select count(*) into v_left from public.thread_members where thread_id = p_thread;
  if v_left = 0 then
    delete from public.threads where id = p_thread;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all     on function public.leave_thread(uuid) from public;
grant  execute on function public.leave_thread(uuid) to authenticated;

-- =====================================================================
-- 4. PLAN DOORS
-- =====================================================================

-- ---------- create_plan: what / where / when + your people ----------
-- Every plan is born WITH its room (kind='plan' thread; the thread title
-- mirrors the plan title so the inbox needs no extra join). Invitees must
-- be the creator's friends; non-friends are silently skipped, and the
-- honest count comes back.
create or replace function public.create_plan(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_title   text;
  v_detail  text;
  v_spot    text;
  v_starts  timestamptz;
  v_plan    uuid;
  v_thread  uuid;
  v_invited int := 0;
  k         text;
  m         uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  perform public.ensure_own_profile();
  if p is null or jsonb_typeof(p) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'plan must be an object');
  end if;
  for k in select jsonb_object_keys(p) loop
    if k not in ('title', 'detail', 'spot', 'starts_at', 'invitee_ids') then
      return jsonb_build_object('ok', false, 'error', 'unknown plan key: ' || k);
    end if;
  end loop;

  v_title := btrim(coalesce(p->>'title', ''));
  if char_length(v_title) < 1 or char_length(v_title) > 80 then
    return jsonb_build_object('ok', false, 'error', 'plan title: 1–80 characters');
  end if;
  v_detail := nullif(btrim(coalesce(p->>'detail', '')), '');
  if v_detail is not null and char_length(v_detail) > 500 then
    return jsonb_build_object('ok', false, 'error', 'plan detail: 500 characters max');
  end if;
  v_spot := nullif(btrim(coalesce(p->>'spot', '')), '');
  if v_spot is not null and char_length(v_spot) > 120 then
    return jsonb_build_object('ok', false, 'error', 'plan spot: 120 characters max');
  end if;
  begin
    v_starts := nullif(p->>'starts_at', '')::timestamptz;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'starts_at is not a valid timestamp');
  end;

  insert into public.plans (creator_id, title, detail, spot, starts_at)
  values (v_uid, v_title, v_detail, v_spot, v_starts)
  returning id into v_plan;

  insert into public.threads (kind, plan_id, title, created_by)
  values ('plan', v_plan, left(v_title, 60), v_uid)
  returning id into v_thread;

  -- the creator is IN, in the plan and in the room
  insert into public.plan_members (plan_id, profile_id, status, responded_at)
  values (v_plan, v_uid, 'in', now());
  insert into public.thread_members (thread_id, profile_id)
  values (v_thread, v_uid);

  for m in
    select distinct (val)::uuid
    from jsonb_array_elements_text(coalesce(p->'invitee_ids', '[]'::jsonb)) as t(val)
  loop
    exit when v_invited >= 39;                      -- 40 with the creator
    if m is null or m = v_uid then continue; end if;
    if not public.are_friends(v_uid, m) then continue; end if;
    insert into public.plan_members (plan_id, profile_id, invited_by)
    values (v_plan, m, v_uid)
    on conflict do nothing;
    insert into public.thread_members (thread_id, profile_id)
    values (v_thread, m)
    on conflict do nothing;
    v_invited := v_invited + 1;
  end loop;

  return jsonb_build_object('ok', true, 'plan_id', v_plan,
                            'thread_id', v_thread, 'invited', v_invited);
end;
$$;
revoke all     on function public.create_plan(jsonb) from public;
grant  execute on function public.create_plan(jsonb) to authenticated;

-- ---------- rsvp_plan: in / out / maybe — the honest three ----------
create or replace function public.rsvp_plan(p_plan uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_found int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if p_status not in ('in', 'out', 'maybe') then
    return jsonb_build_object('ok', false, 'error', 'rsvp must be in, out or maybe');
  end if;
  update public.plan_members
     set status = p_status, responded_at = now()
   where plan_id = p_plan and profile_id = v_uid;
  get diagnostics v_found = row_count;
  if v_found = 0 then
    return jsonb_build_object('ok', false, 'error', 'not_invited');
  end if;
  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;
revoke all     on function public.rsvp_plan(uuid, text) from public;
grant  execute on function public.rsvp_plan(uuid, text) to authenticated;

-- ---------- invite_to_plan: any member brings THEIR friends ----------
-- Kickback dynamics — whoever is in can widen the circle, but only with
-- their own people (are_friends gate per invitee, always).
create or replace function public.invite_to_plan(p_plan uuid, p_others uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_thread  uuid;
  v_status  text;
  v_cnt     int;
  v_invited int := 0;
  m         uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  select status into v_status from public.plan_members
   where plan_id = p_plan and profile_id = v_uid;
  if v_status is null then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;
  select id into v_thread from public.threads where plan_id = p_plan;

  for m in select distinct u from unnest(coalesce(p_others, '{}'::uuid[])) u loop
    select count(*) into v_cnt from public.plan_members where plan_id = p_plan;
    exit when v_cnt >= 40;
    if m is null or m = v_uid then continue; end if;
    if not public.are_friends(v_uid, m) then continue; end if;
    insert into public.plan_members (plan_id, profile_id, invited_by)
    values (p_plan, m, v_uid)
    on conflict do nothing;
    if v_thread is not null then
      insert into public.thread_members (thread_id, profile_id)
      values (v_thread, m)
      on conflict do nothing;
    end if;
    v_invited := v_invited + 1;
  end loop;

  return jsonb_build_object('ok', true, 'invited', v_invited);
end;
$$;
revoke all     on function public.invite_to_plan(uuid, uuid[]) from public;
grant  execute on function public.invite_to_plan(uuid, uuid[]) to authenticated;

-- ---------- cancel_plan: creator only; the room survives ----------
create or replace function public.cancel_plan(p_plan uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_found int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  update public.plans
     set status = 'canceled'
   where id = p_plan and creator_id = v_uid;
  get diagnostics v_found = row_count;
  if v_found = 0 then
    return jsonb_build_object('ok', false, 'error', 'not_yours');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all     on function public.cancel_plan(uuid) from public;
grant  execute on function public.cancel_plan(uuid) to authenticated;

-- ---------- my_plans: everything I'm part of, one call ----------
create or replace function public.my_plans()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ok', true,
    'plans', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id',        pl.id,
               'title',     pl.title,
               'detail',    pl.detail,
               'spot',      pl.spot,
               'starts_at', pl.starts_at,
               'status',    pl.status,
               'creator', jsonb_build_object(
                 'id', cp.id, 'name', cp.full_name,
                 'username', cp.username, 'avatar_url', cp.avatar_url),
               'my_status', me.status,
               'thread_id', th.id,
               'in_count',    (select count(*) from public.plan_members x
                               where x.plan_id = pl.id and x.status = 'in'),
               'maybe_count', (select count(*) from public.plan_members x
                               where x.plan_id = pl.id and x.status = 'maybe'),
               'invited_count', (select count(*) from public.plan_members x
                                 where x.plan_id = pl.id and x.status = 'invited'),
               'roster', (select jsonb_agg(jsonb_build_object(
                            'id', rp.id, 'name', rp.full_name,
                            'username', rp.username, 'avatar_url', rp.avatar_url,
                            'status', rm.status)
                          order by case rm.status when 'in' then 0 when 'maybe' then 1
                                                  when 'invited' then 2 else 3 end,
                                   lower(coalesce(rp.full_name, rp.username, '')))
                          from public.plan_members rm
                          join public.profiles rp on rp.id = rm.profile_id
                          where rm.plan_id = pl.id)
             )
             order by (pl.status = 'live') desc, pl.starts_at asc nulls last, pl.created_at desc)
      from public.plan_members me
      join public.plans pl on pl.id = me.plan_id
      join public.profiles cp on cp.id = pl.creator_id
      left join public.threads th on th.plan_id = pl.id
      where me.profile_id = auth.uid()
    ), '[]'::jsonb)
  );
$$;
revoke all     on function public.my_plans() from public;
grant  execute on function public.my_plans() to authenticated;

commit;

-- =====================================================================
-- VERIFY (read-only, run after push):
--   -- as user A: select request_friend('<B>');           -- {ok, pending}
--   -- as user B: select request_friend('<A>');           -- auto-accept
--   -- as A: select my_circle();                          -- B in friends
--   -- as C (stranger): select * from friendships
--   --   where requester_id='<A>';                        -- zero rows
--   -- as A: select create_plan('{"title":"fucho sábado",
--   --   "invitee_ids":["<B>"]}'::jsonb);                 -- plan + room
--   -- as B: select rsvp_plan('<plan>', 'in');            -- {ok, in}
--   -- old thread rows: select count(*) from threads;     -- unchanged
-- =====================================================================
