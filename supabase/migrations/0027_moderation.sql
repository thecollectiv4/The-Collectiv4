-- =====================================================================
-- 0027 — LA LIMPIEZA (D2): moderation surface + purge-honesty.
--        El Mundo v7. Applied via Supabase CLI (db push).
--
-- THE AMENDMENT (15 jul): NOTHING auto-purges — ever. The /os surface only
-- SHOWS raw evidence; the founder decides account by account. Cohort-zero
-- (the real team) is `protected` and un-purgeable. Purge = REVERSIBLE soft
-- delete (`deleted_at`), never a destructive row delete. A purged account
-- then leaves every public surface AND every aggregate — honest by code,
-- not by memory.
--
-- Additive only: two nullable columns, one guard trigger (separate from the
-- verified guard — that one is untouched), four owner-gated SECURITY DEFINER
-- RPCs, and a `deleted_at is null` predicate appended to every existing
-- profile-read policy + the get_for_you / my_circle aggregates that bypass
-- RLS. Touches no price, no ticket, no Stripe file.
--
-- Design mirrors 0008/0014: is_owner() gate first; a txn-local GUC hatch
-- (app.grant_lifecycle) opened only inside the admin_* RPCs after the gate;
-- os_activity audit line in the same transaction (ACTION INTEGRITY).
-- =====================================================================

begin;

-- ---------- (1) lifecycle columns ----------
alter table public.profiles
  add column if not exists deleted_at timestamptz,                    -- null = live; set = soft-purged (reversible 30d)
  add column if not exists protected  boolean not null default false; -- whitelist / cohort-zero → never purgeable

create index if not exists profiles_deleted_at_idx
  on public.profiles (deleted_at) where deleted_at is not null;

-- ---------- (2) column guard: members can't self-purge / self-protect ----------
-- profiles_self_update (0001) lets a member write their own row with NO column
-- guard, so without this a member could PATCH deleted_at=null (un-purge) or
-- protected=true. deleted_at/protected are lifecycle state only the founder
-- may set — pin them for anon/authenticated exactly like lock_verified pins
-- `verified`. Owner writes open a txn-local hatch (app.grant_lifecycle), set
-- ONLY inside the admin_* RPCs after is_owner() passed. Separate trigger,
-- separate GUC — the 0008 verified guard is not modified.
create or replace function public.lock_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.grant_lifecycle', true) = '1' then
    return new;                              -- owner hatch (admin_* RPCs only)
  end if;
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.deleted_at := null;                -- a new world is always live…
      new.protected  := false;               -- …and never self-protected
    else
      if new.deleted_at is distinct from old.deleted_at then
        new.deleted_at := old.deleted_at;    -- clients never CHANGE purge state
      end if;
      if new.protected is distinct from old.protected then
        new.protected := old.protected;      -- clients never CHANGE protection
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lock_lifecycle on public.profiles;
create trigger trg_lock_lifecycle
  before insert or update on public.profiles
  for each row execute function public.lock_lifecycle();

-- ---------- (3) owner RPCs — the surface only SHOWS; the founder decides ----------

-- (a) evidence list: every registered account (auth.users ⟕ profiles) with RAW
--     evidence + moderation state. No score, no "bot" verdict — the founder
--     judges with the data in front of him. The UI derives SUSPICIOUS vs
--     INCOMPLETE from these fields; the server renders no opinion.
create or replace function public.admin_list_accounts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;
  return jsonb_build_object('ok', true, 'accounts', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id',           u.id,
             'email',        u.email,
             'registered',   u.created_at,
             'last_sign_in', u.last_sign_in_at,
             'has_profile',  (p.id is not null),
             'full_name',    p.full_name,
             'username',     p.username,
             'city',         p.city,
             'discipline',   p.discipline,
             'avatar_url',   p.avatar_url,
             'has_avatar',   (coalesce(p.avatar_url, '') <> ''),
             'bio_len',      coalesce(length(p.bio), 0),
             'verified',     coalesce(p.verified, false),
             'is_demo',      coalesce(p.is_demo, false),
             'protected',    coalesce(p.protected, false),
             'deleted_at',   p.deleted_at,
             -- raw evidence (activity counts; all profile-linked):
             'posts',        (select count(*) from public.world_posts   w  where w.profile_id  = p.id),
             'crafts',       (select count(*) from public.profile_crafts pc where pc.profile_id = p.id),
             'tastes',       (select count(*) from public.profile_tastes pt where pt.profile_id = p.id),
             'follows_in',   (select count(*) from public.follows f where f.followee_id = p.id),
             'follows_out',  (select count(*) from public.follows f where f.follower_id = p.id),
             'listings',     (select count(*) from public.listings l where l.profile_id = p.id),
             'tickets',      (select count(*) from public.tickets  t where t.buyer_id   = u.id::text)
           ) order by u.created_at desc)
      from auth.users u
      left join public.profiles p on p.id = u.id
     where u.deleted_at is null
  ), '[]'::jsonb));
end;
$$;

-- (b) whitelist toggle — cohort-zero is marked once and drops off the list.
create or replace function public.admin_set_protected(p_user uuid, p_protected boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name  text;
  v_new   boolean;
  v_actor uuid;
begin
  if not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;
  select coalesce(nullif(trim(full_name), ''), username, 'account') into v_name
    from public.profiles where id = p_user;

  perform set_config('app.grant_lifecycle', '1', true);
  update public.profiles set protected = p_protected where id = p_user
    returning protected into v_new;
  perform set_config('app.grant_lifecycle', '0', true);

  if v_new is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');   -- profile-less → nothing to protect
  end if;

  select auth.uid() into v_actor;
  if v_actor is not null and exists (select 1 from public.profiles where id = v_actor) then
    insert into public.os_activity (profile_id, action)
    values (v_actor, (case when p_protected then 'protected ' else 'unprotected ' end) || coalesce(v_name, 'account'));
  end if;
  return jsonb_build_object('ok', true, 'id', p_user, 'protected', v_new);
end;
$$;

-- (c) soft-purge — reversible; refuses a protected account; a dedo-slip can't
--     cost a real member (restore below). Nothing is auto-finalized here.
create or replace function public.admin_soft_purge(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_protected boolean;
  v_name      text;
  v_deleted   timestamptz;
  v_actor     uuid;
begin
  if not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;
  select protected, coalesce(nullif(trim(full_name), ''), username, 'account')
    into v_protected, v_name
    from public.profiles where id = p_user;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');   -- profile-less → nothing to soft-delete
  end if;
  if v_protected then
    return jsonb_build_object('ok', false, 'error', 'protected');   -- whitelist wins; never purge cohort-zero
  end if;

  perform set_config('app.grant_lifecycle', '1', true);
  update public.profiles set deleted_at = coalesce(deleted_at, now()) where id = p_user
    returning deleted_at into v_deleted;
  perform set_config('app.grant_lifecycle', '0', true);

  select auth.uid() into v_actor;
  if v_actor is not null and exists (select 1 from public.profiles where id = v_actor) then
    insert into public.os_activity (profile_id, action)
    values (v_actor, 'purged (soft) ' || coalesce(v_name, 'account'));
  end if;
  return jsonb_build_object('ok', true, 'id', p_user, 'deleted_at', v_deleted);
end;
$$;

-- (d) restore — undo. Always allowed while the row still exists (nothing
--     auto-finalizes in this design; the 30-day window is a UI/manual rule).
create or replace function public.admin_restore(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name  text;
  v_id    uuid;
  v_actor uuid;
begin
  if not public.is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;
  select coalesce(nullif(trim(full_name), ''), username, 'account') into v_name
    from public.profiles where id = p_user;

  perform set_config('app.grant_lifecycle', '1', true);
  update public.profiles set deleted_at = null where id = p_user
    returning id into v_id;
  perform set_config('app.grant_lifecycle', '0', true);

  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select auth.uid() into v_actor;
  if v_actor is not null and exists (select 1 from public.profiles where id = v_actor) then
    insert into public.os_activity (profile_id, action)
    values (v_actor, 'restored ' || coalesce(v_name, 'account'));
  end if;
  return jsonb_build_object('ok', true, 'id', p_user);
end;
$$;

-- grants: authenticated only; every function self-gates on is_owner().
revoke all on function public.admin_list_accounts()               from public;
revoke all on function public.admin_set_protected(uuid, boolean)  from public;
revoke all on function public.admin_soft_purge(uuid)              from public;
revoke all on function public.admin_restore(uuid)                 from public;
grant execute on function public.admin_list_accounts()              to authenticated;
grant execute on function public.admin_set_protected(uuid, boolean) to authenticated;
grant execute on function public.admin_soft_purge(uuid)             to authenticated;
grant execute on function public.admin_restore(uuid)                to authenticated;

-- =====================================================================
-- (4) PURGE-HONESTY: append `deleted_at is null` to every profile-read
--     surface. A purged world vanishes for everyone EXCEPT its own account
--     (which still sees its suspended row — no lazy-insert landmine) and the
--     founder (who reaches it only through the admin_* RPCs above).
-- =====================================================================

-- (S1) profiles_public_read — THE linchpin. Restructured: self always; else
--      live + (real | owner | verified). Purged → hidden from all public/anon.
drop policy if exists profiles_public_read on public.profiles;
create policy profiles_public_read on public.profiles
  for select
  using (
    id::text = auth.uid()::text
    or (
      deleted_at is null
      and (
        is_demo = false
        or public.is_owner()
        or public.caller_is_verified()
      )
    )
  );

-- (S4) world_posts_public_read
drop policy if exists world_posts_public_read on public.world_posts;
create policy world_posts_public_read on public.world_posts
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = world_posts.profile_id
        and (
          p.id::text = auth.uid()::text
          or (p.deleted_at is null
              and (p.is_demo = false or public.is_owner() or public.caller_is_verified()))
        )
    )
  );

-- (S2) profile_crafts_public_read
drop policy if exists profile_crafts_public_read on public.profile_crafts;
create policy profile_crafts_public_read on public.profile_crafts
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_crafts.profile_id
        and (
          p.id::text = auth.uid()::text
          or (p.deleted_at is null
              and (p.is_demo = false or public.is_owner() or public.caller_is_verified()))
        )
    )
  );

-- (S3) profile_tastes_read — self all; else public row on a live, visible world
drop policy if exists profile_tastes_read on public.profile_tastes;
create policy profile_tastes_read on public.profile_tastes
  for select using (
    profile_id::text = auth.uid()::text
    or (
      is_public
      and exists (
        select 1 from public.profiles p
        where p.id = profile_tastes.profile_id
          and p.deleted_at is null
          and (
            p.is_demo = false
            or public.is_owner()
            or public.caller_is_verified()
          )
      )
    )
  );

-- (S5) follows_read — the both-public branch must exclude purged either side
drop policy if exists follows_read on public.follows;
create policy follows_read on public.follows
  for select
  using (
    follower_id::text = auth.uid()::text
    or followee_id::text = auth.uid()::text
    or public.is_owner()
    or public.caller_is_verified()
    or (
      exists (select 1 from public.profiles p
              where p.id = follows.follower_id and p.is_demo = false and p.deleted_at is null)
      and exists (select 1 from public.profiles p
                  where p.id = follows.followee_id and p.is_demo = false and p.deleted_at is null)
    )
  );

-- (S6) follows_self_insert — cannot follow toward a purged world
drop policy if exists follows_self_insert on public.follows;
create policy follows_self_insert on public.follows
  for insert to authenticated
  with check (
    follower_id::text = auth.uid()::text
    and exists (
      select 1 from public.profiles p
      where p.id = followee_id
        and p.deleted_at is null
        and (p.is_demo = false or public.is_owner() or public.caller_is_verified())
    )
  );

-- (S7) listings_public_read — a purged world's live listings go dark publicly
drop policy if exists listings_public_read on public.listings;
create policy listings_public_read on public.listings
  for select
  using (
    profile_id::text = auth.uid()::text
    or public.is_owner()
    or public.caller_is_verified()
    or (
      status = 'live'
      and exists (select 1 from public.profiles p
                  where p.id = listings.profile_id and p.is_demo = false and p.deleted_at is null)
    )
  );

-- =====================================================================
-- (5) AGGREGATES THAT BYPASS RLS (SECURITY DEFINER) — must filter explicitly.
--     Reproduced verbatim from their source migrations with a single added
--     `deleted_at` predicate each; no other behavior changes.
-- =====================================================================

-- (S8/S9) get_for_you — reproduced from 0025 + `and p.deleted_at is null`
--         (people candidate) + purged-host exclusion (events demo_host).
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
$$;

revoke all     on function public.get_for_you(int, text) from public;
grant  execute on function public.get_for_you(int, text) to authenticated;

-- (my_circle) reproduced from 0023 + `and p.deleted_at is null` in each join,
-- so a purged account leaves an existing friend's circle too.
create or replace function public.my_circle()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ok', true,
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'name', p.full_name, 'username', p.username,
               'avatar_url', p.avatar_url, 'verified', p.verified, 'city', p.city)
             order by lower(coalesce(p.full_name, p.username, '')))
      from public.friendships f
      join public.profiles p
        on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
      where f.status = 'accepted'
        and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
        and p.deleted_at is null
    ), '[]'::jsonb),
    'pending_in', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'name', p.full_name, 'username', p.username,
               'avatar_url', p.avatar_url, 'verified', p.verified, 'city', p.city)
             order by f.created_at desc)
      from public.friendships f
      join public.profiles p on p.id = f.requester_id
      where f.status = 'pending' and f.addressee_id = auth.uid()
        and p.deleted_at is null
    ), '[]'::jsonb),
    'pending_out', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'name', p.full_name, 'username', p.username,
               'avatar_url', p.avatar_url, 'verified', p.verified, 'city', p.city)
             order by f.created_at desc)
      from public.friendships f
      join public.profiles p on p.id = f.addressee_id
      where f.status = 'pending' and f.requester_id = auth.uid()
        and p.deleted_at is null
    ), '[]'::jsonb)
  );
$$;
revoke all     on function public.my_circle() from public;
grant  execute on function public.my_circle() to authenticated;

commit;

-- ---------- verify (run as anon / plain authenticated / owner) ----------
-- select public.admin_list_accounts();          -- non-owner → {ok:false, not_owner}; owner → {ok:true, accounts:[…]}
-- select public.admin_soft_purge('<uuid>');      -- non-owner → not_owner; owner+protected → protected; owner+ok → {ok:true, deleted_at}
-- select public.admin_restore('<uuid>');         -- owner → {ok:true}
-- anon GET /profiles?id=eq.<purged_uid>&select=id  → 0 rows (S1 filters deleted_at)
-- own token PATCH /profiles?id=eq.<self> {deleted_at:null} → value unchanged (trg_lock_lifecycle)
