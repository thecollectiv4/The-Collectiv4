-- =========================================================================
-- 0046 — LA PUERTA (the early-access gate)
--
-- THE GAP: signup is wide open. Anyone — any bot — can POST to
-- /auth/v1/signup and become a member, because the anon key ships in the
-- client bundle (src/api/supabase.js). That is fine for a platform nobody
-- knows about and fatal for a founder-level launch: the first hundred
-- profiles ARE the brand. "Zero bots, enforced by code" is already house
-- doctrine for public reads (CLAUDE.md §4). This extends it to the door.
--
-- THE SHAPE: a Supabase `before_user_created` auth hook. GoTrue calls it
-- with the pending user BEFORE the auth.users row commits; returning an
-- error object rejects the signup. This is the ONLY layer that actually
-- gates — a React check is a suggestion, since curl skips React entirely.
--
-- THE FLAG: public.app_flags. The gate is runtime-toggleable with ONE
-- UPDATE — no redeploy, no rebuild. It ships INSTALLED AND OFF: the hook
-- is live and returns '{}' (allow) on the very first statement until
-- someone flips the row. Same doctrine as the inert image-transform flag
-- (src/lib/img.js): wire it cold, verify the no-op, then turn it on.
--
-- EXISTING MEMBERS ARE INVISIBLE TO THIS SYSTEM. The hook fires only on
-- user CREATION — never on sign-in, token refresh, or password recovery.
-- No backfill, no grandfather table, no ALTER on profiles. The 16 real
-- accounts cannot be locked out by this migration because this migration
-- cannot see them.
--
-- WHY NOT A COLUMN ON profiles: profiles_self_update (0001) is row-level,
-- not column-level. Any `invited`/`access_granted` column on that table is
-- self-writable by any authenticated user with the public anon key and a
-- raw PATCH. A gate you can grant yourself is not a gate. Redemption
-- therefore lives in its own deny-all table, keyed on email — the only
-- identity that exists inside the hook (auth.users has no row yet).
--
-- ADDITIVE: three new tables, one hook, four functions. No ALTER on
-- profiles. No trigger on auth.users. Nothing existing is altered or
-- dropped. Blast radius outside these three tables: zero.
-- =========================================================================
begin;

-- ------------------------------------------------------------------ flags
-- One row per switch. Deliberately generic: the next runtime flag lands
-- here instead of becoming another VITE_ var that needs a deploy to move.
create table if not exists public.app_flags (
  key         text primary key,
  enabled     boolean not null default false,
  note        text,
  updated_at  timestamptz not null default now()
);

insert into public.app_flags (key, enabled, note)
values ('invite_gate', false, 'la puerta — when true, signup requires a valid invite code')
on conflict (key) do nothing;

-- ------------------------------------------------------------------ codes
-- max_uses > 1 makes a code a shareable door (a founder hands one to a
-- room); max_uses = 1 makes it a personal key. revoked_at kills a code
-- that leaked without deleting the audit trail.
create table if not exists public.invite_codes (
  code        text primary key,
  created_by  uuid references public.profiles(id) on delete set null,
  max_uses    integer not null default 1 check (max_uses > 0),
  used_count  integer not null default 0,
  expires_at  timestamptz,
  revoked_at  timestamptz,
  note        text,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------- redemptions
-- redeemed_by is nullable and carries NO foreign key on purpose: at hook
-- time the auth.users row does not exist yet, and profiles has no FK to
-- auth.users anyway (the linkage is an RLS convention, not a constraint).
-- The unique on email is the real guard: one email, one redemption.
create table if not exists public.invite_redemptions (
  id             uuid primary key default gen_random_uuid(),
  code           text not null references public.invite_codes(code) on delete cascade,
  redeemed_email text not null,
  redeemed_by    uuid,
  redeemed_at    timestamptz not null default now(),
  unique (redeemed_email)
);
create index if not exists invite_redemptions_code_idx on public.invite_redemptions (code);

-- --------------------------------------------------------------------- RLS
-- Deny-all to client keys: RLS on, ZERO policies. service_role bypasses
-- RLS and SECURITY DEFINER functions run as owner, so the doors below are
-- the only way in. An invite code list that anon can SELECT is not a gate.
alter table public.app_flags          enable row level security;
alter table public.invite_codes       enable row level security;
alter table public.invite_redemptions enable row level security;
revoke all on public.app_flags          from anon, authenticated;
revoke all on public.invite_codes       from anon, authenticated;
revoke all on public.invite_redemptions from anon, authenticated;

-- ============================================================== THE HOOK
-- Wired in the dashboard: Auth → Hooks → Before User Created.
-- Returns '{}' to allow, or an error object to reject the signup.
create or replace function public.before_user_created_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(event->'user'->>'email', ''));
  v_code  text := upper(trim(coalesce(event->'user'->'raw_user_meta_data'->>'invite_code', '')));
  v_hit   text;
begin
  -- GATE OFF → TOTAL NO-OP. Every signup passes exactly as it does today.
  -- This is the first statement in the function for a reason: while the
  -- flag is false, nothing below can affect anyone.
  if not coalesce((select enabled from app_flags where key = 'invite_gate'), false) then
    return '{}'::jsonb;
  end if;

  if v_code = '' then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403, 'message', 'invite_required'));
  end if;

  -- The conditional UPDATE is the lock — validity check and increment in
  -- ONE atomic statement (same arbiter pattern as claim_ticket_email, 0045).
  -- Two people racing the last seat on a code: one wins, one is rejected.
  -- Checking-then-updating would let both through.
  --
  -- SEAT AND AUDIT ROW MOVE TOGETHER. The redemption insert leads and the
  -- increment only happens if that insert actually produced a row. Done the
  -- other way round, a repeat attempt from an already-registered email would
  -- burn a seat (the UPDATE always fires) while the insert silently did
  -- nothing (unique on email) — used_count and invite_redemptions drift apart
  -- permanently, and admin_list_invites, the founders' only view of the door,
  -- quietly under-reports who came through.
  with claimed as (
    insert into invite_redemptions (code, redeemed_email)
    select v_code, v_email
     where exists (
       select 1 from invite_codes
        where code = v_code
          and revoked_at is null
          and (expires_at is null or expires_at > now())
          and used_count < max_uses
     )
    on conflict (redeemed_email) do nothing
    returning code
  )
  update invite_codes c
     set used_count = c.used_count + 1
    from claimed
   where c.code = claimed.code
     and c.revoked_at is null
     and (c.expires_at is null or c.expires_at > now())
     and c.used_count < c.max_uses
  returning c.code into v_hit;

  if v_hit is null then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403, 'message', 'invite_invalid'));
  end if;

  return '{}'::jsonb;
end;
$$;

revoke all on function public.before_user_created_hook(jsonb) from public, anon, authenticated;
-- USAGE on the schema as well as EXECUTE on the function. On a stock project
-- PUBLIC still holds schema USAGE so EXECUTE alone would probably resolve —
-- but "probably" is the wrong word here: if it does NOT resolve, the hook
-- raises, GoTrue 500s, and EVERY signup fails regardless of the flag. The
-- "installed and off" promise only holds while the function can execute at
-- all; the flag is read inside it. One additive line, no downside.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.before_user_created_hook(jsonb) to supabase_auth_admin;

-- ============================================================== THE DOORS

-- gate_status — anon-callable. Returns ONLY the boolean, never the codes.
-- The client needs it to decide whether to render the code field at all.
create or replace function public.gate_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('invite_gate',
    coalesce((select enabled from app_flags where key = 'invite_gate'), false));
$$;
revoke all on function public.gate_status() from public, anon, authenticated;
grant execute on function public.gate_status() to anon, authenticated;

-- check_invite_code — pre-submit validation so the UI can say "that code
-- isn't right" before asking for a password. Returns {valid:bool} and
-- NOTHING else: no code list, no owner, no remaining-uses count. It is a
-- yes/no oracle BY DESIGN, and it is unrated and unlogged — be honest about
-- what that costs. Keyspace is 31^8 ≈ 8.5e11, but the work factor is
-- keyspace ÷ LIVE codes: at 200 live codes an attacker expects a hit in
-- ~4e9 tries. Comfortable at founder scale, not forever.
-- ⚠ TRIGGER, not a someday: add edge rate-limiting BEFORE live codes pass
-- ~100. It does NOT consume a use — only the hook does.
create or replace function public.check_invite_code(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('valid', exists (
    select 1 from invite_codes
     where code = upper(trim(coalesce(p_code, '')))
       and revoked_at is null
       and (expires_at is null or expires_at > now())
       and used_count < max_uses
  ));
$$;
revoke all on function public.check_invite_code(text) from public;
grant execute on function public.check_invite_code(text) to anon, authenticated;

-- admin_mint_invite — owner-only, gate INSIDE the function (the 0008
-- pattern): grant to authenticated, then refuse anyone who isn't an owner.
-- Alphabet excludes 0/O/1/I/L — these get read aloud and typed on phones.
create or replace function public.admin_mint_invite(
  p_count integer default 1,
  p_max_uses integer default 1,
  p_expires timestamptz default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alpha  text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_codes  text[] := '{}';
  v_code   text;
  v_i      integer;
  v_j      integer;
begin
  if not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;

  for v_i in 1..greatest(1, least(coalesce(p_count, 1), 100)) loop
    -- retry until unique; collision odds are negligible but the loop is honest
    loop
      -- gen_random_bytes, not random(). These codes ARE credentials: random()
      -- is a seeded PRNG, and minting 100 at once draws them from one
      -- contiguous stream — observing a few would constrain the rest. The
      -- modulo bias across a 31-char alphabet is irrelevant next to that.
      v_code := 'C4-';
      for v_j in 1..8 loop
        if v_j = 5 then v_code := v_code || '-'; end if;
        v_code := v_code || substr(v_alpha,
          1 + (get_byte(gen_random_bytes(1), 0) % length(v_alpha)), 1);
      end loop;
      exit when not exists (select 1 from invite_codes where code = v_code);
    end loop;

    insert into invite_codes (code, created_by, max_uses, expires_at, note)
    values (v_code, null, greatest(1, coalesce(p_max_uses, 1)), p_expires, p_note);
    v_codes := array_append(v_codes, v_code);
  end loop;

  return jsonb_build_object('ok', true, 'codes', to_jsonb(v_codes));
end;
$$;
revoke all on function public.admin_mint_invite(integer, integer, timestamptz, text) from public, anon;
grant execute on function public.admin_mint_invite(integer, integer, timestamptz, text) to authenticated;

-- admin_list_invites — owner-only. The founders' view of who is holding
-- what: every code, its use count, and who came through it.
create or replace function public.admin_list_invites()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;
  return jsonb_build_object('ok', true, 'codes', coalesce((
    select jsonb_agg(x order by x->>'created_at' desc) from (
      select jsonb_build_object(
        'code', c.code, 'max_uses', c.max_uses, 'used_count', c.used_count,
        'expires_at', c.expires_at, 'revoked_at', c.revoked_at,
        'note', c.note, 'created_at', c.created_at,
        'redeemed_by', coalesce((
          select jsonb_agg(r.redeemed_email order by r.redeemed_at)
          from invite_redemptions r where r.code = c.code), '[]'::jsonb)
      ) as x
      from invite_codes c
    ) s), '[]'::jsonb));
end;
$$;
revoke all on function public.admin_list_invites() from public, anon;
grant execute on function public.admin_list_invites() to authenticated;

commit;

-- =====================================================================
-- ⚠ THE DASHBOARD STEP — `supabase db push` DOES NOT DO THIS.
-- This migration ships the FUNCTION. It does not wire it. Until a human
-- goes to Supabase → Authentication → Hooks → "Before User Created" and
-- selects public.before_user_created_hook, the gate is inert no matter
-- what app_flags says. config.toml's [auth.hook] block is LOCAL DEV ONLY
-- and is not the production switch. Do not report the gate as live until
-- this step is confirmed in the dashboard.
--
-- VERIFY (in this order, on a preview/staging project first):
--   1. gate OFF is a true no-op:
--        select public.gate_status();                  -- {"invite_gate": false}
--        -- sign up a throwaway email in the app -> SUCCEEDS unchanged
--   2. mint, as an owner session:
--        select public.admin_mint_invite(3, 1, null, 'first ring');
--   3. flip the gate:
--        update public.app_flags set enabled = true, updated_at = now()
--         where key = 'invite_gate';
--   4. signup with NO code            -> rejected, 'invite_required'
--      signup with a garbage code     -> rejected, 'invite_invalid'
--      signup with a minted code      -> allowed; used_count = 1
--      SAME code again (max_uses 1)   -> rejected, 'invite_invalid'
--   4b. SEAT/AUDIT SYMMETRY (the drift this migration was corrected for):
--        gate ON, valid multi-use code, sign up with an email that ALREADY
--        has an account -> rejected, and used_count MUST NOT have moved:
--          select used_count from public.invite_codes where code = '<code>';
--          select count(*) from public.invite_redemptions where code = '<code>';
--        those two must agree after every attempt, successful or not.
--   5. EXISTING MEMBERS, gate ON — all must still work:
--        sign in with password · hard-reload a live session · password
--        recovery through /reset-password · a paid buyer opening /claim
--   5b. CLIENT FAILURE MODES (no DB needed — kill the network in devtools):
--        /auth must still render sign-in, never a blank page (2s timeout)
--        a rejected code must return you to the door, not trap you on a
--        form with no code field
--   6. flip it back off -> open signup returns instantly, no deploy:
--        update public.app_flags set enabled = false where key = 'invite_gate';
--
-- ROLLBACK (forward-only repo — run by hand, and have it saved BEFORE
-- the gate is ever switched on):
--   -- first: un-wire the hook in the dashboard, THEN:
--   drop function if exists public.before_user_created_hook(jsonb);
--   drop function if exists public.admin_list_invites();
--   drop function if exists public.admin_mint_invite(integer,integer,timestamptz,text);
--   drop function if exists public.check_invite_code(text);
--   drop function if exists public.gate_status();
--   drop table if exists public.invite_redemptions, public.invite_codes, public.app_flags cascade;
-- =====================================================================
