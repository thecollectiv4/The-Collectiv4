-- =========================================================================
-- 0045 — EL CORREO DEL COMPRADOR (the buyer confirmation email)
--
-- THE GAP: a buyer pays and receives nothing. The webhook has sent a
-- confirmation since v10, but fragile: one inline Resend call, no retry,
-- an UNVERIFIED sender (onboarding@resend.dev), and no floor against the
-- seed. If Resend hiccups after the ticket saves, a Stripe re-delivery
-- hits the ticket idempotency guard and SKIPS the email — lost forever.
--
-- THE SHAPE (two paths to one email, both idempotent against email_sent_at):
--   FAST PATH   — the webhook, after recording the sale, claims + sends.
--                 The buyer's email lands in seconds.
--   SAFETY NET  — a daily sweep claims the un-emailed rows the fast path
--                 lost (Resend down, timeout, deploy mid-transaction).
--   email_sent_at is the LOCK. The claim is a conditional UPDATE: two
--   callers race the same row, the loser gets nothing and sends nothing.
--   A send that fails RELEASES the claim (email_sent_at → null) so the
--   safety net retries; a lost email is recoverable, a double email is spam.
--
-- THE SEED NEVER RECEIVES: mirrors the notify_emit floor (0042/0043). A
-- buyer that resolves to a demo profile is a fixture — never a real email
-- from our domain. 18 of 21 tickets today are seed; the floor is load-
-- bearing, not theoretical.
--
-- START AT ZERO: every ticket that predates this system is stamped in the
-- backfill so the sweep never surprise-emails an old test buyer. The email
-- stream begins with the NEXT sale (mirrors 0042's no-backfill doctrine).
--
-- ADDITIVE: three columns, one index, four functions. Nothing dropped.
-- =========================================================================
begin;

-- ---------------------------------------------------------------- columns
-- email_sent_at: the lock + the sweep's cursor (null = not emailed).
-- tier_name / tier_id: the ticket becomes self-describing, so the sweep can
--   compose the same email the webhook does — WITHOUT Stripe metadata in hand.
alter table public.tickets add column if not exists email_sent_at timestamptz;
alter table public.tickets add column if not exists tier_name text;
alter table public.tickets add column if not exists tier_id text;

-- ------------------------------------------------------ start-at-zero backfill
-- Stamp every pre-existing ticket so the safety net never emails a buyer who
-- paid before this system existed (the 3 real ones here are founder self-tests
-- from May–Jul; the other 18 are seed). Honest zero, like the bell stream.
update public.tickets set email_sent_at = now() where email_sent_at is null;

-- the sweep's cheap scan of the un-emailed.
create index if not exists tickets_email_pending_idx
  on public.tickets (created_at) where email_sent_at is null;

-- --------------------------------------------------------------- seed floor
-- A buyer_id that resolves to a demo profile is a fixture. buyer_id is
-- Base44-era TEXT: a non-uuid (or the all-zero sentinel, or a value with no
-- profile) is a REAL anonymous buyer, not seed — they get their ticket.
create or replace function public.ticket_is_seed(p_buyer_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare v uuid;
begin
  begin
    v := p_buyer_id::uuid;
  exception when others then
    return false;   -- non-uuid buyer is real, not seed
  end;
  return exists (select 1 from public.profiles where id = v and is_demo = true);
end;
$$;

-- ----------------------------------------------------------- the sweep list
-- Confirmed, un-emailed, not seed, within a bounded window so a permanently
-- failing address never retries forever (older misses surface via
-- email_failures for a human, not an infinite loop).
create or replace function public.tickets_pending_email(p_limit integer default 100)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.tickets
  where status = 'confirmed'
    and email_sent_at is null
    and created_at > now() - interval '7 days'
    and not public.ticket_is_seed(buyer_id)
  order by created_at asc
  limit greatest(1, least(coalesce(p_limit, 100), 200));
$$;

-- ------------------------------------------------------------- atomic claim
-- Stamp email_sent_at (the lock) and hand back everything needed to compose
-- the email. The conditional UPDATE is the arbiter between the fast path and
-- the sweep: the row goes to exactly one caller; the other gets no row and
-- sends nothing. Seed / non-confirmed / already-sent never claim.
create or replace function public.claim_ticket_email(p_ticket_id uuid)
returns table(
  buyer_email text, buyer_name text, qr_code text, price_paid numeric,
  tier_name text, ev_title text, ev_edition text, ev_date timestamptz,
  ev_doors text, ev_venue text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tickets t
     set email_sent_at = now()
   where t.id = p_ticket_id
     and t.email_sent_at is null
     and t.status = 'confirmed'
     and not public.ticket_is_seed(t.buyer_id);
  if not found then
    return;   -- already sent, concurrently claimed, seed, or not confirmed
  end if;
  return query
    select t.buyer_email, t.buyer_name, t.qr_code, t.price_paid, t.tier_name,
           e.title, e.edition, e.event_date, e.doors, e.venue
    from public.tickets t
    left join public.events e on e.id = t.event_id
    where t.id = p_ticket_id;
end;
$$;

-- --------------------------------------------------------- release on failure
-- A send that failed hands the row back to the safety net. Never called on a
-- send that succeeded.
create or replace function public.release_ticket_email(p_ticket_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.tickets set email_sent_at = null where id = p_ticket_id;
$$;

-- --------------------------------------------------------------------- grants
-- Internal doors: the API calls them with the service key. No client role
-- gets them (house doctrine — mirrors notify_emit).
revoke all on function public.ticket_is_seed(text)              from public, anon, authenticated;
revoke all on function public.tickets_pending_email(integer)    from public, anon, authenticated;
revoke all on function public.claim_ticket_email(uuid)          from public, anon, authenticated;
revoke all on function public.release_ticket_email(uuid)        from public, anon, authenticated;
grant execute on function public.ticket_is_seed(text)           to service_role;
grant execute on function public.tickets_pending_email(integer) to service_role;
grant execute on function public.claim_ticket_email(uuid)       to service_role;
grant execute on function public.release_ticket_email(uuid)     to service_role;

commit;

-- =====================================================================
-- VERIFY (after push):
--   -- a SEED ticket id: claim_ticket_email(id) -> 0 rows (never sends)
--   -- a fresh REAL ticket: claim -> 1 row with payload; email_sent_at set
--   -- claim the SAME real ticket again -> 0 rows (idempotent, no 2nd email)
--   -- release_ticket_email(id) -> claim returns a row again (retry works)
--   -- tickets_pending_email(100) -> excludes every seed + every stamped row
-- =====================================================================
