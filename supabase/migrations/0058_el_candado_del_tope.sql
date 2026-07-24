-- =========================================================================
-- 0058 — EL CANDADO DEL TOPE (v17 · review adversarial)
--
-- El review de v17 confirmó una carrera en join_plan (0057): el tope de 40
-- se validaba con count-then-insert SIN candado — dos extraños entrando al
-- mismo tiempo por el link podían (a) rebasar el tope, o (b) el mismo
-- humano con doble tap cosechar un duplicate-key crudo en vez de una
-- respuesta idempotente.
--
-- EL ARREGLO ES UN CANDADO, NO UNA REESCRITURA: se toma el lock de la fila
-- del plan ANTES de leer membresía y contar. Los joins concurrentes del
-- mismo plan se forman en fila; cada uno ve el insert ya commiteado del
-- anterior — el conteo del tope es exacto y el select de v_was ve la
-- verdad, así que el doble tap cae al camino idempotente (ya estás 'in').
-- Todo lo demás es byte-idéntico a 0057, campana incluida.
--
-- ACL (cinturón 0053): se re-declara completa — authenticated únicamente,
-- anon jamás toca la puerta de unirse.
-- =========================================================================

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

  -- EL CANDADO: los joiners de este plan se serializan aquí. El conteo del
  -- tope y la lectura de membresía de abajo ven siempre el estado real.
  perform 1 from public.plans where id = v_plan.id for update;

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
