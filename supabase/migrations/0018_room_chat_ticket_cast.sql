-- =====================================================================
-- 0018 — room chat: type-agnostic ticket comparison. The Collectiv4.
--        NOT applied by Claude Code — Pato runs it:
--          cd ~/The-Collectiv4 && supabase db push --linked
--
-- THE BUG (caught by the first LIVE post-0017 walkthrough, story G):
-- join_event_chat compared t.buyer_id = v_me raw. tickets.buyer_id is a
-- TEXT column from the Base44 era (the same legacy shape 0001 documents:
-- "::text join is type-agnostic on buyer_id"), so the comparison throws
-- 42883 `operator does not exist: text = uuid` — the room chat door was
-- broken for every ticket holder, and the ticketless path errored
-- instead of answering not_in. One function replace, casts both sides
-- (the house pattern), nothing else moves.
-- =====================================================================

begin;

create or replace function public.join_event_chat(p_event uuid)
returns uuid
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_id uuid;
  v_ok boolean;
begin
  if v_me is null then
    raise exception 'not_signed_in';
  end if;
  select exists (
    select 1 from public.events e
    where e.id = p_event
      and e.is_test = false
      and e.status in ('published','past')
      and (
        public.is_owner()
        or e.host_id::text = v_me::text
        or exists (
          select 1 from public.tickets t
          where t.event_id::text = e.id::text
            and t.buyer_id::text = v_me::text
            and t.status = 'confirmed'
        )
      )
  ) into v_ok;
  if not coalesce(v_ok, false) then
    raise exception 'not_in';
  end if;
  perform public.ensure_own_profile();

  select id into v_id from public.threads where kind = 'event' and event_id = p_event;
  if v_id is null then
    insert into public.threads (kind, event_id, created_by)
    values ('event', p_event, v_me)
    on conflict (event_id) do update set event_id = excluded.event_id
    returning id into v_id;
  end if;
  insert into public.thread_members (thread_id, profile_id)
  values (v_id, v_me)
  on conflict (thread_id, profile_id) do nothing;
  return v_id;
end $$;
revoke all on function public.join_event_chat(uuid) from public;
grant execute on function public.join_event_chat(uuid) to authenticated;

commit;
