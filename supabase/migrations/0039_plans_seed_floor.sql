-- =========================================================================
-- 0039 — PLANS SEED FLOOR (El Mundo v9 · adversarial review catch)
--
-- THE LEAK: plans_visible_read (0029) is `is_plan_member(id) OR
-- can_see(creator_id, visibility)`, and can_see(owner,'public') returns TRUE
-- unconditionally (0030) with NO check on the creator. So a v9 seed persona's
-- visibility='public' plan (0038) was readable by ANY authenticated non-owner
-- member via a direct select on plans — a seed artifact reaching a real user.
-- (Anon is already blocked: no table grant. This closes the authed vector.)
--
-- THE FIX: mirror 0034's listings/follows floor. A NON-MEMBER discoverer sees
-- a plan through can_see ONLY when the creator is clean (is_demo=false AND
-- deleted_at is null) OR the viewer is a founder (is_owner, for QA). Members
-- still always see their own plans; real public plans are byte-for-byte
-- unchanged; a purged creator's plan is now hidden too (bonus). Additive:
-- the policy is replaced, no data moves.
-- =========================================================================
begin;

drop policy if exists plans_visible_read on public.plans;
create policy plans_visible_read on public.plans
  for select using (
    public.is_plan_member(id)
    or (
      public.can_see(creator_id, visibility)
      and (
        public.is_owner()
        or exists (select 1 from public.profiles p
                   where p.id = plans.creator_id
                     and p.is_demo = false
                     and p.deleted_at is null)
      )
    )
  );

commit;

-- =====================================================================
-- VERIFY (after push):
--   -- as an authed NON-owner member (not in the plan):
--   --   GET /rest/v1/plans?visibility=eq.public   -> no seed plan rows
--   -- as a founder (is_owner): seed plans still readable (QA)
--   -- real public plans by clean creators: unchanged; members: unchanged
-- =====================================================================
