-- =====================================================================
-- 0012 — Permanent QA checkout-test event, never public.
--
-- WHY: verifying the Stripe checkout end-to-end used to require flipping a
-- REAL production tier to 'available' — which, because the events table is
-- shared and production runs a LIVE Stripe key, would open real ticket sales
-- on the public site. Never again. This adds a dedicated, permanently-hidden
-- test event so the checkout can be exercised on the preview (test key) with
-- zero risk to production data.
--
-- PATTERN: mirrors profiles.is_demo — a `is_test` flag, filtered server-side.
-- Defense in depth:
--   1. events.is_test flag (default false → every real event is unaffected).
--   2. Public client queries filter is_test=false (useLiveEvent, Discover).
--   3. RLS hides is_test rows from anon entirely — only an AUTHENTICATED
--      session (i.e. /test-purchase, which is session-gated) can read one.
--      A real (logged-out) visitor can never see it, even hand-crafting a query.
--   4. created_at is backdated so useLiveEvent (order created_at desc, limit 1)
--      never ranks it as "the live event" even before the client filter ships.
-- The SERVICE key (checkout / webhook) bypasses RLS, so selling the test tier
-- still works server-side. Additive + idempotent.
-- =====================================================================

begin;

alter table public.events
  add column if not exists is_test boolean not null default false;

comment on column public.events.is_test is
  'True = internal QA / checkout-test event. Hidden from every public surface (client filter is_test=false + RLS anon-hidden). Reachable only by an authenticated session via /test-purchase. Never sold to a real buyer.';

-- Public read stays open for non-draft events, but is_test rows are anon-hidden.
-- Authenticated sessions may read them (so /test-purchase can resolve the event);
-- the public client queries still filter is_test=false so it never surfaces there.
drop policy if exists events_public_read on public.events;
create policy events_public_read on public.events
  for select using (
    status <> 'draft'
    and (is_test = false or auth.uid() is not null)
  );

-- The permanent QA event: published (a valid, sellable contract) but is_test.
-- One available tier at a symbolic $1 so a Stripe TEST-mode checkout has a real
-- line item (Stripe's card minimum is $0.50; no real money moves in test mode).
-- created_at is deliberately old so it never wins useLiveEvent's most-recent sort.
insert into public.events
  (slug, title, edition, tagline, event_date, doors, venue, city, status, is_test, tiers, lineup, experiences, created_at)
values (
  'qa-checkout-test',
  'QA — Checkout Test',
  'INTERNAL',
  'Internal end-to-end checkout test. Never shown publicly.',
  '2099-12-31T00:00:00-06:00',
  'n/a',
  'Internal',
  'Houston',
  'published',
  true,
  '[{"id":"test","name":"TEST TICKET","price":100,"status":"available","note":"QA only — Stripe test mode, no real money"}]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '2020-01-01T00:00:00Z'
)
on conflict (slug) do update set
  status  = 'published',
  is_test = true,
  tiers   = excluded.tiers,
  created_at = excluded.created_at;

commit;
