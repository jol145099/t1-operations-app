import { useEffect, useMemo, useState } from 'react'
import { router } from 'expo-router'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { Button, Card, H1, H2, Muted, Screen, colors } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/AuthProvider'

type Player = { id: string; profile_id: string | null; display_name: string }
type Assignment = { player_id: string; assigned_pay: number | null; calculated_pay: number | null; final_pay: number | null }
type LedgerRow = { player_id: string; amount: number }
type DispatchOrder = { dispatcher_id: string | null; dispatch_fee: number | null }
type SettlementRow = { id: string; player_id: string; order_pay: number; dispatch_pay: number; adjustments: number; total_payable: number; payment_status: 'unpaid' | 'partial' | 'paid'; amount_paid: number; paid_at: string | null }
type SettlementSummary = { player: Player; orderPay: number; dispatchPay: number; adjustments: number; total: number; saved?: SettlementRow }
type Period = { start: Date; end: Date; nextExclusive: Date; payout: Date }

function localDate(year: number, month: number, day: number) { return new Date(year, month, day, 0, 0, 0, 0) }

function currentSettlementPeriod(now = new Date()): Period {
  const y = now.getFullYear(); const m = now.getMonth(); const d = now.getDate()
  if (d === 1) return { start: localDate(y, m - 1, 16), end: localDate(y, m, 1), nextExclusive: localDate(y, m, 2), payout: localDate(y, m, 1) }
  if (d <= 15) return { start: localDate(y, m, 2), end: localDate(y, m, 15), nextExclusive: localDate(y, m, 16), payout: localDate(y, m, 15) }
  return { start: localDate(y, m, 16), end: localDate(y, m + 1, 1), nextExclusive: localDate(y, m + 1, 2), payout: localDate(y, m + 1, 1) }
}

function dateLabel(date: Date) { return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}` }
function isoStart(date: Date) { return date.toISOString() }
function dateOnly(date: Date) { const y = date.getFullYear(); const m = `${date.getMonth() + 1}`.padStart(2, '0'); const d = `${date.getDate()}`.padStart(2, '0'); return `${y}-${m}-${d}` }
function money(value: number) { return `$${Math.ceil(Number(value || 0)).toLocaleString()}` }
function statusLabel(status?: SettlementRow['payment_status']) { return status === 'paid' ? '已付款' : status === 'partial' ? '部分付款' : '待付款' }

export default function SettlementScreen() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState('')
  const [players, setPlayers] = useState<Player[]>([]); const [assignments, setAssignments] = useState<Assignment[]>([]); const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([]); const [dispatchOrders, setDispatchOrders] = useState<DispatchOrder[]>([]); const [savedSettlements, setSavedSettlements] = useState<SettlementRow[]>([])
  const period = useMemo(() => currentSettlementPeriod(), [])
  const canManage = profile?.role === 'staff' || profile?.role === 'admin'

  async function load() {
    if (!profile) return
    setLoading(true); setError('')
    let playerQuery = supabase.from('players').select('id, profile_id, display_name').eq('active', true).order('display_name')
    if (profile.role === 'player') playerQuery = playerQuery.eq('profile_id', profile.id)
    const [p, a, l, d, s] = await Promise.all([
      playerQuery,
      supabase.from('order_players').select('player_id, assigned_pay, calculated_pay, final_pay').eq('status', 'completed').gte('completed_at', isoStart(period.start)).lt('completed_at', isoStart(period.nextExclusive)),
      supabase.from('ledger').select('player_id, amount').gte('occurred_at', isoStart(period.start)).lt('occurred_at', isoStart(period.nextExclusive)),
      supabase.from('orders').select('dispatcher_id, dispatch_fee').eq('status', 'completed').gte('completed_at', isoStart(period.start)).lt('completed_at', isoStart(period.nextExclusive)),
      supabase.from('settlements').select('id, player_id, order_pay, dispatch_pay, adjustments, total_payable, payment_status, amount_paid, paid_at').eq('period_start', dateOnly(period.start)).eq('period_end', dateOnly(period.end))
    ])
    const firstError = p.error || a.error || l.error || d.error || s.error
    if (firstError) setError(firstError.message)
    else { setPlayers((p.data ?? []) as Player[]); setAssignments((a.data ?? []) as Assignment[]); setLedgerRows((l.data ?? []) as LedgerRow[]); setDispatchOrders((d.data ?? []) as DispatchOrder[]); setSavedSettlements((s.data ?? []) as SettlementRow[]) }
    setLoading(false)
  }

  useEffect(() => { void load() }, [profile?.id, profile?.role])

  const summaries = useMemo<SettlementSummary[]>(() => players.map((player) => {
    const saved = savedSettlements.find((row) => row.player_id === player.id)
    if (saved) return { player, orderPay: Number(saved.order_pay || 0), dispatchPay: Number(saved.dispatch_pay || 0), adjustments: Number(saved.adjustments || 0), total: Number(saved.total_payable || 0), saved }
    const orderPay = assignments.filter((row) => row.player_id === player.id).reduce((sum, row) => sum + Number(row.final_pay ?? row.calculated_pay ?? row.assigned_pay ?? 0), 0)
    const adjustments = ledgerRows.filter((row) => row.player_id === player.id).reduce((sum, row) => sum + Number(row.amount || 0), 0)
    const dispatchPay = player.profile_id ? dispatchOrders.filter((order) => order.dispatcher_id === player.profile_id).reduce((sum, order) => sum + Number(order.dispatch_fee || 0), 0) : 0
    return { player, orderPay, dispatchPay, adjustments, total: orderPay + dispatchPay + adjustments }
  }), [players, assignments, ledgerRows, dispatchOrders, savedSettlements])

  async function confirmSettlement(summary: SettlementSummary) {
    if (!canManage || summary.saved) return
    setSaving(true)
    const { error: saveError } = await supabase.from('settlements').insert({ player_id: summary.player.id, period_start: dateOnly(period.start), period_end: dateOnly(period.end), order_pay: summary.orderPay, dispatch_pay: summary.dispatchPay, adjustments: summary.adjustments, total_payable: summary.total, payment_status: 'unpaid', amount_paid: 0 })
    setSaving(false)
    if (saveError) return Alert.alert('確認失敗', saveError.message)
    await load()
  }

  async function markPaid(summary: SettlementSummary) {
    if (!canManage || !summary.saved || summary.saved.payment_status === 'paid') return
    setSaving(true)
    const { error: payError } = await supabase.from('settlements').update({ payment_status: 'paid', amount_paid: summary.total, paid_at: new Date().toISOString() }).eq('id', summary.saved.id)
    setSaving(false)
    if (payError) return Alert.alert('付款更新失敗', payError.message)
    await load()
  }

  function openDetails(summary: SettlementSummary) { router.push({ pathname: '/settlement-detail', params: { playerId: summary.player.id, playerName: summary.player.display_name, start: period.start.toISOString(), end: period.end.toISOString(), nextExclusive: period.nextExclusive.toISOString() } }) }
  if (loading) return <Screen><ActivityIndicator color={colors.accent} /></Screen>

  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ flexGrow: 1 }}><Screen>
    <H1>薪資結算</H1>
    <Card><H2>本期：{dateLabel(period.start)} → {dateLabel(period.end)}</H2><Text style={styles.payout}>結算日：{dateLabel(period.payout)}</Text><Muted>固定每月 1 號與 15 號結算，結算日當天也包含在本期。</Muted></Card>
    {error ? <Card><Text style={styles.error}>讀取結算資料失敗：{error}</Text></Card> : null}
    {!error && summaries.length === 0 ? <Card><Muted>目前沒有可顯示的打手資料。</Muted></Card> : null}
    {summaries.map((summary) => <View key={summary.player.id}>
      <TouchableOpacity onPress={() => openDetails(summary)} activeOpacity={0.75}><Card>
        <View style={styles.headerRow}><H2>{summary.player.display_name}</H2>{summary.saved ? <Text style={[styles.status, summary.saved.payment_status === 'paid' && styles.paid]}>{statusLabel(summary.saved.payment_status)}</Text> : <Text style={styles.live}>即時計算</Text>}</View>
        <Line label="完單收入" value={summary.orderPay} /><Line label="派單收入" value={summary.dispatchPay} /><Line label="其他加扣" value={summary.adjustments} signed /><View style={styles.divider} /><Line label="本期應付" value={summary.total} total />
        {summary.saved?.paid_at ? <Muted>付款時間：{new Date(summary.saved.paid_at).toLocaleString()}</Muted> : null}
      </Card></TouchableOpacity>
      {canManage ? <View style={styles.actions}>{!summary.saved ? <Button title="確認結算" onPress={() => void confirmSettlement(summary)} disabled={saving} /> : summary.saved.payment_status !== 'paid' ? <Button title={`標記已付款 ${money(summary.total)}`} onPress={() => void markPaid(summary)} disabled={saving} /> : null}</View> : null}
    </View>)}
  </Screen></ScrollView>
}

function Line({ label, value, signed = false, total = false }: { label: string; value: number; signed?: boolean; total?: boolean }) { const shown = signed && value > 0 ? `+${money(value)}` : money(value); return <View style={styles.line}><Text style={[styles.label, total && styles.totalLabel]}>{label}</Text><Text style={[styles.value, total && styles.total]}>{shown}</Text></View> }

const styles = StyleSheet.create({
  payout: { color: colors.accent, fontWeight: '800', fontSize: 18 }, headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  status: { color: '#ffd37a', fontWeight: '800', fontSize: 13 }, paid: { color: colors.success }, live: { color: colors.muted, fontWeight: '700', fontSize: 13 }, actions: { marginTop: -6, marginBottom: 8 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, label: { color: colors.muted, fontSize: 15 }, value: { color: colors.text, fontWeight: '700', fontSize: 16 }, totalLabel: { color: colors.text, fontWeight: '800', fontSize: 17 }, total: { color: colors.accent, fontSize: 24, fontWeight: '900' }, divider: { height: 1, backgroundColor: colors.border, marginVertical: 5 }, error: { color: '#ff8f8f', fontWeight: '700' }
})
