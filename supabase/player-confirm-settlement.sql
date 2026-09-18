-- Player self-confirmation of settlement.
-- Replaces confirm_t1_settlement so a player may confirm only their own settlement.
create or replace function public.confirm_t1_settlement(
  p_player_id uuid, p_period_start date, p_period_end date,
  p_order_pay numeric, p_dispatch_pay numeric, p_adjustments numeric
) returns public.settlements
language plpgsql security definer set search_path=''
as $$
declare v_role public.app_role; v_carry numeric(12,2):=0; v_gross numeric(12,2); v_total numeric(12,2); v_row public.settlements;
begin
 select role into v_role from public.profiles where id=auth.uid();
 if v_role='player' then
   if not exists(select 1 from public.players where id=p_player_id and profile_id=auth.uid() and active=true) then raise exception 'players can confirm only their own settlement'; end if;
 elsif v_role not in ('staff','admin') then raise exception 'not allowed'; end if;

 select least(total_payable,0) into v_carry from public.settlements
 where player_id=p_player_id and period_end < p_period_start order by period_end desc limit 1;
 v_carry:=coalesce(v_carry,0);
 v_gross:=coalesce(p_order_pay,0)+coalesce(p_dispatch_pay,0)+coalesce(p_adjustments,0);
 v_total:=v_gross+v_carry;
 if v_total=0 then raise exception 'zero balance does not require confirmation'; end if;

 insert into public.settlements(player_id,period_start,period_end,order_pay,dispatch_pay,adjustments,carry_in,total_payable,carry_out,payment_status,amount_paid)
 values(p_player_id,p_period_start,p_period_end,p_order_pay,p_dispatch_pay,p_adjustments,v_carry,v_total,least(v_total,0),'unpaid',0)
 on conflict(player_id,period_start,period_end) do nothing returning * into v_row;
 if v_row.id is null then select * into v_row from public.settlements where player_id=p_player_id and period_start=p_period_start and period_end=p_period_end; end if;
 return v_row;
end; $$;
revoke all on function public.confirm_t1_settlement(uuid,date,date,numeric,numeric,numeric) from public;
grant execute on function public.confirm_t1_settlement(uuid,date,date,numeric,numeric,numeric) to authenticated;
