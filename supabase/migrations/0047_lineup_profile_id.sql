-- =====================================================================
-- 0047 — MADOU ES NATE: el entry del lineup apunta a un perfil REAL.
--
-- RENUMERADA DE 0046 → 0047 AL RECONCILIAR RAMAS (jul 2026). Tres cosas
-- pelearon por el número 0046 al mismo tiempo:
--   · 0046 = 'diego_fundador' — YA aplicado en la DB, sin archivo en el repo
--   · 0046_la_puerta.sql — la migración de Pato, mergeada a main
--   · 0046_lineup_profile_id.sql — ésta
-- El archivo de Pato se queda con el 0046 del repo (llegó a main primero);
-- ésta pasa a 0047. Su SQL YA CORRIÓ en producción y está verificado
-- (el lineup trae profile_id), sólo cambia el número del archivo.
-- The Collectiv4 platform. Reparación de dato puntual, idempotente.
--
-- WHY -----------------------------------------------------------------
-- El lineup vive como JSONB en events.lineup (0001). El entry de Madou es:
--
--   {"handle":"madou","slug":"madou","name":"MADOU",
--    "role":"DJ","tag":"House · Deep","ig":"@natemadou","color":"#40B060"}
--
-- y el perfil real de esa persona dice full_name 'Nate' con username NULL.
-- CERO identificadores en común: ni handle, ni slug, ni nombre plegado.
-- resolveLineupWorlds cotejaba por texto, así que "MADOU" nunca podía
-- resolver a Nate por listo que fuera el cotejo — no era un bug de
-- matching, era ausencia de dato.
--
-- Las dos salidas eran: (a) un mapa de alias 'madou'→uuid dentro de
-- src/lib/match.js, o (b) el id en el dato. Se eligió (b):
--   · un alias en el código es la identidad de UNA persona escrita a mano
--     dentro de lógica compartida — exige deploy por cada artista nuevo;
--   · el id es exacto y no se puede suplantar renombrándose (que es el
--     riesgo mismo contra el que existe la reja de `verified`);
--   · sobrevive a que Nate cambie de nombre artístico o se ponga username.
--
-- QUÉ HACE ------------------------------------------------------------
-- Le agrega la llave "profile_id" ÚNICAMENTE al entry cuyo handle es
-- 'madou', en el evento 'ran-by-artists'. Nada más se toca.
--
-- SAFETY --------------------------------------------------------------
-- · do $$ …$$  → transaccional: cualquier fallo revierte TODO.
-- · into strict → truena si Nate no existe o si hay más de un 'Nate'
--                 (0 filas = no_data_found, >1 = too_many_rows). Nunca
--                 adivina a quién apuntar. Verificado hoy: exactamente 1.
--                 Ojo: se usa IGUALDAD y no LIKE a propósito — existe un
--                 'Alternate Account' que un %nate% sí atraparía.
-- · Reconstruye el arreglo entry por entry en vez de escribir el JSONB
--   completo a mano: si mañana el lineup crece, esto sigue respetando lo
--   que haya y sólo modifica el de 'madou'.
-- · Idempotente: correrlo dos veces deja exactamente el mismo valor.
-- · NO toca verified, lock_verified, tiers, precios, is_demo, RLS ni
--   ninguna otra columna. Sólo events.lineup del evento nombrado.
-- =====================================================================

do $$
declare
  v_nate  uuid;
  v_event uuid;
  v_new   jsonb;
begin
  -- 1. El perfil real. Falla ruidoso si no es exactamente uno.
  begin
    select id into strict v_nate
    from public.profiles
    where full_name = 'Nate'
      and is_demo = false
      and deleted_at is null;
  exception
    when no_data_found then
      raise exception 'No existe un perfil real con full_name = ''Nate'' — nada que apuntar.';
    when too_many_rows then
      raise exception 'Hay más de un perfil ''Nate'' — ambiguo, abortando en vez de adivinar.';
  end;

  -- 2. El evento: NO por slug, sino por el que de verdad TIENE a madou en su
  --    lineup. El primer intento buscaba slug 'ran-by-artists' y el guard lo
  --    tumbó: el slug real es 'rba-edition-2'. Buscar por contenido en vez de
  --    por nombre evita justo esa clase de error, y sigue sirviendo si algún
  --    día el evento se renombra o se clona.
  begin
    select e.id into strict v_event
    from public.events e
    where exists (
      select 1 from jsonb_array_elements(e.lineup) x
      where x->>'handle' = 'madou'
    );
  exception
    when no_data_found then
      raise exception 'Ningún evento tiene un entry de lineup con handle ''madou''.';
    when too_many_rows then
      raise exception 'Más de un evento con ''madou'' en el lineup — ambiguo, abortando.';
  end;

  -- 3. Reconstruir el lineup: al entry de 'madou' se le agrega profile_id,
  --    todos los demás pasan tal cual. jsonb_agg preserva el orden con la
  --    ordinalidad del with-ordinality, porque el orden del lineup ES
  --    información (quién encabeza).
  select coalesce(jsonb_agg(
           case when elem->>'handle' = 'madou'
                then elem || jsonb_build_object('profile_id', v_nate::text)
                else elem
           end
           order by ord), '[]'::jsonb)
    into v_new
  from public.events e,
       lateral jsonb_array_elements(e.lineup) with ordinality as t(elem, ord)
  where e.id = v_event;

  update public.events set lineup = v_new where id = v_event;

  raise notice 'lineup actualizado: MADOU → % (evento %)', v_nate, v_event;
end $$;
