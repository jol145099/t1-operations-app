-- Settlement history + negative balance carry-forward.
alter table public.settlements add column if not exists carry_in numeric(12,2) not null default 0;
alter table public.settlements add column if not exists carry_out numeric(12,2) not null default 0;

create or replace function public.confirm_t1_settlement(
  p_player_id uuid, p_period_start date, p_period_end date,
  p_order_pay numeric, p_dispatch_pay numeric, p_adjustments numeric
) returns public.settlements
language plpgsql security definer set search_path=''
as $$
declare v_role public.app_role; v_carry numeric(12,2):=0; v_gross numeric(12,2); v_total numeric(12,2); v_row public.settlements;
begin
 select role into v_role from public.profiles where id=auth.uid();
 if v_role not in ('staff','admin') then raise exception 'staff/admin only'; end if;
 select least(total_payable,0) into v_carry from public.settlements
 where player_id=p_player_id and period_end < p_period_start
 order by period_end desc limit 1;
 v_carry:=coalesce(v_carry,0); v_gross:=coalesce(p_order_pay,0)+coalesce(p_dispatch_pay,0)+coalesce(p_adjustments,0);
 v_total:=v_gross+v_carry;
 insert into public.settlements(player_id,period_start,period_end,order_pay,dispatch_pay,adjustments,carry_in,total_payable,carry_out,payment_status,amount_paid)
 values(p_player_id,p_period_start,p_period_end,p_order_pay,p_dispatch_pay,p_adjustments,v_carry,v_total,least(v_total,0),'unpaid',0)
 on conflict(player_id,period_start,period_end) do nothing returning * into v_row;
 if v_row.id is null then select * into v_row from public.settlements where player_id=p_player_id and period_start=p_period_start and period_end=p_period_end; end if;
 return v_row;
end; $$;
revoke all on function public.confirm_t1_settlement(uuid,date,date,numeric,numeric,numeric) from public;
grant execute on function public.confirm_t1_settlement(uuid,date,date,numeric,numeric,numeric) to authenticated;

create or replace function public.ensure_negative_settlement_carry(
  p_period_start date, p_period_end date
) returns integer
language plpgsql security definer set search_path=''
as $$
declare v_role public.app_role; r record; n integer:=0;
begin
 select role into v_role from public.profiles where id=auth.uid();
 if v_role not in ('staff','admin') then raise exception 'staff/admin only'; end if;
 for r in
  select distinct on (player_id) player_id,total_payable from public.settlements
  where period_end < p_period_start order by player_id,period_end desc
 loop
  if r.total_payable < 0 and not exists(select 1 from public.settlements s where s.player_id=r.player_id and s.period_start=p_period_start and s.period_end=p_period_end) then
   insert into public.settlements(player_id,period_start,period_end,carry_in,total_payable,carry_out,payment_status,amount_paid)
   values(r.player_id,p_period_start,p_period_end,r.total_payable,r.total_payable,r.total_payable,'unpaid',0);
   n:=n+1;
  end if;
 end loop;
 return n;
end; $$;
revoke all on function public.ensure_negative_settlement_carry(date,date) from public;
grant execute on function public.ensure_negative_settlement_carry(date,date) to authenticated;
