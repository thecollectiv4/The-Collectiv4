-- =====================================================================
-- 0028 — RETENCIÓN INSTRUMENTADA (D4). El Mundo v7.
--        Applied via Supabase CLI (db push).
--
-- "El número del que cuelga la compañía": el 26 de julio abres /os y ves,
-- honesto, cuánta gente REAL volvió. If the answer is "más o menos", no
-- está listo. So this is honest by CODE, never by estimate:
--   * cohort by event: the buyer↔event link ALREADY exists on tickets
--     (event_id + buyer_id + created_at). We only add read-side aggregates
--     + the missing FK/index integrity. The Stripe write path is untouched
--     (create-checkout-session.js / webhook.js stay byte-identical).
--   * return log: a lightweight heartbeat — one row per profile per day.
--     Only an authenticated user writes their OWN row (definer RPC pinned
--     to auth.uid()); the table is deny-all so it is NEVER public; only
--     the founder reads it, and only in aggregate.
--   * EXCLUDED FROM EVERY AGGREGATE, by code: is_demo profiles, purged
--     profiles (0027 deleted_at), the all-zero sentinel buyer, and is_test
--     events. Si es 0, dice 0. Sin dato = sin dato.
--
-- NOTE on headcount honesty: the frozen webhook never writes tickets.quantity
-- (defaults 1) and price_paid is the order total, so a multi-ticket order is
-- ONE row. Cohort size is therefore "distinct real buyers / orders", not
-- "attendees" — labeled as such. We do not touch the Stripe files to fix it.
-- =====================================================================

begin;

-- ---------- (1) integrity on tickets: the missing FK + indexes ----------
-- 0001 declared `event_id ... references events(id)` but the column pre-existed
-- (Base44), so the add-column no-op'd and the FK never applied (known debt,
-- 0013:347). Add it now — nullable FK, so the 1 legacy NULL row is fine.
create index if not exists tickets_event_id_idx on public.tickets (event_id);
create index if not exists tickets_buyer_id_idx on public.tickets (buyer_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tickets_event_id_fkey' and conrelid = 'public.tickets'::regclass
  ) then
    alter table public.tickets
      add constraint tickets_event_id_fkey foreign key (event_id)
      references public.events(id) not valid;
    alter table public.tickets validate constraint tickets_event_id_fkey;
  end if;
end $$;

-- ---------- (2) the return log: one row per profile per day ----------
create table if not exists public.retention_activity (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  day        date not null default (now() at time zone 'utc')::date,
  surface    text,
  created_at timestamptz not null default now(),
  primary key (profile_id, day)
);

-- deny-all: RLS on, NO policies, NO grants → nobody reads or writes this table
-- through PostgREST. Writes happen only via log_return() (definer, uid-pinned);
-- the aggregate read happens only via os_cohort_by_event() (definer, owner).
-- "Nunca público" — enforced by the absence of any grant.
alter table public.retention_activity enable row level security;
revoke all on public.retention_activity from anon, authenticated;

-- ---------- (3) log_return(): each writes their OWN heartbeat ----------
-- Pinned to auth.uid(); only a REAL, non-purged profile logs (demo / purged /
-- QA never inflate retention). Idempotent per day (one row per profile per day).
create or replace function public.log_return(p_surface text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;                       -- anon leaves no trace
  end if;
  -- honest by code: only a real, live world's return counts
  if not exists (
    select 1 from public.profiles
    where id = v_uid and coalesce(is_demo, false) = false and deleted_at is null
  ) then
    return;
  end if;
  insert into public.retention_activity (profile_id, day, surface)
  values (v_uid, (now() at time zone 'utc')::date, nullif(left(coalesce(p_surface, ''), 40), ''))
  on conflict (profile_id, day) do nothing;
end;
$$;
revoke all     on function public.log_return(text) from public;
grant  execute on function public.log_return(text) to authenticated;

-- ---------- (4) os_cohort_by_event(): the honest number, founders-only ----------
-- Per real, non-test event: distinct real buyers, gross (cents), how many
-- created a world, how many returned within 1/7/30 days of their first buy,
-- and how many bought a subsequent event. Founder gate (is_owner) — NEVER
-- public, never network-wide. A purged or demo buyer never appears.
create or replace function public.os_cohort_by_event()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;

  return jsonb_build_object('ok', true, 'cohorts', coalesce((
    with real_tickets as (
      -- confirmed tickets by a REAL, non-purged, non-sentinel buyer
      select t.event_id, t.buyer_id, t.created_at, t.price_paid
      from public.tickets t
      join public.profiles p on p.id::text = t.buyer_id
      where t.status = 'confirmed'
        and t.buyer_id <> '00000000-0000-0000-0000-000000000000'
        and coalesce(p.is_demo, false) = false
        and p.deleted_at is null
    ),
    buyer_event as (
      -- one row per (event, buyer)
      select
        rt.event_id,
        rt.buyer_id,
        min(rt.created_at) as first_buy,
        sum(rt.price_paid) as gross,
        (   exists (select 1 from public.world_posts   wp where wp.profile_id::text = rt.buyer_id)
         or exists (select 1 from public.profile_crafts pc where pc.profile_id::text = rt.buyer_id)
         or exists (select 1 from public.profiles pp
                    where pp.id::text = rt.buyer_id
                      and (coalesce(pp.avatar_url, '') <> '' or length(coalesce(pp.bio, '')) > 0))
        ) as has_world
      from real_tickets rt
      group by rt.event_id, rt.buyer_id
    ),
    enriched as (
      select be.*,
        exists (select 1 from public.retention_activity ra
                 where ra.profile_id::text = be.buyer_id
                   and ra.day >  be.first_buy::date
                   and ra.day <= be.first_buy::date + 1)  as returned_1,
        exists (select 1 from public.retention_activity ra
                 where ra.profile_id::text = be.buyer_id
                   and ra.day >  be.first_buy::date
                   and ra.day <= be.first_buy::date + 7)  as returned_7,
        exists (select 1 from public.retention_activity ra
                 where ra.profile_id::text = be.buyer_id
                   and ra.day >  be.first_buy::date
                   and ra.day <= be.first_buy::date + 30) as returned_30,
        exists (select 1 from buyer_event nx
                 where nx.buyer_id = be.buyer_id
                   and nx.event_id <> be.event_id
                   and nx.first_buy > be.first_buy)        as bought_next
      from buyer_event be
    )
    select jsonb_agg(c order by c.event_date desc nulls last, c.first_buy desc)
    from (
      select
        e.id         as event_id,
        e.slug,
        e.title,
        e.event_date,
        count(*)                                       as buyers,
        coalesce(sum(en.gross), 0)                     as gross_cents,
        count(*) filter (where en.has_world)           as created_world,
        count(*) filter (where en.returned_1)          as returned_1d,
        count(*) filter (where en.returned_7)          as returned_7d,
        count(*) filter (where en.returned_30)         as returned_30d,
        count(*) filter (where en.bought_next)         as bought_next,
        min(en.first_buy)                              as first_buy
      from public.events e
      join enriched en on en.event_id = e.id
      where e.is_test = false
      group by e.id, e.slug, e.title, e.event_date
    ) c
  ), '[]'::jsonb));
end;
$$;
revoke all     on function public.os_cohort_by_event() from public;
grant  execute on function public.os_cohort_by_event() to authenticated;

commit;

-- ---------- verify ----------
-- anon:            select public.log_return('x');            -> void, writes nothing (uid null)
-- anon:            select public.os_cohort_by_event()->>'error';  -> 'not_owner'
-- owner:           select public.os_cohort_by_event();       -> {ok:true, cohorts:[…]}
-- deny-all proof:  anon/authenticated GET /rest/v1/retention_activity -> 0 rows / blocked
