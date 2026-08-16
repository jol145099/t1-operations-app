-- T1 Operations App - MVP database schema
-- Run in Supabase SQL Editor on a NEW project.

create extension if not exists pgcrypto;

create type public.app_role as enum ('customer', 'player', 'staff', 'admin');
create type public.order_status as enum (
  'draft',
  'awaiting_player',
  'in_progress',
  'completed',
  'cancelled',
  'refunded'
);
create type public.assignment_status as enum ('assigned', 'accepted', 'in_progress', 'completed', 'cancelled');
create type public.ledger_type as enum (
  'rental',
  'compensation',
  'advance',
  'topup',
  'deposit',
  'bonus',
  'penalty',
  'other'
);
create type public.payment_status as enum ('unpaid', 'partial', 'paid');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role public.app_role not null default 'customer',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  display_name text not null,
  aliases text[] not null default '{}',
  vip_level integer not null default 0 check (vip_level between 0 and 10),
  stored_balance numeric(12,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.order_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  requires_player boolean not null default true,
  vip_eligible boolean not null default true,
  calculation_mode text not null default 'manual'
    check (calculation_mode in ('manual', 'fixed', 'per_game', 'extract_rate', 'custom')),
  player_rate numeric(8,4),
  fixed_player_pay numeric(12,2),
  per_game_pay numeric(12,2),
  rules jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create sequence if not exists public.order_number_seq;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique default (
    'T1-' || to_char(now(), 'YYYYMMDD') || '-' ||
    lpad(nextval('public.order_number_seq')::text, 5, '0')
  ),
  customer_id uuid not null references public.customers(id),
  order_type_id uuid not null references public.order_types(id),
  created_by uuid not null references public.profiles(id),
  dispatcher_id uuid references public.profiles(id),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  vip_eligible_amount numeric(12,2) not null default 0 check (vip_eligible_amount >= 0),
  dispatch_rate numeric(8,4) not null default 0,
  dispatch_fee numeric(12,2) generated always as (amount_paid * dispatch_rate) stored,
  requires_player boolean not null default true,
  status public.order_status not null default 'draft',
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_players (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  player_id uuid not null references public.players(id),
  status public.assignment_status not null default 'assigned',
  accepted_at timestamptz,
  completed_at timestamptz,
  games_played integer not null default 0 check (games_played >= 0),
  extracts integer not null default 0 check (extracts >= 0),
  assigned_pay numeric(12,2) not null default 0,
  calculated_pay numeric(12,2) not null default 0,
  final_pay numeric(12,2) not null default 0,
  result_data jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  unique (order_id, player_id),
  check (extracts <= games_played)
);

create table public.ledger (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id),
  order_id uuid references public.orders(id) on delete set null,
  type public.ledger_type not null,
  amount numeric(12,2) not null,
  description text,
  created_by uuid not null references public.profiles(id),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id),
  period_start date not null,
  period_end date not null,
  order_pay numeric(12,2) not null default 0,
  dispatch_pay numeric(12,2) not null default 0,
  adjustments numeric(12,2) not null default 0,
  total_payable numeric(12,2) not null default 0,
  payment_status public.payment_status not null default 'unpaid',
  amount_paid numeric(12,2) not null default 0,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (player_id, period_start, period_end)
);

create table public.vip_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  order_id uuid unique references public.orders(id) on delete cascade,
  eligible_amount numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create index idx_customers_profile on public.customers(profile_id);
create index idx_players_profile on public.players(profile_id);
create index idx_orders_customer on public.orders(customer_id);
create index idx_orders_dispatcher on public.orders(dispatcher_id);
create index idx_order_players_order on public.order_players(order_id);
create index idx_order_players_player on public.order_players(player_id);
create index idx_ledger_player on public.ledger(player_id);
create index idx_settlements_player on public.settlements(player_id);

-- Automatically create a minimal profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    'customer'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Helper functions used by RLS.
create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_customer_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.customers where profile_id = auth.uid();
$$;

create or replace function public.current_player_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.players where profile_id = auth.uid();
$$;

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.players enable row level security;
alter table public.order_types enable row level security;
alter table public.orders enable row level security;
alter table public.order_players enable row level security;
alter table public.ledger enable row level security;
alter table public.settlements enable row level security;
alter table public.vip_transactions enable row level security;

-- profiles
create policy "profiles own select"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.current_role() in ('staff','admin'));

create policy "admin manage profiles"
on public.profiles for all to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

-- customers
create policy "customers self or staff select"
on public.customers for select to authenticated
using (
  profile_id = (select auth.uid())
  or public.current_role() in ('staff','admin')
);

create policy "staff manage customers"
on public.customers for all to authenticated
using (public.current_role() in ('staff','admin'))
with check (public.current_role() in ('staff','admin'));

-- players
create policy "players self or staff select"
on public.players for select to authenticated
using (
  profile_id = (select auth.uid())
  or public.current_role() in ('staff','admin')
);

create policy "staff manage players"
on public.players for all to authenticated
using (public.current_role() in ('staff','admin'))
with check (public.current_role() in ('staff','admin'));

-- order_types
create policy "authenticated read order types"
on public.order_types for select to authenticated
using (active = true or public.current_role() in ('staff','admin'));

create policy "admin manage order types"
on public.order_types for all to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

-- orders: customers see their own, players see assigned, staff/admin see all
create policy "role based order select"
on public.orders for select to authenticated
using (
  public.current_role() in ('staff','admin')
  or customer_id = public.current_customer_id()
  or exists (
    select 1
    from public.order_players op
    where op.order_id = orders.id
      and op.player_id = public.current_player_id()
  )
);

create policy "staff insert orders"
on public.orders for insert to authenticated
with check (public.current_role() in ('staff','admin'));

create policy "staff update orders"
on public.orders for update to authenticated
using (public.current_role() in ('staff','admin'))
with check (public.current_role() in ('staff','admin'));

-- order_players
create policy "player assignment select"
on public.order_players for select to authenticated
using (
  public.current_role() in ('staff','admin')
  or player_id = public.current_player_id()
);

create policy "staff insert assignments"
on public.order_players for insert to authenticated
with check (public.current_role() in ('staff','admin'));

create policy "staff update assignments"
on public.order_players for update to authenticated
using (public.current_role() in ('staff','admin'))
with check (public.current_role() in ('staff','admin'));

-- Players may update ONLY their own assignment rows.
-- Column-level validation should be added in a trigger before production.
create policy "player update own assignment"
on public.order_players for update to authenticated
using (player_id = public.current_player_id())
with check (player_id = public.current_player_id());

-- ledger
create policy "player own ledger select"
on public.ledger for select to authenticated
using (
  public.current_role() in ('staff','admin')
  or player_id = public.current_player_id()
);

create policy "staff manage ledger"
on public.ledger for all to authenticated
using (public.current_role() in ('staff','admin'))
with check (public.current_role() in ('staff','admin'));

-- settlements
create policy "player own settlement select"
on public.settlements for select to authenticated
using (
  public.current_role() in ('staff','admin')
  or player_id = public.current_player_id()
);

create policy "staff manage settlements"
on public.settlements for all to authenticated
using (public.current_role() in ('staff','admin'))
with check (public.current_role() in ('staff','admin'));

-- VIP transactions
create policy "customer own vip select"
on public.vip_transactions for select to authenticated
using (
  public.current_role() in ('staff','admin')
  or customer_id = public.current_customer_id()
);

create policy "staff manage vip transactions"
on public.vip_transactions for all to authenticated
using (public.current_role() in ('staff','admin'))
with check (public.current_role() in ('staff','admin'));

-- Seed sample order types. Replace these with your real T1 order types.
insert into public.order_types (name, requires_player, vip_eligible, calculation_mode)
values
  ('一般陪玩', true, true, 'manual'),
  ('直接報單', false, true, 'manual')
on conflict (name) do nothing;
