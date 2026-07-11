-- =====================================================================
-- 0014 — EL MUNDO: the profile becomes a curable world + founder
--        verification without SQL. The Collectiv4.
--        Applied via Supabase CLI (db push).
--
-- WHY (this week's onboarding: ~10-15 creatives arrive to "curate their
-- worlds"; today the profile is too basic for that promise and verifying
-- each member is raw SQL):
--
--   1. WORLD COLUMNS. Four additive nullable columns on profiles give the
--      museum its curable surfaces: a welcome marquee (marquee_text), a
--      link row (world_links), an uploaded-work gallery (gallery), and a
--      composition preset (world_theme). Same jsonb-shape-guard pattern
--      as 0002's taste/media.
--
--   2. STORAGE, NOT BASE64. Images move to a real Supabase Storage bucket
--      ('worlds', public read). The old base64-in-DB avatars keep
--      rendering (client safeImg accepts data:image), but every NEW
--      upload is an object under the uploader's OWN folder — enforced by
--      storage RLS below, where the client can't lie: the first path
--      segment must equal auth.uid(). Size/type limits live on the
--      bucket, server-side.
--
--   3. VERIFY WITHOUT SQL. 0008/0009 already gave owners set_verified()
--      and list_network_profiles(), but both only see rows in
--      public.profiles — and a profile row is born LAZILY on the first
--      /profile visit. A team member who signed up five minutes ago is
--      invisible to the founder exactly when the founder needs to verify
--      them. admin_list_users() reads auth.users (owner-gated, SECURITY
--      DEFINER) so every REGISTERED account shows; admin_set_verified()
--      creates the missing minimal profile row before flipping the flag
--      (same transaction-local GUC hatch as 0008 — lock_verified stays
--      the only client-proof gate on the column).
--
--   4. my_os_identity() gains an `owner` boolean (additive key; existing
--      consumers read .member/.profile and are unaffected) so the OS can
--      SHOW owner tools only to owners. Display-gating only — the RPCs
--      re-check is_owner() server-side on every call.
--
-- Does NOT touch: prices, tickets, events RLS, lock_verified's client
-- lock, create-checkout-session/webhook. Additive + idempotent.
-- =====================================================================

begin;

-- ---------- 1) world columns (additive, nullable, shape-guarded) ----------
-- marquee_text: the welcome ticker. NULL → client renders the default
-- ("wlcme 2 my wrld"); empty string → owner explicitly turned it off.
alter table public.profiles add column if not exists marquee_text text;

-- world_links: [{"label":"IG","url":"https://…"}] — order = array order.
alter table public.profiles add column if not exists world_links jsonb;

-- gallery: [{"path":"<uid>/g-….jpg","url":"https://…","caption":"…"}]
-- path is the storage object (for cleanup); url is the public render URL;
-- order = array order (manual curation).
alter table public.profiles add column if not exists gallery jsonb;

-- world_theme: composition preset within cosmos (never a custom color —
-- per-profile accent colors are a forbidden pattern). NULL → 'chrome'.
alter table public.profiles add column if not exists world_theme text;

alter table public.profiles drop constraint if exists profiles_world_links_is_array;
alter table public.profiles add  constraint profiles_world_links_is_array
  check (world_links is null or jsonb_typeof(world_links) = 'array');
alter table public.profiles drop constraint if exists profiles_gallery_is_array;
alter table public.profiles add  constraint profiles_gallery_is_array
  check (gallery is null or jsonb_typeof(gallery) = 'array');
alter table public.profiles drop constraint if exists profiles_world_theme_known;
alter table public.profiles add  constraint profiles_world_theme_known
  check (world_theme is null or world_theme in ('chrome', 'outline', 'bone'));

-- ---------- 2) storage: the 'worlds' bucket ----------
-- Public read (the museum is public by design); 8 MB cap; images only.
-- Limits are enforced HERE (bucket metadata, checked by the storage API),
-- not in client code.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('worlds', 'worlds', true, 8388608,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS: anyone reads; an authenticated user WRITES only under a
-- folder named by their own uid — (storage.foldername(name))[1] is the
-- first path segment, compared to the caller's unforgeable auth.uid().
-- No cross-user writes, no anon writes, ever.
drop policy if exists worlds_public_read on storage.objects;
create policy worlds_public_read on storage.objects
  for select using (bucket_id = 'worlds');

drop policy if exists worlds_owner_insert on storage.objects;
create policy worlds_owner_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'worlds' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists worlds_owner_update on storage.objects;
create policy worlds_owner_update on storage.objects
  for update to authenticated
  using      (bucket_id = 'worlds' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'worlds' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists worlds_owner_delete on storage.objects;
create policy worlds_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'worlds' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- 3) founder verification without SQL ----------
-- Every REGISTERED account (auth.users), left-joined to its profile row if
-- one exists. Owner-only: emails leave the DB only toward a founder's JWT.
create or replace function public.admin_list_users()
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
  return jsonb_build_object('ok', true, 'users', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id',          u.id,
             'email',       u.email,
             'registered',  u.created_at,
             'has_profile', (p.id is not null),
             'full_name',   p.full_name,
             'username',    p.username,
             'discipline',  p.discipline,
             'avatar_url',  p.avatar_url,
             'verified',    coalesce(p.verified, false),
             'is_demo',     coalesce(p.is_demo, false)
           ) order by coalesce(p.verified, false) desc, u.created_at desc)
      from auth.users u
      left join public.profiles p on p.id = u.id
     where u.deleted_at is null
  ), '[]'::jsonb));
end;
$$;

-- Verify/unverify a REGISTERED user. If the profile row doesn't exist yet
-- (lazy creation hasn't fired), a minimal one is created first — same
-- shape as Profile.jsx's first-visit insert — so verification never
-- depends on the member having opened /profile. Writes through the 0008
-- trigger hatch; logs to os_activity in the SAME transaction (ACTION
-- INTEGRITY: the feed states what the DB did).
create or replace function public.admin_set_verified(p_user uuid, p_verified boolean)
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

  -- existence check on FOUND, never on a nullable column (an email-less
  -- account is still a registered user the list surfaced)
  select coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
                  split_part(u.email, '@', 1), 'Member')
    into v_name
    from auth.users u
   where u.id = p_user and u.deleted_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  -- open the 0008 trigger hatch for THIS transaction only, write, close.
  perform set_config('app.grant_verified', '1', true);
  insert into public.profiles (id, user_id, full_name, username, bio, city, verified)
  values (p_user, p_user::text, v_name, '', '', '', p_verified)
  on conflict (id) do update set verified = excluded.verified
  returning verified into v_new;
  perform set_config('app.grant_verified', '0', true);

  select auth.uid() into v_actor;
  if v_actor is not null and exists (select 1 from public.profiles where id = v_actor) then
    insert into public.os_activity (profile_id, action)
    values (v_actor, case when p_verified then 'verified ' else 'unverified ' end || v_name);
  end if;

  return jsonb_build_object('ok', true, 'id', p_user, 'verified', v_new);
end;
$$;

-- ---------- 4) my_os_identity(): additive `owner` key ----------
create or replace function public.my_os_identity()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile jsonb;
begin
  if not public.caller_is_network() then
    return jsonb_build_object('member', false);
  end if;
  select to_jsonb(t) into v_profile
  from (
    select id, full_name, username, avatar_url, verified
    from public.profiles
    where id = auth.uid()
  ) t;
  return jsonb_build_object('member', true, 'owner', public.is_owner(), 'profile', v_profile);
end;
$$;

-- ---------- grants: authenticated only; every function self-gates ----------
revoke all on function public.admin_list_users()                  from public;
revoke all on function public.admin_set_verified(uuid, boolean)   from public;
grant execute on function public.admin_list_users()                to authenticated;
grant execute on function public.admin_set_verified(uuid, boolean) to authenticated;

commit;

-- ---------- verify (run as anon / plain authenticated / owner) ----------
-- select public.admin_list_users();                        -- non-owner → {ok:false, not_owner}
-- select public.admin_set_verified(gen_random_uuid(), true); -- non-owner → not_owner; owner+unknown uuid → not_found
-- select public.my_os_identity();                          -- member → {member:true, owner:bool, profile:{…}}
-- Storage: as user A, upload to 'worlds/<A-uid>/x.jpg' → ok; to
-- 'worlds/<B-uid>/x.jpg' → RLS reject; anon upload → reject; 9 MB → reject.
