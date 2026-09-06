import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { Card, H1, H2, Muted, Screen, colors } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/AuthProvider'

type Player = { id: string; profile_id: string | null; display_name: string }
type Assignment = {
  player_id: string
  assigned_pay: number | null
  calculated_pay: number | null
  final_pay: number | null
  completed_at: string | null
  notes: string | null
  orders: {
    order_no: string
    notes: string | null
    customers: { display_name: string } | null
    order_types: { name: string } | null
  } | null
}
type LedgerRow = {
  player_id: string
  amount: number
  description: string | null
  occurred_at: string
  type: string
}
type DispatchOrder = {
  dispatcher_id: string | null
  dispatch_fee: number | null
  completed_at: string | null
  order_no: string
  notes: string | null
  customers: { display_name: string } | null
  order_types: { name: string } | null
}

type SettlementSummary = {
  player: Player
  orderPay: number
  dispatchPay: number
  adjustments: number
  total: number
}

type Period = {
  start: Date
  end: Date
  nextExclusive: Date
  payout: Date
}

function localDate(year: number, month: number, day: number) {
  return new Date(year, month, day, 0, 0, 0, 0)
}

function currentSettlementPeriod(now = new Date()): Period {
  const y = now.getFullYear()
  const m = now.getMonth()
  const d = now.getDate()

  if (d < 15) {
    return {
      start: localDate(y, m, 1),
      end: localDate(y, m, 14),
      nextExclusive: localDate(y, m, 15),
      payout: localDate(y, m, 15)
    }
  }

  const nextMonth = localDate(y, m + 1, 1)
  const monthEnd = new Date(nextMonth.getTime() - 24 * 60 * 60 * 1000)
  return {
    start: localDate(y, m, 15),
    end: monthEnd,
    nextExclusive: nextMonth,
    payout: nextMonth
  }
}

function dateLabel(date: Date) {
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

function shortDate(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function isoStart(date: Date) {
  return date.toISOString()
}

function money(value: number) {
  return `$${Math.ceil(Number(value || 0)).toLocaleString()}`
}

function signedMoney(value: number) {
  const n = Math.ceil(Number(value || 0))
  if (n > 0) return `+${money(n)}`
  return money(n)
}

function serviceLabel(order: Assignment['orders'] | DispatchOrder) {
  return order?.order_types?.name || '訂單'
}

export default function SettlementScreen() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([])
  const [dispatchOrders, setDispatchOrders] = useState<DispatchOrder[]>([])
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null)

  const period = useMemo(() => currentSettlementPeriod(), [])

  useEffect(() => {
    async function load() {
      if (!profile) return
      setLoading(true)
      setError('')

      let playerQuery = supabase.from('players').select('id, profile_id, display_name').eq('active', true).order('display_name')
      if (profile.role === 'player') playerQuery = playerQuery.eq('profile_id', profile.id)

      const [p, a, l, d] = await Promise.all([
        playerQuery,
        supabase
          .from('order_players')
          .select('player_id, assigned_pay, calculated_pay, final_pay, completed_at, notes, orders(order_no, notes, customers(display_name), order_types(name))')
          .eq('status', 'completed')
          .gte('completed_at', isoStart(period.start))
          .lt('completed_at', isoStart(period.nextExclusive))
          .order('completed_at', { ascending: true }),
        supabase
          .from('ledger')
          .select('player_id, amount, description, occurred_at, type')
          .gte('occurred_at', isoStart(period.start))
          .lt('occurred_at', isoStart(period.nextExclusive))
          .order('occurred_at', { ascending: true }),
        supabase
          .from('orders')
          .select('dispatcher_id, dispatch_fee, completed_at, order_no, notes, customers(display_name), order_types(name)')
          .eq('status', 'completed')
          .gte('completed_at', isoStart(period.start))
          .lt('completed_at', isoStart(period.nextExclusive))
          .order('completed_at', { ascending: true })
      ])

      const firstError = p.error || a.error || l.error || d.error
      if (firstError) {
        setError(firstError.message)
      } else {
        const playerData = (p.data ?? []) as Player[]
        setPlayers(playerData)
        setAssignments((a.data ?? []) as unknown as Assignment[])
        setLedgerRows((l.data ?? []) as LedgerRow[])
        setDispatchOrders((d.data ?? []) as unknown as DispatchOrder[])
        if (profile.role === 'player' && playerData.length === 1) setExpandedPlayerId(playerData[0].id)
      }
      setLoading(false)
    }

    void load()
  }, [profile?.id, profile?.role])

  const summaries = useMemo<SettlementSummary[]>(() => {
    return players.map((player) => {
      const orderPay = assignments
        .filter((row) => row.player_id === player.id)
        .reduce((sum, row) => sum + Number(row.final_pay ?? row.calculated_pay ?? row.assigned_pay ?? 0), 0)

      const adjustments = ledgerRows
        .filter((row) => row.player_id === player.id)
        .reduce((sum, row) => sum + Number(row.amount || 0), 0)

      const dispatchPay = player.profile_id
        ? dispatchOrders
            .filter((order) => order.dispatcher_id === player.profile_id)
            .reduce((sum, order) => sum + Number(order.dispatch_fee || 0), 0)
        : 0

      return {
        player,
        orderPay,
        dispatchPay,
        adjustments,
        total: orderPay + dispatchPay + adjustments
      }
    })
  }, [players, assignments, ledgerRows, dispatchOrders])

  if (loading) {
    return <Screen><ActivityIndicator color={colors.accent} /></Screen>
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        <H1>薪資結算</H1>
        <Card>
          <H2>本期：{dateLabel(period.start)} → {dateLabel(period.end)}</H2>
          <Text style={styles.payout}>結算日：{dateLabel(period.payout)}</Text>
          <Muted>固定每月 1 號與 15 號結算。點打手卡片可以查看這一期的每一筆收入與加扣款。</Muted>
        </Card>

        {error ? <Card><Text style={styles.error}>讀取結算資料失敗：{error}</Text></Card> : null}

        {!error && summaries.length === 0 ? (
          <Card><Muted>目前沒有可顯示的打手資料。</Muted></Card>
        ) : null}

        {summaries.map((summary) => {
          const expanded = expandedPlayerId === summary.player.id
          const playerOrders = assignments.filter((row) => row.player_id === summary.player.id)
          const playerLedger = ledgerRows.filter((row) => row.player_id === summary.player.id)
          const playerDispatch = summary.player.profile_id
            ? dispatchOrders.filter((row) => row.dispatcher_id === summary.player.profile_id)
            : []

          return (
            <Card key={summary.player.id}>
              <TouchableOpacity onPress={() => setExpandedPlayerId(expanded ? null : summary.player.id)} activeOpacity={0.75}>
                <View style={styles.headerRow}>
                  <H2>{summary.player.display_name}</H2>
                  <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
                </View>
                <Line label="完單收入" value={summary.orderPay} />
                <Line label="派單收入" value={summary.dispatchPay} />
                <Line label="其他加扣" value={summary.adjustments} signed />
                <View style={styles.divider} />
                <Line label="本期應付" value={summary.total} total />
                {!expanded ? <Text style={styles.tapHint}>點擊查看每一筆</Text> : null}
              </TouchableOpacity>

              {expanded ? (
                <View style={styles.details}>
                  <DetailSection title={`完單明細（${playerOrders.length}）`} empty="這一期沒有完單收入。">
                    {playerOrders.map((row, index) => {
                      const pay = Number(row.final_pay ?? row.calculated_pay ?? row.assigned_pay ?? 0)
                      return (
                        <DetailRow
                          key={`${row.orders?.order_no ?? 'order'}-${index}`}
                          date={shortDate(row.completed_at)}
                          title={`${row.orders?.order_no ?? '訂單'} · ${serviceLabel(row.orders)}`}
                          subtitle={row.orders?.customers?.display_name ? `老闆：${row.orders.customers.display_name}` : undefined}
                          amount={money(pay)}
                        />
                      )
                    })}
                  </DetailSection>

                  <DetailSection title={`派單明細（${playerDispatch.length}）`} empty="這一期沒有派單收入。">
                    {playerDispatch.map((row, index) => (
                      <DetailRow
                        key={`${row.order_no}-${index}`}
                        date={shortDate(row.completed_at)}
                        title={`${row.order_no} · ${serviceLabel(row)}`}
                        subtitle={row.customers?.display_name ? `老闆：${row.customers.display_name}` : undefined}
                        amount={money(Number(row.dispatch_fee || 0))}
                      />
                    ))}
                  </DetailSection>

                  <DetailSection title={`加扣款明細（${playerLedger.length}）`} empty="這一期沒有其他加扣款。">
                    {playerLedger.map((row, index) => (
                      <DetailRow
                        key={`${row.occurred_at}-${index}`}
                        date={shortDate(row.occurred_at)}
                        title={row.description || ledgerTypeLabel(row.type)}
                        amount={signedMoney(Number(row.amount || 0))}
                        amountPositive={Number(row.amount || 0) > 0}
                        amountNegative={Number(row.amount || 0) < 0}
                      />
                    ))}
                  </DetailSection>
                </View>
              ) : null}
            </Card>
          )
        })}
      </Screen>
    </ScrollView>
  )
}

function ledgerTypeLabel(type: string) {
  const labels: Record<string, string> = {
    rental: '租號', compensation: '賠付', advance: '預支', topup: '儲值', deposit: '押金', bonus: '加雞腿', penalty: '罰錢', other: '其他'
  }
  return labels[type] || type
}

function DetailSection({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <View style={styles.detailSection}>
      <Text style={styles.detailTitle}>{title}</Text>
      {hasChildren ? children : <Muted>{empty}</Muted>}
    </View>
  )
}

function DetailRow({ date, title, subtitle, amount, amountPositive = false, amountNegative = false }: {
  date: string
  title: string
  subtitle?: string
  amount: string
  amountPositive?: boolean
  amountNegative?: boolean
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailDateBox}><Text style={styles.detailDate}>{date}</Text></View>
      <View style={styles.detailText}>
        <Text style={styles.detailName}>{title}</Text>
        {subtitle ? <Text style={styles.detailSubtitle}>{subtitle}</Text> : null}
      </View>
      <Text style={[styles.detailAmount, amountPositive && styles.positive, amountNegative && styles.negative]}>{amount}</Text>
    </View>
  )
}

function Line({ label, value, signed = false, total = false }: { label: string; value: number; signed?: boolean; total?: boolean }) {
  const shown = signed && value > 0 ? `+${money(value)}` : money(value)
  return (
    <View style={styles.line}>
      <Text style={[styles.label, total && styles.totalLabel]}>{label}</Text>
      <Text style={[styles.value, total && styles.total]}>{shown}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  payout: { color: colors.accent, fontWeight: '800', fontSize: 18 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chevron: { color: colors.accent, fontWeight: '900', fontSize: 16 },
  tapHint: { color: colors.accent, textAlign: 'center', marginTop: 8, fontWeight: '700', fontSize: 13 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  label: { color: colors.muted, fontSize: 15 },
  value: { color: colors.text, fontWeight: '700', fontSize: 16 },
  totalLabel: { color: colors.text, fontWeight: '800', fontSize: 17 },
  total: { color: colors.accent, fontSize: 24, fontWeight: '900' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 5 },
  details: { marginTop: 14, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  detailSection: { marginTop: 12 },
  detailTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 7 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailDateBox: { width: 42 },
  detailDate: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  detailText: { flex: 1 },
  detailName: { color: colors.text, fontWeight: '700', fontSize: 14 },
  detailSubtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
  detailAmount: { color: colors.text, fontWeight: '800', fontSize: 15 },
  positive: { color: '#6fdc8c' },
  negative: { color: '#ff8f8f' },
  error: { color: '#ff8f8f', fontWeight: '700' }
})
