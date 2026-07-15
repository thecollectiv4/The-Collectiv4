-- =====================================================================
-- 0021 — EVENT VIBE: cada evento declara su carácter (El Mundo v5, D2+D4).
--        The Collectiv4 platform. Applied via Supabase CLI (db push).
--
-- WHAT / WHY:
--   v5 gives every event a CHARACTER the host declares at creation: the
--   experience temperature (live-art / sound / gallery / day / mixed), the
--   sounds it speaks (music tags), and one optional character line. The
--   temperature drives Ley 14 (light and color with meaning) on the public
--   room; the sound tags are the event side of the matching column (events
--   connect to the people who share the taste).
--
--   * events.vibe   — ONE nullable jsonb column:
--                       { "kind": "sound", "sound": ["house","techno"], "line": "…" }
--                     NULL = the event never declared a character (every
--                     existing row) — surfaces render exactly as before.
--   * admin_save_event — REPLACED with the same body as 0016 plus vibe
--                     validation + persistence (the 0016-over-0013 pattern,
--                     marked VIBE). No other behavior changes: same gates,
--                     same host stamping, same tier validation. A payload
--                     without 'vibe' keeps the stored value untouched on
--                     edit, so older clients can never erase a character.
--
-- HONEST-BY-CODE / SAFETY (mirrors 0016/0019/0020):
--   * Purely ADDITIVE: one nullable column; zero changes to prices, tickets,
--     tiers, RLS, lock_verified, lineup, experiences, or the Stripe path.
--   * Idempotent: add-column-if-not-exists + create-or-replace function.
--   * vibe is validated server-side: whitelisted keys, known kinds, capped
--     tag count/length — a client can never store an arbitrary blob.
-- =====================================================================

begin;

alter table public.events add column if not exists vibe jsonb;

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
  -- VIBE (0021)
  v_vibe        jsonb;
  v_vibe_given  boolean := (p ? 'vibe');
  v_kind        text;
  v_line        text;
  v_sound       jsonb;
  s             jsonb;
  v_sounds      jsonb := '[]'::jsonb;
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

  -- ---------- VIBE (0021): validate + normalize the declared character ----
  -- 'vibe' absent from the payload -> keep the stored value (edits from
  -- older clients never erase). Present-but-null/empty -> clears it.
  if v_vibe_given then
    v_vibe := p->'vibe';
    if v_vibe is null or jsonb_typeof(v_vibe) = 'null' then
      v_vibe := null;
    elsif jsonb_typeof(v_vibe) <> 'object' then
      return jsonb_build_object('ok', false, 'error', 'vibe must be an object');
    else
      for k in select jsonb_object_keys(v_vibe) loop
        if k not in ('kind', 'sound', 'line') then
          return jsonb_build_object('ok', false, 'error', 'unknown vibe key: ' || k);
        end if;
      end loop;
      v_kind := nullif(trim(coalesce(v_vibe->>'kind', '')), '');
      if v_kind is not null and v_kind not in ('live-art', 'sound', 'gallery', 'day', 'mixed') then
        return jsonb_build_object('ok', false, 'error', 'vibe kind must be live-art, sound, gallery, day or mixed');
      end if;
      v_line := nullif(trim(coalesce(v_vibe->>'line', '')), '');
      if v_line is not null and length(v_line) > 80 then
        return jsonb_build_object('ok', false, 'error', 'vibe line: 80 characters max');
      end if;
      v_sound := coalesce(v_vibe->'sound', '[]'::jsonb);
      if jsonb_typeof(v_sound) <> 'array' then
        return jsonb_build_object('ok', false, 'error', 'vibe sound must be an array of tags');
      end if;
      if jsonb_array_length(v_sound) > 6 then
        return jsonb_build_object('ok', false, 'error', 'vibe sound: 6 tags max');
      end if;
      for s in select * from jsonb_array_elements(v_sound) loop
        if jsonb_typeof(s) <> 'string' or length(trim(s #>> '{}')) = 0 or length(s #>> '{}') > 24 then
          return jsonb_build_object('ok', false, 'error', 'each sound tag must be text, 24 characters max');
        end if;
        v_sounds := v_sounds || to_jsonb(lower(trim(s #>> '{}')));
      end loop;
      -- normalized: only what was actually declared, nothing invented
      v_vibe := jsonb_strip_nulls(jsonb_build_object(
        'kind', v_kind,
        'sound', case when jsonb_array_length(v_sounds) > 0 then v_sounds else null end,
        'line', v_line
      ));
      if v_vibe = '{}'::jsonb then v_vibe := null; end if;
    end if;
  end if;

  if v_id is null then
    -- HOST: every new event belongs to its creator; only a founder's event
    -- is a house event (the root landing's pool). Stamped here, where the
    -- client can't lie — identity is the JWT, never a payload field.
    insert into public.events
      (slug, title, edition, tagline, description, event_date, doors, venue, city, cover_url, status, tiers, is_test, host_id, is_house, vibe)
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
      auth.uid(), public.is_owner(),
      case when v_vibe_given then v_vibe else null end
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
      tiers       = v_tiers,
      -- VIBE: only a payload that SPEAKS vibe can change it
      vibe        = case when v_vibe_given then v_vibe else v_old.vibe end
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

commit;
