-- =========================================================================
-- 0035 — MY_PLANS RETURNS VISIBILITY (El Mundo v9 · D2)
--
-- v7 D5 gave plans a three-tier audience (public / friends / close) and 0029
-- shipped plans.visibility + set_plan_visibility(). v9 D2 builds the missing
-- control — the creator picks the tier at create/edit time. For the plan
-- card to tell the honest truth (Ley 11: real data, never a guess) it must
-- read the STORED tier back, not the one the client last set. my_plans()
-- omitted it. This adds one field. Purely additive: same shape, one more key.
--
-- Nothing else changes — the roster, counts, ordering and grants are byte
-- for byte the 0023 function with `visibility` grafted in after `status`.
-- =========================================================================
begin;

create or replace function public.my_plans()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ok', true,
    'plans', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id',        pl.id,
               'title',     pl.title,
               'detail',    pl.detail,
               'spot',      pl.spot,
               'starts_at', pl.starts_at,
               'status',    pl.status,
               'visibility', pl.visibility,
               'creator', jsonb_build_object(
                 'id', cp.id, 'name', cp.full_name,
                 'username', cp.username, 'avatar_url', cp.avatar_url),
               'my_status', me.status,
               'thread_id', th.id,
               'in_count',    (select count(*) from public.plan_members x
                               where x.plan_id = pl.id and x.status = 'in'),
               'maybe_count', (select count(*) from public.plan_members x
                               where x.plan_id = pl.id and x.status = 'maybe'),
               'invited_count', (select count(*) from public.plan_members x
                                 where x.plan_id = pl.id and x.status = 'invited'),
               'roster', (select jsonb_agg(jsonb_build_object(
                            'id', rp.id, 'name', rp.full_name,
                            'username', rp.username, 'avatar_url', rp.avatar_url,
                            'status', rm.status)
                          order by case rm.status when 'in' then 0 when 'maybe' then 1
                                                  when 'invited' then 2 else 3 end,
                                   lower(coalesce(rp.full_name, rp.username, '')))
                          from public.plan_members rm
                          join public.profiles rp on rp.id = rm.profile_id
                          where rm.plan_id = pl.id)
             )
             order by (pl.status = 'live') desc, pl.starts_at asc nulls last, pl.created_at desc)
      from public.plan_members me
      join public.plans pl on pl.id = me.plan_id
      join public.profiles cp on cp.id = pl.creator_id
      left join public.threads th on th.plan_id = pl.id
      where me.profile_id = auth.uid()
    ), '[]'::jsonb)
  );
$$;
revoke all     on function public.my_plans() from public;
grant  execute on function public.my_plans() to authenticated;

commit;

-- =====================================================================
-- VERIFY (read-only, after push):
--   -- as a member of a plan:
--   select (my_plans()->'plans'->0) ? 'visibility';   -- true
--   -- a fresh plan defaults to 'friends':
--   select my_plans()->'plans'->0->>'visibility';     -- 'friends'
-- =====================================================================
