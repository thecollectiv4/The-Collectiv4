-- =====================================================================
-- 0009 — Owner-authoritative profile list for /network. The Collectiv4.
--        Applied via Supabase CLI (db push).
--
-- WHY THIS EXISTS (the /network "renders nothing for the owner" bug):
--   /network read the profiles table directly from the client and (a) discarded
--   the query error and (b) gated the whole page on a hardcoded client-side
--   OWNER_EMAILS list. When the read came back empty/errored, the page silently
--   rendered an empty state — indistinguishable from "you're not an owner." The
--   founder's session IS a valid owner (is_owner() returns true for his JWT,
--   proven), yet he saw nothing.
--
--   Fix, per the standing pattern (same shape as set_verified + the door RPCs):
--   make the DB the single authority for BOTH "am I an owner?" and "what rows do
--   I get?" in one SECURITY DEFINER call. The client stops guessing and stops
--   swallowing errors. is_owner() (0008) is the unforgeable gate — the caller's
--   VERIFIED JWT email, never client-trusted.
--
--   SECURITY DEFINER means the inner read runs as the function owner, bypassing
--   RLS — so this is NOT dependent on (and does NOT change) profiles_public_read.
--   Public RLS is left exactly as 0008 set it. No policy is widened.
--
-- Returns jsonb, mirroring set_verified's contract:
--   owner      -> { ok:true, rows:[ ...all profiles, demos included... ] }
--   non-owner  -> { ok:false, error:'not_owner' }  (no rows, no leak)
--
-- Touches no data, no prices, no tickets, no policies. Read-only + additive.
-- =====================================================================

begin;

create or replace function public.list_network_profiles()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  -- gate: only a signed-in OWNER may list the full network. Unforgeable JWT email.
  -- anon (no JWT) and any non-owner authenticated caller -> not_owner, no rows.
  if not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;

  -- owner path: the FULL list, demos included, ordered exactly as the UI wants
  -- (verified first, then name). SECURITY DEFINER bypasses RLS on this read.
  select coalesce(
           jsonb_agg(to_jsonb(t) order by t.verified desc, t.full_name asc nulls last),
           '[]'::jsonb)
    into v_rows
  from (
    select id, full_name, username, discipline, city, avatar_url, verified, is_demo
    from public.profiles
  ) t;

  return jsonb_build_object('ok', true, 'rows', v_rows);
end;
$$;

-- Grants. is_owner() inside is the real enforcement (SECURITY DEFINER, unforgeable
-- JWT email), so reaching the function is harmless: a non-owner call returns
-- {ok:false,not_owner} and zero rows. Granting anon too lets a logged-out visitor
-- to /network get a clean "owners only" verdict instead of a 403 the client would
-- have to special-case. Mirrors the 0008 reasoning for set_verified.
revoke all     on function public.list_network_profiles() from public;
grant  execute on function public.list_network_profiles() to anon, authenticated;

commit;

-- ---------- verify (simulated authenticated owner, rolled back) ----------
--   begin;
--   set local role authenticated;
--   select set_config('request.jwt.claims',
--     json_build_object('role','authenticated','email','patduranchacon@gmail.com',
--       'sub','c255c33b-60d5-4e53-a81a-2f89d7f5ad1b')::text, true);
--   select public.list_network_profiles();   -- { ok:true, rows:[9 profiles] }
--   rollback;
-- Anon (no jwt): select public.list_network_profiles();  -- { ok:false, not_owner }
