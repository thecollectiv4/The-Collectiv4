-- =====================================================================
-- 0008 — Verified-grant mechanism ("our network" badge) + hide demo
--        profiles on direct links. The Collectiv4 platform.
--        Applied via Supabase CLI (db push).
--
-- TWO things, both additive / RLS-safe / idempotent:
--
--  (A) GRANT PATH. 0002's lock_verified trigger blocks anon/authenticated from
--      ever writing profiles.verified (self-award = meaningless badge). Good —
--      that stays. But there was NO owner path to grant it except raw SQL in the
--      dashboard ("manual SQL is dead here"). This adds public.set_verified():
--      an owner-gated SECURITY DEFINER RPC. Enforcement is the caller's VERIFIED
--      JWT email (public.is_owner()) — never client-trusted. To let ONLY this
--      function write the column, it opens a transaction-local escape hatch
--      (set_config('app.grant_verified','1',true)) that the trigger recognizes.
--      A client can't exploit the hatch: each PostgREST request is its own
--      transaction, and a local GUC dies at txn end — so a raw PATCH /profiles
--      can never be in the same txn as a set of the flag. The flag is set ONLY
--      inside set_verified, AFTER the owner check, and closed immediately.
--
--  (B) HIDE DEMOS ON DIRECT LINKS. /discover already filters is_demo=false in
--      the query, but 0001's profiles_public_read is `using(true)` — so a demo
--      persona is still readable directly at /user/:id via the anon key. Replace
--      that policy so anon/public can only read is_demo=false rows. Owner,
--      the row's own account, and verified members still see everything (keeps
--      the /discover preview parity). Honest-by-code, enforced at the DB.
--
-- Does NOT touch prices, tickets, the verified column's default, or any data
-- rows. lock_verified stays intact for every non-owner path.
-- =====================================================================

begin;

-- ---------- helper: is the caller an owner? (JWT email allowlist) ----------
-- Reads the VERIFIED email claim off the request JWT — unforgeable, signed by
-- Supabase Auth. anon (no JWT) → '' → false. Used by set_verified + the RLS
-- policy below. Mirrors the client OWNER_EMAILS gate in Discover.jsx.
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'patduranchacon@gmail.com',   -- founder's active app-login (verified in auth.users, 0006)
    'patduranchacon@icloud.com'   -- older founder account, kept as fallback
  );
$$;

-- ---------- helper: is the caller a verified member? ----------
-- SECURITY DEFINER so the inner read bypasses RLS → no policy recursion when
-- this is called from profiles_public_read. Returns false for anon (uid null).
create or replace function public.caller_is_verified()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id::text = auth.uid()::text and verified = true
  );
$$;

-- ---------- (A) trigger: add the owner escape hatch, keep all else ----------
-- Identical to 0002 EXCEPT the first guard: if the transaction-local flag is on
-- (only public.set_verified sets it, only after the owner check), allow the
-- write through untouched. Every other path still hits the client-role lock.
create or replace function public.lock_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- owner escape hatch (see header (A)) — scoped to one transaction, set only
  -- by public.set_verified after is_owner() passed.
  if current_setting('app.grant_verified', true) = '1' then
    return new;
  end if;

  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.verified := false;             -- clients never CREATE a verified row
    elsif new.verified is distinct from old.verified then
      new.verified := old.verified;      -- clients never CHANGE verified
    end if;
  end if;
  return new;
end;
$$;
-- trigger trg_lock_verified from 0002 already points at this function — untouched.

-- ---------- (A) the owner grant/revoke RPC ----------
create or replace function public.set_verified(p_target uuid, p_verified boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new boolean;
begin
  -- gate: only a signed-in OWNER may grant/revoke. Unforgeable JWT email.
  if not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;

  -- open the trigger hatch for THIS transaction only, write, close immediately.
  perform set_config('app.grant_verified', '1', true);
  update public.profiles
     set verified = p_verified
   where id::text = p_target::text
  returning verified into v_new;
  perform set_config('app.grant_verified', '0', true);

  if v_new is null then                    -- verified is NOT NULL, so null ⟺ no row matched
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return jsonb_build_object('ok', true, 'id', p_target, 'verified', v_new);
end;
$$;

-- Grants. NOTE: Supabase's default privileges re-grant EXECUTE on public functions
-- to anon+authenticated, so anon can still REACH this RPC — and that's fine: the real
-- enforcement is is_owner() inside (SECURITY DEFINER, unforgeable JWT email). Proven:
-- an anon call returns {ok:false, not_owner} and changes nothing. The revoke below is
-- defense-in-depth on the PUBLIC grant; it does not (and need not) block anon.
revoke all     on function public.set_verified(uuid, boolean) from public;
grant  execute on function public.set_verified(uuid, boolean) to authenticated;

-- ---------- (B) hide demo profiles from the public/anon path ----------
-- Replaces 0001's `using(true)`. Demo personas are readable only by the owner,
-- the row's own account, or a verified member — never anon/public direct links.
drop policy if exists profiles_public_read on public.profiles;
create policy profiles_public_read on public.profiles
  for select
  using (
    is_demo = false
    or id::text = auth.uid()::text
    or public.is_owner()
    or public.caller_is_verified()
  );

commit;

-- ---------- verify (run manually / see the branch handback) ----------
-- Anon (public anon key) should get a real profile but NOT a demo one:
--   GET /rest/v1/profiles?select=username,is_demo&username=eq.patoduranc   -> 1 row
--   GET /rest/v1/profiles?select=username,is_demo&username=eq.marcusreyes  -> 0 rows
-- Grant path (simulated authenticated owner, rolled back):
--   begin;
--   set local role authenticated;
--   select set_config('request.jwt.claims',
--     json_build_object('role','authenticated','email','patduranchacon@gmail.com',
--       'sub',(select id from public.profiles where username='patoduranc'))::text, true);
--   select public.set_verified((select id from public.profiles where username='patoduranc'), true); -- {"ok":true,...}
--   rollback;
