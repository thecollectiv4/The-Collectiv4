-- =========================================================================
-- 0052 — LOS DÍAS CONTADOS
--
-- El TODO que v14 dejó escrito en src/lib/tiers.js (bloque PENDING_METRICS):
-- `retention_activity` guarda un latido por perfil por día UTC (log_return,
-- 0028), pero la tabla es deny-all — RLS sin políticas ni grants — así que
-- ningún navegador puede leerla. "Days active" existía en la escalera sólo
-- como rótulo honesto de "no se puede leer".
--
-- Esto añade la lectura, y NADA más:
--   my_days_active() → jsonb { ok, days, first_day, last_day }
--
-- · SECURITY DEFINER porque la tabla es deny-all a propósito y se queda así:
--   la función es el ÚNICO camino de lectura, y sólo contesta por el que
--   llama (clavada a auth.uid(), misma postura que log_return).
-- · La frontera del día es UTC, no Houston, y log_return dispara una vez por
--   montaje de Layout — cuenta DÍAS QUE SE ABRIÓ LA APP, no días en que se
--   hizo algo. El cliente lo rotula así (tiers.js) o se vuelve otra mentira.
-- · No toca la escalera: daysActive NO entra como requisito de ningún rung.
--   Eso sería re-tunear niveles, que es otra decisión y otra migración.
-- · Anon: revoke EXPLÍCITO de `anon`, no sólo de `public` — los default
--   privileges de Supabase le dan execute a anon/authenticated directo al
--   crear la función, y `revoke from public` no toca esos grants directos
--   (verificado con has_function_privilege al aplicar esto). Sin el revoke
--   explícito, un anon ejecutaría y recibiría el conteo de nadie
--   ({days: 0} para auth.uid() null) — inocuo pero mentiroso; con él,
--   PostgREST contesta 42501 y el cliente degrada a null.
-- =========================================================================

create or replace function public.my_days_active()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ok',        true,
    'days',      count(distinct day),
    'first_day', min(day),
    'last_day',  max(day)
  )
  from public.retention_activity
  where profile_id = auth.uid()
$$;

revoke all     on function public.my_days_active() from public;
revoke execute on function public.my_days_active() from anon;
grant  execute on function public.my_days_active() to authenticated;

comment on function public.my_days_active() is
  'Lectura propia del latido de retención: días UTC distintos en que este perfil abrió la app. Único camino de lectura sobre retention_activity (deny-all). Contesta sólo por auth.uid().';
