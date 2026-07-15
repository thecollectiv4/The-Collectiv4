-- =====================================================================
-- 0030 — can_see() returns a clean boolean (never NULL). El Mundo v7.
--        Applied via Supabase CLI (db push).
--
-- 0029's can_see began `p_owner = auth.uid() or ...`. For anon, auth.uid()
-- is NULL, so `p_owner = NULL` is NULL and `NULL or false or false` is NULL.
-- In a WHERE / RLS USING clause NULL excludes exactly like false, so every
-- read was already correct — BUT `not can_see(...)` would be NULL (not TRUE),
-- a latent foot-gun for any future negated use. Pin it to a real boolean.
-- Forward-only: 0029 stays as applied; this supersedes can_see in place.
-- =====================================================================

begin;

create or replace function public.can_see(p_owner uuid, p_tier text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p_owner = auth.uid(), false)
      or public.is_owner()
      or case coalesce(p_tier, 'friends')
           when 'public'  then true
           when 'friends' then public.are_friends(p_owner, auth.uid())
           when 'close'   then public.is_close(p_owner, auth.uid())
           else false
         end;
$$;
grant execute on function public.can_see(uuid, text) to anon, authenticated;

commit;

-- verify: select public.can_see('<any>','friends') as anon -> false (not null)
