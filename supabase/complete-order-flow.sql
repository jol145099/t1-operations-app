-- Complete T1 order workflow: report -> in progress -> handoff -> complete.
-- Run once in Supabase SQL Editor after order-handoff.sql.

-- Allow the same player to leave and later rejoin the same order.
alter table public.order_players drop constraint if exists order_players_order_id_player_id_key;

-- Completion RPC: only a current active player on the order may complete it.
-- Staff/Admin may also complete from the order detail screen.
create or replace function public.complete_t1_order(
  p_order_id uuid,
  p_completed_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_player uuid;
begin
  select role into v_role from public.profiles where id = auth.uid();
  select id into v_player from public.players where profile_id = auth.uid();

  if v_role not in ('staff','admin') and not exists (
    select 1 from public.order_players
    where order_id = p_order_id
      and player_id = v_player
      and is_active_slot = true
      and status in ('assigned','accepted','in_progress')
  ) then
    raise exception 'only a current active player can complete this order';
  end if;

  update public.order_players
  set status = 'completed',
      completed_at = (p_completed_date::timestamp + time '12:00') at time zone 'UTC',
      calculated_pay = coalesce(nullif(final_pay,0), assigned_pay),
      final_pay = coalesce(nullif(final_pay,0), assigned_pay)
  where order_id = p_order_id
    and is_active_slot = true
    and status <> 'cancelled';

  update public.orders
  set status = 'completed',
      completed_at = (p_completed_date::timestamp + time '12:00') at time zone 'UTC',
      updated_at = now()
  where id = p_order_id;
end;
$$;

grant execute on function public.complete_t1_order(uuid,date) to authenticated;
