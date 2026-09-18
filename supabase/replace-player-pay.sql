-- Atomic player replacement with signed actual pay amounts.
create or replace function public.replace_t1_order_player(
  p_old_assignment_id uuid,
  p_new_player_id uuid,
  p_old_final_pay numeric,
  p_new_final_pay numeric,
  p_reason text default null
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_role public.app_role; v_old public.order_players%rowtype; v_new_id uuid;
begin
  select role into v_role from public.profiles where id=auth.uid();
  if v_role not in ('staff','admin') then raise exception 'staff/admin only'; end if;
  select * into v_old from public.order_players where id=p_old_assignment_id for update;
  if v_old.id is null or not v_old.is_active_slot then raise exception 'active assignment not found'; end if;
  if exists(select 1 from public.order_players where order_id=v_old.order_id and player_id=p_new_player_id and is_active_slot) then raise exception 'player already active on order'; end if;

  insert into public.order_players(order_id,player_id,status,assigned_pay,calculated_pay,final_pay,is_active_slot)
  values(v_old.order_id,p_new_player_id,'in_progress',p_new_final_pay,p_new_final_pay,p_new_final_pay,true)
  returning id into v_new_id;

  update public.order_players set
    is_active_slot=false,status='cancelled',assigned_pay=p_old_final_pay,calculated_pay=p_old_final_pay,final_pay=p_old_final_pay,
    compensation_amount=0,replaced_by_assignment_id=v_new_id,replacement_reason=nullif(trim(p_reason),''),
    replaced_at=now()
  where id=v_old.id;
  return v_new_id;
end; $$;
revoke all on function public.replace_t1_order_player(uuid,uuid,numeric,numeric,text) from public;
grant execute on function public.replace_t1_order_player(uuid,uuid,numeric,numeric,text) to authenticated;
