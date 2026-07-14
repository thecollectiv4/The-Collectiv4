-- =====================================================================
-- 0019 — DROPS: the team becomes a product sensor from day one.
--        The Collectiv4 platform. Applied via Supabase CLI (db push).
--
-- The first verified members (cohorte cero) can drop an idea or a bug
-- report from INSIDE the platform: a floating button on /os → free text
-- + the context of where they were → it lands for the FOUNDERS to read
-- in the OS. Small to build, large in value: product feedback with an
-- author and a location, captured the moment it's felt.
--
-- SHAPE (honest-by-code, mirrors 0008/0010):
--   * WRITE — any network member (owner OR verified) may submit, ONLY
--     through submit_drop() (SECURITY DEFINER). Author is the JWT session
--     uid, never client-supplied → attribution can't be forged. There is
--     NO client INSERT policy, so a raw PostgREST insert is refused.
--   * READ — FOUNDERS ONLY. The single SELECT policy is is_owner(). A
--     verified member who submits can't read the feed back; the anon key
--     returns []. "Visible para founders" enforced at the DB, not the UI.
--   * CURATE — founders may archive/delete their own team's drops.
--
-- Reuses 0008's is_owner() + 0010's caller_is_network() (unforgeable JWT
-- email / own-profile verified). Touches NO prices, tickets, lock_verified,
-- RLS of any existing table, or the Stripe path. Additive + idempotent.
-- =====================================================================

begin;

-- ---------- table ----------
create table if not exists public.drops (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid references public.profiles(id) on delete set null,
  body        text not null,
  -- where they were when they dropped it: { surface:'os', tab:'board', path:'/os' }.
  -- jsonb (not columns) so the shape can grow without a migration.
  context     jsonb not null default '{}'::jsonb,
  status      text not null default 'open'
                check (status in ('open', 'archived')),
  created_at  timestamptz not null default now()
);
create index if not exists drops_created_idx on public.drops (created_at desc);

-- ---------- RLS: founders read; nobody writes directly ----------
-- The ONLY policies are is_owner()-gated. Writes go through submit_drop()
-- (SECURITY DEFINER, network-gated) — with no INSERT policy here, a raw
-- client insert is default-denied. Verified members submit via the RPC and
-- cannot read the feed. Anon gets nothing.
alter table public.drops enable row level security;

drop policy if exists drops_owner_read   on public.drops;
drop policy if exists drops_owner_update on public.drops;
drop policy if exists drops_owner_delete on public.drops;

create policy drops_owner_read   on public.drops
  for select using (public.is_owner());
create policy drops_owner_update on public.drops
  for update using (public.is_owner()) with check (public.is_owner());
create policy drops_owner_delete on public.drops
  for delete using (public.is_owner());

-- grants: authenticated only (RLS is the real gate); never anon. No INSERT
-- grant to clients — submit_drop() (definer) owns the write.
grant select, update, delete on public.drops to authenticated;
revoke all on public.drops from anon;

-- ---------- write path: network-gated, forge-proof author ----------
-- Any network member (owner OR verified) may drop. SECURITY DEFINER so the
-- insert bypasses the founders-only table grant; membership is re-checked
-- inside, and author_id is pinned to auth.uid() — a caller can't attribute a
-- drop to someone else. Body is trimmed, required, and capped server-side.
create or replace function public.submit_drop(p_body text, p_context jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text;
  v_id   uuid;
begin
  if not public.caller_is_network() then
    return jsonb_build_object('ok', false, 'error', 'not_network');
  end if;

  v_body := btrim(coalesce(p_body, ''));
  if length(v_body) = 0 then
    return jsonb_build_object('ok', false, 'error', 'empty');
  end if;
  v_body := left(v_body, 2000);   -- cap: a drop is a note, not a document

  insert into public.drops (author_id, body, context)
  values (
    auth.uid(),
    v_body,
    -- accept only a small object; anything else collapses to empty (never trust client shape)
    case when jsonb_typeof(coalesce(p_context, '{}'::jsonb)) = 'object'
         then p_context else '{}'::jsonb end
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- Supabase re-grants EXECUTE on public functions to anon+authenticated by
-- default; the real gate is caller_is_network() inside (anon → false →
-- {ok:false, not_network}, nothing written). Revoke PUBLIC as defense-in-depth,
-- grant authenticated explicitly.
revoke all     on function public.submit_drop(text, jsonb) from public;
grant  execute on function public.submit_drop(text, jsonb) to authenticated;

commit;

-- ---------- verify (simulated, rolled back) ----------
--   Anon:                     select public.submit_drop('x', '{}');  -- {ok:false, not_network}
--   Anon:                     select * from public.drops;            -- [] (no read policy match)
--   Verified member (rolled): select public.submit_drop('bug: X', '{"surface":"os","tab":"board"}'); -- {ok:true,...}
--                             select * from public.drops;            -- still [] for the member (founders-only read)
--   Owner:                    select * from public.drops;            -- sees every drop
