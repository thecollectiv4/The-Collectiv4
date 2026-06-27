-- =====================================================================
-- 0003 — Profile World: cover image + tagline on public.profiles
-- The Collectiv4 platform.  Run in Supabase SQL Editor (or via CLI).
--
-- 100% additive + nullable.  No data loss.  NO RLS changes — the existing
-- profiles_public_read / profiles_self_insert / profiles_self_update policies
-- from 0001 already govern these new columns (RLS is table-level), and the
-- 0002 lock_verified trigger / jsonb guards are untouched.
-- Idempotent: IF NOT EXISTS guards, safe to re-run.
-- =====================================================================

begin;

-- Full-bleed cover image for the profile "world" hero. Like avatar_url, this
-- holds a base64 data: URL today (Supabase Storage migration is queued separately).
alter table public.profiles add column if not exists cover_url text;

-- One-line "right now" statement in the person's own voice (rendered as the
-- featured italic line under the name). Plain text.
alter table public.profiles add column if not exists tagline text;

commit;
