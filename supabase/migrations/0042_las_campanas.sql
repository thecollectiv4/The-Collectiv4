-- =========================================================================
-- 0042 — LAS CAMPANAS (El Mundo v10 · D2 — the retention skeleton)
--
-- THE GAP (Gap Audit N2, structural P0): there are NO notifications. A
-- friend request, a plan invite, an RSVP, a message, a ticket sale — you
-- learn about them only if you open the app and navigate to the exact
-- surface. The founder declared retention the only door to monetization;
-- today retention isn't unproven, it is STRUCTURALLY IMPOSSIBLE. And the
-- framing correction this migration encodes: this was never blocked by
-- DNS — DNS blocks EMAIL. The in-app stream is pure front + DB.
--
-- THE SHAPE: one event stream (public.notifications) → inbox → badge →
-- mark read. Emission happens in TRIGGERS on the tables themselves (not
-- by re-declaring the social RPCs) so every write path — present and
-- future — rings the same bell. EMAIL PLUGS INTO THE SAME ROW LATER:
-- `email_sent_at` is the Resend worker's cursor; when the domain lands,
-- a worker selects rows where email_sent_at is null, sends, stamps.
-- Zero rework, same stream, same kinds.
--
-- KINDS (the spec's seven, one honest note):
--   friend_request · friend_accept · plan_invite · plan_rsvp · message ·
--   ticket_sale — live producers wired below.
--   offer_sale · match_new — kinds RESERVED in the check constraint with
--   NO producer yet: listings have no purchase path (DM-to-buy, P3 queue)
--   and "match" has no event until el verbo (v11). Reserving the kinds
--   now means email + UI need no schema change when they arrive.
--
-- THE SEED NEVER RINGS A BELL: every emitter skips is_demo actors (the
-- spirit of guardrail 2 — the seed is never counted, so it never drives
-- a badge number either). Seed→founder pending requests exist in the DB
-- but ring nothing; QA accounts (real, non-demo) exercise the bells in
-- the gate instead. No backfill: the stream starts at zero, honestly.
--
-- ANTI-CORNY LAW (data layer): message bells COALESCE — one unread bell
-- per thread per recipient, refreshed by the newest message. A bell does
-- not shout.
--
-- ADDITIVE: new table, new functions, new triggers. Nothing existing is
-- altered or dropped.
-- =========================================================================
begin;

-- ---------------------------------------------------------------- table
create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references public.profiles(id) on delete cascade,
  actor_id      uuid references public.profiles(id) on delete set null,
  kind          text not null check (kind in
                  ('friend_request','friend_accept','plan_invite','plan_rsvp',
                   'message','ticket_sale','offer_sale','match_new')),
  subject       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  read_at       timestamptz,
  email_sent_at timestamptz          -- the Resend worker's cursor (null = not emailed)
);

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (recipient_id) where read_at is null;

-- RLS: recipients read their own bells; nobody writes from the client —
-- triggers and owner-gated doors are the only writers (house doctrine).
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
drop policy if exists notifications_self_read on public.notifications;
create policy notifications_self_read on public.notifications
  for select using (recipient_id = auth.uid());

-- ------------------------------------------------------------ the emitter
-- One internal door every trigger rings through. Skips: no recipient,
-- self-notification, dead/missing recipient, and — the floor — is_demo or
-- purged ACTORS (the seed never rings a bell). SECURITY DEFINER so writes
-- pass RLS regardless of which client context fired the trigger.
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
                 where r.id = p_recipient and r.deleted_at is null) then
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
revoke all on function public.notify_emit(uuid, uuid, text, jsonb) from public;
-- not granted to any client role — triggers only.

-- ------------------------------------------------- trigger · friendships
-- INSERT pending  → the addressee hears "asked to join your circle".
-- UPDATE →accepted → the original requester hears "you're in" (covers both
-- respond_friend's accept and request_friend's ask-back acceptance, 0023).
create or replace function public.notif_on_friendship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.notify_emit(new.addressee_id, new.requester_id, 'friend_request', '{}'::jsonb);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    perform public.notify_emit(new.requester_id, new.addressee_id, 'friend_accept', '{}'::jsonb);
  end if;
  return new;
end;
$$;
drop trigger if exists notifications_friendship on public.friendships;
create trigger notifications_friendship
  after insert or update on public.friendships
  for each row execute function public.notif_on_friendship();

-- ------------------------------------------------ trigger · plan_members
-- INSERT invited (with an inviter) → the invitee hears about the plan.
-- UPDATE to in/out/maybe          → the plan's creator hears the answer.
create or replace function public.notif_on_plan_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan record;
begin
  select id, title, creator_id into v_plan
  from public.plans where id = new.plan_id;
  if v_plan.id is null then return new; end if;

  if tg_op = 'INSERT' and new.status = 'invited' and new.invited_by is not null then
    perform public.notify_emit(new.profile_id, new.invited_by, 'plan_invite',
      jsonb_build_object('plan_id', v_plan.id, 'title', v_plan.title));
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status
        and new.status in ('in','out','maybe') then
    perform public.notify_emit(v_plan.creator_id, new.profile_id, 'plan_rsvp',
      jsonb_build_object('plan_id', v_plan.id, 'title', v_plan.title, 'status', new.status));
  end if;
  return new;
end;
$$;
drop trigger if exists notifications_plan_member on public.plan_members;
create trigger notifications_plan_member
  after insert or update on public.plan_members
  for each row execute function public.notif_on_plan_member();

-- --------------------------------------------- trigger · thread_messages
-- Every DM / crew / plan-room / event-room message rings the members who
-- aren't the sender — COALESCED: one unread 'message' bell per thread per
-- recipient, refreshed in place by the newest message (anti-corny law).
-- Rooms cap at ~41 members (0023), so the fan-out loop is bounded.
create or replace function public.notif_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  -- the seed never rings a bell — checked once for the sender here
  if exists (select 1 from public.profiles a
             where a.id = new.sender_id
               and (a.is_demo = true or a.deleted_at is not null)) then
    return new;
  end if;

  for r in
    select tm.profile_id
    from public.thread_members tm
    where tm.thread_id = new.thread_id
      and tm.profile_id <> new.sender_id
  loop
    update public.notifications
       set created_at = new.created_at,
           actor_id   = new.sender_id,
           subject    = jsonb_build_object(
             'thread_id', new.thread_id,
             'preview',   left(new.body, 80))
     where recipient_id = r.profile_id
       and kind = 'message'
       and read_at is null
       and subject->>'thread_id' = new.thread_id::text;
    if not found then
      perform public.notify_emit(r.profile_id, new.sender_id, 'message',
        jsonb_build_object('thread_id', new.thread_id, 'preview', left(new.body, 80)));
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists notifications_message on public.thread_messages;
create trigger notifications_message
  after insert on public.thread_messages
  for each row execute function public.notif_on_message();

-- -------------------------------------------------- trigger · tickets
-- A confirmed ticket rings the event's HOST (the room grew by one). The
-- buyer may be anonymous (buyer_id is Base44-era TEXT; the all-zero
-- sentinel or a non-profile value resolves to actor null — the bell still
-- rings, carrying buyer_name in the subject). Seed buyers never ring
-- (notify_emit floor). Hosts are stamped by admin_save_event (0016).
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
  return new;
end;
$$;
drop trigger if exists notifications_ticket on public.tickets;
create trigger notifications_ticket
  after insert on public.tickets
  for each row execute function public.notif_on_ticket();

-- ------------------------------------------------------------ the doors
-- my_signals — the inbox read. Actor floor mirrors the seed doctrine:
-- a bell whose actor has since gone demo (retired QA) or purged is hidden
-- from non-owners, exactly like their profile is (0033).
create or replace function public.my_signals(p_limit integer default 40)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_limit int  := least(greatest(coalesce(p_limit, 40), 1), 100);
  v_rows  jsonb;
  v_unread int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id',         n.id,
           'kind',       n.kind,
           'subject',    n.subject,
           'created_at', n.created_at,
           'read_at',    n.read_at,
           'actor', case when n.actor_id is null then null else jsonb_build_object(
             'id',         a.id,
             'name',       a.full_name,
             'username',   a.username,
             'avatar_url', a.avatar_url,
             'verified',   a.verified,
             'is_demo',    a.is_demo
           ) end
         ) order by (n.read_at is null) desc, n.created_at desc), '[]'::jsonb)
    into v_rows
  from (
    select n.*
    from public.notifications n
    left join public.profiles a on a.id = n.actor_id
    where n.recipient_id = v_uid
      and (n.actor_id is null
           or (a.id is not null and a.deleted_at is null
               and (a.is_demo = false or public.is_owner())))
    order by (n.read_at is null) desc, n.created_at desc
    limit v_limit
  ) n
  left join public.profiles a on a.id = n.actor_id;

  select count(*) into v_unread
  from public.notifications n
  left join public.profiles a on a.id = n.actor_id
  where n.recipient_id = v_uid
    and n.read_at is null
    and (n.actor_id is null
         or (a.id is not null and a.deleted_at is null
             and (a.is_demo = false or public.is_owner())));

  return jsonb_build_object('ok', true, 'unread', v_unread, 'signals', v_rows);
end;
$$;
revoke all     on function public.my_signals(integer) from public;
grant  execute on function public.my_signals(integer) to authenticated;

-- signals_unread_count — the badge's cheap poll (partial index above).
create or replace function public.signals_unread_count()
returns jsonb
language plpgsql
stable
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
  select count(*) into v_n
  from public.notifications n
  left join public.profiles a on a.id = n.actor_id
  where n.recipient_id = v_uid
    and n.read_at is null
    and (n.actor_id is null
         or (a.id is not null and a.deleted_at is null
             and (a.is_demo = false or public.is_owner())));
  return jsonb_build_object('ok', true, 'count', v_n);
end;
$$;
revoke all     on function public.signals_unread_count() from public;
grant  execute on function public.signals_unread_count() to authenticated;

-- mark_signals_read — null p_ids marks everything; ids mark just those.
create or replace function public.mark_signals_read(p_ids uuid[] default null)
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
     and read_at is null
     and (p_ids is null or id = any(p_ids));
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'marked', v_n);
end;
$$;
revoke all     on function public.mark_signals_read(uuid[]) from public;
grant  execute on function public.mark_signals_read(uuid[]) to authenticated;

commit;

-- =====================================================================
-- VERIFY (after push):
--   -- anon: my_signals / signals_unread_count / mark_signals_read
--            -> {ok:false, not_authenticated}
--   -- A requests B  -> B's signals_unread_count = 1, kind friend_request
--   -- B accepts     -> A hears friend_accept
--   -- B plan-invites A -> A hears plan_invite (title in subject)
--   -- A rsvps 'in'  -> B (creator) hears plan_rsvp
--   -- A messages the room twice -> B has ONE unread message bell (coalesced)
--   -- mark_signals_read() -> count returns 0
--   -- seed actors ring nothing (is_demo floor in notify_emit)
-- =====================================================================
