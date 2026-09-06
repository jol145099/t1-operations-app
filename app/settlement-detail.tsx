import { useEffect, useMemo, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'

import { Card, H1, H2, Muted, Screen, colors } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/AuthProvider'

type Assignment = {
  player_id: string
  assigned_pay: number | null
  calculated_pay: number | null
  final_pay: number | null
  completed_at: string | null
  orders: {
    order_no: string
    customers: { display_name: string } | null
    order_types: { name: string } | null
  } | null
}

type LedgerRow = { player_id: string; amount: number; description: string | null; occurred_at: string; type: string }
type DispatchOrder = {
  dispatcher_id: string | null
  dispatch_fee: number | null
  completed_at: string | null
  order_no: string
  customers: { display_name: string } | null
  order_types: { name: string } | null
}

type PlayerRow = { id: string; profile_id: string | null; display_name: string }

function shortDate(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function fullDate(value: string) {
  const date = new Date(value)
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

function money(value: number) {
  return `$${Math.ceil(Number(value || 0)).toLocaleString()}`
}

function signedMoney(value: number) {
  const n = Math.ceil(Number(value || 0))
  return n > 0 ? `+${money(n)}` : money(n)
}

function ledgerTypeLabel(type: string) {
  const labels: Record<string, string> = {
    rental: '租號', compensation: '賠付', advance: '預支', topup: '儲值', deposit: '押金', bonus: '加雞腿', penalty: '罰錢', other: '其他'
  }
  return labels[type] || type
}

export default function SettlementDetailScreen() {
  const { profile } = useAuth()
  const params = useLocalSearchParams<{ playerId: string; playerName?: string; start: string; end: string; nextExclusive: string }>()
  const playerId = String(params.playerId || '')
  const start = String(params.start || '')
  const end = String(params.end || '')
  const nextExclusive = String(params.nextExclusive || '')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [player, setPlayer] = useState<PlayerRow | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([])
  const [dispatchOrders, setDispatchOrders] = useState<DispatchOrder[]>([])

  useEffect(() => {
    async function load() {
      if (!profile || !playerId || !start || !nextExclusive) return
      setLoading(true)
      setError('')

      let pq = supabase.from('players').select('id, profile_id, display_name').eq('id', playerId)
      if (profile.role === 'player') pq = pq.eq('profile_id', profile.id)

      const p = await pq.maybeSingle()
      if (p.error || !p.data) {
        setError(p.error?.message || '找不到這位打手，或你沒有權限查看。')
        setLoading(false)
        return
      }

      const playerData = p.data as PlayerRow
      setPlayer(playerData)

      const [a, l, d] = await Promise.all([
        supabase
          .from('order_players')
          .select('player_id, assigned_pay, calculated_pay, final_pay, completed_at, orders(order_no, customers(display_name), order_types(name))')
          .eq('player_id', playerId)
          .eq('status', 'completed')
          .gte('completed_at', start)
          .lt('completed_at', nextExclusive)
          .order('completed_at', { ascending: true }),
        supabase
          .from('ledger')
          .select('player_id, amount, description, occurred_at, type')
          .eq('player_id', playerId)
          .gte('occurred_at', start)
          .lt('occurred_at', nextExclusive)
          .order('occurred_at', { ascending: true }),
        playerData.profile_id
          ? supabase
              .from('orders')
              .select('dispatcher_id, dispatch_fee, completed_at, order_no, customers(display_name), order_types(name)')
              .eq('dispatcher_id', playerData.profile_id)
              .eq('status', 'completed')
              .gte('completed_at', start)
              .lt('completed_at', nextExclusive)
              .order('completed_at', { ascending: true })
          : Promise.resolve({ data: [], error: null })
      ])

      const firstError = a.error || l.error || d.error
      if (firstError) setError(firstError.message)
      else {
        setAssignments((a.data ?? []) as unknown as Assignment[])
        setLedgerRows((l.data ?? []) as LedgerRow[])
        setDispatchOrders((d.data ?? []) as unknown as DispatchOrder[])
      }
      setLoading(false)
    }

    void load()
  }, [profile?.id, profile?.role, playerId, start, nextExclusive])

  const totals = useMemo(() => {
    const orderPay = assignments.reduce((sum, row) => sum + Number(row.final_pay ?? row.calculated_pay ?? row.assigned_pay ?? 0), 0)
    const dispatchPay = dispatchOrders.reduce((sum, row) => sum + Number(row.dispatch_fee || 0), 0)
    const adjustments = ledgerRows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
    return { orderPay, dispatchPay, adjustments, total: orderPay + dispatchPay + adjustments }
  }, [assignments, dispatchOrders, ledgerRows])

  if (loading) return <Screen><ActivityIndicator color={colors.accent} /></Screen>

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        <H1>{player?.display_name || params.playerName || '打手'}｜本期明細</H1>
        {start && end ? <Muted>{fullDate(start)} → {fullDate(end)}</Muted> : null}

        {error ? <Card><Text style={styles.error}>{error}</Text></Card> : null}

        {!error ? (
          <>
            <Card>
              <H2>本期總覽</H2>
              <Line label="完單收入" value={totals.orderPay} />
              <Line label="派單收入" value={totals.dispatchPay} />
              <Line label="其他加扣" value={totals.adjustments} signed />
              <View style={styles.divider} />
              <Line label="本期應付" value={totals.total} total />
            </Card>

            <Card>
              <H2>完單明細（{assignments.length}）</H2>
              {assignments.length === 0 ? <Muted>這一期沒有完單收入。</Muted> : assignments.map((row, index) => (
                <DetailRow
                  key={`${row.orders?.order_no ?? 'order'}-${index}`}
                  date={shortDate(row.completed_at)}
                  title={`${row.orders?.order_no ?? '訂單'} · ${row.orders?.order_types?.name || '訂單'}`}
                  subtitle={row.orders?.customers?.display_name ? `老闆：${row.orders.customers.display_name}` : undefined}
                  amount={money(Number(row.final_pay ?? row.calculated_pay ?? row.assigned_pay ?? 0))}
                />
              ))}
            </Card>

            <Card>
              <H2>派單明細（{dispatchOrders.length}）</H2>
              {dispatchOrders.length === 0 ? <Muted>這一期沒有派單收入。</Muted> : dispatchOrders.map((row, index) => (
                <DetailRow
                  key={`${row.order_no}-${index}`}
                  date={shortDate(row.completed_at)}
                  title={`${row.order_no} · ${row.order_types?.name || '訂單'}`}
                  subtitle={row.customers?.display_name ? `老闆：${row.customers.display_name}` : undefined}
                  amount={money(Number(row.dispatch_fee || 0))}
                />
              ))}
            </Card>

            <Card>
              <H2>加扣款明細（{ledgerRows.length}）</H2>
              {ledgerRows.length === 0 ? <Muted>這一期沒有其他加扣款。</Muted> : ledgerRows.map((row, index) => (
                <DetailRow
                  key={`${row.occurred_at}-${index}`}
                  date={shortDate(row.occurred_at)}
                  title={row.description || ledgerTypeLabel(row.type)}
                  amount={signedMoney(Number(row.amount || 0))}
                  positive={Number(row.amount || 0) > 0}
                  negative={Number(row.amount || 0) < 0}
                />
              ))}
            </Card>
          </>
        ) : null}
      </Screen>
    </ScrollView>
  )
}

function Line({ label, value, signed = false, total = false }: { label: string; value: number; signed?: boolean; total?: boolean }) {
  const shown = signed && value > 0 ? `+${money(value)}` : money(value)
  return <View style={styles.line}><Text style={[styles.label, total && styles.totalLabel]}>{label}</Text><Text style={[styles.value, total && styles.total]}>{shown}</Text></View>
}

function DetailRow({ date, title, subtitle, amount, positive = false, negative = false }: { date: string; title: string; subtitle?: string; amount: string; positive?: boolean; negative?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.dateBox}><Text style={styles.date}>{date}</Text></View>
      <View style={styles.detailText}>
        <Text style={styles.detailTitle}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <Text style={[styles.amount, positive && styles.positive, negative && styles.negative]}>{amount}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  label: { color: colors.muted, fontSize: 15 },
  value: { color: colors.text, fontWeight: '700', fontSize: 16 },
  totalLabel: { color: colors.text, fontWeight: '800', fontSize: 17 },
  total: { color: colors.accent, fontSize: 24, fontWeight: '900' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 5 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  dateBox: { width: 42 },
  date: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  detailText: { flex: 1 },
  detailTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
  amount: { color: colors.text, fontWeight: '800', fontSize: 15 },
  positive: { color: '#6fdc8c' },
  negative: { color: '#ff8f8f' },
  error: { color: '#ff8f8f', fontWeight: '700' }
})
