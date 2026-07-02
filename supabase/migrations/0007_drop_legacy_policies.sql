-- =====================================================================
-- 0007 — Close the Base44-era RLS holes + move door check-in server-side.
-- The Collectiv4 platform. Applied via Supabase CLI (db push).
--
-- WHY: 0001 created strict policies but never DROPPED the legacy permissive
-- ones ("Users can insert profiles" with_check(true), "Tickets viewable"
-- using(true), etc.). Postgres ORs permissive policies together, so the
-- legacy ones nullified the strict ones. Audited live (jul 1): 16 permissive
-- leftovers across 9 tables. Concretely open before this migration:
--   • tickets: ANY anon key could read ALL tickets (buyer emails, names,
--     stripe ids, QR codes) and INSERT forged confirmed tickets.
--   • profiles: ANY anon key could UPDATE any profile and INSERT junk rows
--     (proven by an adversarial probe on jul 1).
--   • email_failures / chat / posts / services / moves / messages /
--     conversations: anon read and/or write.
--
-- WHAT STAYS (the intended posture): profiles_public_read, profiles_self_*,
-- tickets_self_read, chat_read_auth, chat_insert_self, events_public_read.
-- Tables with RLS on and no policies remain deny-all to client keys.
--
-- DOOR CHECK-IN: the scan flow read tickets by qr_code client-side and only
-- worked through the "Tickets viewable" leak (its checked_in UPDATE already
-- silently failed — no update policy existed). It moves into check_in_ticket()
-- below: SECURITY DEFINER, authenticated-only, atomic, and returns only what
-- the door needs (status + display name) — never emails or payment ids.
--
-- Does NOT touch: verified / lock_verified, prices, any data rows. Idempotent.
-- =====================================================================

begin;

-- ---------- 1) Drop every legacy permissive policy ----------
drop policy if exists "Public profiles are viewable"      on public.profiles;
drop policy if exists "Users can insert profiles"         on public.profiles;
drop policy if exists "Users can update profiles"         on public.profiles;

drop policy if exists "Tickets viewable"                  on public.tickets;
drop policy if exists "Users can insert tickets"          on public.tickets;

drop policy if exists "Anyone can read chat"              on public.chat_messages;
drop policy if exists "Anyone can insert chat"            on public.chat_messages;

drop policy if exists "Service can manage email_failures" on public.email_failures;

drop policy if exists "Public posts are viewable"         on public.posts;
drop policy if exists "Users can insert posts"            on public.posts;

drop policy if exists "Public services are viewable"      on public.services;
drop policy if exists "Users can insert services"         on public.services;

drop policy if exists "Public moves are viewable"         on public.moves;
drop policy if exists "Users can insert moves"            on public.moves;
drop policy if exists "Users can update moves"            on public.moves;

drop policy if exists "Messages viewable"                 on public.messages;
drop policy if exists "Users can insert messages"         on public.messages;

drop policy if exists "Conversations viewable"            on public.conversations;
drop policy if exists "Users can insert conversations"    on public.conversations;

-- ---------- 2) Door check-in, server-side ----------
-- Atomic scan: one call flips checked_in and reports the outcome. Returns ONLY
-- door-safe fields. Authenticated-only (door staff sign in); anon gets nothing,
-- so the public can't probe QR codes.
create or replace function public.check_in_ticket(p_qr text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_row  record;
begin
  if coalesce(auth.role(), '') <> 'authenticated' and coalesce(auth.role(), '') <> 'service_role' then
    return jsonb_build_object('status', 'denied');
  end if;

  update public.tickets
     set checked_in = true
   where qr_code = p_qr
     and status = 'confirmed'
     and checked_in is distinct from true
  returning coalesce(buyer_name, buyer_email, 'Attendee') into v_name;

  if found then
    return jsonb_build_object('status', 'welcome', 'name', v_name);
  end if;

  select coalesce(buyer_name, buyer_email, 'Attendee') as nm, checked_in
    into v_row
    from public.tickets
   where qr_code = p_qr and status = 'confirmed'
   limit 1;

  if v_row is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  return jsonb_build_object('status', 'already_in', 'name', v_row.nm);
end;
$$;

-- Door counters (confirmed / checked-in), PII-free.
create or replace function public.door_stats(p_event uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'confirmed',  count(*) filter (where status = 'confirmed'),
    'checked_in', count(*) filter (where status = 'confirmed' and checked_in is true)
  )
  from public.tickets
  where (p_event is null or event_id = p_event);
$$;

revoke all     on function public.check_in_ticket(text) from public;
revoke all     on function public.door_stats(uuid)      from public;
grant  execute on function public.check_in_ticket(text) to authenticated;
grant  execute on function public.door_stats(uuid)      to authenticated;

commit;

-- ---------- verify ----------
-- select polname from pg_policy where polrelid='public.tickets'::regclass;
-- Expect ONLY tickets_self_read. Anon read of tickets should return zero rows.
