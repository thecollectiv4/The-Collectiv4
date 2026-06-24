-- =====================================================================
-- 0001 — Foundation: events table (multi-event) + tickets.event_id
--                    + Row Level Security on EVERY table + safe count RPC
-- The Collectiv4 platform.  Run in Supabase SQL Editor (or via CLI).
-- Idempotent where practical — safe to re-run.
--
-- WHY: the client uses the public anon key. Without RLS, anyone with that
-- key can read all ticket PII (emails, names, payment ids) and forge/alter
-- tickets. RLS closes that. Server code (webhook / checkout) uses the
-- SERVICE key, which bypasses RLS, so privileged writes keep working.
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

-- ---------- SEED: migrate the previously-hardcoded RBA Edition 002 ----------
-- NOTE: code hardcoded June 13, 2026 but the live OG/index.html says May 30 —
-- confirm the true date. This historical row just preserves current behavior;
-- the real fall event becomes a NEW row (that's the point of multi-event).
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
  'published',
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
on conflict (slug) do nothing;

-- ---------- RPC: public confirmed-count WITHOUT exposing ticket PII ----------
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
-- (no insert/update/delete policy => only the SERVICE key can write:
--  the Stripe webhook. Door check-in must move server-side — see report.)
alter table public.tickets enable row level security;
drop policy if exists tickets_self_read on public.tickets;
-- ::text cast is intentional: buyer_id's column type is unverified (it's written
-- from string checkout metadata). The cast works whether buyer_id is uuid OR text.
-- If you confirm it's uuid, simplify to (auth.uid() = buyer_id) for index use.
create policy tickets_self_read on public.tickets
  for select using (auth.uid()::text = buyer_id::text);

-- ---------- chat_messages: authed read, self insert (OUT-of-MVP, secured) ----------
do $$
begin
  if to_regclass('public.chat_messages') is not null then
    execute 'alter table public.chat_messages enable row level security';
    execute 'drop policy if exists chat_read_auth on public.chat_messages';
    execute 'drop policy if exists chat_insert_self on public.chat_messages';
    execute 'create policy chat_read_auth on public.chat_messages for select using (auth.role() = ''authenticated'')';
    execute 'create policy chat_insert_self on public.chat_messages for insert with check (auth.uid()::text = user_id::text)';
  end if;
end $$;

-- ---------- email_failures: service-role ONLY (no client policies) ----------
do $$
begin
  if to_regclass('public.email_failures') is not null then
    execute 'alter table public.email_failures enable row level security';
  end if;
end $$;

-- ---------- RPC grants ----------
grant execute on function public.confirmed_count(uuid) to anon, authenticated;
