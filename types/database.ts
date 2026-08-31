export type AppRole = 'customer' | 'player' | 'staff' | 'admin'
export type OrderStatus =
  | 'draft'
  | 'awaiting_player'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'refunded'

export type Profile = {
  id: string
  display_name: string
  role: AppRole
  active: boolean
}

export type Order = {
  id: string
  order_no: string
  customer_id: string
  order_type_id: string
  amount_paid: number
  vip_eligible_amount: number
  status: OrderStatus
  requires_player: boolean
  created_at: string
}
