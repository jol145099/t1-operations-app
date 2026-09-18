-- Gate player settlement confirmation until staff/admin finishes checking the period.
create table if not exists public.settlement_period_controls (
  period_start date not null,
  period_end date not null,
  confirmation_open boolean not null default false,
  opened_at timestamptz,
  opened_by uuid references public.profiles(id) on delete set null,
  primary key(period_start,period_end)
);
alter table public.settlement_period_controls enable row level security;
drop policy if exists "authenticated read settlement controls" on public.settlement_period_controls;
create policy "authenticated read settlement controls" on public.settlement_period_controls for select to authenticated using (true);
drop policy if exists "staff manage settlement controls" on public.settlement_period_controls;
create policy "staff manage settlement controls" on public.settlement_period_controls for all to authenticated
using (public.current_role() in ('staff','admin')) with check (public.current_role() in ('staff','admin'));

create or replace function public.set_t1_settlement_confirmation_open(p_period_start date,p_period_end date,p_open boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if (select role from public.profiles where id=auth.uid()) not in ('staff','admin') then raise exception 'staff/admin only'; end if;
 insert into public.settlement_period_controls(period_start,period_end,confirmation_open,opened_at,opened_by)
 values(p_period_start,p_period_end,p_open,case when p_open then now() else null end,case when p_open then auth.uid() else null end)
 on conflict(period_start,period_end) do update set confirmation_open=excluded.confirmation_open,opened_at=excluded.opened_at,opened_by=excluded.opened_by;
end; $$;
grant execute on function public.set_t1_settlement_confirmation_open(date,date,boolean) to authenticated;

-- Enforce the gate in the database too.
create or replace function public.confirm_t1_settlement(
  p_player_id uuid,p_period_start date,p_period_end date,p_order_pay numeric,p_dispatch_pay numeric,p_adjustments numeric
) returns public.settlements language plpgsql security definer set search_path='' as $$
declare v_role public.app_role;v_carry numeric(12,2):=0;v_total numeric(12,2);v_row public.settlements;
begin
 select role into v_role from public.profiles where id=auth.uid();
 if v_role='player' then
   if not exists(select 1 from public.players where id=p_player_id and profile_id=auth.uid() and active=true) then raise exception 'players can confirm only their own settlement'; end if;
   if not coalesce((select confirmation_open from public.settlement_period_controls where period_start=p_period_start and period_end=p_period_end),false) then raise exception 'settlement confirmation is not open yet'; end if;
 elsif v_role not in ('staff','admin') then raise exception 'not allowed'; end if;
 select least(total_payable,0) into v_carry from public.settlements where player_id=p_player_id and period_end<p_period_start order by period_end desc limit 1;
 v_carry:=coalesce(v_carry,0);
 -- Players never receive dispatcher commission.
 v_total:=coalesce(p_order_pay,0)+coalesce(p_adjustments,0)+v_carry;
 if v_total=0 then raise exception 'zero balance does not require confirmation'; end if;
 insert into public.settlements(player_id,period_start,period_end,order_pay,dispatch_pay,adjustments,carry_in,total_payable,carry_out,payment_status,amount_paid)
 values(p_player_id,p_period_start,p_period_end,p_order_pay,0,p_adjustments,v_carry,v_total,least(v_total,0),'unpaid',0)
 on conflict(player_id,period_start,period_end) do nothing returning * into v_row;
 if v_row.id is null then select * into v_row from public.settlements where player_id=p_player_id and period_start=p_period_start and period_end=p_period_end;end if;
 return v_row;
end;$$;
grant execute on function public.confirm_t1_settlement(uuid,date,date,numeric,numeric,numeric) to authenticated;
