-- =========================================================================
-- 0044 — IS_DEMO VIAJA CON LA IDENTIDAD (El Mundo v10 · guardrail 4 total)
--
-- THE PRINCIPLE (founder's order, verbatim): "is_demo viaja con la
-- identidad, no con la superficie. Si un payload transporta un perfil,
-- transporta is_demo. Sin excepción."
--
-- The v10 sweep enumerated 26 profile-rendering surfaces and found the
-- pattern behind every unlabeled hole: the surfaces with the ◇ are the
-- ones whose payload carries is_demo; every hole is a payload (my_circle,
-- my_plans, fetchInbox, fetchThread) that doesn't even TRANSPORT the
-- field. This migration fixes the two RPC payloads; the client selects
-- (fetchInbox/fetchThread) ride the same commit.
--
-- my_circle: byte-faithful 0027 redeclaration + 'is_demo' in all three
--   branches (friends / pending_in / pending_out). The seed reaches this
--   payload BY DESIGN — 0038/0041 plant pending requests to the founders
--   so day-one ACCEPT works; those rows rendered unlabeled until now.
-- my_plans: byte-faithful 0035 redeclaration + 'is_demo' on the creator
--   and on every roster row.
--
-- Non-owners are untouched in practice: their social graph can only
-- contain seed if they befriended one, which RLS/product flow prevents —
-- and either way the field is now simply THERE, carrying the truth.
-- ADDITIVE: same shapes, same grants, one more key per identity.
-- =========================================================================
begin;

create or replace function public.my_circle()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ok', true,
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'name', p.full_name, 'username', p.username,
               'avatar_url', p.avatar_url, 'verified', p.verified, 'city', p.city,
               'is_demo', p.is_demo)
             order by lower(coalesce(p.full_name, p.username, '')))
      from public.friendships f
      join public.profiles p
        on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
      where f.status = 'accepted'
        and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
        and p.deleted_at is null
    ), '[]'::jsonb),
    'pending_in', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'name', p.full_name, 'username', p.username,
               'avatar_url', p.avatar_url, 'verified', p.verified, 'city', p.city,
               'is_demo', p.is_demo)
             order by f.created_at desc)
      from public.friendships f
      join public.profiles p on p.id = f.requester_id
      where f.status = 'pending' and f.addressee_id = auth.uid()
        and p.deleted_at is null
    ), '[]'::jsonb),
    'pending_out', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'name', p.full_name, 'username', p.username,
               'avatar_url', p.avatar_url, 'verified', p.verified, 'city', p.city,
               'is_demo', p.is_demo)
             order by f.created_at desc)
      from public.friendships f
      join public.profiles p on p.id = f.addressee_id
      where f.status = 'pending' and f.requester_id = auth.uid()
        and p.deleted_at is null
    ), '[]'::jsonb)
  );
$$;
revoke all     on function public.my_circle() from public, anon;
grant  execute on function public.my_circle() to authenticated;

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
                 'username', cp.username, 'avatar_url', cp.avatar_url,
                 'is_demo', cp.is_demo),
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
                            'status', rm.status, 'is_demo', rp.is_demo)
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
revoke all     on function public.my_plans() from public, anon;
grant  execute on function public.my_plans() to authenticated;

commit;

-- =====================================================================
-- VERIFY (after push):
--   -- any member: (my_circle()->'friends'->0) ? 'is_demo'      -- true
--   --             (my_circle()->'pending_in'->0) ? 'is_demo'   -- true
--   --             (my_plans()->'plans'->0->'creator') ? 'is_demo'  -- true
--   --             (my_plans()->'plans'->0->'roster'->0) ? 'is_demo' -- true
-- =====================================================================
