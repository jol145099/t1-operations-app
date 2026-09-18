-- Fix active-order workflow.
-- Run once in Supabase SQL Editor.

-- Existing player orders created under the old flow should appear as in progress.
update public.orders
set status = 'in_progress',
    started_at = coalesce(started_at, created_at),
    updated_at = now()
where requires_player = true
  and status = 'awaiting_player';

-- Staff/Admin may delete an order. order_players and VIP rows cascade with the order.
drop policy if exists "staff delete orders" on public.orders;
create policy "staff delete orders"
on public.orders for delete to authenticated
using (public.current_role() in ('staff','admin'));
