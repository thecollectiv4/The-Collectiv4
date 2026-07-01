-- =====================================================================
-- 0004 — Claim your world: link a paid ticket to the buyer's profile
--        via their own VERIFIED email, RLS-safe.
-- The Collectiv4 platform.  Run in Supabase SQL Editor (or via CLI).
--
-- WHY: tickets RLS is `tickets_self_read = auth.uid() = buyer_id` and there is
-- NO client update policy — so a buyer can never relink a ticket from the
-- browser. The normal path is already fine (checkout requires login, so the
-- webhook stores buyer_id = the buyer's uid). But a ticket bought without a
-- resolvable user_id lands ORPHANED under the all-zero sentinel buyer_id
-- (see webhook.js) and is then invisible/unusable to everyone.
--
-- This SECURITY DEFINER function lets a logged-in user CLAIM such an orphaned
-- ticket — but ONLY when the ticket's Stripe buyer_email equals the caller's
-- OWN token email (auth.jwt() ->> 'email'). The email is taken from the verified
-- token, never passed by the client, so a user can only ever claim tickets that
-- were paid for under their own email. It never moves a ticket that already
-- belongs to a real account, so it can't steal another member's ticket.
--
-- Touches ONLY tickets.buyer_id. Does NOT touch profiles, the `verified` column,
-- or the lock_verified trigger. Additive + idempotent (create or replace).
-- Prices are untouched (still cents).
-- =====================================================================

begin;

create or replace function public.claim_my_tickets()
returns integer            -- how many orphaned tickets were linked to the caller
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid    := auth.uid();
  v_email text    := lower(nullif(auth.jwt() ->> 'email', ''));
  v_n     integer := 0;
begin
  -- Must be an authenticated user whose token carries an email.
  if v_uid is null or v_email is null then
    return 0;
  end if;

  -- Link ORPHANED confirmed tickets (bought with no resolvable user_id, so the
  -- webhook stored the all-zero sentinel buyer_id) whose Stripe buyer_email matches
  -- THIS caller's verified token email. We deliberately restrict to the sentinel so
  -- a ticket already owned by a real account is never reassigned.
  update public.tickets
     set buyer_id = v_uid
   where status = 'confirmed'
     and buyer_id = '00000000-0000-0000-0000-000000000000'
     and lower(buyer_email) = v_email;

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Client roles: only an authenticated user may claim (keyed to their own token
-- email inside the function). anon cannot.
revoke all     on function public.claim_my_tickets() from public;
grant  execute on function public.claim_my_tickets() to authenticated;

commit;

-- ---------- Manual test (run as an authenticated session, e.g. from the app) ----------
-- select public.claim_my_tickets();   -- returns the number of tickets linked to you.
