-- =====================================================================
-- 0020 — CRAFTS: the taxonomy of oficios (El Mundo v5 pre-flight).
--        The Collectiv4 platform. Applied via Supabase CLI (db push).
--
-- WHAT / WHY:
--   v5's builder replaces the free-text profiles.discipline with a curated,
--   searchable craft taxonomy — a person is "producer + photographer + DJ",
--   MANY crafts, one primary. This migration lays the MECHANICAL half so the
--   v5 UI session designs pure theatre on top of a working data + search layer.
--
--   * crafts          — the curated dictionary (name/slug/category/aliases).
--                       PUBLIC read, service-role write only (seed/admin).
--   * profile_crafts  — join: a profile's many crafts, one is_primary, ordered.
--                       PUBLIC read (museum/directory show it), SELF write only
--                       (mirrors the profiles_self_* RLS pattern from 0001).
--   * c4_norm()       — dependency-free, IMMUTABLE accent+case fold for search.
--   * search_crafts() — case/accent-insensitive search over name+aliases,
--                       returns jsonb GROUPED by category (the picker's feed).
--   * set_profile_crafts() — atomic own-row replace (forge-proof author = uid).
--
-- HONEST-BY-CODE / SAFETY (mirrors 0001/0019):
--   * profiles.discipline is NOT touched — the two coexist; v5 migrates users
--     in the UI. Zero changes to any existing table, column, policy, price,
--     ticket, lock_verified trigger, or the Stripe path. Purely ADDITIVE.
--   * Idempotent: create-if-not-exists tables/indexes, drop-then-create
--     policies/functions, and an on-conflict seed. Safe to re-run.
-- =====================================================================

begin;

-- =====================================================================
-- 1. TABLES
-- =====================================================================

-- ---------- crafts: the curated dictionary ----------
create table if not exists public.crafts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  category   text not null,
  -- generous synonyms for the searcher: 'video editor' → Videographer, ES/EN
  -- variants, common phrasings. text[] (not a table) so a craft's synonyms
  -- grow without a migration. Never user-facing on their own.
  aliases    text[] not null default '{}'::text[],
  position   int  not null default 0,          -- curated order within a category
  created_at timestamptz not null default now()
);
create index if not exists crafts_category_position_idx on public.crafts (category, position);

-- ---------- profile_crafts: a person's many crafts ----------
-- Composite PK (profile_id, craft_id) => a craft can appear at most once per
-- person. is_primary marks the headline craft; position orders the rest.
create table if not exists public.profile_crafts (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  craft_id   uuid not null references public.crafts(id)   on delete cascade,
  is_primary boolean not null default false,
  position   int  not null default 0,
  created_at timestamptz not null default now(),
  primary key (profile_id, craft_id)
);
create index if not exists profile_crafts_profile_idx on public.profile_crafts (profile_id, position);
create index if not exists profile_crafts_craft_idx   on public.profile_crafts (craft_id);

-- =====================================================================
-- 2. ROW LEVEL SECURITY
-- =====================================================================

-- ---------- crafts: PUBLIC read; writes = service role only ----------
-- No write policy => anon/authenticated cannot insert/update/delete under RLS
-- (seeding + admin run as the service role / SQL editor, which bypass RLS).
alter table public.crafts enable row level security;
revoke all    on public.crafts from anon, authenticated;
grant  select on public.crafts to   anon, authenticated;
drop policy if exists crafts_public_read on public.crafts;
create policy crafts_public_read on public.crafts
  for select using (true);

-- ---------- profile_crafts: PUBLIC read (honesty-gated), SELF write ----------
-- WRITE: a client may only write rows for its OWN profile_id (= auth.uid()),
-- mirroring profiles_self_* (0001). The ::text cast is the repo's
-- type-agnostic uid-compare idiom.
-- READ: NOT a blanket using(true). This is a NEW public surface, so per the
-- honest-by-code gate (CLAUDE.md §4, and 0008 narrowing profiles_public_read),
-- it must not leak associations of HIDDEN demo personas. A demo profile's
-- crafts must stay invisible to anon exactly as the demo profile itself is.
-- We gate read on the target profile being publicly visible, reusing the SAME
-- predicate + helpers (is_owner / caller_is_verified) 0008 put on profiles —
-- so the two gates cannot drift. A demo persona seeded with crafts leaks
-- nothing: /rest/v1/profile_crafts returns no rows for a profile anon can't see.
alter table public.profile_crafts enable row level security;
revoke all    on public.profile_crafts from anon, authenticated;
grant  select on public.profile_crafts to   anon, authenticated;
grant  insert, update, delete on public.profile_crafts to authenticated;

drop policy if exists profile_crafts_public_read on public.profile_crafts;
drop policy if exists profile_crafts_self_insert on public.profile_crafts;
drop policy if exists profile_crafts_self_update on public.profile_crafts;
drop policy if exists profile_crafts_self_delete on public.profile_crafts;

create policy profile_crafts_public_read on public.profile_crafts
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_crafts.profile_id
        and (
          p.is_demo = false
          or p.id::text = auth.uid()::text
          or public.is_owner()
          or public.caller_is_verified()
        )
    )
  );
create policy profile_crafts_self_insert on public.profile_crafts
  for insert with check (auth.uid()::text = profile_id::text);
create policy profile_crafts_self_update on public.profile_crafts
  for update using (auth.uid()::text = profile_id::text)
             with check (auth.uid()::text = profile_id::text);
create policy profile_crafts_self_delete on public.profile_crafts
  for delete using (auth.uid()::text = profile_id::text);

-- =====================================================================
-- 3. c4_norm() — accent + case fold for search (dependency-free, IMMUTABLE)
-- =====================================================================
-- Folds Latin accents to ASCII and lowercases, so "Diseñador" matches
-- "disenador" and "Café" matches "cafe". translate()+lower() are both
-- IMMUTABLE, so this is deterministic and index-safe (v5 can add a functional
-- index later if the table ever grows). Chosen over the unaccent extension to
-- avoid a superuser dependency and the search_path footguns of unaccent()
-- inside SECURITY DEFINER functions. The from/to strings are the same length.
create or replace function public.c4_norm(p text)
returns text
language sql
immutable
strict
as $$
  select lower(translate(
    p,
    'ÁÀÂÄÃÅáàâäãåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÖÕóòôöõÚÙÛÜúùûüÑñÇçÝýŸÿ',
    'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuNnCcYyYy'
  ));
$$;

-- =====================================================================
-- 4. search_crafts() — the picker's feed, grouped by category
-- =====================================================================
-- p_query NULL/blank  -> the WHOLE taxonomy, grouped (initial picker state).
-- p_query given       -> crafts whose name OR any alias contains the (folded)
--                        needle, case/accent-insensitive. strpos() (not LIKE)
--                        so a stray %/_ in the query is a literal, never a
--                        wildcard. Ordered: exact name, then prefix, then the
--                        curated position — the natural picker ranking.
-- Returns jsonb:
--   [ { "category": "Music & Audio",
--       "crafts": [ { "id","name","slug","aliases" }, ... ] }, ... ]
-- NOT security definer: crafts is public-read (RLS using(true)), so least
-- privilege — the function runs as the caller and RLS still applies.
create or replace function public.search_crafts(p_query text default null)
returns jsonb
language sql
stable
set search_path = public
as $$
  with needle as (
    select nullif(public.c4_norm(btrim(coalesce(p_query, ''))), '') as n
  ),
  matched as (
    select c.id, c.name, c.slug, c.category, c.aliases, c.position,
           case
             when (select n from needle) is null then 2
             when public.c4_norm(c.name) = (select n from needle) then 0
             when strpos(public.c4_norm(c.name), (select n from needle)) = 1 then 1
             else 2
           end as rank
    from public.crafts c
    where (select n from needle) is null
       or strpos(public.c4_norm(c.name), (select n from needle)) > 0
       or exists (
            select 1 from unnest(c.aliases) a
            where strpos(public.c4_norm(a), (select n from needle)) > 0
          )
  ),
  grouped as (
    select category,
           array_position(
             array[
               'Music & Audio','Visual Arts','Design','Fashion','Photo & Video',
               'Events & Production','Content & Media','Written',
               'Movement & Performance','Culinary','Tech Creative','Business Creative'
             ]::text[],
             category
           ) as cat_ord,
           jsonb_agg(
             jsonb_build_object('id', id, 'name', name, 'slug', slug, 'aliases', aliases)
             order by rank, position, name
           ) as crafts
    from matched
    group by category
  )
  select coalesce(
           jsonb_agg(
             jsonb_build_object('category', category, 'crafts', crafts)
             order by cat_ord nulls last, category
           ),
           '[]'::jsonb)
  from grouped;
$$;

revoke all     on function public.search_crafts(text) from public;
grant  execute on function public.search_crafts(text) to anon, authenticated;

-- =====================================================================
-- 5. set_profile_crafts() — atomic own-row replace
-- =====================================================================
-- The v5 editor's write path: hand it the ordered craft ids + which is primary,
-- and it replaces the caller's whole set in one transaction. SECURITY DEFINER
-- so the write is single-authority, but profile_id is PINNED to auth.uid() —
-- a caller can only ever touch their OWN crafts (forge-proof, mirrors
-- submit_drop in 0019). Invalid/duplicate ids are dropped; capped at 12; if no
-- valid primary is named, the first craft is promoted. Guarantees ONE primary.
create or replace function public.set_profile_crafts(
  p_craft_ids  uuid[],
  p_primary_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ids uuid[];
  v_cnt int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  -- de-dupe (keep first occurrence), keep only ids that really exist, preserve order
  select array_agg(cid order by ord)
    into v_ids
  from (
    select cid, min(ord) as ord
    from unnest(coalesce(p_craft_ids, '{}'::uuid[])) with ordinality as u(cid, ord)
    where exists (select 1 from public.crafts c where c.id = u.cid)
    group by cid
  ) d;

  v_ids := coalesce(v_ids, '{}'::uuid[]);
  if array_length(v_ids, 1) > 12 then          -- a person is many crafts, not fifty
    v_ids := v_ids[1:12];
  end if;

  -- replace the caller's whole set atomically
  delete from public.profile_crafts where profile_id = v_uid;

  insert into public.profile_crafts (profile_id, craft_id, is_primary, position)
  select v_uid,
         cid,
         (p_primary_id is not null and cid = p_primary_id),
         (ord - 1)::int
  from unnest(v_ids) with ordinality as u(cid, ord);

  -- no valid primary named but the person has crafts -> promote the first
  if array_length(v_ids, 1) >= 1
     and not exists (
       select 1 from public.profile_crafts
       where profile_id = v_uid and is_primary
     )
  then
    update public.profile_crafts
       set is_primary = (craft_id = v_ids[1])
     where profile_id = v_uid;
  end if;

  select count(*) into v_cnt from public.profile_crafts where profile_id = v_uid;
  return jsonb_build_object('ok', true, 'count', v_cnt);
end;
$$;

revoke all     on function public.set_profile_crafts(uuid[], uuid) from public;
grant  execute on function public.set_profile_crafts(uuid[], uuid) to authenticated;

-- =====================================================================
-- 6. SEED — the curated craft dictionary (~141 crafts, 12 categories)
-- =====================================================================
-- Scene-credible names, generous aliases for the fuzzy picker (ES/EN variants,
-- role phrasings, common near-synonyms). Idempotent via on conflict (slug):
-- re-running refreshes name/category/aliases/position in place. This runs in
-- the SAME transaction as the schema above (begin at top of file / commit
-- after the seed) — schema + seed land together or not at all, never a
-- committed-but-empty crafts table. No is_demo concept here — crafts are real
-- taxonomy, always public.

insert into public.crafts (name, slug, category, aliases, position) values
-- ---------- Music & Audio ----------
('DJ','dj','Music & Audio',array['selector','disc jockey','turntablist','deejay','dj set'],1),
('Music Producer','music-producer','Music & Audio',array['producer','productor','record producer','beat producer'],2),
('Beatmaker','beatmaker','Music & Audio',array['beat maker','trap producer','lofi producer','type beat'],3),
('Singer','singer','Music & Audio',array['vocalist','cantante','vocals','singer songwriter'],4),
('Songwriter','songwriter','Music & Audio',array['topliner','top liner','lyricist','compositor','songwriting'],5),
('Rapper','rapper','Music & Audio',array['mc','emcee','hip hop artist','rapero'],6),
('Guitarist','guitarist','Music & Audio',array['guitar player','guitarrista','guitar'],7),
('Pianist','pianist','Music & Audio',array['keyboardist','keys','pianista','piano'],8),
('Drummer','drummer','Music & Audio',array['percussionist','baterista','drums'],9),
('Bassist','bassist','Music & Audio',array['bass player','bajista','bass'],10),
('Audio Engineer','audio-engineer','Music & Audio',array['mixing engineer','mastering engineer','sound engineer','mix engineer','ingeniero de audio'],11),
('Sound Designer','sound-designer','Music & Audio',array['sound design','sfx','foley artist'],12),
('Composer','composer','Music & Audio',array['film composer','score composer','compositor','scoring'],13),
-- ---------- Visual Arts ----------
('Painter','painter','Visual Arts',array['fine artist','pintor','painting'],1),
('Illustrator','illustrator','Visual Arts',array['illustration','ilustrador','digital illustrator'],2),
('Muralist','muralist','Visual Arts',array['mural artist','street muralist','muralista'],3),
('Graffiti Artist','graffiti-artist','Visual Arts',array['street artist','graffiti','writer','spray artist'],4),
('Sculptor','sculptor','Visual Arts',array['sculpture','escultor','3d artist'],5),
('Tattoo Artist','tattoo-artist','Visual Arts',array['tattooer','tatuador','ink artist'],6),
('Digital Artist','digital-artist','Visual Arts',array['concept artist','digital painter','procreate artist'],7),
('Collage Artist','collage-artist','Visual Arts',array['collagist','mixed media artist'],8),
('Printmaker','printmaker','Visual Arts',array['screen printer','screenprinter','lino artist','risograph'],9),
('Ceramicist','ceramicist','Visual Arts',array['ceramic artist','potter','ceramista','pottery'],10),
('Mixed Media Artist','mixed-media-artist','Visual Arts',array['multimedia artist','installation artist'],11),
('Comic Artist','comic-artist','Visual Arts',array['comic illustrator','manga artist','cartoonist'],12),
-- ---------- Design ----------
('Graphic Designer','graphic-designer','Design',array['graphic design','disenador grafico','visual designer'],1),
('Brand Designer','brand-designer','Design',array['brand identity','branding','identity designer'],2),
('UI/UX Designer','ui-ux-designer','Design',array['ui designer','ux designer','product designer','ux ui'],3),
('Product Designer','product-designer','Design',array['digital product designer','app designer'],4),
('Type Designer','type-designer','Design',array['typographer','typeface designer','lettering artist'],5),
('Motion Designer','motion-designer','Design',array['motion graphics','mograph','after effects','animator'],6),
('3D Designer','3d-designer','Design',array['3d artist','blender artist','cgi artist','3d modeler'],7),
('Web Designer','web-designer','Design',array['website designer','webflow designer'],8),
('Art Director','art-director','Design',array['creative art director','director de arte'],9),
('Print Designer','print-designer','Design',array['editorial designer','layout designer','print layout'],10),
('Packaging Designer','packaging-designer','Design',array['package design','packaging'],11),
('Set Designer','set-designer','Design',array['scenic designer','production designer','stage designer'],12),
('Interior Designer','interior-designer','Design',array['interiorista','spatial designer'],13),
-- ---------- Fashion ----------
('Fashion Designer','fashion-designer','Fashion',array['clothing designer','apparel designer','disenador de moda'],1),
('Stylist','stylist','Fashion',array['fashion stylist','wardrobe stylist','estilista'],2),
('Textile Designer','textile-designer','Fashion',array['textile artist','fabric designer','surface designer'],3),
('Pattern Maker','pattern-maker','Fashion',array['patternmaker','patronista','patternmaking'],4),
('Tailor','tailor','Fashion',array['seamstress','sastre','costurera','sewing'],5),
('Milliner','milliner','Fashion',array['hat maker','hatmaker','sombrerero'],6),
('Jewelry Designer','jewelry-designer','Fashion',array['jeweler','jewellery designer','joyero','jewelry maker'],7),
('Shoe Designer','shoe-designer','Fashion',array['footwear designer','cobbler'],8),
('Costume Designer','costume-designer','Fashion',array['wardrobe designer','vestuario'],9),
('Fashion Illustrator','fashion-illustrator','Fashion',array['fashion sketch artist','croquis artist'],10),
('Knitwear Designer','knitwear-designer','Fashion',array['knitwear','crochet designer','knitter'],11),
('Sneaker Customizer','sneaker-customizer','Fashion',array['sneaker artist','custom sneakers','shoe customizer'],12),
-- ---------- Photo & Video ----------
('Photographer','photographer','Photo & Video',array['photo','fotografo','shooter'],1),
('Portrait Photographer','portrait-photographer','Photo & Video',array['portrait shooter','headshot photographer'],2),
('Fashion Photographer','fashion-photographer','Photo & Video',array['editorial photographer','lookbook photographer'],3),
('Event Photographer','event-photographer','Photo & Video',array['party photographer','concert photographer','nightlife photographer'],4),
('Videographer','videographer','Photo & Video',array['video editor','videomaker','camera op','video'],5),
('Cinematographer','cinematographer','Photo & Video',array['dp','director of photography','camera operator','dop'],6),
('Film Director','film-director','Photo & Video',array['director','movie director','music video director'],7),
('Video Editor','video-editor','Photo & Video',array['editor','post production','premiere editor','final cut editor'],8),
('Colorist','colorist','Photo & Video',array['color grader','color grading','di colorist'],9),
('Photo Retoucher','photo-retoucher','Photo & Video',array['retoucher','photo editor','photoshop retoucher'],10),
('Drone Operator','drone-operator','Photo & Video',array['fpv pilot','aerial videographer','drone pilot'],11),
('Animator','animator','Photo & Video',array['2d animator','3d animator','motion animator'],12),
('VFX Artist','vfx-artist','Photo & Video',array['visual effects','vfx compositor','compositor'],13),
-- ---------- Events & Production ----------
('Event Producer','event-producer','Events & Production',array['event organizer','productor de eventos','event production'],1),
('Creative Director','creative-director','Events & Production',array['creative lead','director creativo','cd'],2),
('Production Manager','production-manager','Events & Production',array['line producer','production coordinator','prod manager'],3),
('Stage Manager','stage-manager','Events & Production',array['show caller','stage crew lead'],4),
('Lighting Designer','lighting-designer','Events & Production',array['ld','lighting tech','lighting operator','luminotecnia'],5),
('VJ','vj','Events & Production',array['visual jockey','live visuals','projection artist'],6),
('Sound Technician','sound-technician','Events & Production',array['live sound engineer','foh engineer','audio tech','sonidista'],7),
('Event Curator','event-curator','Events & Production',array['program curator','lineup curator','curador'],8),
('Talent Booker','talent-booker','Events & Production',array['booker','booking agent','talent buyer'],9),
('Stage Builder','stage-builder','Events & Production',array['scenic builder','set builder','fabricator'],10),
('Promoter','promoter','Events & Production',array['event promoter','nightlife promoter','promotor'],11),
('Host / MC','host-mc','Events & Production',array['emcee','event host','master of ceremonies','presentador'],12),
-- ---------- Content & Media ----------
('Content Creator','content-creator','Content & Media',array['creator','influencer','content','creador de contenido'],1),
('Social Media Manager','social-media-manager','Content & Media',array['social manager','smm','social media','community manager'],2),
('Copywriter','copywriter','Content & Media',array['copy','ad copywriter','redactor'],3),
('Podcaster','podcaster','Content & Media',array['podcast host','podcasting','podcast producer'],4),
('Streamer','streamer','Content & Media',array['live streamer','twitch streamer','gamer'],5),
('YouTuber','youtuber','Content & Media',array['youtube creator','video creator','vlogger'],6),
('UGC Creator','ugc-creator','Content & Media',array['ugc','user generated content','brand creator'],7),
('Community Manager','community-manager','Content & Media',array['community lead','community builder','cm'],8),
('Meme Artist','meme-artist','Content & Media',array['meme creator','meme page','shitposter'],9),
('Podcast Editor','podcast-editor','Content & Media',array['audio editor','podcast post'],10),
('Growth Marketer','growth-marketer','Content & Media',array['growth hacker','performance marketer','digital marketer','marketing'],11),
('Brand Strategist','brand-strategist','Content & Media',array['brand consultant','estratega de marca','marketing strategist'],12),
-- ---------- Written ----------
('Writer','writer','Written',array['author','escritor','freelance writer'],1),
('Journalist','journalist','Written',array['reporter','periodista','news writer'],2),
('Poet','poet','Written',array['spoken word artist','poeta','poetry'],3),
('Copy Editor','copy-editor','Written',array['proofreader','line editor','editor','editorial'],4),
('Screenwriter','screenwriter','Written',array['scriptwriter','guionista','script writer'],5),
('Blogger','blogger','Written',array['blog writer','substack writer','newsletter writer'],6),
('Playwright','playwright','Written',array['dramatist','dramaturgo'],7),
('Ghostwriter','ghostwriter','Written',array['ghost writer','book writer'],8),
('Critic','critic','Written',array['music critic','art critic','reviewer','critico'],9),
('Zine Maker','zine-maker','Written',array['zinester','self publisher','zine'],10),
('Content Writer','content-writer','Written',array['seo writer','article writer','blog writer'],11),
-- ---------- Movement & Performance ----------
('Dancer','dancer','Movement & Performance',array['bailarin','performer','dance'],1),
('Choreographer','choreographer','Movement & Performance',array['choreo','coreografo','dance director'],2),
('Actor','actor','Movement & Performance',array['actress','performer','actriz'],3),
('Performance Artist','performance-artist','Movement & Performance',array['live performer','conceptual performer'],4),
('Model','model','Movement & Performance',array['fashion model','runway model','modelo'],5),
('Theater Director','theater-director','Movement & Performance',array['theatre director','stage director','director teatral'],6),
('Circus Artist','circus-artist','Movement & Performance',array['aerialist','acrobat','circo'],7),
('Drag Performer','drag-performer','Movement & Performance',array['drag artist','drag queen','drag king'],8),
('Ballet Dancer','ballet-dancer','Movement & Performance',array['ballerina','classical dancer'],9),
('Street Dancer','street-dancer','Movement & Performance',array['breakdancer','bboy','bgirl','hip hop dancer'],10),
('Voice Actor','voice-actor','Movement & Performance',array['voiceover artist','vo artist','voice over','doblaje'],11),
-- ---------- Culinary ----------
('Chef','chef','Culinary',array['cook','private chef','cocinero','head chef'],1),
('Pastry Chef','pastry-chef','Culinary',array['baker','pastelero','patissier','dessert chef'],2),
('Baker','baker','Culinary',array['bread baker','panadero','artisan baker'],3),
('Mixologist','mixologist','Culinary',array['bartender','cocktail maker','barman','coctelero'],4),
('Barista','barista','Culinary',array['coffee maker','coffee artist','cafetero'],5),
('Food Stylist','food-stylist','Culinary',array['culinary stylist','food styling'],6),
('Caterer','caterer','Culinary',array['catering','event caterer','banquetero'],7),
('Sommelier','sommelier','Culinary',array['wine expert','wine steward','somelier'],8),
('Chocolatier','chocolatier','Culinary',array['chocolate maker','chocolatero'],9),
('Charcutier','charcutier','Culinary',array['charcuterie maker','butcher'],10),
-- ---------- Tech Creative ----------
('Creative Developer','creative-developer','Tech Creative',array['creative coder','frontend developer','web developer','dev'],1),
('Frontend Engineer','frontend-engineer','Tech Creative',array['front end developer','ui engineer','react developer'],2),
('Full-Stack Developer','fullstack-developer','Tech Creative',array['full stack engineer','software developer','programmer','programador'],3),
('Game Developer','game-developer','Tech Creative',array['game dev','indie dev','unity developer'],4),
('AI Artist','ai-artist','Tech Creative',array['generative artist','ai creative','prompt artist','midjourney artist'],5),
('Creative Technologist','creative-technologist','Tech Creative',array['xr developer','interactive developer','installation technologist'],6),
('3D Modeler','3d-modeler','Tech Creative',array['3d modeller','cgi modeler','blender modeler'],7),
('AR/VR Designer','ar-vr-designer','Tech Creative',array['xr designer','immersive designer','vr developer'],8),
('Data Visualizer','data-visualizer','Tech Creative',array['data viz','dataviz designer','information designer'],9),
('Generative Designer','generative-designer','Tech Creative',array['generative artist','creative coder','processing artist'],10),
('No-Code Builder','no-code-builder','Tech Creative',array['no code developer','webflow developer','bubble developer'],11),
-- ---------- Business Creative ----------
('Founder','founder','Business Creative',array['co-founder','entrepreneur','startup founder','emprendedor'],1),
('Marketer','marketer','Business Creative',array['marketing manager','digital marketer','mercadologo'],2),
('Project Manager','project-manager','Business Creative',array['producer','pm','program manager','coordinador'],3),
('Artist Manager','artist-manager','Business Creative',array['talent manager','band manager','representante'],4),
('Publicist','publicist','Business Creative',array['pr manager','public relations','press'],5),
('A&R','a-and-r','Business Creative',array['artist and repertoire','a and r','talent scout'],6),
('Consultant','consultant','Business Creative',array['creative consultant','strategy consultant','asesor'],7),
('Curator','curator','Business Creative',array['art curator','gallery curator','exhibition curator','curador'],8),
('Gallerist','gallerist','Business Creative',array['gallery owner','art dealer','galerista'],9),
('Business Development','business-development','Business Creative',array['biz dev','sales lead','partnerships'],10),
('Operations Lead','operations-lead','Business Creative',array['ops manager','operations manager','coo'],11)
on conflict (slug) do update set
  name     = excluded.name,
  category = excluded.category,
  aliases  = excluded.aliases,
  position = excluded.position;

commit;
