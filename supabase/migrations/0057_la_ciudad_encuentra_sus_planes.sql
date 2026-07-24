-- =========================================================================
-- 0057 — LA CIUDAD ENCUENTRA SUS PLANES (v17 · fase 4)
--
-- "PÚBLICO · anyone can find it" era falso por construcción: la única
-- lectura de planes en todo el codebase era my_plans() (miembros de sus
-- propios planes) y la política pública de 0029/0039 existía sin que nadie
-- la caminara. Los 13 arquetipos del audit del 16 jul pegaron aquí — la
-- tamalada, el taller abierto, el fucho: puertas a cuartos sin ventana.
--
-- TRES PUERTAS NUEVAS, cada una con su propia decisión de acceso:
--
-- 1) public_plans(p_limit)  — el rail "HAPPENING NEAR YOU" del tab EVENTS.
-- 2) public_plan(p_id)      — la landing compartible /p/:id.
--    AMBAS ABIERTAS A ANON, con criterio y a propósito: un plan público
--    que un no-miembro no puede ver repite la mentira de la etiqueta, y el
--    caso real del send-off (el link del fucho en un WhatsApp de 60) es
--    exactamente gente SIN cuenta. Lo que anon recibe es SOLO la tarjeta
--    pública: título, detalle, spot, fecha y quién lo arma — NUNCA el
--    roster ni los conteos (doctrina 0029: "a discoverer sees the plan
--    card, not who is in it"; los counts siguen siendo de miembros, via
--    my_plans). El piso de semillas de 0039 viaja adentro de ambas:
--    creador is_demo=false y deleted_at is null — salvo is_owner(), y en
--    ese caso is_demo VIAJA con la identidad (guardrail 4, 0044) para que
--    el fundador vea la semilla etiquetada, nunca disfrazada.
--
-- 3) join_plan(p_plan_id)   — el "I'm in" de un extraño. SOLO
--    authenticated: el no-miembro pasa por /auth (?mode=create) y vuelve.
--    Excepción DELIBERADA a la doctrina 0023 ("plans are built FROM
--    friendship"): un plan que su creador marcó PÚBLICO invita al extraño
--    por definición — eso es lo que la etiqueta promete. La puerta valida
--    el mismo piso que las lecturas, respeta el tope de 40 (0023), espeja
--    thread_members (el room recibe al que llega, patrón create_plan) y
--    LE SUENA LA CAMPANA AL CREADOR: la línea entera del audit — "a
--    stranger joins your public plan" es la única campana que suena sin
--    amigos previos. En INSERT fresco la emitimos aquí (el trigger de
--    0042 ignora inserts sin invited_by); en el camino UPDATE
--    (invited→in) NO emitimos — el trigger 0042 ya suena ahí y sonaría
--    doble.
--
-- ACL (regla 0053 — nacen cerradas, se abren explícito y se reporta):
--   public_plans, public_plan  → anon + authenticated (justificado arriba)
--   join_plan                  → authenticated únicamente
-- =========================================================================

-- ── 1. el rail ──────────────────────────────────────────────────────────
create or replace function public.public_plans(p_limit int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit int := greatest(1, least(coalesce(p_limit, 30), 60));
begin
  return jsonb_build_object('ok', true, 'plans', coalesce((
    select jsonb_agg(x.j)
    from (
      select jsonb_build_object(
        'id', pl.id,
        'title', pl.title,
        'detail', pl.detail,
        'spot', pl.spot,
        'starts_at', pl.starts_at,
        'created_at', pl.created_at,
        'creator', jsonb_build_object(
          'id', cp.id, 'name', cp.full_name,
          'username', cp.username, 'avatar_url', cp.avatar_url,
          'city', cp.city, 'is_demo', cp.is_demo)
      ) as j
      from public.plans pl
      join public.profiles cp on cp.id = pl.creator_id
      where pl.visibility = 'public'
        and pl.status = 'live'
        -- hoy y el futuro; los planes sin fecha son planes en pie
        and (pl.starts_at is null or pl.starts_at > now() - interval '3 hours')
        -- el piso de 0039, replicado adentro (riesgo documentado: can_see
        -- devuelve true incondicional para 'public')
        and (public.is_owner()
             or (cp.is_demo = false and cp.deleted_at is null))
      order by (pl.starts_at is null) asc, pl.starts_at asc, pl.created_at desc
      limit v_limit
    ) x
  ), '[]'::jsonb));
end;
$$;
revoke all     on function public.public_plans(int) from public, anon, authenticated;
grant  execute on function public.public_plans(int) to anon, authenticated;

-- ── 2. la landing compartible ───────────────────────────────────────────
create or replace function public.public_plan(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  select jsonb_build_object(
    'id', pl.id,
    'title', pl.title,
    'detail', pl.detail,
    'spot', pl.spot,
    'starts_at', pl.starts_at,
    'created_at', pl.created_at,
    'creator', jsonb_build_object(
      'id', cp.id, 'name', cp.full_name,
      'username', cp.username, 'avatar_url', cp.avatar_url,
      'city', cp.city, 'is_demo', cp.is_demo)
  ) into v
  from public.plans pl
  join public.profiles cp on cp.id = pl.creator_id
  where pl.id = p_id
    and pl.visibility = 'public'
    and pl.status = 'live'
    and (public.is_owner()
         or (cp.is_demo = false and cp.deleted_at is null));

  -- un solo error para todo lo invisible: no existir, ser privado y estar
  -- cancelado responden IGUAL — la landing no es un oráculo de planes
  if v is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return jsonb_build_object('ok', true, 'plan', v);
end;
$$;
revoke all     on function public.public_plan(uuid) from public, anon, authenticated;
grant  execute on function public.public_plan(uuid) to anon, authenticated;

-- ── 3. el "I'm in" del extraño ──────────────────────────────────────────
create or replace function public.join_plan(p_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_plan   record;
  v_thread uuid;
  v_count  int;
  v_was    text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  perform public.ensure_own_profile();

  select pl.id, pl.title, pl.creator_id into v_plan
  from public.plans pl
  join public.profiles cp on cp.id = pl.creator_id
  where pl.id = p_plan_id
    and pl.visibility = 'public'
    and pl.status = 'live'
    and (public.is_owner()
         or (cp.is_demo = false and cp.deleted_at is null));
  if v_plan.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select th.id into v_thread from public.threads th where th.plan_id = v_plan.id;

  select status into v_was
  from public.plan_members
  where plan_id = v_plan.id and profile_id = v_uid;

  if v_was is null then
    -- el tope de 40 de 0023 cuenta a todos los que ocupan lugar en el plan
    select count(*) into v_count from public.plan_members where plan_id = v_plan.id;
    if v_count >= 40 then
      return jsonb_build_object('ok', false, 'error', 'plan_full');
    end if;
    insert into public.plan_members (plan_id, profile_id, status, responded_at)
    values (v_plan.id, v_uid, 'in', now());
    -- LA campana: un extraño se unió a tu plan público. El trigger de 0042
    -- no cubre inserts sin invited_by, así que aquí se emite a mano — sólo
    -- en el insert fresco, para no sonar doble en el camino UPDATE.
    if v_plan.creator_id <> v_uid then
      perform public.notify_emit(v_plan.creator_id, v_uid, 'plan_rsvp',
        jsonb_build_object('plan_id', v_plan.id, 'title', v_plan.title, 'status', 'in'));
    end if;
  elsif v_was <> 'in' then
    -- invitado/out/maybe que llega por el link: el trigger 0042 suena solo
    update public.plan_members
       set status = 'in', responded_at = now()
     where plan_id = v_plan.id and profile_id = v_uid;
  end if;

  -- el room recibe al que llega (patrón create_plan) — idempotente
  if v_thread is not null then
    insert into public.thread_members (thread_id, profile_id)
    values (v_thread, v_uid)
    on conflict do nothing;
  end if;

  return jsonb_build_object('ok', true, 'plan_id', v_plan.id, 'thread_id', v_thread);
end;
$$;
revoke all     on function public.join_plan(uuid) from public, anon, authenticated;
grant  execute on function public.join_plan(uuid) to authenticated;
