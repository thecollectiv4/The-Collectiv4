-- =========================================================================
-- 0033 — SEED READ HONESTY (v8 adición C)
--
-- THE FINDING (v7 hard data): 128 accounts · 112 are is_demo · 16 real.
-- 0008/0027's read rule shows demo personas to ANY verified account — so
-- the ONLY person who saw the platform full of fake profiles was the
-- founder (verified), the person whose taste decides everything. The
-- public always saw zero. Days of "sigue sintiéndose como un app
-- cualquiera" partly trace here: he was the only one looking at the
-- fake part.
--
-- THE FIX: verified members no longer read seed rows by default. Demo
-- personas stay readable ONLY by (a) the demo row's own session and
-- (b) the founders (is_owner()) — who get an explicit "show seed"
-- toggle in /os (default OFF, client-side surface control on top of
-- this floor). ADDITIVE: no data moves, nothing is deleted; the seed
-- keeps existing for QA. The founders' moderation surface is untouched
-- (admin_list_accounts is SECURITY DEFINER owner-gated, bypasses RLS).
--
-- Everything else in 0027's posture is preserved verbatim:
--   · own row always readable (even while purged — the "gone" screen)
--   · purged rows (deleted_at) invisible to everyone else
-- =========================================================================

begin;

drop policy if exists profiles_public_read on public.profiles;
create policy profiles_public_read on public.profiles
  for select
  using (
    id::text = auth.uid()::text
    or (
      deleted_at is null
      and (
        is_demo = false
        or public.is_owner()          -- founders can still open the seed, deliberately
      )
    )
  );

commit;

-- ---------- verify (run manually) ----------
-- As a VERIFIED non-owner member:
--   select count(*) from profiles where is_demo;          -> 0   (was 112)
-- As anon:
--   GET /rest/v1/profiles?username=eq.marcusreyes         -> 0 rows (unchanged)
-- As owner (Pato):
--   select count(*) from profiles where is_demo;          -> 112 (the toggle's floor)
-- Real profiles: unchanged for everyone.
