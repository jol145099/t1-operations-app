-- T1 active-player handoff workflow.
-- Run once in Supabase SQL Editor.

alter table public.order_players add column if not exists is_active_slot boolean not null default true;
alter table public.order_players add column if not exists replaced_by_assignment_id uuid references public.order_players(id) on delete set null;
alter table public.order_players add column if not exists replacement_reason text;
alter table public.order_players add column if not exists compensation_amount numeric(12,2) not null default 0;
alter table public.order_players add column if not exists replaced_at timestamptz;

-- final_pay is the amount actually paid. compensation_amount is recorded separately
-- so staff can explicitly see the compensation while still overriding final_pay.
create index if not exists idx_order_players_active_slot on public.order_players(order_id, is_active_slot);

-- Remove the abandoned proportional-compensation experiment if it was installed.
drop function if exists public.recalculate_order_player_final_pay(uuid);
drop table if exists public.order_pay_adjustments;
