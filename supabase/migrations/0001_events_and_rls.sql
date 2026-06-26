-- =====================================================================
-- 0001 — Foundation: events table (multi-event) + tickets.event_id
--                    + Row Level Security + webhook idempotency
--                    + PII-safe public RPCs (count + attendee wall)
-- The Collectiv4 platform.  Run in Supabase SQL Editor (or via CLI).
-- Idempotent where practical — safe to re-run.
--
-- WHY: the client uses the public anon key. Without RLS, anyone with that
-- key can read all ticket PII (emails, names, payment ids) and forge/alter
-- tickets. RLS closes that. Server code (webhook / checkout) uses the
-- SERVICE key, which bypasses RLS, so privileged writes keep working.
-- The PII-safe RPCs (confirmed_count, confirmed_attendees) let public pages
-- show a count + a name/avatar wall WITHOUT exposing email or payment data.
-- =====================================================================

-- ---------- EVENTS (new, multi-event) ----------
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  title       text not null,
  edition     text,
  tagline     text,
  description text,
  event_date  timestamptz,
  doors       text,
  venue       text,
  city        text default 'Houston',
  cover_url   text,
  status      text not null default 'draft',   -- draft | published | past
  tiers       jsonb not null default '[]'::jsonb,   -- prices in CENTS (Stripe-native)
  lineup      jsonb not null default '[]'::jsonb,
  experiences jsonb not null default '[]'::jsonb,
  host_id     uuid,
  created_at  timestamptz not null default now()
);

-- ---------- TICKETS: link to an event (multi-event) ----------
alter table public.tickets add column if not exists event_id uuid references public.events(id);

-- ---------- TICKETS: idempotency key for the Stripe webhook ----------
-- Stripe delivers checkout.session.completed AT-LEAST-ONCE. This unique index makes
-- a second insert for the same payment fail with SQLSTATE 23505, which the webhook
-- catches and treats as "already processed" — no duplicate ticket, no duplicate
-- email, no inflated count. Partial (NOT NULL) so any legacy rows with a null
-- payment id don't collide with each other.
-- NOTE: if this line errors with "could not create unique index … duplicate key",
-- you already have duplicate stripe_payment_id rows from the pre-fix webhook.
-- De-dupe those rows first, then re-run. (Pre-launch this should be empty.)
create unique index if not exists tickets_stripe_payment_id_uidx
  on public.tickets (stripe_payment_id)
  where stripe_payment_id is not null;

-- ---------- SEED: preserve the previously-hardcoded RBA Edition 002 as PAST ----------
-- Seeded as status='past' ON PURPOSE. Its date is historical (code said June 13,
-- the live OG/index.html said May 30 — either way it has already passed). Keeping it
-- 'past' preserves the historical row WITHOUT the landing page showing it as the live
-- event. The real fall event becomes a NEW row with status='published' when its date
-- locks. The do-update guarantees the row ends up 'past' even if an older run of this
-- migration already inserted it as 'published'.
insert into public.events
  (slug, title, edition, tagline, description, event_date, doors, venue, city, status, tiers, lineup, experiences)
values (
  'rba-edition-2',
  'RAN BY ARTISTS',
  'EDITION 002',
  'A night where Houston''s artists stop performing for the world and start creating for each other. Sound, paint, and fabric — alive in the same room.',
  'Ran By Artists Edition 2',
  '2026-06-13T22:00:00-05:00',
  '10PM — 2AM',
  'Houston · Venue reveal soon',
  'Houston',
  'past',
  '[
    {"id":"early-bird","name":"EARLY BIRD","price":1500,"status":"available","note":"Limited first wave"},
    {"id":"general","name":"GENERAL","price":2500,"status":"soon","note":"Available May 15"},
    {"id":"door","name":"DOOR","price":4000,"status":"soon","note":"Night of the event","doorLabel":"AT DOOR"}
  ]'::jsonb,
  '[
    {"handle":"madou","slug":"madou","name":"MADOU","role":"DJ","tag":"House · Deep","ig":"@natemadou","color":"#40B060"},
    {"handle":"patoduranc","slug":"pato-duran","name":"PATO","role":"DJ","tag":"House · Techno","ig":"@patoduranc","color":"#4A7AFF"}
  ]'::jsonb,
  '[
    {"slug":"live-art","label":"LIVE ART","short":"Paintings created in real time as the music plays.","iconName":"Paintbrush","accent":"#D06020","bg":"rgba(208,96,32,.04)"},
    {"slug":"gallery","label":"GALLERY","short":"Original works from Houston artists. Walk through it, feel it, take it home.","iconName":"Frame","accent":"#8A2040","bg":"rgba(138,32,64,.04)"},
    {"slug":"fashion","label":"FASHION POP-UP","short":"Local Houston designers. Wearable culture.","iconName":"Shirt","accent":"#D4A040","bg":"rgba(212,160,64,.04)"},
    {"slug":"screen-printing","label":"SCREEN PRINTING","short":"Custom prints made live. Leave with something that only exists tonight.","iconName":"Layers","accent":"#5A9A30","bg":"rgba(90,122,58,.04)"}
  ]'::jsonb
)
on conflict (slug) do update set status = 'past';

-- ---------- RPC: public confirmed-COUNT without exposing ticket PII ----------
-- Lets the event page show "N confirmed" while tickets stay owner-private.
create or replace function public.confirmed_count(p_event uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.tickets
  where event_id = p_event and status = 'confirmed';
$$;

-- ---------- RPC: public attendee WALL — name + avatar ONLY, never PII ----------
-- Replaces the old client-side `select * from tickets` that the Community and
-- Attendees walls used (now blocked by RLS). Returns ONLY a display name, an
-- avatar, and the public profile id (for routing to /user/:id) — never email,
-- never payment. p_event null = all confirmed (preserves current wall behavior);
-- pass an event id to scope to one event. ::text join is type-agnostic on buyer_id.
create or replace function public.confirmed_attendees(p_event uuid default null)
returns table (id text, name text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  -- distinct on (buyer_id): one row per PERSON, not per ticket — a buyer can hold up to
  -- 5 tickets / buy across sessions, and would otherwise appear multiple times on the
  -- public wall. The all-zero sentinel buyer_id (orphaned ticket from a checkout with no
  -- user_id) is excluded so the wall never shows a dead-link phantom 'Attendee'.
  select d.id, d.name, d.avatar_url
  from (
    select distinct on (t.buyer_id)
      t.buyer_id::text                                as id,
      coalesce(p.full_name, t.buyer_name, 'Attendee') as name,
      p.avatar_url                                    as avatar_url,
      t.created_at                                    as created_at
    from public.tickets t
    left join public.profiles p on p.id::text = t.buyer_id::text
    where t.status = 'confirmed'
      and (p_event is null or t.event_id = p_event)
      and t.buyer_id <> '00000000-0000-0000-0000-000000000000'
    order by t.buyer_id, t.created_at desc
  ) d
  order by d.created_at desc;
$$;

-- ===================== ROW LEVEL SECURITY =====================

-- ---------- profiles: PUBLIC read (museum/discovery), SELF write ----------
alter table public.profiles enable row level security;
drop policy if exists profiles_public_read on public.profiles;
drop policy if exists profiles_self_insert on public.profiles;
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_public_read on public.profiles
  for select using (true);
create policy profiles_self_insert on public.profiles
  for insert with check (auth.uid()::text = id::text);
create policy profiles_self_update on public.profiles
  for update using (auth.uid()::text = id::text) with check (auth.uid()::text = id::text);

-- ---------- events: PUBLIC read (non-draft); writes = service role only ----------
alter table public.events enable row level security;
drop policy if exists events_public_read on public.events;
create policy events_public_read on public.events
  for select using (status <> 'draft');
grant select on public.events to anon, authenticated;

-- ---------- tickets: OWNER read only; ALL client writes denied ----------
-- (no insert/update/delete policy => only the SERVICE key can write: the Stripe
--  webhook. Door check-in must move server-side — see report.)
-- buyer_id is written from checkout metadata (a uuid string). This block picks the
-- index-friendly policy (auth.uid() = buyer_id) when the column is actually uuid,
-- and the safe text-cast form otherwise — correct either way, no manual guessing.
alter table public.tickets enable row level security;
do $$
declare bid_type text;
begin
  select data_type into bid_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'tickets' and column_name = 'buyer_id';

  drop policy if exists tickets_self_read on public.tickets;
  if bid_type = 'uuid' then
    execute 'create policy tickets_self_read on public.tickets for select using (auth.uid() = buyer_id)';
  else
    execute 'create policy tickets_self_read on public.tickets for select using (auth.uid()::text = buyer_id::text)';
  end if;
end $$;

-- ---------- chat_messages: authed read, self insert (OUT-of-MVP, secured) ----------
do $$
begin
  if to_regclass('public.chat_messages') is not null then
    execute 'alter table public.chat_messages enable row level security';
    execute 'drop policy if exists chat_read_auth on public.chat_messages';
    execute 'drop policy if exists chat_insert_self on public.chat_messages';
    execute 'create policy chat_read_auth on public.chat_messages for select using (auth.role() = ''authenticated'')';
    -- Only create the self-insert policy if the user_id column actually exists, so a
    -- differently-named column (Base44-era) can't abort the whole migration at CREATE.
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'chat_messages' and column_name = 'user_id') then
      execute 'create policy chat_insert_self on public.chat_messages for insert with check (auth.uid()::text = user_id::text)';
    end if;
  end if;
end $$;

-- ---------- email_failures: service-role ONLY (no client policies) ----------
do $$
begin
  if to_regclass('public.email_failures') is not null then
    execute 'alter table public.email_failures enable row level security';
  end if;
end $$;

-- ---------- OUT-OF-MVP tables: enable RLS + DENY-ALL to client keys ----------
-- Base44-era tables that are not part of the MVP. Enabling RLS with NO policy
-- denies all anon/authenticated access (the SERVICE key still bypasses) — closing
-- the same anon-key hole RLS closes on tickets. Guarded by to_regclass, so it's a
-- no-op for any table that doesn't exist. IMPACT: any client-side read of these
-- returns empty until they get real policies when their feature ships post-MVP.
do $$
declare t text;
begin
  foreach t in array array['posts','services','moves','messages','conversations']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

-- ---------- RPC grants ----------
grant execute on function public.confirmed_count(uuid) to anon, authenticated;
grant execute on function public.confirmed_attendees(uuid) to anon, authenticated;
