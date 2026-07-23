-- =========================================================================
-- 0054 — LAS FOTOS COMPLETAS (v16 · fase 4)
--
-- DOS DECISIONES DE FUNDADOR, UNA MIGRACIÓN:
--
-- 1) EL ORDEN DE LOS MUNDOS CON CARA. Los perfiles con avatar Y portada van
--    SIEMPRE arriba (en Community y en For You). Dentro de ese grupo, el
--    orden es por cuándo completaron sus fotos — el que acaba de completar
--    entra AL FINAL del grupo, nunca en primer lugar. Eso exige memoria:
--    `photos_completed_at`, mantenida por trigger (se llena cuando ambas
--    fotos existen, se vacía si alguna se va — quitar una foto te saca del
--    grupo, volverla a poner te forma al final, que es lo honesto).
--    Backfill: coalesce(updated_at, created_at) — no existe registro real
--    de cuándo esos 4 perfiles completaron sus fotos, así que se usa la
--    última fecha conocida de su fila; el orden relativo resultante es
--    estable y deja de importar en cuanto la columna vive de verdad.
--
-- 2) FOR YOU SIN FANTASMAS. La regla del send-off: TODOS los perfiles
--    reales aparecen (fuera is_demo y purgados, como siempre). La causa
--    estructural de los perfiles invisibles era el corte `score >= 1` de
--    0025/0040 — un perfil real sin señales compartidas daba 0 y
--    desaparecía; y el penalizador -2 de "ya lo sigo" hundía a conocidos
--    por debajo del corte. EL SCORE AHORA ORDENA, NUNCA EXCLUYE. El tope
--    sube de 60 a 200 (el mismo techo que Community) para que "todos"
--    sea verdad también en el límite.
--
-- LA LEY ANTI-ORÁCULO DE 0025 SIGUE INTACTA: un candidato sólo es visible
-- y ordenado por sus señales PÚBLICAS (public_overlap usa is_public).
-- Mostrar más perfiles no filtra nada privado: las razones nombrables
-- siguen saliendo sólo de shared_crafts / shared_public_tastes / city.
--
-- SEGURIDAD (regla 0053): CREATE OR REPLACE conserva el ACL vivo de
-- get_for_you — anon quedó revocado por 0053 y authenticated conserva su
-- grant; el bloque de abajo lo re-declara explícito de todos modos. La
-- función de trigger es nueva: nace CERRADA a anon/PUBLIC por los default
-- privileges de 0053, y ningún rol de cliente necesita ejecutarla (la
-- dispara el sistema). NADA nuevo se concede a anon.
-- =========================================================================
begin;

-- ---------- 1) la memoria: cuándo quedó completa la cara del mundo ----------
alter table public.profiles
  add column if not exists photos_completed_at timestamptz;

create or replace function public.profiles_photos_completed()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if coalesce(new.avatar_url, '') <> '' and coalesce(new.cover_url, '') <> '' then
    -- ya completo: si es la primera vez (o re-completó después de quitar
    -- una foto), sella AHORA — entra al final del grupo con fotos
    if new.photos_completed_at is null then
      new.photos_completed_at := now();
    end if;
  else
    -- cara incompleta: fuera del grupo, sin sello
    new.photos_completed_at := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_profiles_photos_completed on public.profiles;
create trigger trg_profiles_photos_completed
  before insert or update of avatar_url, cover_url on public.profiles
  for each row execute function public.profiles_photos_completed();

-- backfill de los perfiles ya completos (ver la nota del encabezado)
update public.profiles
   set photos_completed_at = coalesce(updated_at, created_at)
 where coalesce(avatar_url, '') <> ''
   and coalesce(cover_url, '') <> ''
   and photos_completed_at is null;

-- ---------- 2) get_for_you: el score ordena, nunca excluye ----------
CREATE OR REPLACE FUNCTION public.get_for_you(p_limit integer DEFAULT 30, p_city text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid    uuid := auth.uid();
  v_city   text;
  v_city_n text;
  -- v16: tope 200 (era 60) — "todos los perfiles reales" también en el límite
  v_limit  int := least(greatest(coalesce(p_limit, 30), 1), 200);
  v_people jsonb;
  v_events jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select coalesce(nullif(btrim(coalesce(p_city, '')), ''),
                  nullif(btrim(coalesce(p.city, '')), ''),
                  'Houston')
    into v_city
  from public.profiles p where p.id = v_uid;
  v_city   := coalesce(v_city, 'Houston');
  v_city_n := public.c4_norm(v_city);

  -- ---------------- PEOPLE ----------------
  with my_tastes as (
    select domain, norm from public.profile_tastes where profile_id = v_uid
  ),
  my_crafts as (
    select craft_id from public.profile_crafts where profile_id = v_uid
  ),
  i_follow as (
    select followee_id from public.follows where follower_id = v_uid
  ),
  follows_me as (
    select follower_id from public.follows where followee_id = v_uid
  ),
  cand as (
    select
      p.id, p.full_name, p.username, p.avatar_url, p.cover_url,
      p.city, p.tagline, p.verified, p.is_demo,
      p.photos_completed_at,
      (select count(*) from public.profile_tastes t
        join my_tastes m on m.domain = t.domain and m.norm = t.norm
        where t.profile_id = p.id
          and t.is_public)                                 as public_overlap,
      (select count(*) from public.profile_crafts pc
        where pc.profile_id = p.id
          and pc.craft_id in (select craft_id from my_crafts)) as craft_overlap,
      (p.city is not null and public.c4_norm(p.city) = v_city_n) as same_city,
      exists (select 1 from i_follow f where f.followee_id = p.id)   as f_out,
      exists (select 1 from follows_me f where f.follower_id = p.id) as f_in
    from public.profiles p
    where p.id <> v_uid
      and (p.is_demo = false or public.is_owner())
      and p.deleted_at is null      -- v7: a purged world is never a candidate
  ),
  scored as (
    select c.*,
      (c.public_overlap * 3
       + c.craft_overlap * 2
       + case when c.same_city then 2 else 0 end
       + case when c.f_in then 1 else 0 end
       + case when c.verified then 1 else 0 end
       - case when c.f_out then 2 else 0 end) as score
    from cand c
  ),
  ranked as (
    -- v16: el corte score >= 1 MURIÓ — todos los candidatos reales entran.
    -- Orden de fundador: fotos completas arriba (el sello más viejo
    -- primero, el recién completado al final del grupo); después el score
    -- ordena la cola como siempre.
    select * from scored
    order by (photos_completed_at is not null) desc,
             photos_completed_at asc,
             score desc, public_overlap desc, same_city desc, id
    limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id',         r.id,
           'name',       r.full_name,
           'username',   r.username,
           'avatar_url', r.avatar_url,
           'cover_url',  r.cover_url,
           'city',       r.city,
           'tagline',    r.tagline,
           'verified',   r.verified,
           'is_demo',    r.is_demo,
           'i_follow',   r.f_out,
           'follows_me', r.f_in,
           'crafts', coalesce((
              select jsonb_agg(jsonb_build_object(
                       'name', c.name, 'slug', c.slug, 'category', c.category,
                       'is_primary', pc.is_primary)
                     order by pc.is_primary desc, pc.position)
              from public.profile_crafts pc
              join public.crafts c on c.id = pc.craft_id
              where pc.profile_id = r.id), '[]'::jsonb),
           'shared_crafts', coalesce((
              select jsonb_agg(distinct c.name)
              from public.profile_crafts pc
              join public.crafts c on c.id = pc.craft_id
              where pc.profile_id = r.id
                and pc.craft_id in (select craft_id from public.profile_crafts where profile_id = v_uid)), '[]'::jsonb),
           'shared_public_tastes', coalesce((
              select jsonb_agg(jsonb_build_object('domain', t.domain, 'label', t.label))
              from (
                select tt.domain, tt.label
                from public.profile_tastes tt
                join public.profile_tastes mine
                  on mine.profile_id = v_uid
                 and mine.domain = tt.domain
                 and mine.norm = tt.norm
                where tt.profile_id = r.id
                  and tt.is_public
                order by tt.position
                limit 3
              ) t), '[]'::jsonb),
           'same_city', r.same_city
         ) order by (r.photos_completed_at is not null) desc,
                    r.photos_completed_at asc,
                    r.score desc, r.public_overlap desc, r.same_city desc, r.id), '[]'::jsonb)
    into v_people
  from ranked r;

  -- ---------------- EVENTS ----------------
  with my_music as (
    select norm from public.profile_tastes
    where profile_id = v_uid and domain = 'music'
  ),
  i_follow as (
    select followee_id from public.follows where follower_id = v_uid
  ),
  ecand as (
    select e.id, e.slug, e.title, e.tagline, e.event_date, e.venue, e.city,
           e.cover_url, e.is_house, e.vibe, e.host_id,
           coalesce((
             select array_agg(s)
             from jsonb_array_elements_text(coalesce(e.vibe->'sound', '[]'::jsonb)) s
             where public.c4_norm(s) in (select norm from my_music)
           ), '{}'::text[])                                   as shared_sounds,
           (e.city is not null and public.c4_norm(e.city) = v_city_n) as same_city,
           (e.host_id is not null
             and e.host_id in (select followee_id from i_follow))     as host_followed,
           (e.host_id is not null and exists (
              select 1 from public.profiles hp
              where hp.id = e.host_id
                and (hp.is_demo = true or hp.deleted_at is not null)))  as demo_host  -- v7: purged host hidden too
    from public.events e
    where e.status = 'published'
      and e.is_test = false
      and (e.event_date is null or e.event_date >= now() - interval '12 hours')
  ),
  escored as (
    select c.*,
      (coalesce(array_length(c.shared_sounds, 1), 0) * 3
       + case when c.same_city then 2 else 0 end
       + case when c.host_followed then 2 else 0 end
       + case when c.is_house then 1 else 0 end) as score
    from ecand c
    where not c.demo_host
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id',         s.id,
           'slug',       s.slug,
           'title',      s.title,
           'tagline',    s.tagline,
           'event_date', s.event_date,
           'venue',      s.venue,
           'city',       s.city,
           'cover_url',  s.cover_url,
           'is_house',   s.is_house,
           'kind',       s.vibe->>'kind',
           'sounds',     coalesce(s.vibe->'sound', '[]'::jsonb),
           'line',       s.vibe->>'line',
           'shared_sounds', to_jsonb(s.shared_sounds),
           'host_followed', s.host_followed,
           'same_city',     s.same_city
         ) order by s.score desc, s.event_date asc nulls last, s.id), '[]'::jsonb)
    into v_events
  from (select * from escored order by score desc, event_date asc nulls last, id limit 12) s;

  return jsonb_build_object(
    'ok', true,
    'city', v_city,
    'people', v_people,
    'events', v_events
  );
end;
$function$;

-- el ACL explícito, aunque OR REPLACE ya lo conserva (cinturón 0053):
-- anon NO ejecuta esto; authenticated sí.
revoke all     on function public.get_for_you(integer, text) from public, anon;
grant  execute on function public.get_for_you(integer, text) to authenticated;

commit;

-- =====================================================================
-- VERIFY (after apply, via Management API):
--   -- has_function_privilege('anon', 'public.get_for_you(integer,text)', 'execute') = false
--   -- select count(*) from profiles where photos_completed_at is not null  -> 4 (los completos de hoy)
--   -- authed: people.length == todos los perfiles reales activos menos yo
--   -- el orden: los 4 con fotos primero (sello asc), luego el resto por score
-- =====================================================================
