-- =========================================================================
-- 0053 — LA PUERTA DE SERVICIO
--
-- Un visitante SIN SESIÓN podía preguntarle a la base quién es amigo de
-- quién, y recibir respuesta.
--
--     select public.are_friends('<uuid A>', '<uuid B>')  ->  true
--
-- La tabla `friendships` está correctamente cerrada — anon recibe
-- "permission denied for table friendships". Pero `are_friends` es SECURITY
-- DEFINER, no mira auth.uid(), y anon tenía EXECUTE sobre ella: la tabla
-- cerrada y el oráculo abierto. Los UUID de perfil son públicos (viajan en
-- /user/:id), así que la red de conexiones se podía reconstruir par por par.
-- `is_close` filtraba igual la lista de amigos cercanos.
--
-- Eso contradice una promesa escrita en el producto (Settings.jsx, §03
-- Privacy): "your CONNECTED list has no public read path in the database at
-- all. Nobody can open it, including us."
--
-- ── POR QUÉ PASÓ: `revoke from public` NO ES SUFICIENTE ─────────────────
-- anon llega por DOS caminos y hay que cortar los dos:
--   · el grant heredado de PUBLIC        -> ACL "=X/postgres"
--   · el grant DIRECTO a anon, que los privilegios default de Supabase
--     conceden al crear cualquier función -> ACL "anon=X/postgres"
-- Casi todas nuestras migraciones hacían `revoke all from public` y dejaban
-- vivo el directo. 0052 revocó de anon pero no de public. La forma completa,
-- y la que este archivo usa en todas partes, es:
--     revoke execute on function ... from public, anon;
--
-- ── QUÉ **NO** SE REVOCA, Y POR QUÉ ────────────────────────────────────
-- Verificado rompiéndolas a propósito dentro de transacciones con ROLLBACK,
-- no por deducción:
--   · is_owner()            11 políticas, entre ellas profiles_public_read.
--                           Revocarla -> "permission denied for function
--                           is_owner" al leer profiles COMO ANÓNIMO: el sitio
--                           público entero deja de cargar.
--   · caller_is_verified()  igual, 4 políticas de rol público.
--   · confirmed_count()     la llaman páginas públicas de evento como anon
--                           (EventLanding.jsx, Events.jsx).
--   · caller_is_network() · is_plan_member() · can_see()
--                           inertes para anon (devuelven false/nada) y hoy
--                           inalcanzables porque anon no puede leer plans ni
--                           os_*. Pero son infraestructura de políticas de rol
--                           PÚBLICO: Postgres las evaluará el día que esas
--                           tablas se abran. Cero fuga -> cero ganancia en
--                           revocarlas, y un modo de fallo confuso si se hace.
--
-- Las 8 funciones TRIGGER (notif_on_*, lock_*, bump_thread_on_message) se
-- quedan como están: no tienen firma invocable por PostgREST y el permiso se
-- comprueba al CREAR el trigger, no al dispararlo. Riesgo sin ganancia.
--
-- Los 49 revokes de abajo se probaron en bloque contra las superficies
-- públicas como rol anon: perfiles, posts, crafts, tastes, follows, listings,
-- eventos y confirmed_count siguen respondiendo igual. Las 63 funciones
-- tienen grant DIRECTO a `authenticated`, así que revocar PUBLIC no le quita
-- nada a un miembro con sesión (verificado: authenticated sigue leyendo
-- are_friends -> true).
-- =========================================================================

-- ---------- (1) LA FUGA: el grafo social, legible sin sesión ----------
-- Ninguna de las dos mira auth.uid(). No están en ninguna política y el
-- cliente nunca las invoca: sólo las llaman otras funciones definer, y ahí
-- el grant de quien llama es irrelevante. El permiso de anon no servía
-- para nada y filtraba la red entera.
revoke execute on function public.are_friends(p_a uuid, p_b uuid) from public, anon;
revoke execute on function public.is_close(p_owner uuid, p_viewer uuid) from public, anon;

-- ---------- (2) LA SUPERFICIE ADMIN ----------
-- Inertes hoy: is_owner() devuelve false para anon (verificado ejecutando
-- como rol anon), así que todas cortan sola. Se cierran igual porque el
-- permiso no les sirve de nada y el radio de daño es total si esa guarda
-- se degradara alguna vez. Defensa en profundidad, no corrección.
revoke execute on function public.admin_delete_event(p_id uuid) from public, anon;
revoke execute on function public.admin_list_accounts() from public, anon;
revoke execute on function public.admin_list_events() from public, anon;
revoke execute on function public.admin_list_users() from public, anon;
revoke execute on function public.admin_purge_seed() from public, anon;
revoke execute on function public.admin_restore(p_user uuid) from public, anon;
revoke execute on function public.admin_save_event(p jsonb) from public, anon;
revoke execute on function public.admin_seed_count() from public, anon;
revoke execute on function public.admin_set_protected(p_user uuid, p_protected boolean) from public, anon;
revoke execute on function public.admin_set_verified(p_user uuid, p_verified boolean) from public, anon;
revoke execute on function public.admin_soft_purge(p_user uuid) from public, anon;
revoke execute on function public.set_verified(p_target uuid, p_verified boolean) from public, anon;

-- ---------- (3) LO QUE EXIGE SESIÓN POR DISEÑO ----------
-- Sociales, planes, mensajes, señales, tickets, OS. Todas con guarda de
-- auth.uid() y todas inertes para un anónimo. Mismo criterio que (2):
-- un visitante sin sesión no tiene por qué poder invocarlas.
revoke execute on function public.add_close_friend(p_other uuid) from public, anon;
revoke execute on function public.add_group_member(p_thread uuid, p_other uuid) from public, anon;
revoke execute on function public.cancel_plan(p_plan uuid) from public, anon;
revoke execute on function public.check_in_ticket(p_qr text, p_event uuid) from public, anon;
revoke execute on function public.claim_my_tickets() from public, anon;
revoke execute on function public.confirmed_attendees(p_event uuid) from public, anon;
revoke execute on function public.create_group_thread(p_title text, p_member_ids uuid[]) from public, anon;
revoke execute on function public.create_plan(p jsonb) from public, anon;
revoke execute on function public.door_stats(p_event uuid) from public, anon;
revoke execute on function public.ensure_own_profile() from public, anon;
revoke execute on function public.get_for_you(p_limit integer, p_city text) from public, anon;
revoke execute on function public.invite_to_plan(p_plan uuid, p_others uuid[]) from public, anon;
revoke execute on function public.is_thread_member(p_thread uuid) from public, anon;
revoke execute on function public.join_event_chat(p_event uuid) from public, anon;
revoke execute on function public.leave_plan(p_plan uuid) from public, anon;
revoke execute on function public.leave_thread(p_thread uuid) from public, anon;
revoke execute on function public.list_network_profiles() from public, anon;
revoke execute on function public.log_return(p_surface text) from public, anon;
revoke execute on function public.mark_signals_read(p_ids uuid[]) from public, anon;
revoke execute on function public.my_close_friends() from public, anon;
revoke execute on function public.my_os_identity() from public, anon;
revoke execute on function public.my_signals(p_limit integer) from public, anon;
revoke execute on function public.os_cohort_by_event() from public, anon;
revoke execute on function public.remove_close_friend(p_other uuid) from public, anon;
revoke execute on function public.remove_friend(p_other uuid) from public, anon;
revoke execute on function public.request_friend(p_other uuid) from public, anon;
revoke execute on function public.respond_friend(p_other uuid, p_accept boolean) from public, anon;
revoke execute on function public.rsvp_plan(p_plan uuid, p_status text) from public, anon;
revoke execute on function public.set_attendance_visibility(p_event uuid, p_tier text) from public, anon;
revoke execute on function public.set_plan_visibility(p_plan uuid, p_tier text) from public, anon;
revoke execute on function public.set_profile_crafts(p_craft_ids uuid[], p_primary_id uuid) from public, anon;
revoke execute on function public.set_profile_tastes(p jsonb) from public, anon;
revoke execute on function public.signals_unread_count() from public, anon;
revoke execute on function public.start_dm(p_other uuid) from public, anon;
revoke execute on function public.submit_drop(p_body text, p_context jsonb) from public, anon;

-- ---------- (4) QUE NO VUELVA A PASAR ----------
-- La causa raíz no son estas 49 funciones: es que CADA función nueva nace
-- con EXECUTE para anon. Los privilegios default de Supabase en el schema
-- public lo conceden explícitamente (pg_default_acl: "anon=X/postgres"), y
-- encima Postgres añade el EXECUTE a PUBLIC de fábrica. Sin esto, la próxima
-- función definer que alguien escriba reabre la puerta sin que nadie lo note.
--
-- Se apunta al rol `postgres` porque es el que corre las migraciones y el que
-- posee las 73 funciones definer de public (verificado: current_user y
-- proowner). Lo que crea `supabase_admin` es interno de Supabase y no se toca.
--
-- ⚠ CONSECUENCIA PARA QUIEN ESCRIBA LA PRÓXIMA FUNCIÓN: a partir de aquí
-- TODA función nueva en public nace CERRADA para anon — incluidas las que no
-- son definer. Si un visitante SIN SESIÓN necesita invocarla, hay que
-- concederlo a mano y a propósito:
--     grant execute on function public.<nueva>(...) to anon;
-- Olvidarlo no rompe a los miembros con sesión (authenticated conserva su
-- grant default): falla sólo para deslogueados, que es el modo de fallo
-- seguro y el que queremos.
--
-- HACEN FALTA LAS DOS SENTENCIAS, Y NO SON INTERCAMBIABLES. Los privilegios
-- default POR SCHEMA se SUMAN a los globales, no los reemplazan — así que
-- anon llega por dos caminos distintos y hay que cortar cada uno donde vive:
--   · el EXECUTE a PUBLIC es el default GLOBAL de fábrica de Postgres para
--     funciones. No está en pg_default_acl y una sentencia `IN SCHEMA public`
--     NO lo toca: hay que revocarlo SIN cláusula de schema.
--   · el EXECUTE directo a anon sí es un default configurado por Supabase en
--     el schema public (pg_default_acl: "anon=X/postgres"), y ése se revoca
--     CON `IN SCHEMA public`.
-- Medido: con sólo la variante por schema, una función nueva nace
-- "=X/postgres | postgres=X | authenticated=X | service_role=X" — anon fuera
-- del ACL pero dentro por PUBLIC, o sea la puerta seguía abierta. Con las dos
-- nace "postgres=X | authenticated=X | service_role=X": anon false, auth true.
--
-- La primera es GLOBAL a propósito (afecta lo que `postgres` cree en
-- cualquier schema, no sólo public) porque es la única forma de matar el
-- default de fábrica. Nada existente cambia: los privilegios default sólo
-- aplican al CREAR. Si algún día una migración crea una función fuera de
-- public que un rol no privilegiado deba invocar, tendrá que concederlo a
-- mano — mismo trato que en public.
alter default privileges for role postgres
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;
