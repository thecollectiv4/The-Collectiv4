-- =========================================================================
-- 0055 — EL SELLO ES DEL SERVIDOR (v16 · review adversarial, hallazgo #4)
--
-- EL HOYO DE 0054: el trigger se declaró `before insert or update OF
-- avatar_url, cover_url`. En Postgres, un trigger `UPDATE OF lista` sólo
-- dispara si el SET del UPDATE nombra una de esas columnas — así que un
-- UPDATE directo `set photos_completed_at = '1970-01-01'` (legal bajo la
-- RLS de fila propia: la columna no estaba protegida) NO despertaba al
-- trigger, y cualquier usuario podía auto-formarse PRIMERO en el orden de
-- Community y For You con un curl. El orden de los mundos con cara es una
-- decisión de fundador; el sello que lo implementa no puede ser opinable
-- por el cliente.
--
-- EL ARREGLO: el trigger dispara en TODO insert/update (la tabla es chica;
-- el costo es trivial) y la función trata la columna como DERIVADA — lo
-- que venga del cliente se DESCARTA: en UPDATE arranca del valor viejo,
-- en INSERT de null, y sólo el propio trigger decide sellar (ambas fotos
-- presentes por primera vez → now()) o borrar (falta una foto → null).
-- Ni el dueño de la fila puede escribirla; el sello es del servidor.
--
-- SEGURIDAD (regla 0053): CREATE OR REPLACE de la función de trigger
-- conserva su ACL (nació cerrada a anon por los defaults de 0053; ningún
-- rol de cliente la ejecuta — la dispara el sistema). Nada se concede.
-- =========================================================================
begin;

create or replace function public.profiles_photos_completed()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  -- LA COLUMNA ES DERIVADA: se ignora cualquier valor que traiga el
  -- cliente. UPDATE parte de la verdad vieja; INSERT parte de null.
  if TG_OP = 'UPDATE' then
    new.photos_completed_at := old.photos_completed_at;
  else
    new.photos_completed_at := null;
  end if;

  if coalesce(new.avatar_url, '') <> '' and coalesce(new.cover_url, '') <> '' then
    -- completo: si es la primera vez (o re-completó tras quitar una foto),
    -- sella AHORA — entra al final del grupo con fotos
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

-- el trigger deja de mirar una lista de columnas: dispara siempre, y la
-- función decide. (El OF de 0054 era el hoyo — ver el encabezado.)
drop trigger if exists trg_profiles_photos_completed on public.profiles;
create trigger trg_profiles_photos_completed
  before insert or update on public.profiles
  for each row execute function public.profiles_photos_completed();

commit;

-- =====================================================================
-- VERIFY (after apply, via Management API):
--   -- update profiles set photos_completed_at = '1970-01-01' where id = X;
--   --   → la fila conserva su sello real (el trigger descarta el valor)
--   -- los 4 sellos del backfill de 0054 quedan intactos
-- =====================================================================
