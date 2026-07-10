-- =====================================================================
-- 0013 — SELL READY: door check-in hardened + event admin without SQL.
--        The Collectiv4. Applied via Supabase CLI (db push).
--
-- WHY (three holes between today and selling Coffee & House, Jul 25):
--   1. check_in_ticket() was authenticated-only, and the UI gate was a
--      hardcoded PIN ('4444') shipped in the public JS bundle. Any signed-in
--      user who read the bundle could scan tickets — walk in free, or burn a
--      stranger's ticket. Check-in becomes NETWORK-ONLY (verified or owner),
--      enforced here, where the client can't lie. Identity = JWT, never text.
--   2. No surface could write to public.events — every event needed raw SQL
--      through an intermediary. The admin_* RPCs below are the server side of
--      the /os Events surface: create, edit, publish, open/close tiers,
--      guarded delete. Validation lives HERE (single writer), so a buggy or
--      hostile client cannot persist a malformed event.
--   3. check_in_ticket() matched a QR across ALL events — a ticket for one
--      event scanned "welcome" at another. It now takes the event being
--      worked and answers 'wrong_event' honestly.
--
-- TIERS STAY JSONB (decision, data-backed): create-checkout-session.js finds
-- the tier inside events.tiers, EventLanding renders that same jsonb, and the
-- hard rule for this build is ZERO changes to the purchase flow — a tiers
-- table would force exactly those changes. Scale is ~3 tiers/event, single
-- concurrent editor, no per-tier inventory. The jsonb is now written by ONE
-- validated server path instead of hand-edited SQL, which was the real risk.
--
-- ACTION INTEGRITY: every admin mutation writes its os_activity row in the
-- SAME transaction — the feed reflects what happened, not what a client said.
--
-- Does NOT touch: prices already sold, tickets rows, lock_verified, RLS on
-- events (public read policy unchanged; writes stay closed to clients —
-- admin writes go through these SECURITY DEFINER functions only).
-- Additive + idempotent (create or replace; drop-if-exists only on the
-- function being re-signed).
-- =====================================================================

begin;

-- ---------- 1) Door check-in: network-only + event-scoped ----------
-- Old signature (text) is replaced by (text, uuid default null); callers that
-- pass only p_qr still resolve. Gate: caller_is_network() — the same gate as
-- /os. Anon and ordinary signed-in users get 'denied' and learn nothing.
drop function if exists public.check_in_ticket(text);

create or replace function public.check_in_ticket(p_qr text, p_event uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name  text;
  v_row   record;
  v_title text;
begin
  if not (public.caller_is_network() or coalesce(auth.role(), '') = 'service_role') then
    return jsonb_build_object('status', 'denied');
  end if;

  -- Atomic happy path: flip checked_in only for a confirmed ticket of THIS
  -- event (when an event is given). Anything else falls through to diagnosis.
  update public.tickets
     set checked_in = true
   where qr_code = p_qr
     and status = 'confirmed'
     and (p_event is null or event_id = p_event)
     and checked_in is distinct from true
  returning coalesce(buyer_name, buyer_email, 'Attendee') into v_name;

  if found then
    return jsonb_build_object('status', 'welcome', 'name', v_name);
  end if;

  select coalesce(t.buyer_name, t.buyer_email, 'Attendee') as nm,
         t.checked_in, t.event_id
    into v_row
    from public.tickets t
   where t.qr_code = p_qr and t.status = 'confirmed'
   limit 1;

  if v_row is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- Wrong event beats already_in: a ticket for another night must never read
  -- as a state of THIS door, checked-in or not.
  if p_event is not null and v_row.event_id is distinct from p_event then
    select e.title into v_title from public.events e where e.id = v_row.event_id;
    return jsonb_build_object('status', 'wrong_event', 'name', v_row.nm,
                              'event_title', coalesce(v_title, 'another event'));
  end if;

  return jsonb_build_object('status', 'already_in', 'name', v_row.nm);
end;
$$;

-- Door counters: same gate as the scanner itself. PII-free.
create or replace function public.door_stats(p_event uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not (public.caller_is_network() or coalesce(auth.role(), '') = 'service_role') then
    return jsonb_build_object('status', 'denied');
  end if;
  select jsonb_build_object(
    'status',     'ok',
    'confirmed',  count(*) filter (where status = 'confirmed'),
    'checked_in', count(*) filter (where status = 'confirmed' and checked_in is true)
  ) into v
  from public.tickets
  where (p_event is null or event_id = p_event);
  return v;
end;
$$;

-- ---------- 2) Event admin: list ----------
-- Members see EVERYTHING (drafts included — the events RLS policy hides
-- drafts even from authenticated, so the admin surface reads through here).
-- `sold` rides along per event: it drives the delete guard's honesty in the
-- UI and the "tickets out" count at the door.
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
  -- `sold` = confirmed tickets (the money number). `ticket_rows` = ALL ticket
  -- rows regardless of status — it drives the delete guard's UI honestly,
  -- because admin_delete_event refuses on ANY row, not just confirmed ones.
  return jsonb_build_object('ok', true, 'events', coalesce((
    select jsonb_agg(to_jsonb(e) || jsonb_build_object(
                       'sold', coalesce(s.sold, 0),
                       'ticket_rows', coalesce(s.total, 0))
                     order by e.created_at desc)
      from public.events e
      left join (select event_id,
                        count(*) filter (where status = 'confirmed') as sold,
                        count(*) as total
                   from public.tickets
                  group by event_id) s
        on s.event_id = e.id
  ), '[]'::jsonb));
end;
$$;

-- ---------- 3) Event admin: create / edit ----------
-- ONE validated write path for events. Everything a hand-written SQL insert
-- used to get wrong is rejected here with a named error the UI shows as-is:
--   • slug: lowercase kebab, <=60 chars, unique.
--   • status: draft | published | past. Publishing REQUIRES an event_date —
--     an event on sale with no date is a dishonest surface.
--   • tiers: strict shape. Only keys id/name/price/status/note/doorLabel.
--     price = INTEGER CENTS (never a float, never dollars). An 'available'
--     tier must be >= 50 cents — Stripe's card minimum; a cheaper "available"
--     tier would 500 at checkout, which is a lie at the button.
--     status: available | coming_soon | sold_out (legacy 'soon' rows are
--     normalized by the editor on load; the server accepts only the new set).
--   • is_test / lineup / experiences / created_at are NEVER written here:
--     is_test stays a migration-managed flag (0012), lineup/experiences keep
--     their current values (out of this surface's scope), created_at keeps
--     the landing's most-recent-wins sort honest.
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
    -- IS DISTINCT FROM: an ABSENT price key makes jsonb_typeof() return SQL
    -- NULL, and `null <> 'number'` is NULL → the guard would silently pass and
    -- every downstream price check would NULL-propagate past. (Adversarial
    -- review catch — the exact malformed-sellable-tier this function exists
    -- to make impossible.)
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
    insert into public.events
      (slug, title, edition, tagline, description, event_date, doors, venue, city, cover_url, status, tiers, is_test)
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
      v_status, v_tiers, false
    )
    returning * into v_row;
    v_action := 'created event “' || v_title || '” (' || v_status || ')';
  else
    select * into v_old from public.events where id = v_id;
    if v_old.id is null then
      return jsonb_build_object('ok', false, 'error', 'event not found');
    end if;
    -- A sold event must never become invisible to its buyers: 'draft' is
    -- hidden from EVERY client by events_public_read, so the buyers' ticket
    -- cards and the door picker would lose it while their tickets still
    -- exist. 'past' stays publicly readable — retiring a sold event is
    -- allowed, hiding it is not. (Mirrors the delete guard below.)
    if v_old.status = 'published' and v_status = 'draft'
       and exists (select 1 from public.tickets
                    where event_id = v_id and status = 'confirmed') then
      return jsonb_build_object('ok', false, 'error',
        'this event has sold tickets — it can''t go back to draft; mark it past instead');
    end if;
    update public.events set
      slug        = v_slug,
      title       = v_title,
      edition     = nullif(trim(coalesce(p->>'edition', '')), ''),
      tagline     = nullif(trim(coalesce(p->>'tagline', '')), ''),
      description = nullif(trim(coalesce(p->>'description', '')), ''),
      event_date  = v_date,
      doors       = nullif(trim(coalesce(p->>'doors', '')), ''),
      venue       = nullif(trim(coalesce(p->>'venue', '')), ''),
      -- No silent 'Houston' rewrite: what the admin typed is what persists —
      -- a cleared city stays cleared (same honesty rule as profile city).
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

  -- Same-transaction activity row: the feed states what the DB did, not what
  -- a client claimed. Guarded — a member without a profile row must not fail
  -- the save on the FK.
  select auth.uid() into v_actor;
  if v_actor is not null and exists (select 1 from public.profiles where id = v_actor) then
    insert into public.os_activity (profile_id, action) values (v_actor, v_action);
  end if;

  return jsonb_build_object('ok', true, 'event', to_jsonb(v_row));
end;
$$;

-- ---------- 4) Event admin: guarded delete ----------
-- An event that any ticket row points at CANNOT be deleted — with no FK on
-- tickets.event_id (known debt), a delete would orphan sold tickets silently.
-- Counts ALL ticket rows (not just confirmed): a pending/failed row still
-- proves the event has entered the money path.
create or replace function public.admin_delete_event(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n     bigint;
  v_title text;
  v_actor uuid;
begin
  if not public.caller_is_network() then
    return jsonb_build_object('ok', false, 'error', 'not_member');
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

-- ---------- grants: authenticated only; every function self-gates ----------
revoke all on function public.check_in_ticket(text, uuid) from public;
revoke all on function public.door_stats(uuid)            from public;
revoke all on function public.admin_list_events()         from public;
revoke all on function public.admin_save_event(jsonb)     from public;
revoke all on function public.admin_delete_event(uuid)    from public;

grant execute on function public.check_in_ticket(text, uuid) to authenticated, service_role;
grant execute on function public.door_stats(uuid)            to authenticated, service_role;
grant execute on function public.admin_list_events()         to authenticated;
grant execute on function public.admin_save_event(jsonb)     to authenticated;
grant execute on function public.admin_delete_event(uuid)    to authenticated;

commit;

-- ---------- verify (run as anon / plain authenticated / member) ----------
-- select public.check_in_ticket('NOPE');            -- anon → denied
-- select public.admin_list_events();                -- non-member → ok:false not_member
-- select public.admin_save_event('{"title":"x","slug":"x"}'); -- non-member → not_member
