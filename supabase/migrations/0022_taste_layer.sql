-- =====================================================================
-- 0022 — EL GUSTO INVISIBLE: the taste layer + for-you engine (El Mundo v6, D1+D2).
--        The Collectiv4 platform. Applied via Supabase CLI (db push).
--
-- WHAT / WHY:
--   v6 gives the universe a memory of what each person LOVES — music,
--   film, interests — so discovery can be taste-based, not follower-based.
--   The founding rule (Pato, 13 jul drops): "No necesito mostrar que me
--   gusta Interestelar — pero el sistema conecta lo relacionado."
--   Privacy is ARCHITECTURE here, not UI:
--
--     THE RAW RANKS, ONLY THE PUBLIC SPEAKS.
--
--   * taste_bank      — curated brainstorm dictionary (music/film/interest
--                       + aliases). PUBLIC read, service-role write only.
--                       Free text is still allowed — the bank seeds the
--                       constellation, it never limits it.
--   * profile_tastes  — a person's tastes. PRIVATE BY DEFAULT AT RLS LEVEL:
--                       only the owner can read their raw rows. A per-item
--                       is_public toggle is the ONLY way an item becomes
--                       readable by others (and even then only when the
--                       profile itself is publicly visible — the 0020
--                       honesty predicate). There are NO client write
--                       grants at all: set_profile_tastes() is the single
--                       door (stricter than 0020 — new privacy surface,
--                       thread-style door discipline from 0017).
--   * search_taste_bank() — the brainstorm's feed, grouped by domain
--                       (mirrors search_crafts).
--   * set_profile_tastes() — atomic own-row replace, validated, capped.
--   * get_for_you()   — the discovery engine. SECURITY DEFINER: it may
--                       JOIN over raw tastes to ORDER candidates, but its
--                       payload NEVER carries raw data out: no raw labels,
--                       no overlap counts, no kinship bands, no scores.
--                       Reasons name (a) the other side's PUBLIC tastes,
--                       (b) crafts and event sounds (public by nature),
--                       (c) city. Order is the only trace the private
--                       layer leaves — deliberately the weakest oracle.
--
-- MULTI-CITY: nothing is hardcoded to Houston. The caller's own
--   profiles.city leads (param override available); city match WEIGHTS
--   the ranking, it never gates it — Houston is first because Houston is
--   where the people are, Valencia inherits the same machine.
--
-- HONEST-BY-CODE / SAFETY (mirrors 0017/0019/0020/0021):
--   * Purely ADDITIVE: two new tables, four functions, zero changes to
--     any existing table, column, policy, trigger, price, ticket,
--     lock_verified, or the Stripe path. profiles.taste (0002, the museum
--     embeds) is NOT touched — that is public display content; this layer
--     is the quiet one.
--   * Idempotent: create-if-not-exists tables/indexes, drop-then-create
--     policies, create-or-replace functions, on-conflict seed.
--   * Demo/QA rows can never leak: every public-facing read repeats the
--     profiles_public_read is_demo predicate (0020 pattern), and
--     get_for_you filters is_demo = false on both people and hosts.
-- =====================================================================

begin;

-- =====================================================================
-- 1. TABLES
-- =====================================================================

-- ---------- taste_bank: the curated brainstorm dictionary ----------
create table if not exists public.taste_bank (
  id         uuid primary key default gen_random_uuid(),
  domain     text not null check (domain in ('music','film','interest')),
  label      text not null,
  slug       text not null unique,
  aliases    text[] not null default '{}'::text[],
  position   int  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists taste_bank_domain_position_idx on public.taste_bank (domain, position);

-- ---------- profile_tastes: the quiet layer ----------
-- norm is a STORED generated column over c4_norm(label) (IMMUTABLE, 0020)
-- so matching never depends on client-side folding. is_public defaults
-- FALSE — private is the resting state, visibility is a decision.
create table if not exists public.profile_tastes (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  domain     text not null check (domain in ('music','film','interest')),
  label      text not null check (char_length(btrim(label)) between 1 and 48),
  norm       text not null generated always as (public.c4_norm(label)) stored,
  is_public  boolean not null default false,
  position   int not null default 0,
  created_at timestamptz not null default now(),
  unique (profile_id, domain, norm)
);
create index if not exists profile_tastes_profile_idx on public.profile_tastes (profile_id, position);
create index if not exists profile_tastes_match_idx   on public.profile_tastes (domain, norm);

-- =====================================================================
-- 2. ROW LEVEL SECURITY
-- =====================================================================

-- ---------- taste_bank: PUBLIC read; writes = service role only ----------
alter table public.taste_bank enable row level security;
revoke all    on public.taste_bank from anon, authenticated;
grant  select on public.taste_bank to   anon, authenticated;
drop policy if exists taste_bank_public_read on public.taste_bank;
create policy taste_bank_public_read on public.taste_bank
  for select using (true);

-- ---------- profile_tastes: OWNER reads raw; the world reads only what
-- ---------- was deliberately made public; NOBODY writes directly ----------
-- READ: the owner sees every own row. Anyone else sees a row ONLY when
--   (a) the owner flipped that item public, AND (b) the owner's profile is
--   itself publicly visible (0020 honesty predicate — a demo/QA persona's
--   public tastes stay as invisible as the persona).
--   NOTE the deliberate asymmetry vs profile_crafts: is_owner() /
--   caller_is_verified() only widen the DEMO-visibility branch — they never
--   unlock private rows. Founders cannot read a member's raw tastes
--   through the API. That is the product promise, enforced here.
-- WRITE: no insert/update/delete grants and no write policies at all.
--   set_profile_tastes() (SECURITY DEFINER, uid-pinned) is the only door —
--   the 0017 threads discipline applied to the new privacy surface.
alter table public.profile_tastes enable row level security;
revoke all    on public.profile_tastes from anon, authenticated;
grant  select on public.profile_tastes to   anon, authenticated;

drop policy if exists profile_tastes_read on public.profile_tastes;
create policy profile_tastes_read on public.profile_tastes
  for select using (
    profile_id::text = auth.uid()::text
    or (
      is_public
      and exists (
        select 1 from public.profiles p
        where p.id = profile_tastes.profile_id
          and (
            p.is_demo = false
            or public.is_owner()
            or public.caller_is_verified()
          )
      )
    )
  );

-- =====================================================================
-- 3. search_taste_bank() — the brainstorm's feed, grouped by domain
-- =====================================================================
-- Mirrors search_crafts (0020): NULL/blank query -> whole bank grouped;
-- otherwise case/accent-insensitive strpos over label+aliases, ranked
-- exact > prefix > curated position. p_domain narrows to one domain.
-- NOT security definer — taste_bank is public-read, least privilege.
create or replace function public.search_taste_bank(
  p_query  text default null,
  p_domain text default null
)
returns jsonb
language sql
stable
set search_path = public
as $$
  with needle as (
    select nullif(public.c4_norm(btrim(coalesce(p_query, ''))), '') as n
  ),
  matched as (
    select b.id, b.label, b.slug, b.domain, b.aliases, b.position,
           case
             when (select n from needle) is null then 2
             when public.c4_norm(b.label) = (select n from needle) then 0
             when strpos(public.c4_norm(b.label), (select n from needle)) = 1 then 1
             else 2
           end as rank
    from public.taste_bank b
    where (p_domain is null or b.domain = p_domain)
      and (
        (select n from needle) is null
        or strpos(public.c4_norm(b.label), (select n from needle)) > 0
        or exists (
             select 1 from unnest(b.aliases) a
             where strpos(public.c4_norm(a), (select n from needle)) > 0
           )
      )
  ),
  grouped as (
    select domain,
           array_position(array['music','film','interest']::text[], domain) as dom_ord,
           jsonb_agg(
             jsonb_build_object('id', id, 'label', label, 'slug', slug)
             order by rank, position, label
           ) as items
    from matched
    group by domain
  )
  select coalesce(
           jsonb_agg(
             jsonb_build_object('domain', domain, 'items', items)
             order by dom_ord
           ),
           '[]'::jsonb)
  from grouped;
$$;

revoke all     on function public.search_taste_bank(text, text) from public;
grant  execute on function public.search_taste_bank(text, text) to anon, authenticated;

-- =====================================================================
-- 4. set_profile_tastes() — atomic own-row replace, the only write door
-- =====================================================================
-- Hand it the whole ordered set: [{domain, label, is_public}, ...].
-- SECURITY DEFINER with profile_id PINNED to auth.uid() (forge-proof,
-- mirrors set_profile_crafts). Validates domains and label lengths,
-- de-dupes on (domain, c4_norm(label)) keeping first occurrence, caps at
-- 40 per domain / 90 total. Atomic delete+reinsert — the brainstorm
-- commits as one truth, never a half-written set.
create or replace function public.set_profile_tastes(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  t         jsonb;
  k         text;
  v_domain  text;
  v_label   text;
  v_public  boolean;
  v_norm    text;
  v_seen    text[] := '{}';
  v_dom_cnt jsonb  := '{"music":0,"film":0,"interest":0}'::jsonb;
  v_rows    jsonb  := '[]'::jsonb;
  v_total   int    := 0;
  v_pos     int    := 0;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  -- a brand-new account may not have its profiles row yet (the FK target);
  -- same self-heal start_dm uses (0017)
  perform public.ensure_own_profile();
  if p is null or jsonb_typeof(p) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'tastes must be an array');
  end if;
  if jsonb_array_length(p) > 200 then
    return jsonb_build_object('ok', false, 'error', 'too many items');
  end if;

  for t in select * from jsonb_array_elements(p) loop
    if jsonb_typeof(t) <> 'object' then
      return jsonb_build_object('ok', false, 'error', 'each taste must be an object');
    end if;
    for k in select jsonb_object_keys(t) loop
      if k not in ('domain', 'label', 'is_public') then
        return jsonb_build_object('ok', false, 'error', 'unknown taste key: ' || k);
      end if;
    end loop;
    v_domain := coalesce(t->>'domain', '');
    if v_domain not in ('music', 'film', 'interest') then
      return jsonb_build_object('ok', false, 'error', 'taste domain must be music, film or interest');
    end if;
    v_label := btrim(coalesce(t->>'label', ''));
    if char_length(v_label) < 1 or char_length(v_label) > 48 then
      return jsonb_build_object('ok', false, 'error', 'each taste label must be 1–48 characters');
    end if;
    v_public := coalesce((t->>'is_public')::boolean, false);
    v_norm   := v_domain || ':' || public.c4_norm(v_label);

    -- de-dupe: first occurrence of (domain, norm) wins
    if v_norm = any(v_seen) then
      continue;
    end if;
    -- caps: 40 per domain, 90 total — a brainstorm, not a database dump
    if (v_dom_cnt->>v_domain)::int >= 40 or v_total >= 90 then
      continue;
    end if;

    v_seen    := v_seen || v_norm;
    v_dom_cnt := jsonb_set(v_dom_cnt, array[v_domain],
                           to_jsonb((v_dom_cnt->>v_domain)::int + 1));
    v_total   := v_total + 1;
    v_rows    := v_rows || jsonb_build_object(
                   'domain', v_domain, 'label', v_label,
                   'is_public', v_public, 'position', v_pos);
    v_pos     := v_pos + 1;
  end loop;

  -- replace the caller's whole set atomically
  delete from public.profile_tastes where profile_id = v_uid;

  insert into public.profile_tastes (profile_id, domain, label, is_public, position)
  select v_uid, r->>'domain', r->>'label',
         (r->>'is_public')::boolean, (r->>'position')::int
  from jsonb_array_elements(v_rows) r;

  return jsonb_build_object('ok', true, 'count', v_total);
end;
$$;

revoke all     on function public.set_profile_tastes(jsonb) from public;
grant  execute on function public.set_profile_tastes(jsonb) to authenticated;

-- =====================================================================
-- 5. get_for_you() — the discovery engine (D2)
-- =====================================================================
-- The one function allowed to look at everyone's raw tastes — and the
-- contract is that nothing raw survives into its output:
--   * PEOPLE are ordered by: raw taste overlap ×3 + shared crafts ×2
--     + same city ×2 + follows-you +1 + verified +1 − already-followed ×2
--     (discovery favors NEW faces; people you follow still appear, damped).
--   * The payload carries: profile card fields, their crafts (public),
--     i_follow / follows_me flags (follows are public edges, 0017), and
--     REASONS built ONLY from speakable data: shared crafts by name,
--     shared PUBLIC tastes by label, same city. No counts of raw overlap,
--     no scores, no bands — order is the only trace (weakest oracle:
--     multi-factor, unobservable in isolation).
--   * EVENTS are published, non-test, upcoming-or-dateless; ordered by
--     declared sounds (0021 vibe) matching the caller's music tastes ×3
--     + same city ×2 + hosted by someone you follow (+2) + house (+1).
--     Event sounds are public declarations — naming them is honest.
--   * is_demo is filtered EVERYWHERE (people, hosts). Self excluded.
--   * Empty tastes still work: crafts/city/follows carry the ranking, and
--     an all-zero score returns an empty, honest list (Ley 11 — the UI
--     turns that into the door to the brainstorm).
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
      (select count(*) from public.profile_tastes t
        join my_tastes m on m.domain = t.domain and m.norm = t.norm
        where t.profile_id = p.id)                          as raw_overlap,
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
      (c.raw_overlap * 3
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
    order by score desc, raw_overlap desc, same_city desc, id
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
           -- ONLY the other side's PUBLIC items may be named. Raw stays raw.
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
         ) order by r.score desc, r.raw_overlap desc, r.same_city desc, r.id), '[]'::jsonb)
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

-- =====================================================================
-- 6. SEED — the taste bank (~135 entries, three domains)
-- =====================================================================
-- Scene-credible, ES/EN aliases for the fuzzy brainstorm. Idempotent via
-- on conflict (slug). Free text remains first-class — the bank is the
-- constellation's seed, never its ceiling. Slugs are domain-prefixed so
-- 'anime' the film taste and 'anime & manga' the interest never collide.

insert into public.taste_bank (domain, label, slug, aliases, position) values
-- ---------- music ----------
('music','House','music-house',array['house music','musica house'],1),
('music','Deep House','music-deep-house',array['deep'],2),
('music','Afro House','music-afro-house',array['afrohouse','afro'],3),
('music','Tech House','music-tech-house',array[]::text[],4),
('music','Techno','music-techno',array['tekno'],5),
('music','Melodic Techno','music-melodic-techno',array['melodic'],6),
('music','Minimal','music-minimal',array['minimal techno','micro house'],7),
('music','Disco','music-disco',array['nu disco','nu-disco'],8),
('music','Funk','music-funk',array[]::text[],9),
('music','Soul','music-soul',array['neo soul','neosoul'],10),
('music','R&B','music-rnb',array['rnb','r and b','rhythm and blues'],11),
('music','Jazz','music-jazz',array[]::text[],12),
('music','Latin Jazz','music-latin-jazz',array['jazz latino'],13),
('music','Bossa Nova','music-bossa-nova',array['bossa'],14),
('music','Salsa','music-salsa',array[]::text[],15),
('music','Cumbia','music-cumbia',array[]::text[],16),
('music','Corridos','music-corridos',array['corridos tumbados','regional mexicano'],17),
('music','Reggaeton','music-reggaeton',array['reggaetón','perreo'],18),
('music','Dembow','music-dembow',array[]::text[],19),
('music','Hip-Hop','music-hip-hop',array['hip hop','rap'],20),
('music','Boom Bap','music-boom-bap',array['boombap'],21),
('music','Trap','music-trap',array[]::text[],22),
('music','Drum & Bass','music-drum-and-bass',array['dnb','d&b','jungle'],23),
('music','UK Garage','music-uk-garage',array['garage','ukg','2 step'],24),
('music','Breakbeat','music-breakbeat',array['breaks'],25),
('music','Ambient','music-ambient',array[]::text[],26),
('music','Downtempo','music-downtempo',array['chillout','chill out'],27),
('music','Trip-Hop','music-trip-hop',array['trip hop'],28),
('music','Indie Rock','music-indie-rock',array['indie'],29),
('music','Rock en Español','music-rock-en-espanol',array['rock latino','rock mexicano'],30),
('music','Post-Punk','music-post-punk',array['post punk'],31),
('music','Shoegaze','music-shoegaze',array[]::text[],32),
('music','Dream Pop','music-dream-pop',array[]::text[],33),
('music','Synth Pop','music-synth-pop',array['synthpop','synthwave'],34),
('music','Pop','music-pop',array[]::text[],35),
('music','Gospel','music-gospel',array[]::text[],36),
('music','Classical','music-classical',array['clasica','musica clasica','orchestral'],37),
('music','Film Scores','music-film-scores',array['soundtracks','bandas sonoras','score'],38),
('music','Flamenco','music-flamenco',array[]::text[],39),
('music','Afrobeats','music-afrobeats',array['afrobeat'],40),
('music','Amapiano','music-amapiano',array[]::text[],41),
('music','Dancehall','music-dancehall',array[]::text[],42),
('music','Bachata','music-bachata',array[]::text[],43),
('music','Electronic','music-electronic',array['electronica','electrónica','edm'],44),
-- ---------- film ----------
('film','Sci-Fi','film-sci-fi',array['science fiction','ciencia ficcion'],1),
('film','Interstellar','film-interstellar',array['interestelar'],2),
('film','Christopher Nolan','film-christopher-nolan',array['nolan'],3),
('film','Denis Villeneuve','film-denis-villeneuve',array['villeneuve','dune'],4),
('film','Tarantino','film-tarantino',array['quentin tarantino','pulp fiction'],5),
('film','Wes Anderson','film-wes-anderson',array[]::text[],6),
('film','Scorsese','film-scorsese',array['martin scorsese'],7),
('film','Kubrick','film-kubrick',array['stanley kubrick'],8),
('film','David Lynch','film-david-lynch',array['lynch'],9),
('film','A24','film-a24',array[]::text[],10),
('film','Studio Ghibli','film-studio-ghibli',array['ghibli','miyazaki'],11),
('film','Anime','film-anime',array[]::text[],12),
('film','Almodóvar','film-almodovar',array['pedro almodovar'],13),
('film','Cuarón','film-cuaron',array['alfonso cuaron','roma'],14),
('film','Iñárritu','film-inarritu',array['gonzalez inarritu','birdman'],15),
('film','Guillermo del Toro','film-guillermo-del-toro',array['del toro'],16),
('film','Cine de Oro Mexicano','film-cine-de-oro',array['cine de oro','pedro infante'],17),
('film','Documentaries','film-documentaries',array['documentales','docs'],18),
('film','Music Documentaries','film-music-docs',array['music docs'],19),
('film','Thrillers','film-thrillers',array['suspenso'],20),
('film','Psychological Thrillers','film-psych-thrillers',array['psychological'],21),
('film','Horror','film-horror',array['terror'],22),
('film','Film Noir','film-noir',array['noir'],23),
('film','Westerns','film-westerns',array[]::text[],24),
('film','Coming of Age','film-coming-of-age',array[]::text[],25),
('film','Rom-Coms','film-rom-coms',array['romantic comedy','comedia romantica'],26),
('film','Foreign Film','film-foreign',array['world cinema','cine extranjero'],27),
('film','French New Wave','film-french-new-wave',array['nouvelle vague','godard'],28),
('film','Korean Cinema','film-korean-cinema',array['cine coreano','parasite','oldboy'],29),
('film','Wong Kar-wai','film-wong-kar-wai',array['in the mood for love'],30),
('film','Tarkovsky','film-tarkovsky',array[]::text[],31),
('film','Blade Runner','film-blade-runner',array[]::text[],32),
('film','The Godfather','film-the-godfather',array['el padrino'],33),
('film','Cinema Paradiso','film-cinema-paradiso',array[]::text[],34),
('film','Before Trilogy','film-before-trilogy',array['before sunrise','before sunset'],35),
('film','La Haine','film-la-haine',array[]::text[],36),
('film','City of God','film-city-of-god',array['ciudad de dios','cidade de deus'],37),
-- ---------- interest ----------
('interest','Fucho','interest-fucho',array['futbol','fútbol','soccer','football'],1),
('interest','Basketball','interest-basketball',array['basquet','nba','hoops'],2),
('interest','F1','interest-f1',array['formula 1','formula uno','checo'],3),
('interest','Boxing','interest-boxing',array['box','boxeo'],4),
('interest','Running','interest-running',array['correr','run club'],5),
('interest','Gym','interest-gym',array['lifting','fitness','entrenar'],6),
('interest','Yoga','interest-yoga',array[]::text[],7),
('interest','Cycling','interest-cycling',array['bike','ciclismo'],8),
('interest','Skating','interest-skating',array['skate','skateboarding','patineta'],9),
('interest','Surfing','interest-surfing',array['surf'],10),
('interest','Hiking','interest-hiking',array['senderismo','trails'],11),
('interest','Camping','interest-camping',array['acampar'],12),
('interest','Nature','interest-nature',array['naturaleza','outdoors'],13),
('interest','Roadtrips','interest-roadtrips',array['road trips','carretera'],14),
('interest','Travel','interest-travel',array['viajar','viajes'],15),
('interest','Cooking','interest-cooking',array['cocinar','cocina'],16),
('interest','Coffee','interest-coffee',array['cafe','café','specialty coffee'],17),
('interest','Mezcal','interest-mezcal',array['agave','tequila'],18),
('interest','Natural Wine','interest-natural-wine',array['vino natural','wine'],19),
('interest','Vinyl','interest-vinyl',array['vinilos','records','digging'],20),
('interest','Analog Photography','interest-analog-photo',array['film photography','fotografia analoga','35mm'],21),
('interest','Vintage Cameras','interest-vintage-cameras',array['camaras vintage'],22),
('interest','Fashion','interest-fashion',array['moda'],23),
('interest','Streetwear','interest-streetwear',array[]::text[],24),
('interest','Sneakers','interest-sneakers',array['tenis','kicks'],25),
('interest','Thrifting','interest-thrifting',array['segunda mano','vintage shopping','bazares'],26),
('interest','Tattoos','interest-tattoos',array['tatuajes','ink'],27),
('interest','Architecture','interest-architecture',array['arquitectura'],28),
('interest','Interior Design','interest-interior-design',array['interiores'],29),
('interest','Philosophy','interest-philosophy',array['filosofia','filosofía'],30),
('interest','Stoicism','interest-stoicism',array['estoicismo','marcus aurelius','marco aurelio'],31),
('interest','Faith','interest-faith',array['fe','god','dios','spirituality'],32),
('interest','Meditation','interest-meditation',array['meditacion','mindfulness'],33),
('interest','Journaling','interest-journaling',array['journal','diario'],34),
('interest','Reading','interest-reading',array['leer','books','libros'],35),
('interest','Poetry','interest-poetry',array['poesia','poesía'],36),
('interest','Chess','interest-chess',array['ajedrez'],37),
('interest','Gaming','interest-gaming',array['videojuegos','video games'],38),
('interest','Anime & Manga','interest-anime-manga',array['manga'],39),
('interest','Astronomy','interest-astronomy',array['astronomia','stargazing','estrellas'],40),
('interest','Gardening','interest-gardening',array['plantas','plants','jardineria'],41),
('interest','Dancing','interest-dancing',array['bailar','dance'],42),
('interest','Salsa Dancing','interest-salsa-dancing',array['bailar salsa'],43),
('interest','Languages','interest-languages',array['idiomas'],44),
('interest','History','interest-history',array['historia'],45),
('interest','Psychology','interest-psychology',array['psicologia','psicología','jung'],46),
('interest','Entrepreneurship','interest-entrepreneurship',array['startups','emprender'],47),
('interest','Community Building','interest-community',array['comunidad','community'],48)
on conflict (slug) do update set
  domain   = excluded.domain,
  label    = excluded.label,
  aliases  = excluded.aliases,
  position = excluded.position;

commit;

-- =====================================================================
-- VERIFY (read-only, run after push):
--   select count(*) from taste_bank;                       -- ~129
--   select search_taste_bank('interestelar');              -- finds Interstellar
--   -- as anon / another user: select * from profile_tastes
--   --   where profile_id = '<someone>';                   -- only is_public rows
--   -- as the owner: all rows.
--   -- get_for_you() as anon -> not_authenticated envelope.
-- =====================================================================
