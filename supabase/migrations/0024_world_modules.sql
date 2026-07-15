-- =====================================================================
-- 0024 — MUNDOS MODULARES: the world adapts to the craft (El Mundo v6, D4).
--        The Collectiv4 platform. Applied via Supabase CLI (db push).
--
-- WHAT / WHY:
--   One nullable jsonb column: profiles.world_modules — an ordered array
--   of module keys the owner turned ON for their public world, e.g.
--   ["sound","sets","gallery","taste","offer"]. NULL = the owner never
--   composed their rooms; the client renders the kind-default composition
--   (a DJ's world leads with sound + upcoming sets, a photographer's with
--   the gallery + the offer, a discoverer's with public taste + moments).
--
--   Same doctrine as profiles.taste / profiles.media (0002) and
--   profiles.gallery (0014): owner-written through the existing
--   profiles_self_* RLS, shape-guarded by a CHECK, semantically
--   normalized client-side (normModules whitelists keys — junk in the
--   column can only mis-render its OWN world, never anyone else's).
--
-- HONEST-BY-CODE / SAFETY: purely ADDITIVE — one nullable column, one
--   named CHECK. Zero changes to policies, prices, tickets, verified,
--   Stripe. Idempotent: add-column-if-not-exists + drop-then-add check.
-- =====================================================================

begin;

alter table public.profiles add column if not exists world_modules jsonb;

alter table public.profiles drop constraint if exists profiles_world_modules_is_array;
alter table public.profiles add  constraint profiles_world_modules_is_array
  check (world_modules is null or jsonb_typeof(world_modules) = 'array');

commit;

-- =====================================================================
-- VERIFY: update own row with '["sound","gallery"]'::jsonb -> ok;
--         with '{"x":1}'::jsonb -> check violation.
-- =====================================================================
