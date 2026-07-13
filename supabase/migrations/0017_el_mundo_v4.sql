-- =====================================================================
-- 0017 — EL MUNDO v4: el ecosistema despierta. The Collectiv4.
--        NOT applied by Claude Code — Pato runs it:
--          cd ~/The-Collectiv4 && supabase db push --linked
--
-- THREE pieces — the social layer + the first marketplace layer. All
-- additive, all idempotent, all RLS-first. This is PRIVATE USER DATA:
-- every read path is participants-only or mirrors the world's public
-- visibility (is_demo), and thread creation happens ONLY through
-- SECURITY DEFINER RPCs — no client can forge a membership row.
--
--  (A) FOLLOWS. A directed edge between two worlds ("stay connected").
--      Public counts stay honest: an edge is publicly visible only when
--      BOTH worlds are visible (is_demo mirror, same doctrine as
--      world_posts in 0016). You always see your own edges.
--
--  (B) THREADS (DMs + event rooms). The Base44 chat rebuilt native —
--      NOT the legacy `conversations`/`messages`/`chat_messages`
--      tables, which stay untouched (unknown legacy shape; nothing new
--      reads or writes them). One `threads` table holds both kinds:
--        • kind='dm'    — a private pair, deduped by dm_key
--        • kind='event' — the room that continues ("Techno Night
--          03/07"): ticket holders + the host + founders
--      Membership is the ONLY key that opens a thread: reads and
--      writes on threads/thread_members/thread_messages all gate on
--      is_thread_member() (SECURITY DEFINER — breaks RLS recursion).
--      There are NO insert policies on threads or thread_members:
--      start_dm() and join_event_chat() are the only doors, and both
--      validate server-side. DMs are private between participants —
--      deliberately NOT founder-readable (moderation needs a consent
--      story first; flagged in the handback).
--
--  (C) LISTINGS. The profile gains an OFFER: pieces and services with
--      a real price. This layer is "exist and show honestly" — there
--      is NO payment path yet, so the UI says "DM to buy", never a
--      dead checkout (Ley 11). Public read mirrors world visibility
--      and shows only status='live'; the owner manages their own.
--
-- Does NOT touch: prices, tickets, events RLS, world_posts, storage
-- policies (the 'worlds' bucket uid-folder rule from 0014 already
-- covers listing images), create-checkout-session/webhook.
-- =====================================================================

begin;

-- =====================================================================
-- (A) FOLLOWS
-- =====================================================================
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_no_self check (follower_id <> followee_id)
);

create index if not exists follows_followee on public.follows (followee_id, created_at desc);

alter table public.follows enable row level security;

-- read: your own edges always; the network sees everything (ops); the
-- public sees an edge only when BOTH worlds are public (is_demo mirror —
-- a QA/demo account's follows never inflate a real count).
drop policy if exists follows_read on public.follows;
create policy follows_read on public.follows
  for select
  using (
    follower_id::text = auth.uid()::text
    or followee_id::text = auth.uid()::text
    or public.is_owner()
    or public.caller_is_verified()
    or (
      exists (select 1 from public.profiles p
              where p.id = follows.follower_id and p.is_demo = false)
      and exists (select 1 from public.profiles p
                  where p.id = follows.followee_id and p.is_demo = false)
    )
  );

-- insert: only as yourself, and only toward a world you can actually see.
drop policy if exists follows_self_insert on public.follows;
create policy follows_self_insert on public.follows
  for insert to authenticated
  with check (
    follower_id::text = auth.uid()::text
    and exists (
      select 1 from public.profiles p
      where p.id = followee_id
        and (p.is_demo = false or public.is_owner() or public.caller_is_verified())
    )
  );

-- delete: unfollow (your edge out) — or remove a follower (your edge in).
drop policy if exists follows_self_delete on public.follows;
create policy follows_self_delete on public.follows
  for delete to authenticated
  using (
    follower_id::text = auth.uid()::text
    or followee_id::text = auth.uid()::text
  );

-- =====================================================================
-- (B) THREADS — DMs + event rooms
-- =====================================================================
create table if not exists public.threads (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('dm','event')),
  -- dm_key dedupes a pair: least(uid)||':'||greatest(uid). Unique.
  dm_key          text unique,
  -- one room per event. Plain UNIQUE: NULLs (dm rows) never collide.
  event_id        uuid unique references public.events(id) on delete cascade,
  created_by      uuid not null references public.profiles(id) on delete cascade,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint threads_shape check (
    (kind = 'dm'    and dm_key is not null and event_id is null) or
    (kind = 'event' and event_id is not null and dm_key is null)
  )
);

create table if not exists public.thread_members (
  thread_id    uuid not null references public.threads(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (thread_id, profile_id)
);

create index if not exists thread_members_profile on public.thread_members (profile_id);

create table if not exists public.thread_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.threads(id) on delete cascade,
  sender_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  constraint thread_messages_body_cap
    check (char_length(body) >= 1 and char_length(body) <= 2000)
);

create index if not exists thread_messages_thread_created
  on public.thread_messages (thread_id, created_at);

-- membership check as SECURITY DEFINER: policies on thread_members that
-- query thread_members would recurse; the definer function reads past
-- RLS and answers one question only. STABLE — one snapshot per query.
create or replace function public.is_thread_member(p_thread uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.thread_members
    where thread_id = p_thread
      and profile_id::text = auth.uid()::text
  )
$$;
revoke all on function public.is_thread_member(uuid) from public;
grant execute on function public.is_thread_member(uuid) to authenticated, anon;

alter table public.threads         enable row level security;
alter table public.thread_members  enable row level security;
alter table public.thread_messages enable row level security;

-- READS: participants only. No public path at all — a DM or a room is
-- invisible unless you are in it. (No insert/update/delete policies on
-- threads; no insert policy on thread_members: the RPCs are the doors.)
drop policy if exists threads_member_read on public.threads;
create policy threads_member_read on public.threads
  for select to authenticated
  using (public.is_thread_member(id));

drop policy if exists thread_members_member_read on public.thread_members;
create policy thread_members_member_read on public.thread_members
  for select to authenticated
  using (public.is_thread_member(thread_id));

-- your own membership row is yours to update — and ONLY its read cursor.
-- The RLS row guard alone is NOT enough here: an UPDATE that repoints
-- thread_id on your OWN row would pass both USING and WITH CHECK (they
-- only constrain profile_id) and forge membership into ANY thread —
-- full read of arbitrary DMs (adversarial review catch, HIGH). Two
-- walls: a column-level grant (only last_read_at is updatable at all)
-- and a belt-and-suspenders trigger pinning the identity columns.
drop policy if exists thread_members_self_update on public.thread_members;
create policy thread_members_self_update on public.thread_members
  for update to authenticated
  using      (profile_id::text = auth.uid()::text)
  with check (profile_id::text = auth.uid()::text);

revoke update on public.thread_members from anon, authenticated;
grant  update (last_read_at) on public.thread_members to authenticated;

create or replace function public.thread_members_pin_identity()
returns trigger
language plpgsql
as $$
begin
  if new.thread_id is distinct from old.thread_id
     or new.profile_id is distinct from old.profile_id then
    raise exception 'membership_immutable';
  end if;
  return new;
end $$;

drop trigger if exists thread_members_pin on public.thread_members;
create trigger thread_members_pin
  before update on public.thread_members
  for each row execute function public.thread_members_pin_identity();

drop policy if exists thread_messages_member_read on public.thread_messages;
create policy thread_messages_member_read on public.thread_messages
  for select to authenticated
  using (public.is_thread_member(thread_id));

-- write: as yourself, into a thread you belong to. Both must hold.
drop policy if exists thread_messages_member_insert on public.thread_messages;
create policy thread_messages_member_insert on public.thread_messages
  for insert to authenticated
  with check (
    sender_id::text = auth.uid()::text
    and public.is_thread_member(thread_id)
  );

-- a sender may take back their own message
drop policy if exists thread_messages_sender_delete on public.thread_messages;
create policy thread_messages_sender_delete on public.thread_messages
  for delete to authenticated
  using (sender_id::text = auth.uid()::text);

-- inbox ordering: every new message bumps its thread. SECURITY DEFINER —
-- threads has no UPDATE policy, the trigger is the only writer.
create or replace function public.bump_thread_on_message()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.threads
     set last_message_at = new.created_at
   where id = new.thread_id;
  return new;
end $$;

drop trigger if exists thread_messages_bump on public.thread_messages;
create trigger thread_messages_bump
  after insert on public.thread_messages
  for each row execute function public.bump_thread_on_message();

-- a signed-up member may not have a profiles row yet (it's born lazily
-- on the first /profile visit) — the FKs above need one. Same safety
-- net as admin_set_verified (0014): create the minimal row.
create or replace function public.ensure_own_profile()
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  insert into public.profiles (id, user_id, full_name, username, bio, city)
  select auth.uid(), auth.uid(),
         coalesce(nullif(trim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''), 'Member'),
         null, '', ''
  where auth.uid() is not null
    and not exists (select 1 from public.profiles where id::text = auth.uid()::text);
end $$;
revoke all on function public.ensure_own_profile() from public;
grant execute on function public.ensure_own_profile() to authenticated;

-- THE DOOR #1 — start (or reopen) a DM with another member.
create or replace function public.start_dm(p_other uuid)
returns uuid
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_me  uuid := auth.uid();
  v_key text;
  v_id  uuid;
begin
  if v_me is null then
    raise exception 'not_signed_in';
  end if;
  if p_other is null or p_other = v_me then
    raise exception 'bad_target';
  end if;
  -- the other side must be a world the caller can actually see (a
  -- demo/QA world is not messageable by the public; network can)
  if not exists (
    select 1 from public.profiles p
    where p.id = p_other
      and (p.is_demo = false or public.is_owner() or public.caller_is_verified())
  ) then
    raise exception 'not_found';
  end if;
  perform public.ensure_own_profile();

  v_key := least(v_me::text, p_other::text) || ':' || greatest(v_me::text, p_other::text);
  select id into v_id from public.threads where dm_key = v_key;
  if v_id is null then
    -- concurrent-safe: the loser of the race lands on the winner's row
    insert into public.threads (kind, dm_key, created_by)
    values ('dm', v_key, v_me)
    on conflict (dm_key) do update set dm_key = excluded.dm_key
    returning id into v_id;
  end if;
  insert into public.thread_members (thread_id, profile_id)
  values (v_id, v_me), (v_id, p_other)
  on conflict (thread_id, profile_id) do nothing;
  return v_id;
end $$;
revoke all on function public.start_dm(uuid) from public;
grant execute on function public.start_dm(uuid) to authenticated;

-- THE DOOR #2 — the event room. Confirmed ticket holders, the event's
-- host, and founders. The room only exists for real, visible events.
create or replace function public.join_event_chat(p_event uuid)
returns uuid
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_id uuid;
  v_ok boolean;
begin
  if v_me is null then
    raise exception 'not_signed_in';
  end if;
  select exists (
    select 1 from public.events e
    where e.id = p_event
      and e.is_test = false
      and e.status in ('published','past')
      and (
        public.is_owner()
        or e.host_id::text = v_me::text
        or exists (
          select 1 from public.tickets t
          where t.event_id = e.id
            and t.buyer_id = v_me
            and t.status = 'confirmed'
        )
      )
  ) into v_ok;
  if not coalesce(v_ok, false) then
    raise exception 'not_in';
  end if;
  perform public.ensure_own_profile();

  select id into v_id from public.threads where kind = 'event' and event_id = p_event;
  if v_id is null then
    insert into public.threads (kind, event_id, created_by)
    values ('event', p_event, v_me)
    on conflict (event_id) do update set event_id = excluded.event_id
    returning id into v_id;
  end if;
  insert into public.thread_members (thread_id, profile_id)
  values (v_id, v_me)
  on conflict (thread_id, profile_id) do nothing;
  return v_id;
end $$;
revoke all on function public.join_event_chat(uuid) from public;
grant execute on function public.join_event_chat(uuid) to authenticated;

-- realtime: new messages stream to subscribed participants (postgres_changes
-- respects the select RLS above — non-members receive nothing).
do $$
begin
  alter publication supabase_realtime add table public.thread_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- =====================================================================
-- (C) LISTINGS — the OFFER (marketplace foundations)
-- =====================================================================
create table if not exists public.listings (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('piece','service')),
  title       text not null,
  description text,
  -- a real price is the point of the layer (Pato: "con PRECIO").
  -- $1 – $50,000; payments come in a later layer (the UI says DM to buy).
  price_cents integer not null,
  currency    text not null default 'usd',
  images      jsonb not null default '[]'::jsonb,
  status      text not null default 'live' check (status in ('live','archived','sold')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint listings_title_cap  check (char_length(trim(title)) between 1 and 120),
  constraint listings_desc_cap   check (description is null or char_length(description) <= 1000),
  constraint listings_price_rng  check (price_cents between 100 and 5000000),
  constraint listings_imgs_array check (jsonb_typeof(images) = 'array')
);

create index if not exists listings_profile_created
  on public.listings (profile_id, created_at desc);

alter table public.listings enable row level security;

-- public read: LIVE listings on visible worlds (is_demo mirror). The
-- owner sees all of their own (archived/sold included); network sees all.
drop policy if exists listings_public_read on public.listings;
create policy listings_public_read on public.listings
  for select
  using (
    profile_id::text = auth.uid()::text
    or public.is_owner()
    or public.caller_is_verified()
    or (
      status = 'live'
      and exists (select 1 from public.profiles p
                  where p.id = listings.profile_id and p.is_demo = false)
    )
  );

drop policy if exists listings_owner_insert on public.listings;
create policy listings_owner_insert on public.listings
  for insert to authenticated
  with check (profile_id::text = auth.uid()::text);

drop policy if exists listings_owner_update on public.listings;
create policy listings_owner_update on public.listings
  for update to authenticated
  using      (profile_id::text = auth.uid()::text)
  with check (profile_id::text = auth.uid()::text);

drop policy if exists listings_owner_delete on public.listings;
create policy listings_owner_delete on public.listings
  for delete to authenticated
  using (profile_id::text = auth.uid()::text);

-- =====================================================================
-- (D) HOUSEKEEPING — retire the v4 gate's stray QA profiles.
-- Four walkthrough accounts from broken early runs lost their credential
-- ledger before self-retiring (the normal cleanup path); they sit visible
-- in Community as "QA Seller" clones. Same retirement the script does,
-- pinned by uid, idempotent. (Hard-deleting their auth.users rows stays
-- a founder call — listed in the handback.)
-- =====================================================================
update public.profiles
   set is_demo = true, username = null, full_name = 'QA (retired)'
 where id in (
   '0c9e86d1-d854-4ec9-af33-feca6ea229ba',
   'd6c55ded-1e68-491c-ac9a-4ee64b632e73',
   '4caffcba-1738-4e79-ad0a-14787a8a5549',
   'faf8775e-7ed5-4e21-8505-b061b52f6190'
 );

commit;
