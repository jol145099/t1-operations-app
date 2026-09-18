-- Allow confirmed-but-unpaid settlements to be reopened safely.
create or replace function public.reopen_t1_settlement(p_settlement_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_role public.app_role; v_row public.settlements%rowtype;
begin
 select role into v_role from public.profiles where id=auth.uid();
 if v_role not in ('staff','admin') then raise exception 'staff/admin only'; end if;
 select * into v_row from public.settlements where id=p_settlement_id for update;
 if v_row.id is null then raise exception 'settlement not found'; end if;
 if v_row.payment_status='paid' or coalesce(v_row.amount_paid,0)<>0 or v_row.paid_at is not null then raise exception 'paid settlement cannot be reopened'; end if;
 delete from public.settlements where id=p_settlement_id;
end; $$;
revoke all on function public.reopen_t1_settlement(uuid) from public;
grant execute on function public.reopen_t1_settlement(uuid) to authenticated;
