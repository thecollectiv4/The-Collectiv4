-- ============================================================
-- 0051 — la reserva
-- ============================================================
-- The booking payment layer. A creative shares a payment link for
-- a service (a listing, kind='service' — the OFFER layer from 0017);
-- a client — usually someone with no account, reached by DM — pays
-- it on a standalone page. The money enters the C4 Stripe account
-- directly (no Connect yet); C4's service fee is a config value,
-- snapshotted per booking, never hardcoded in UI.
--
-- Write doctrine (house rules):
--   · rows are BORN via service_role only (the create-booking-session
--     edge function) — no client INSERT policy exists
--   · state changes to 'paid' via service_role only (booking-webhook,
--     Stripe-signature-verified) — no client UPDATE policy exists
--   · the creative's single reachable write is the gated RPC
--     booking_mark_delivered (paid → delivered on their own rows)
--   · the creative reads their own bookings; nobody else reads any
--   · grants are least-privilege from birth (0050 doctrine)
-- ============================================================

-- ---------- app_config: server-side config, clients never read it
create table if not exists public.app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;
revoke all on public.app_config from public, anon, authenticated;

-- C4 service fee on bookings, in basis points. 1500 = 15%, the floor
-- of the agency doctrine (15–25%). Edit the row, not the code.
insert into public.app_config (key, value)
values ('booking_fee_bps', to_jsonb(1500))
on conflict (key) do nothing;

-- ---------- listings: the deliverable line a service promises
alter table public.listings
  add column if not exists delivery text
  check (delivery is null or char_length(delivery) between 1 and 140);

-- ---------- bookings
create table if not exists public.bookings (
  id                uuid primary key default gen_random_uuid(),
  listing_id        uuid references public.listings(id) on delete set null,
  creative_id       uuid not null references public.profiles(id) on delete cascade,

  -- snapshots: the listing can change or die after the booking is born
  service_title     text not null check (char_length(service_title) between 1 and 120),
  price_cents       integer not null check (price_cents between 100 and 5000000),
  fee_bps           integer not null check (fee_bps between 0 and 5000),
  currency          text not null default 'usd',

  -- the client — no account required (the page is the acquisition channel)
  client_name       text not null check (char_length(client_name) between 1 and 120),
  client_email      text not null check (position('@' in client_email) > 1),
  client_user_id    uuid,          -- filled if/when the client claims their world

  -- the structured request: { brief, date, place, links }
  request           jsonb not null default '{}'::jsonb,

  status            text not null default 'pending'
                    check (status in ('pending','paid','delivered','cancelled')),
  stripe_session_id text,
  stripe_payment_id text,

  is_demo           boolean not null default false,  -- guardrail-4: travels with identity

  created_at        timestamptz not null default now(),
  paid_at           timestamptz,
  delivered_at      timestamptz
);

create unique index if not exists bookings_stripe_session_uidx
  on public.bookings (stripe_session_id) where stripe_session_id is not null;
create unique index if not exists bookings_stripe_payment_uidx
  on public.bookings (stripe_payment_id) where stripe_payment_id is not null;
create index if not exists bookings_creative_created_idx
  on public.bookings (creative_id, created_at desc);

alter table public.bookings enable row level security;

-- least privilege from birth: kill the default-privilege grants,
-- then grant back exactly what the read policy needs
revoke all on public.bookings from public, anon, authenticated;
grant select on public.bookings to authenticated;

-- the creative sees their own bookings; clients poll through the
-- booking-status edge function (service_role), never through RLS
create policy bookings_creative_read on public.bookings
  for select to authenticated
  using (auth.uid() = creative_id);

-- ---------- the creative's one write: mark a paid booking delivered
create or replace function public.booking_mark_delivered(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  update public.bookings
     set status = 'delivered',
         delivered_at = now()
   where id = p_booking_id
     and creative_id = auth.uid()
     and status = 'paid'
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found_or_not_paid');
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'status', 'delivered');
end;
$$;

revoke all on function public.booking_mark_delivered(uuid) from public, anon;
grant execute on function public.booking_mark_delivered(uuid) to authenticated;
