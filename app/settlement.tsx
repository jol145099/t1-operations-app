import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'

import { Card, H1, H2, Muted, Screen, colors } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/AuthProvider'

type Player = { id: string; profile_id: string | null; display_name: string }
type Assignment = { player_id: string; assigned_pay: number | null; calculated_pay: number | null; final_pay: number | null }
type LedgerRow = { player_id: string; amount: number; description: string | null; occurred_at: string }
type DispatchOrder = { dispatcher_id: string | null; dispatch_fee: number | null }

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

function isoStart(date: Date) {
  return date.toISOString()
}

function money(value: number) {
  return `$${Math.ceil(Number(value || 0)).toLocaleString()}`
}

export default function SettlementScreen() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([])
  const [dispatchOrders, setDispatchOrders] = useState<DispatchOrder[]>([])

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
          .select('player_id, assigned_pay, calculated_pay, final_pay')
          .eq('status', 'completed')
          .gte('completed_at', isoStart(period.start))
          .lt('completed_at', isoStart(period.nextExclusive)),
        supabase
          .from('ledger')
          .select('player_id, amount, description, occurred_at')
          .gte('occurred_at', isoStart(period.start))
          .lt('occurred_at', isoStart(period.nextExclusive)),
        supabase
          .from('orders')
          .select('dispatcher_id, dispatch_fee')
          .eq('status', 'completed')
          .gte('completed_at', isoStart(period.start))
          .lt('completed_at', isoStart(period.nextExclusive))
      ])

      const firstError = p.error || a.error || l.error || d.error
      if (firstError) {
        setError(firstError.message)
      } else {
        setPlayers((p.data ?? []) as Player[])
        setAssignments((a.data ?? []) as Assignment[])
        setLedgerRows((l.data ?? []) as LedgerRow[])
        setDispatchOrders((d.data ?? []) as DispatchOrder[])
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
          <Muted>固定每月 1 號與 15 號結算。15 號結算當月 1–14 號；1 號結算上月 15 號到月底。</Muted>
        </Card>

        {error ? <Card><Text style={styles.error}>讀取結算資料失敗：{error}</Text></Card> : null}

        {!error && summaries.length === 0 ? (
          <Card><Muted>目前沒有可顯示的打手資料。</Muted></Card>
        ) : null}

        {summaries.map((summary) => (
          <Card key={summary.player.id}>
            <H2>{summary.player.display_name}</H2>
            <Line label="完單收入" value={summary.orderPay} />
            <Line label="派單收入" value={summary.dispatchPay} />
            <Line label="其他加扣" value={summary.adjustments} signed />
            <View style={styles.divider} />
            <Line label="本期應付" value={summary.total} total />
          </Card>
        ))}
      </Screen>
    </ScrollView>
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
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  label: { color: colors.muted, fontSize: 15 },
  value: { color: colors.text, fontWeight: '700', fontSize: 16 },
  totalLabel: { color: colors.text, fontWeight: '800', fontSize: 17 },
  total: { color: colors.accent, fontSize: 24, fontWeight: '900' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 5 },
  error: { color: '#ff8f8f', fontWeight: '700' }
})
