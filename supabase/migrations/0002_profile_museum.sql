-- =====================================================================
-- 0002 — Profile Museum: additive columns on public.profiles
--        + verified-badge integrity trigger
-- The Collectiv4 platform.  Run in Supabase SQL Editor (or via CLI).
--
-- 100% additive + nullable.  No data loss.  NO RLS changes — the existing
-- profiles_public_read / profiles_self_insert / profiles_self_update
-- policies from 0001 already govern these new columns (RLS is table-level).
-- Idempotent: every column is guarded by IF NOT EXISTS and the trigger is
-- dropped-then-created, so this is safe to re-run.
-- =====================================================================

begin;

-- ---------- Identity ----------
alter table public.profiles add column if not exists city       text;  -- likely already exists (Profile insert writes it) → no-op
alter table public.profiles add column if not exists discipline text;  -- "DJ" · "Painter" · "Photographer" · "Designer"…
alter table public.profiles add column if not exists bio        text;  -- likely already exists → no-op

-- ---------- The museum / taste world ----------
-- App-owned shape: {"music":[...],"films":[...],"influences":[...]}
-- Kept jsonb (not three text[] cols) so the taste structure can grow without
-- another migration. Nullable: existing rows stay null; the client coalesces
-- null → {music:[],films:[],influences:[]}.
alter table public.profiles add column if not exists taste jsonb;

-- ---------- Work / portfolio / media ----------
-- App-owned shape: [{"type":"link"|"embed"|"image","url":"…","title":"…"}]
-- Nullable: existing rows stay null; the client coalesces null → [].
alter table public.profiles add column if not exists media jsonb;

-- ---------- Verified trust badge ----------
-- NOT NULL DEFAULT false: a constant default is a metadata-only change in
-- Postgres 11+ (no table rewrite), so this is safe even on a populated table.
alter table public.profiles add column if not exists verified boolean not null default false;

-- ---------- Verified-badge integrity ----------
-- WHY: profiles RLS is ROW-level, not column-level. Both the self_insert and
-- self_update policies constrain only the row id (auth.uid() = id) — NOT which
-- columns a client may write. So without this a logged-in user could set their
-- OWN profiles.verified = true straight from the browser console with the anon
-- key, on either:
--   • UPDATE — `update profiles set verified=true where id=<self>`, or
--   • INSERT — `insert profiles {id:<self>, verified:true}` (the COMMON path:
--     Profile.jsx creates the row lazily on first /profile visit, so most rows
--     are born via insert — a BEFORE UPDATE-only trigger would never see it).
-- That would make the badge a self-awarded sticker and destroy its meaning as a
-- trust signal for "our network".
--
-- A column-level REVOKE does NOT work here: anon/authenticated must keep the
-- TABLE-level insert/update grant for normal profile writes under RLS, and in
-- Postgres a table-level privilege is the union with column privileges — a
-- column REVOKE can't subtract from it. So the enforcement is this BEFORE
-- INSERT OR UPDATE trigger. It blocks ONLY the client roles (anon/authenticated);
-- the service role (server) and the SQL editor (auth.role() is null there) keep
-- the ability to grant/revoke the badge. It never touches any column but `verified`.
create or replace function public.lock_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.verified := false;             -- clients never CREATE a verified row
    elsif new.verified is distinct from old.verified then
      new.verified := old.verified;      -- clients never CHANGE verified
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lock_verified on public.profiles;
create trigger trg_lock_verified
  before insert or update on public.profiles
  for each row
  execute function public.lock_verified();

-- ---------- jsonb shape guards (cheap integrity, additive) ----------
-- The client normalizes taste→object / media→array, but profiles is self-writable
-- via the anon key, so a raw client could store a wrong-shaped blob. These CHECKs
-- keep the columns honest at the DB layer. Drop-then-add = idempotent (the columns
-- are brand-new here, so every existing row is null and passes).
alter table public.profiles drop constraint if exists profiles_taste_is_object;
alter table public.profiles add  constraint profiles_taste_is_object
  check (taste is null or jsonb_typeof(taste) = 'object');
alter table public.profiles drop constraint if exists profiles_media_is_array;
alter table public.profiles add  constraint profiles_media_is_array
  check (media is null or jsonb_typeof(media) = 'array');

commit;

-- ---------- How to grant a real badge later (run as service role / SQL editor) ----------
-- update public.profiles set verified = true where id = '<user-uuid>';
-- (The SQL editor runs with elevated rights, so the trigger lets this through.)
