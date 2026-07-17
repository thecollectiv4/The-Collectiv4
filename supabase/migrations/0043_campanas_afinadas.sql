-- =========================================================================
-- 0043 — LAS CAMPANAS, AFINADAS (El Mundo v10 · review adversarial operado)
--
-- The multi-agent adversarial review of 0042 confirmed defects; this
-- migration operates them. In review order of severity:
--
--  1. HIGH — notify_emit was client-callable. Supabase's default
--     privileges grant EXECUTE to anon+authenticated DIRECTLY (not via
--     PUBLIC), so 0042's `revoke ... from public` left both roles able
--     to call the SECURITY DEFINER emitter and forge bells for anyone
--     (verified live: proacl showed anon=X, authenticated=X). Exactly
--     the pitfall 0019 documents. Fixed with explicit role revokes.
--  2. MEDIUM — reading a thread never cleared its message bell: the
--     normal flow (badge → Messages → open the thread) left the bell
--     unread forever, permanently inflating the badge. New door
--     mark_thread_signals_read(p_thread) bridges thread reads to the
--     stream; the client calls it beside markThreadRead.
--  3. MEDIUM — the update-then-insert coalescing raced: two concurrent
--     sends in one room could both miss the UPDATE and double the bell.
--     Now a partial unique index arbiters and the trigger uses
--     insert ... on conflict do update (also resetting email_sent_at,
--     so a refreshed bell is a new emailable moment for the Resend
--     worker — the LOW the review caught on the cursor).
--  4. LOW — RSVP/invite bells rang for CANCELED plans; now gated on
--     plans.status = 'live'.
--  5. NIT — demo RECIPIENTS now floored too (accepting a seed request
--     wrote rows no purge reaches); the seed neither rings nor receives.
--  6. Hardening — every notif trigger body is wrapped so a notification
--     failure can NEVER abort the underlying user write. A lost bell is
--     recoverable; a lost paid ticket is not.
--
-- ADDITIVE: replaces 0042's functions in place, adds one index and one
-- door. No data changes, no drops.
-- =========================================================================
begin;

-- ---------------------------------------------------------------- 1 · ACL
-- Supabase default privileges granted these directly; strip the emitter
-- from every client role. (The three doors keep their intentional
-- authenticated grant; anon on them is harmless — auth.uid() null walls
-- them — but the emitter must be triggers-only.)
revoke all on function public.notify_emit(uuid, uuid, text, jsonb) from public, anon, authenticated;

-- ------------------------------------------------- 5 · the emitter floor
-- The seed neither rings (0042) nor RECEIVES (0043): a bell for a fixture
-- serves no one and would outlive the purge (0037 soft-deletes profiles,
-- never notifications).
create or replace function public.notify_emit(
  p_recipient uuid, p_actor uuid, p_kind text, p_subject jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_recipient is null then return; end if;
  if p_actor is not null and p_actor = p_recipient then return; end if;
  if not exists (select 1 from public.profiles r
                 where r.id = p_recipient
                   and r.deleted_at is null
                   and r.is_demo = false) then
    return;
  end if;
  if p_actor is not null and exists (select 1 from public.profiles a
                 where a.id = p_actor
                   and (a.is_demo = true or a.deleted_at is not null)) then
    return;
  end if;
  insert into public.notifications (recipient_id, actor_id, kind, subject)
  values (p_recipient, p_actor, p_kind, coalesce(p_subject, '{}'::jsonb));
end;
$$;
revoke all on function public.notify_emit(uuid, uuid, text, jsonb) from public, anon, authenticated;

-- ------------------------------------------- 6 · friendships, guarded
create or replace function public.notif_on_friendship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if tg_op = 'INSERT' and new.status = 'pending' then
      perform public.notify_emit(new.addressee_id, new.requester_id, 'friend_request', '{}'::jsonb);
    elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
      perform public.notify_emit(new.requester_id, new.addressee_id, 'friend_accept', '{}'::jsonb);
    end if;
  exception when others then
    null;  -- a lost bell never aborts the friendship write
  end;
  return new;
end;
$$;

-- ------------------------------- 4 + 6 · plan_members, live-only, guarded
create or replace function public.notif_on_plan_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan record;
begin
  begin
    select id, title, creator_id, status into v_plan
    from public.plans where id = new.plan_id;
    if v_plan.id is null or v_plan.status <> 'live' then return new; end if;

    if tg_op = 'INSERT' and new.status = 'invited' and new.invited_by is not null then
      perform public.notify_emit(new.profile_id, new.invited_by, 'plan_invite',
        jsonb_build_object('plan_id', v_plan.id, 'title', v_plan.title));
    elsif tg_op = 'UPDATE' and new.status is distinct from old.status
          and new.status in ('in','out','maybe') then
      perform public.notify_emit(v_plan.creator_id, new.profile_id, 'plan_rsvp',
        jsonb_build_object('plan_id', v_plan.id, 'title', v_plan.title, 'status', new.status));
    end if;
  exception when others then
    null;  -- a lost bell never aborts the RSVP/invite write
  end;
  return new;
end;
$$;

-- ------------------------- 3 + 6 · messages: race-free coalesce, guarded
-- The arbiter: at most ONE unread message bell per (recipient, thread).
create unique index if not exists notifications_message_coalesce_uidx
  on public.notifications (recipient_id, ((subject->>'thread_id')))
  where kind = 'message' and read_at is null;

create or replace function public.notif_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  begin
    -- the seed never rings — checked once for the sender
    if exists (select 1 from public.profiles a
               where a.id = new.sender_id
                 and (a.is_demo = true or a.deleted_at is not null)) then
      return new;
    end if;

    for r in
      select tm.profile_id
      from public.thread_members tm
      join public.profiles p on p.id = tm.profile_id
      where tm.thread_id = new.thread_id
        and tm.profile_id <> new.sender_id
        and p.deleted_at is null
        and p.is_demo = false
    loop
      insert into public.notifications (recipient_id, actor_id, kind, subject)
      values (r.profile_id, new.sender_id, 'message',
              jsonb_build_object('thread_id', new.thread_id, 'preview', left(new.body, 80)))
      on conflict (recipient_id, ((subject->>'thread_id')))
        where kind = 'message' and read_at is null
      do update set
        created_at    = now(),
        actor_id      = excluded.actor_id,
        subject       = excluded.subject,
        email_sent_at = null;   -- a refreshed bell is a new emailable moment
    end loop;
  exception when others then
    null;  -- a lost bell never aborts the message insert
  end;
  return new;
end;
$$;

-- --------------------------------------- 6 · tickets: guarded (paid path)
create or replace function public.notif_on_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
  v_buyer uuid;
begin
  begin
    select id, slug, title, host_id into v_event
    from public.events where id = new.event_id;
    if v_event.id is null or v_event.host_id is null then return new; end if;

    begin
      v_buyer := new.buyer_id::uuid;
    exception when others then
      v_buyer := null;
    end;
    if v_buyer is not null and not exists (
      select 1 from public.profiles b where b.id = v_buyer) then
      v_buyer := null;
    end if;

    perform public.notify_emit(v_event.host_id, v_buyer, 'ticket_sale',
      jsonb_build_object('event_id', v_event.id, 'slug', v_event.slug,
                         'title', v_event.title, 'buyer_name', new.buyer_name));
  exception when others then
    null;  -- a lost bell must NEVER cost a paid ticket
  end;
  return new;
end;
$$;

-- ------------------------------------------- 2 · the thread-read bridge
-- Reading the room IS reading the bell: called beside markThreadRead so
-- the badge tells the truth after the normal flow, not only after a tap
-- on the bell row itself.
create or replace function public.mark_thread_signals_read(p_thread uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_n   int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  update public.notifications
     set read_at = now()
   where recipient_id = v_uid
     and kind = 'message'
     and read_at is null
     and subject->>'thread_id' = p_thread::text;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'marked', v_n);
end;
$$;
revoke all     on function public.mark_thread_signals_read(uuid) from public, anon;
grant  execute on function public.mark_thread_signals_read(uuid) to authenticated;

commit;

-- =====================================================================
-- VERIFY (after push):
--   -- proacl of notify_emit carries NO anon/authenticated entry
--   -- authed client rpc notify_emit -> permission denied
--   -- two rapid messages, same thread -> ONE unread bell (index arbiters)
--   -- open the thread (mark_thread_signals_read) -> badge count drops
--   -- rsvp on a canceled plan -> no bell
-- =====================================================================
