-- =====================================================================
-- 0026 — SALIR DE UN PLAN: nadie queda atrapado (El Mundo v6, review MEDIUM).
--        The Collectiv4 platform. Applied via Supabase CLI (db push).
--
-- THE GAP (adversarial review, MEDIUM): a friend could create_plan or
-- invite_to_plan and place you in a plan (and its room, full of strangers-
-- to-you) with NO way out — plan_members had no leave door, and rsvp 'out'
-- kept you in the thread. That fabricates presence — the exact opposite of
-- "interacciones reales, gente presente no fabricada". This adds the exit.
--
--   * leave_plan(p_plan) — the invitee walks: removes the caller from
--     plan_members AND from the plan's chat room (thread_members). The
--     CREATOR cannot leave their own plan (that is cancel_plan — the plan
--     and its room survive for everyone else); they get a clear error.
--
-- SAFETY: additive (one new SECURITY DEFINER function, uid-pinned,
--   search_path hardened). Zero schema/policy/grant/price/Stripe change.
--   Idempotent (create-or-replace). Mirrors leave_thread (0023).
-- =====================================================================

begin;

create or replace function public.leave_plan(p_plan uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_creator uuid;
  v_thread uuid;
  v_found  int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  select creator_id into v_creator from public.plans where id = p_plan;
  if v_creator is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_creator = v_uid then
    -- the maker doesn't slip out the back — they cancel (room survives)
    return jsonb_build_object('ok', false, 'error', 'creator_cancels');
  end if;

  delete from public.plan_members where plan_id = p_plan and profile_id = v_uid;
  get diagnostics v_found = row_count;

  -- and out of the room, so 'left' actually silences it
  select id into v_thread from public.threads where plan_id = p_plan;
  if v_thread is not null then
    delete from public.thread_members where thread_id = v_thread and profile_id = v_uid;
  end if;

  if v_found = 0 then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all     on function public.leave_plan(uuid) from public;
grant  execute on function public.leave_plan(uuid) to authenticated;

commit;

-- =====================================================================
-- VERIFY: invitee calls leave_plan(<plan>) -> {ok}; the plan_members row
--   and their thread_members row are gone; my_plans no longer lists it;
--   the plan's room no longer shows their messages' membership. Creator
--   calling leave_plan -> {ok:false, error:'creator_cancels'}.
-- =====================================================================
