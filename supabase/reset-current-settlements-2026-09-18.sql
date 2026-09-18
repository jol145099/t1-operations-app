-- TEST/DEVELOPMENT ONLY
-- Reset settlement confirmations/payments for the current T1 pay period.
-- As of 2026-09-18, the current period is 2026-09-16 through 2026-10-01.
-- This deletes ONLY settlement snapshot rows. It does not delete orders,
-- order_players, ledger entries, players, customers, or VIP transactions.

begin;

delete from public.settlements
where period_start = date '2026-09-16'
  and period_end   = date '2026-10-01';

commit;

-- Verify: should return zero rows immediately after reset.
select id, player_id, period_start, period_end, total_payable,
       payment_status, amount_paid, paid_at
from public.settlements
where period_start = date '2026-09-16'
  and period_end   = date '2026-10-01';
