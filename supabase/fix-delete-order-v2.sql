-- Definitive T1 order deletion RPC.
-- Run in Supabase SQL Editor. This version explicitly removes every known child row first.

create or replace function public.delete_t1_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_role public.app_role;
begin
  select role into v_role from public.profiles where id=auth.uid();
  if v_role not in ('staff','admin') then
    raise exception 'staff/admin only';
  end if;

  -- Detach/delete all known order dependencies before deleting the order.
  update public.ledger set order_id=null where order_id=p_order_id;
  delete from public.vip_transactions where order_id=p_order_id;
  delete from public.order_players where order_id=p_order_id;
  delete from public.orders where id=p_order_id;

  if not found then
    raise exception 'order not found';
  end if;
end;
$$;

revoke all on function public.delete_t1_order(uuid) from public;
grant execute on function public.delete_t1_order(uuid) to authenticated;
