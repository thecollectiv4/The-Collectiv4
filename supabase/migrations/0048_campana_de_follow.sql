-- =========================================================================
-- 0048 — LA CAMPANA DE FOLLOW. v13.
--        Applied via the Management API (db push is broken on this machine).
--
-- El gap real que encontró el recon de v13: "las campanas" (0042) ya tenía
-- friend_request, friend_accept, message y ticket_sale — pero NO tenía la
-- notificación más básica de una red social: te siguieron. La tabla, el
-- emisor (notify_emit), el centro (el segmento signals de Messages) y el
-- badge YA existen. Esto sólo agrega el kind que faltaba y su trigger.
--
-- ADITIVA Y SEGURA POR DISEÑO:
--   · un kind nuevo en el check (no toca los existentes)
--   · un trigger AFTER INSERT sobre follows (la tabla no tenía ninguno)
--   · pasa por notify_emit, que ya trae el piso de seed (un is_demo nunca
--     suena), el auto-guard (no te notificas a ti mismo) y el SECURITY
--     DEFINER para escribir bajo RLS. Cero lógica nueva de permisos.
--   · SÓLO on INSERT: dejar de seguir (delete) no suena. Es un evento, no
--     un estado — igual que friend_request.
-- Un follow que falle por esto es imposible salvo que el trigger mismo
-- lance, y el cuerpo es una sola llamada a una función que ya está probada
-- en producción por los otros cuatro kinds.
-- =========================================================================

begin;

-- ---------- (1) el kind nuevo en el check ----------
-- El constraint es inline y sin nombre en 0042, así que Postgres lo
-- autonombró notifications_kind_check. Se reemplaza con la lista + 'follow'.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in
    ('friend_request','friend_accept','plan_invite','plan_rsvp',
     'message','ticket_sale','offer_sale','match_new','follow'));

-- ---------- (2) el trigger sobre follows ----------
-- INSERT → el seguido (followee) oye "te empezó a seguir".
-- El actor es el seguidor (follower). notify_emit hace el resto.
create or replace function public.notif_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_emit(new.followee_id, new.follower_id, 'follow', '{}'::jsonb);
  return new;
end;
$$;

drop trigger if exists notifications_follow on public.follows;
create trigger notifications_follow
  after insert on public.follows
  for each row execute function public.notif_on_follow();

commit;

-- Verificación (comentada — para correr a mano en el editor SQL):
--   -- A sigue a B  → B's signals_unread_count sube 1, kind 'follow', actor A
--   -- A deja de seguir a B → NO suena (sólo INSERT dispara)
--   -- un is_demo sigue a B → NO suena (piso de seed en notify_emit)
