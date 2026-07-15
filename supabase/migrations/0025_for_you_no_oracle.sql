-- =====================================================================
-- 0025 — FOR-YOU SIN ORÁCULO: el crudo alimenta MI discovery, jamás
--        expone el del otro (El Mundo v6, corrección de review).
--        The Collectiv4 platform. Applied via Supabase CLI (db push).
--
-- THE HOLE (adversarial review, HIGH — the privacy skeptics planted for
-- exactly this found it): 0022's get_for_you ranked and ADMITTED people
-- by RAW taste overlap — a candidate's PRIVATE tastes decided whether and
-- where they appeared. An attacker (Eve) could set her whole taste set to
-- one probe T, zero her crafts, pass a bogus p_city to null every other
-- signal, and read back the `people` array: anyone who surfaced with no
-- public reason necessarily held T PRIVATELY. Membership at score>=1 (and
-- the raw_overlap tiebreaker) was a clean 1-bit oracle over the exact
-- (profile, private-taste) fact profile_tastes RLS forbids — defeating
-- the whole law of the layer ("THE RAW RANKS, ONLY THE PUBLIC SPEAKS";
-- "Founders cannot read a member's raw tastes").
--
-- THE FIX (faithful to canon, not a nerf): the asymmetry Pato named —
-- "los gustos privados alimentan MI discovery; mostrar es una decisión."
--   * MY tastes (private included — they are MINE, zero leak) still rank
--     what I SEE.
--   * A CANDIDATE only ever becomes visible / ordered by their OWN PUBLIC
--     signals: public tastes, crafts, city, follows-me, verified.
--   So my private love of house shows me people who PUBLICLY love house;
--   my private tastes never make ANYONE ELSE discoverable-by-a-private-fact.
--   The output for caller Eve about candidate X now depends only on X's
--   PUBLIC data + Eve's own data → Eve learns nothing private about X.
--   The oracle is gone by construction (membership AND order), and
--   taste-based discovery still works: it just reads the side of the
--   match that its owner chose to make speakable.
--
-- WHAT CHANGES: only the PEOPLE block of get_for_you — `raw_overlap`
--   (candidate's ALL tastes) becomes `public_overlap` (candidate's
--   is_public tastes only). The EVENTS block is untouched: it already
--   matches the caller's own tastes against an event's DECLARED (public)
--   sounds — a host's public declaration, never another person's private
--   fact. Same signature, same payload shape, same grants.
--
-- SAFETY: additive (create-or-replace of one function; no schema, policy,
--   grant, price, ticket, or Stripe change). Idempotent.
-- =====================================================================

begin;

create or replace function public.get_for_you(
  p_limit int  default 30,
  p_city  text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
    -- MY whole taste set — private included. It is mine; using it to
    -- rank what I see leaks nothing about me and nothing about others.
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
      p.city, p.tagline, p.verified,
      -- PUBLIC overlap only: a candidate is matchable-to-others solely by
      -- the tastes they CHOSE to show. Their private rows never enter the
      -- count, so they can never make the candidate appear or move — the
      -- oracle's fuel is removed at the source.
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
      and p.is_demo = false
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
    -- every admitted person carries at least one SPEAKABLE reason; nothing
    -- here or in the order depends on a private fact.
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
           -- the named overlap and the RANKING overlap are now the SAME
           -- set — a candidate's public tastes ∩ mine. Nothing to hide,
           -- nothing hidden.
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

  -- ---------------- EVENTS (unchanged from 0022) ----------------
  -- my own tastes matched against an event's DECLARED sounds — a public
  -- host declaration (0021), never another person's private fact. Safe.
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
              where hp.id = e.host_id and hp.is_demo = true))         as demo_host
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
$$;

revoke all     on function public.get_for_you(int, text) from public;
grant  execute on function public.get_for_you(int, text) to authenticated;

commit;

-- =====================================================================
-- VERIFY (the oracle attack, now refuted):
--   -- Eve: set one PRIVATE probe taste, zero crafts, bogus city.
--   -- Target holds the same taste PRIVATELY (is_public=false).
--   -- select get_for_you(30, 'zzz') as Eve -> Target does NOT appear
--   --   on private overlap alone. Only a PUBLIC taste/craft/city/follow
--   --   surfaces anyone.
-- =====================================================================
