-- =====================================================================
-- 0005 — Honest-by-code: mark demo/seed profiles so the public directory
--        can filter them out. The Collectiv4 platform. Run in Supabase SQL editor.
--
-- WHY: prod's `profiles` holds ~8 curated demo personas (batch-created at an
-- identical timestamp, 2026-05-01T19:12:00) alongside the real founder account
-- (@patoduranc). Discovery (public directory) must NEVER show fabricated people.
-- Rather than "remember to delete before launch", we flag the demo set in the DB
-- and the public Discovery query filters `is_demo = false`. A gated preview mode
-- (owner/team) can flip demo rows back on to see the ecosystem full while building.
--
-- Additive + nullable-safe: NOT NULL DEFAULT false is a metadata-only change in
-- PG11+ (no rewrite). NO RLS change (profiles RLS is table-level; the existing
-- public_read / self_insert / self_update policies already govern this column).
-- Does NOT touch the `verified` column or the lock_verified trigger. Idempotent.
-- =====================================================================

begin;

-- 1) The flag. Real accounts default to false (public/honest).
alter table public.profiles
  add column if not exists is_demo boolean not null default false;

-- 2) Flag ONLY the curated demo personas by handle. @patoduranc (the founder's
--    real account) is deliberately excluded and stays is_demo = false.
update public.profiles
   set is_demo = true
 where username in (
   'marcusreyes',      -- Marcus Reyes
   'jasminevcreates',  -- Jasmine Vega
   'devonmills',       -- Devon Mills
   'sofiamendez__',    -- Sofia Mendez
   'andrethompson',    -- Andre Thompson
   'lilachen_film',    -- Lila Chen
   'djcarlosruiz',     -- Carlos Ruiz
   'amaraosei'         -- Amara Osei
 );

-- 3) Give the flagged demo set a structured `discipline` (taken straight from each
--    persona's own bio) so PREVIEW mode can demonstrate the discipline filter.
--    These rows are is_demo = true, so this is never visible on the public path.
update public.profiles set discipline = 'DJ · Producer'          where username = 'marcusreyes';
update public.profiles set discipline = 'Photographer'           where username = 'jasminevcreates';
update public.profiles set discipline = 'Designer'               where username = 'devonmills';
update public.profiles set discipline = 'Fashion Designer'       where username = 'sofiamendez__';
update public.profiles set discipline = 'Muralist'               where username = 'andrethompson';
update public.profiles set discipline = 'Filmmaker'              where username = 'lilachen_film';
update public.profiles set discipline = 'DJ'                     where username = 'djcarlosruiz';
update public.profiles set discipline = 'Producer'              where username = 'amaraosei';

commit;

-- ---------- verify ----------
-- select username, full_name, discipline, is_demo from public.profiles order by is_demo desc, username;
-- Expect: 8 rows is_demo = true (the personas), @patoduranc is_demo = false.
