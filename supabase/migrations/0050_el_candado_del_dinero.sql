-- ============================================================
-- 0050 — el candado del dinero
-- ============================================================
-- The security gate that preceded the payment layer (21 jul 2026)
-- confirmed the known default-privileges pitfall on the two money
-- tables: anon and authenticated hold FULL table-level DML grants
-- on public.tickets and public.events. Inert today — neither table
-- has a client write policy, so RLS default-denies — but it means
-- the only thing between a client and a money table is the absence
-- of a policy. One permissive policy added later would inherit the
-- whole grant.
--
-- Least privilege: writes on money tables belong to service_role
-- (the webhook) and SECURITY DEFINER RPCs (admin_save_event) only.
-- SELECT stays granted — the read policies govern it.
-- ============================================================

revoke insert, update, delete, truncate, references, trigger
  on public.tickets from anon, authenticated;

revoke insert, update, delete, truncate, references, trigger
  on public.events from anon, authenticated;
