-- Reliable order deletion + dashboard status normalization.
-- Run once in Supabase SQL Editor.

-- Old player-required orders from the previous workflow become in-progress.
update public.orders
set status='in_progress', started_at=coalesce(started_at,created_at), updated_at=now()
where requires_player=true and status='awaiting_player';

-- Delete through a SECURITY DEFINER RPC so child records cannot make the UI appear to succeed while the order remains.
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
  if v_role not in ('staff','admin') then raise exception 'staff/admin only'; end if;

  -- Rows whose FK is SET NULL must be detached first; CASCADE rows disappear with the order.
  update public.ledger set order_id=null where order_id=p_order_id;
  delete from public.orders where id=p_order_id;
  if not found then raise exception 'order not found or already deleted'; end if;
end;
$$;
grant execute on function public.delete_t1_order(uuid) to authenticated;

-- Keep a direct DELETE policy too.
drop policy if exists "staff delete orders" on public.orders;
create policy "staff delete orders" on public.orders for delete to authenticated
using (public.current_role() in ('staff','admin'));
