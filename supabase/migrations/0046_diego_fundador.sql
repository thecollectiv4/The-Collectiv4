-- =====================================================================
-- 0046 — Diego (co-founder) joins the owner allowlist. The Collectiv4.
--        Applied via Supabase CLI (db push).
--
-- WHY: "founder / owner" is not a DB row — it is the email allowlist inside
-- public.is_owner() (0008). Every founder-only surface routes through it:
--   • /os extra tabs — Network / Moderation / Retention (OS.jsx gates on the
--     server `owner` verdict from my_os_identity(), 0014).
--   • the seed worlds + "SEED VISIBLE · MANAGE IN /OS" pill (isOwnerFounder()
--     → my_os_identity().owner, same is_owner()).
-- Both gates read the SAME field. Diego's login (dievillovalle@gmail.com) was
-- never in the list, so he saw only the member surface (he is already
-- verified=true). This is a documented oversight, not a preference change.
--
-- THE CHANGE: add ONE email next to Pato's. The function's logic is untouched —
-- same STABLE SECURITY DEFINER shape, same JWT-email check. No other email is
-- added or removed. Touches no data rows, no prices, no verified/lock_verified.
-- Idempotent (create or replace).
-- =====================================================================

begin;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'patduranchacon@gmail.com',   -- founder Pato — active app-login (verified in auth.users, 0006)
    'patduranchacon@icloud.com',  -- founder Pato — older account, kept as fallback
    'dievillovalle@gmail.com'     -- founder Diego Villaseñor — co-founder (added 0046, was missing)
  );
$$;

commit;

-- ---------- verify (read from prod after db push) ----------
--   select pg_get_functiondef('public.is_owner'::regproc);   -- 3 emails, Pato's two intact
-- Founder count (distinct people) goes 1 -> 2; email entries 2 -> 3 (+1 exactly).
-- is_owner() reads auth.jwt()->>'email' per request, so Diego's existing session
-- already satisfies it — a page reload is enough; no sign-out / sign-in needed.
