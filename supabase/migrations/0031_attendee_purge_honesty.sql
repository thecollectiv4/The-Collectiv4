-- =====================================================================
-- 0031 — confirmed_attendees excludes purged buyers. El Mundo v7 (review
--        fix, HIGH). Applied via Supabase CLI (db push).
--
-- 0027 appended `deleted_at is null` to every profile-read surface + the
-- get_for_you / my_circle aggregates. But confirmed_attendees was REWRITTEN
-- later, in 0029 (the tier filter), and the purge predicate wasn't carried
-- over — so a soft-purged member who bought a ticket still leaked their
-- name+avatar+id on the public SEE-WHO wall (SECURITY DEFINER bypasses the
-- RLS that hides them everywhere else). Verified: purged buyer still returned
-- to anon (public tier) and to a friend (default tier). Add the predicate.
--
-- Same signature → create-or-replace, no drop, callers unchanged. A NULL
-- profile (profile-less buyer) passes `p.deleted_at is null` (NULL is null),
-- so nothing changes for them — they're already owner/host-only via can_see.
-- =====================================================================

begin;

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
      and p.deleted_at is null            -- v7 fix: a purged buyer leaves the wall too
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

-- verify: purge a buyer (rolled back) → confirmed_attendees omits them for
-- anon AND friend AND (they're not the host) — only is_owner/host would still
-- see, and even then p.deleted_at is null now excludes them outright.
