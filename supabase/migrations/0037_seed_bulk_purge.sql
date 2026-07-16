-- =========================================================================
-- 0037 — ONE-CLICK BULK SEED PURGE (El Mundo v9 · D3 · guardrail 3)
--
-- v9 D3 condition 3 (non-negotiable): the seed is "purgable en un click."
-- The D0 audit found this OVERSTATED: admin_soft_purge takes one p_user and
-- the UI is two taps PER account — purging the whole seed was ~200+ taps,
-- and profile-less rows couldn't be reached at all. This is the missing
-- bulk door: one call soft-deletes every live seed world at once.
--
-- Faithful to the v7 doctrine: SOFT delete (deleted_at, reversible via
-- admin_restore), NEVER touches a `protected` row (cohort-zero whitelist),
-- owner-gated (is_owner()), and it rides the same app.grant_lifecycle guard
-- that admin_soft_purge uses so the lifecycle trigger admits the write.
-- Additive: a new function, nothing existing is changed.
-- =========================================================================
begin;

-- how many live seed worlds are there right now? (owner-gated preview so the
-- founder's confirm dialog can say "purge N seed worlds" honestly)
create or replace function public.admin_seed_count()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;
  return jsonb_build_object('ok', true, 'count', (
    select count(*) from public.profiles
    where is_demo = true and deleted_at is null and coalesce(protected, false) = false
  ));
end;
$$;
revoke all     on function public.admin_seed_count() from public;
grant  execute on function public.admin_seed_count() to authenticated;

-- the bulk door — soft-delete every live, non-protected seed world in one call
create or replace function public.admin_purge_seed()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_actor uuid;
begin
  if not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;

  perform set_config('app.grant_lifecycle', '1', true);
  update public.profiles
     set deleted_at = coalesce(deleted_at, now())
   where is_demo = true
     and deleted_at is null
     and coalesce(protected, false) = false;
  get diagnostics v_count = row_count;
  perform set_config('app.grant_lifecycle', '0', true);

  select auth.uid() into v_actor;
  if v_actor is not null and exists (select 1 from public.profiles where id = v_actor) then
    insert into public.os_activity (profile_id, action)
    values (v_actor, 'purged (soft, bulk) ' || v_count || ' seed worlds');
  end if;

  return jsonb_build_object('ok', true, 'purged', v_count);
end;
$$;
revoke all     on function public.admin_purge_seed() from public;
grant  execute on function public.admin_purge_seed() to authenticated;

commit;

-- =====================================================================
-- VERIFY (after push):
--   -- as a non-owner:  select admin_purge_seed();   -> {ok:false, not_owner}
--   -- as the founder:  select admin_seed_count();   -> {ok:true, count:N}
--   --                  select admin_purge_seed();   -> {ok:true, purged:N}
--   -- reversible per row via admin_restore(id); protected rows untouched.
-- =====================================================================
