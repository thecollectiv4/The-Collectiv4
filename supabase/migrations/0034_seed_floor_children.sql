-- =========================================================================
-- 0034 — SEED FLOOR, THE CHILDREN (v8 review catch)
--
-- 0033 closed profiles_public_read: verified ≠ seed access. The adversarial
-- review then walked every child policy of 0027. Four of the six are fixed
-- by RLS CASCADE (their demo-branch lives inside an `exists` subquery on
-- profiles, which itself passes through 0033 for the calling role — a demo
-- row is invisible → exists() is false). TWO leak for real, because their
-- `caller_is_verified()` branch is TOP-LEVEL, outside any profiles check:
--
--   · follows_read      — any verified read EVERY follows row (demo pairs,
--                         purged pairs, all of it)
--   · listings_public_read — any verified read EVERY listing row (demo
--                         sellers' walls included)
--
-- And one SECURITY DEFINER aggregate bypasses RLS entirely and never
-- filtered the seed:
--
--   · confirmed_attendees — a demo-flagged buyer with a confirmed ticket
--                         still rendered on the SEE-WHO wall while the
--                         count (0032) excluded them: wall ≠ count.
--
-- Same posture as 0033: additive, nothing deleted, self/owner branches
-- intact, profile-less real buyers still counted by name.
-- =========================================================================

begin;

-- (1) follows_read — drop the bare verified branch. Self (either side),
--     founders, and clean-both-sides public rows remain readable.
drop policy if exists follows_read on public.follows;
create policy follows_read on public.follows
  for select
  using (
    follower_id::text = auth.uid()::text
    or followee_id::text = auth.uid()::text
    or public.is_owner()
    or (
      exists (select 1 from public.profiles p
              where p.id = follows.follower_id and p.is_demo = false and p.deleted_at is null)
      and exists (select 1 from public.profiles p
                  where p.id = follows.followee_id and p.is_demo = false and p.deleted_at is null)
    )
  );

-- (2) listings_public_read — drop the bare verified branch. Own rows,
--     founders, and live listings on clean worlds remain readable.
drop policy if exists listings_public_read on public.listings;
create policy listings_public_read on public.listings
  for select
  using (
    profile_id::text = auth.uid()::text
    or public.is_owner()
    or (
      status = 'live'
      and exists (select 1 from public.profiles p
                  where p.id = listings.profile_id and p.is_demo = false and p.deleted_at is null)
    )
  );

-- (3) confirmed_attendees — the wall joins the count's universe (0032 shape):
--     demo excluded, purged excluded, sentinel excluded, profile-less real
--     buyers kept. Reproduced from 0031 with the single added predicate.
create or replace function public.confirmed_attendees(p_event uuid default null)
returns table (id text, name text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.name, d.avatar_url
  from (
    select distinct on (t.buyer_id)
      t.buyer_id::text                                as id,
      coalesce(p.full_name, t.buyer_name, 'Attendee') as name,
      p.avatar_url                                    as avatar_url,
      t.created_at                                    as created_at
    from public.tickets t
    left join public.profiles p on p.id::text = t.buyer_id::text
    left join public.events   e on e.id = t.event_id
    left join public.event_attendance_prefs ap
           on ap.profile_id::text = t.buyer_id::text and ap.event_id = t.event_id
    where t.status = 'confirmed'
      and (p_event is null or t.event_id = p_event)
      and t.buyer_id <> '00000000-0000-0000-0000-000000000000'
      and p.deleted_at is null
      and coalesce(p.is_demo, false) = false   -- v8: the wall's universe = the count's universe
      and (
        public.is_owner()
        or (e.host_id is not null and e.host_id::text = auth.uid()::text)
        or (p.id is not null and public.can_see(p.id, coalesce(ap.visibility, 'friends')))
      )
    order by t.buyer_id, t.created_at desc
  ) d
  order by d.created_at desc;
$$;

commit;

-- ---------- verify (run manually) ----------
-- As a VERIFIED non-owner:
--   select count(*) from listings l join profiles p on p.id = l.profile_id
--     where p.is_demo;                                   -> 0
--   select count(*) from follows;                        -> only self/clean rows
-- confirmed_attendees(rba) as anon: names ⊆ the honest count's buyers;
--   a demo/QA-retired buyer never renders.
