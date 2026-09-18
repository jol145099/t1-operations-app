-- Add order-level proportional compensation / pay redistribution.
-- Run this once in Supabase SQL Editor on an existing T1 database.

create table if not exists public.order_pay_adjustments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  player_id uuid not null references public.players(id),
  mode text not null check (mode in ('drops','guarantee','games','hours','ratio','manual')),
  direction text not null default 'earn' check (direction in ('earn','compensate')),
  base_amount numeric(12,2) not null default 0,
  base_units numeric(12,4),
  actual_units numeric(12,4),
  ratio numeric(12,6),
  amount numeric(12,2) not null,
  checkpoint_label text,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_order_pay_adjustments_order on public.order_pay_adjustments(order_id);
create index if not exists idx_order_pay_adjustments_player on public.order_pay_adjustments(player_id);

alter table public.order_pay_adjustments enable row level security;

drop policy if exists "order pay adjustment select" on public.order_pay_adjustments;
create policy "order pay adjustment select"
on public.order_pay_adjustments for select to authenticated
using (
  public.current_role() in ('staff','admin')
  or player_id = public.current_player_id()
);

drop policy if exists "staff manage order pay adjustments" on public.order_pay_adjustments;
create policy "staff manage order pay adjustments"
on public.order_pay_adjustments for all to authenticated
using (public.current_role() in ('staff','admin'))
with check (public.current_role() in ('staff','admin'));

-- Final pay is base assigned pay plus every order-level earn/compensation adjustment.
-- Compensation rows should be stored as negative amounts; earn rows as positive amounts.
create or replace function public.recalculate_order_player_final_pay(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_role() not in ('staff','admin') then
    raise exception 'not allowed';
  end if;

  update public.order_players op
  set calculated_pay = op.assigned_pay + coalesce((
        select sum(a.amount)
        from public.order_pay_adjustments a
        where a.order_id = op.order_id and a.player_id = op.player_id
      ), 0),
      final_pay = op.assigned_pay + coalesce((
        select sum(a.amount)
        from public.order_pay_adjustments a
        where a.order_id = op.order_id and a.player_id = op.player_id
      ), 0)
  where op.order_id = p_order_id;
end;
$$;
