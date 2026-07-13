-- =====================================================================
-- 0016 — EL MUNDO v3: the app comes ALIVE. The Collectiv4.
--        NOT applied by Claude Code — Pato runs it:
--          cd ~/The-Collectiv4 && supabase db push --linked
--
-- TWO pieces, both additive / RLS-safe / idempotent:
--
--  (A) WORLD POSTS. A post = image(s) + a caption that lives in a
--      member's world as a DATED piece — the gallery extended into a
--      timeline of moments (CREATE central, Ley 13). New table
--      public.world_posts (the Base44-era `posts` table is left
--      untouched — unknown legacy shape, nothing reads it). Storage
--      rides the existing 'worlds' bucket under the uploader's own uid
--      folder (0014 storage RLS already enforces that server-side).
--      Read visibility MIRRORS profiles_public_read: a demo/QA world's
--      posts must never leak to the public path.
--
--  (B) EVENT HOSTING OPENS TO VERIFIED — with ownership. 0013's
--      admin_* RPCs already gate on caller_is_network() (verified OR
--      owner), but there was NO ownership model: any verified member
--      could edit ANY event, including the founders' room. This adds:
--        • host stamping — admin_save_event writes host_id=auth.uid()
--          and is_house=is_owner() at INSERT (legacy rows backfilled
--          is_house=true: every existing event is the founders').
--        • ownership gate — a verified member edits/deletes only THEIR
--          events; founders (is_owner) keep every event: publish,
--          unpublish, moderate, delete. Server-side, never client.
--        • the landing stays the house's — useLiveEvent filters
--          is_house=true, so a member publishing THEIR event can never
--          hijack the root landing. Member events live in Discover and
--          at /e/:slug.
--        • admin_list_events returns `mine` per row and keeps every
--          PUBLISHED event visible to network members — the door
--          scanner's picker must keep scanning the house door.
--
-- Does NOT touch: prices, tickets, lock_verified, checkout/webhook,
-- the events public-read policy. Additive + idempotent.
-- =====================================================================

begin;

-- ---------- (A) world_posts ----------
create table if not exists public.world_posts (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  caption    text,
  images     jsonb not null default '[]'::jsonb,  -- [{"path":"<uid>/p-…","url":"https://…"}]
  created_at timestamptz not null default now()
);

alter table public.world_posts drop constraint if exists world_posts_images_is_array;
alter table public.world_posts add  constraint world_posts_images_is_array
  check (jsonb_typeof(images) = 'array');
alter table public.world_posts drop constraint if exists world_posts_caption_cap;
alter table public.world_posts add  constraint world_posts_caption_cap
  check (caption is null or char_length(caption) <= 1000);
-- a post carries something: at least a caption or one image
alter table public.world_posts drop constraint if exists world_posts_not_empty;
alter table public.world_posts add  constraint world_posts_not_empty
  check (jsonb_array_length(images) > 0 or coalesce(trim(caption), '') <> '');

create index if not exists world_posts_profile_created
  on public.world_posts (profile_id, created_at desc);

alter table public.world_posts enable row level security;

-- read mirrors profiles_public_read (0008): the public sees a post only
-- when they can see the world it belongs to. Demo/QA posts never leak.
drop policy if exists world_posts_public_read on public.world_posts;
create policy world_posts_public_read on public.world_posts
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = world_posts.profile_id
        and (p.is_demo = false
             or p.id::text = auth.uid()::text
             or public.is_owner()
             or public.caller_is_verified())
    )
  );

-- writes: the owner of the world, and no one else. auth.uid() is the
-- unforgeable identity — a client cannot post into another world.
drop policy if exists world_posts_owner_insert on public.world_posts;
create policy world_posts_owner_insert on public.world_posts
  for insert to authenticated
  with check (profile_id::text = auth.uid()::text);

drop policy if exists world_posts_owner_update on public.world_posts;
create policy world_posts_owner_update on public.world_posts
  for update to authenticated
  using      (profile_id::text = auth.uid()::text)
  with check (profile_id::text = auth.uid()::text);

drop policy if exists world_posts_owner_delete on public.world_posts;
create policy world_posts_owner_delete on public.world_posts
  for delete to authenticated
  using (profile_id::text = auth.uid()::text);

grant select on public.world_posts to anon, authenticated;
grant insert, update, delete on public.world_posts to authenticated;
revoke insert, update, delete on public.world_posts from anon;

-- ---------- (B) events: ownership + the house flag ----------
-- host_id already exists (Base44-era column, unused, null everywhere).
-- is_house marks an official The Collectiv4 room — the ONLY thing the
-- root landing shows. Stamped at creation, never flipped by an edit.
alter table public.events add column if not exists is_house boolean not null default false;

-- backfill: every event that exists today is the founders' (host_id null).
update public.events set is_house = true where host_id is null;

-- ---------- admin_save_event: host stamping + ownership gate ----------
-- Same validation body as 0013; the deltas are marked HOST/OWNERSHIP.
create or replace function public.admin_save_event(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      uuid;
  v_slug    text;
  v_title   text;
  v_status  text;
  v_date    timestamptz;
  v_tiers   jsonb;
  t         jsonb;
  k         text;
  v_ids     text[] := '{}';
  v_tid     text;
  v_price   numeric;
  v_tstatus text;
  v_old     public.events;
  v_row     public.events;
  v_actor   uuid;
  v_action  text;
begin
  if not public.caller_is_network() then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;

  begin
    v_id := nullif(p->>'id', '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'bad_id');
  end;
  v_slug   := lower(trim(coalesce(p->>'slug', '')));
  v_title  := trim(coalesce(p->>'title', ''));
  v_status := coalesce(nullif(trim(coalesce(p->>'status', '')), ''), 'draft');

  if v_title = '' then
    return jsonb_build_object('ok', false, 'error', 'title required');
  end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_slug) > 60 then
    return jsonb_build_object('ok', false, 'error', 'slug must be lowercase-kebab, max 60 chars');
  end if;
  if v_status not in ('draft', 'published', 'past') then
    return jsonb_build_object('ok', false, 'error', 'status must be draft, published or past');
  end if;
  if exists (select 1 from public.events e where e.slug = v_slug and (v_id is null or e.id <> v_id)) then
    return jsonb_build_object('ok', false, 'error', 'slug already taken');
  end if;

  begin
    v_date := nullif(p->>'event_date', '')::timestamptz;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'event_date is not a valid timestamp');
  end;
  if v_status = 'published' and v_date is null then
    return jsonb_build_object('ok', false, 'error', 'a published event needs a date');
  end if;

  v_tiers := coalesce(p->'tiers', '[]'::jsonb);
  if jsonb_typeof(v_tiers) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'tiers must be an array');
  end if;
  for t in select * from jsonb_array_elements(v_tiers) loop
    if jsonb_typeof(t) <> 'object' then
      return jsonb_build_object('ok', false, 'error', 'each tier must be an object');
    end if;
    for k in select jsonb_object_keys(t) loop
      if k not in ('id', 'name', 'price', 'status', 'note', 'doorLabel') then
        return jsonb_build_object('ok', false, 'error', 'unknown tier key: ' || k);
      end if;
    end loop;
    v_tid := coalesce(t->>'id', '');
    if v_tid !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
      return jsonb_build_object('ok', false, 'error', 'tier id must be lowercase-kebab');
    end if;
    if v_tid = any(v_ids) then
      return jsonb_build_object('ok', false, 'error', 'duplicate tier id: ' || v_tid);
    end if;
    v_ids := v_ids || v_tid;
    if trim(coalesce(t->>'name', '')) = '' then
      return jsonb_build_object('ok', false, 'error', 'every tier needs a name');
    end if;
    if jsonb_typeof(t->'price') is distinct from 'number' then
      return jsonb_build_object('ok', false, 'error', 'tier price must be a number (integer cents)');
    end if;
    v_price := (t->>'price')::numeric;
    if v_price <> floor(v_price) or v_price < 0 then
      return jsonb_build_object('ok', false, 'error', 'tier price must be integer cents (e.g. 1500 = $15)');
    end if;
    v_tstatus := coalesce(t->>'status', 'coming_soon');
    if v_tstatus not in ('available', 'coming_soon', 'sold_out') then
      return jsonb_build_object('ok', false, 'error', 'tier status must be available, coming_soon or sold_out');
    end if;
    if v_tstatus = 'available' and v_price < 50 then
      return jsonb_build_object('ok', false, 'error', 'an available tier must be at least 50 cents (Stripe card minimum)');
    end if;
  end loop;

  if v_id is null then
    -- HOST: every new event belongs to its creator; only a founder's event
    -- is a house event (the root landing's pool). Stamped here, where the
    -- client can't lie — identity is the JWT, never a payload field.
    insert into public.events
      (slug, title, edition, tagline, description, event_date, doors, venue, city, cover_url, status, tiers, is_test, host_id, is_house)
    values (
      v_slug, v_title,
      nullif(trim(coalesce(p->>'edition', '')), ''),
      nullif(trim(coalesce(p->>'tagline', '')), ''),
      nullif(trim(coalesce(p->>'description', '')), ''),
      v_date,
      nullif(trim(coalesce(p->>'doors', '')), ''),
      nullif(trim(coalesce(p->>'venue', '')), ''),
      nullif(trim(coalesce(p->>'city', '')), ''),
      nullif(trim(coalesce(p->>'cover_url', '')), ''),
      v_status, v_tiers, false,
      auth.uid(), public.is_owner()
    )
    returning * into v_row;
    v_action := 'created event “' || v_title || '” (' || v_status || ')';
  else
    select * into v_old from public.events where id = v_id;
    if v_old.id is null then
      return jsonb_build_object('ok', false, 'error', 'event not found');
    end if;
    -- OWNERSHIP: a verified member touches only THEIR events. Founders
    -- (is_owner) keep every event — publish, unpublish, moderate. A legacy
    -- row (host_id NULL — every pre-0016 event, the house's) must fail
    -- CLOSED for non-owners: `null = auth.uid()` evaluates to NULL and
    -- `if not (false or null)` would silently skip this guard.
    if not (public.is_owner()
            or (v_old.host_id is not null and v_old.host_id::text = auth.uid()::text)) then
      return jsonb_build_object('ok', false, 'error', 'not_yours');
    end if;
    if v_old.status = 'published' and v_status = 'draft'
       and exists (select 1 from public.tickets
                    where event_id = v_id and status = 'confirmed') then
      return jsonb_build_object('ok', false, 'error',
        'this event has sold tickets — it can''t go back to draft; mark it past instead');
    end if;
    -- host_id / is_house are NEVER rewritten by an edit: a founder
    -- moderating a member's event doesn't take it, and a member's event
    -- never becomes a house event after the fact.
    update public.events set
      slug        = v_slug,
      title       = v_title,
      edition     = nullif(trim(coalesce(p->>'edition', '')), ''),
      tagline     = nullif(trim(coalesce(p->>'tagline', '')), ''),
      description = nullif(trim(coalesce(p->>'description', '')), ''),
      event_date  = v_date,
      doors       = nullif(trim(coalesce(p->>'doors', '')), ''),
      venue       = nullif(trim(coalesce(p->>'venue', '')), ''),
      city        = nullif(trim(coalesce(p->>'city', '')), ''),
      cover_url   = nullif(trim(coalesce(p->>'cover_url', '')), ''),
      status      = v_status,
      tiers       = v_tiers
    where id = v_id
    returning * into v_row;
    v_action := case
      when v_old.status <> 'published' and v_status = 'published' then 'published event “' || v_title || '”'
      when v_old.status = 'published' and v_status <> 'published' then 'unpublished event “' || v_title || '”'
      else 'updated event “' || v_title || '”'
    end;
  end if;

  select auth.uid() into v_actor;
  if v_actor is not null and exists (select 1 from public.profiles where id = v_actor) then
    insert into public.os_activity (profile_id, action) values (v_actor, v_action);
  end if;

  return jsonb_build_object('ok', true, 'event', to_jsonb(v_row));
end;
$$;

-- ---------- admin_list_events: `mine` + door-safe visibility ----------
-- Owners see everything. A verified member sees THEIR events (any status,
-- for managing) plus every PUBLISHED event (the door scanner's picker must
-- keep every live door scannable). `mine` tells the UI which rows the
-- caller can actually edit — the server re-checks on every write anyway.
create or replace function public.admin_list_events()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.caller_is_network() then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;
  return jsonb_build_object('ok', true, 'events', coalesce((
    select jsonb_agg(to_jsonb(e) || jsonb_build_object(
                       'sold', coalesce(s.sold, 0),
                       'ticket_rows', coalesce(s.total, 0),
                       'mine', (public.is_owner() or e.host_id::text = auth.uid()::text))
                     order by e.created_at desc)
      from public.events e
      left join (select event_id,
                        count(*) filter (where status = 'confirmed') as sold,
                        count(*) as total
                   from public.tickets
                  group by event_id) s
        on s.event_id = e.id
     where public.is_owner()
        or e.host_id::text = auth.uid()::text
        or e.status = 'published'
  ), '[]'::jsonb));
end;
$$;

-- ---------- admin_delete_event: ownership gate ----------
create or replace function public.admin_delete_event(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n     bigint;
  v_title text;
  v_host  uuid;
  v_actor uuid;
begin
  if not public.caller_is_network() then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;

  select host_id into v_host from public.events where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'event not found');
  end if;
  -- OWNERSHIP: same rule as save — yours, or you're a founder. NULL host
  -- (legacy/house rows) fails CLOSED for non-owners (see save's guard).
  if not (public.is_owner()
          or (v_host is not null and v_host::text = auth.uid()::text)) then
    return jsonb_build_object('ok', false, 'error', 'not_yours');
  end if;

  select count(*) into v_n from public.tickets where event_id = p_id;
  if v_n > 0 then
    return jsonb_build_object('ok', false, 'error', 'has_tickets', 'tickets', v_n);
  end if;

  delete from public.events where id = p_id returning title into v_title;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'event not found');
  end if;

  select auth.uid() into v_actor;
  if v_actor is not null and exists (select 1 from public.profiles where id = v_actor) then
    insert into public.os_activity (profile_id, action) values (v_actor, 'deleted event “' || v_title || '”');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

commit;

-- ---------- verify (run as anon / verified non-host / owner) ----------
-- select * from public.world_posts;                     -- anon → only posts of public worlds
-- insert into public.world_posts (profile_id, caption)
--   values ('<someone else''s uid>', 'x');              -- → RLS reject (42501)
-- select public.admin_save_event('{"id":"<house event id>","title":"x","slug":"x"}'::jsonb);
--                                                       -- verified non-host → {ok:false, not_yours}
-- select public.admin_list_events();                    -- verified → own rows + published, each with `mine`
-- select slug, is_house from public.events;             -- legacy rows → is_house = true
