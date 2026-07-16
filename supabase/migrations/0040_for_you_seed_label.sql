-- =========================================================================
-- 0040 — THE FOR-YOU CAN LABEL THE SEED (El Mundo v10 · guardrail 4, N1)
--
-- THE GAP (v10 PASO-0 recon, Gap Audit N1): 0036 let the founder's for-you
-- RANK seed worlds (SHOW SEED + is_owner branch), but the people payload
-- carries no is_demo — so ForYou.jsx cannot draw the ◇ seed label that
-- guardrail 4 demands ("el founder siempre sabe"). Community labels its
-- cards (seed-card-badge); the for-you — the exact surface where v10's
-- spectrum lands — could not. With ~90 seed worlds ranking, the founder
-- would see architects and chefs with no way to tell fixture from member.
--
-- THE FIX: byte-faithful re-declaration of 0036's get_for_you with ONE
-- additive field: `is_demo` flows from the candidate row into the people
-- JSON. For every non-owner the field is constantly false (their candidate
-- set already excludes seed via `p.is_demo = false`), so a normal member's
-- feed payload gains a key but never a different row set. No scoring
-- change, no RLS change, same signature. Additive.
-- =========================================================================
begin;

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
  v_limit  int := least(greatest(coalesce(p_limit, 30), 1), 60);
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
    select * from scored
    where score >= 1
    order by score desc, public_overlap desc, same_city desc, id
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
         ) order by r.score desc, r.public_overlap desc, r.same_city desc, r.id), '[]'::jsonb)
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


revoke all     on function public.get_for_you(integer, text) from public;
grant  execute on function public.get_for_you(integer, text) to authenticated;

commit;

-- =====================================================================
-- VERIFY (after push):
--   -- anon:                      get_for_you -> not_authenticated (unchanged)
--   -- authed non-owner:          every people row has is_demo: false
--   -- founder with SHOW SEED on: seed rows rank AND carry is_demo: true
-- =====================================================================
