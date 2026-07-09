-- =====================================================================
-- 0011 — Content briefs: long structured creative briefs on os_content.
--        Applied via Supabase CLI (db push).
--
-- Adds one nullable text column, `brief`, to public.os_content — the full
-- structured creative brief a member dictates (location, casting, wardrobe,
-- shotlist, caption, references), written by /api/assistant (add_content /
-- update_content, capped server-side) and rendered/edited by the /os client.
--
-- No new policies or grants: os_content's member-only RLS policy
-- (os_content_member_rw, 0010) and its table-level grants are table-wide,
-- so the new column inherits them. Touches NO prices, tickets, or
-- lock_verified. Additive + idempotent.
-- =====================================================================

begin;

alter table public.os_content
  add column if not exists brief text;

comment on column public.os_content.brief is
  'Long structured creative brief (plain text, mono-friendly sections). Written by the Team OS Brain (add_content/update_content) and editable in /os. Nullable; member-only via os_content RLS.';

commit;
