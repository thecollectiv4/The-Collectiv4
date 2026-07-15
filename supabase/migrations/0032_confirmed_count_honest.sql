-- =====================================================================
-- 0032 — confirmed_count: honest + public, never tiered. El Mundo v7
--        (founder decision, 15 jul). Applied via Supabase CLI (db push).
--
-- La asistencia es dato de la PERSONA; la llenura del cuarto es dato del
-- CUARTO. So the two split cleanly:
--   * confirmed_attendees (the WALL, who specifically) → tier-filtered
--     (0029/0031): only shows those who chose to be visible to the viewer.
--   * confirmed_count (the NUMBER, "N CONFIRMED · the room is forming") →
--     AGGREGATE: names nobody, and it is the commercial signal of the event
--     page. It stays PÚBLICO Y HONESTO — every REAL buyer, regardless of
--     their visibility tier, so a stranger never sees "0 confirmed" on the
--     surface that has to sell the next event.
--
-- The old 0001 confirmed_count was `count(*)` over ALL confirmed tickets —
-- honest here only by luck (it also counted demo/purged/sentinel buyers).
-- Make it honest BY CODE, matching the rest of v7: distinct REAL buyers only
-- — is_demo excluded, purged (deleted_at) excluded, the all-zero sentinel
-- excluded — and NOT tier-filtered. Same signature, SECURITY DEFINER, same
-- anon+authenticated grant (the count must render for logged-out visitors).
-- LEFT JOIN keeps profile-less real buyers counted (they are neither demo
-- nor purged); only demo/purged/sentinel drop out.
-- =====================================================================

begin;

create or replace function public.confirmed_count(p_event uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct t.buyer_id)::int
  from public.tickets t
  left join public.profiles p on p.id::text = t.buyer_id::text
  where t.event_id = p_event
    and t.status = 'confirmed'
    and t.buyer_id <> '00000000-0000-0000-0000-000000000000'
    and coalesce(p.is_demo, false) = false
    and p.deleted_at is null;
$$;

revoke all     on function public.confirmed_count(uuid) from public;
grant  execute on function public.confirmed_count(uuid) to anon, authenticated;

commit;

-- verify: anon confirmed_count(<event>) returns the real total (names none);
-- anon confirmed_attendees(<event>) returns only public-tier faces. Count and
-- wall diverge BY DESIGN — the count is the room's data, the wall is the
-- person's. A demo/purged/sentinel buyer never inflates the count.
