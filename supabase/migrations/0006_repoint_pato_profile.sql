-- =====================================================================
-- 0006 — Re-point the @patoduranc seed profile to the founder's REAL account.
-- The Collectiv4 platform. ONE-OFF data repair (not portable schema).
-- Run in the Supabase SQL editor. Safe to re-run (idempotent: no-op once owned).
--
-- WHY: every profiles row is a seed (user_id = 'seed_*'); the @patoduranc row's
-- primary key (id = 09efaaf2…) is NOT the founder's real auth uid, so his real
-- login has no linked profile and can't edit "his" world. This re-points that
-- row's id onto his real auth uid so his account owns it.
--
-- SAFETY: wrapped in a DO block → fully transactional; ANY failure rolls back and
-- changes nothing. Looks the uid up from auth.users by email (no manual uid). Only
-- touches the @patoduranc row (+ removes an empty stub if one exists). Does NOT
-- touch `verified` or the lock_verified trigger (it fires on this UPDATE but leaves
-- verified untouched, and in the SQL editor auth.role() is elevated anyway). No
-- prices touched.
--
-- ⚠️ Replace the email below with your real APP-LOGIN email if it differs.
-- =====================================================================

do $$
declare
  v_email text := lower('patduranchacon@icloud.com');  -- ← your app login email
  v_uid   uuid;
  v_pato  uuid;
  v_n     integer;
begin
  -- Resolve your real auth account by email; FAIL LOUD on none/ambiguous
  -- (deterministic — never silently bind the "first" of several rows).
  select count(*), min(id) into v_n, v_uid from auth.users where lower(email) = v_email;
  if v_n = 0 then
    raise exception 'No auth user for % — sign up in the app first, or fix the email.', v_email;
  elsif v_n > 1 then
    raise exception 'Multiple auth users for % — ambiguous, aborting.', v_email;
  end if;

  -- Locate the @patoduranc profile; must be exactly one.
  select count(*), min(id) into v_n, v_pato from public.profiles where username = 'patoduranc';
  if v_n = 0 then
    raise exception 'No @patoduranc profile row found.';
  elsif v_n > 1 then
    raise exception 'Multiple @patoduranc rows — ambiguous, aborting.';
  end if;

  -- Idempotent: already owned by you → clean no-op on re-run.
  if v_pato = v_uid then
    raise notice 'Already owned by you (id = your uid). Nothing to do.';
    return;
  end if;

  -- Remove any empty stub profile under your real uid, so re-pointing @patoduranc
  -- onto your uid cannot collide on the primary key.
  delete from public.profiles
   where id = v_uid and username is distinct from 'patoduranc';

  -- Point the seeded @patoduranc world at your real account (target the exact old id).
  update public.profiles
     set id      = v_uid,
         user_id = v_uid::text,
         is_demo = false
   where id = v_pato;

  raise notice 'Re-pointed @patoduranc (% -> %). Your account now owns that world.', v_pato, v_uid;
end $$;

-- ---------- verify ----------
-- select id, username, user_id, is_demo from public.profiles where username = 'patoduranc';
-- Expect: id = your auth uid, user_id = same, is_demo = false.
