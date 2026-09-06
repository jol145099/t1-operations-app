import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native'

import { Button, Card, Field, H1, H2, Muted, Screen, colors } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/AuthProvider'

type OrderRow = {
  id: string
  order_no: string
  amount_paid: number
  status: string
  created_at: string
}

type AssignmentRow = {
  id: string
  order_id: string
  status: string
  assigned_pay: number
  games_played: number
  extracts: number
  orders: {
    id: string
    order_no: string
    amount_paid: number
    status: string
    created_at: string
  } | null
}

export default function OrdersScreen() {
  const { profile } = useAuth()
  const isPlayer = profile?.role === 'player'
  const [rows, setRows] = useState<OrderRow[]>([])
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [completionId, setCompletionId] = useState<string | null>(null)
  const [games, setGames] = useState('')
  const [extracts, setExtracts] = useState('')

  const load = useCallback(async () => {
    setLoading(true)

    if (isPlayer) {
      const { data: player, error: playerError } = await supabase
        .from('players')
        .select('id')
        .eq('profile_id', profile?.id)
        .maybeSingle()

      if (playerError) {
        Alert.alert('讀取失敗', playerError.message)
        setLoading(false)
        return
      }
      if (!player) {
        setAssignments([])
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('order_players')
        .select('id, order_id, status, assigned_pay, games_played, extracts, orders(id, order_no, amount_paid, status, created_at)')
        .eq('player_id', player.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) Alert.alert('讀取訂單失敗', error.message)
      else setAssignments((data ?? []) as unknown as AssignmentRow[])
    } else {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_no, amount_paid, status, created_at')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) Alert.alert('讀取訂單失敗', error.message)
      else setRows((data ?? []) as OrderRow[])
    }

    setLoading(false)
  }, [isPlayer, profile?.id])

  useEffect(() => {
    load()
  }, [load])

  async function acceptAssignment(item: AssignmentRow) {
    setBusyId(item.id)
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('order_players')
      .update({ status: 'accepted', accepted_at: now })
      .eq('id', item.id)

    if (error) {
      setBusyId(null)
      Alert.alert('接單失敗', error.message)
      return
    }

    await supabase
      .from('orders')
      .update({ status: 'in_progress', started_at: now })
      .eq('id', item.order_id)
      .eq('status', 'awaiting_player')

    setBusyId(null)
    await load()
  }

  async function completeAssignment(item: AssignmentRow) {
    const gamesNumber = Number(games)
    const extractsNumber = Number(extracts)

    if (!Number.isInteger(gamesNumber) || gamesNumber < 0 || !Number.isInteger(extractsNumber) || extractsNumber < 0) {
      Alert.alert('資料錯誤', '局數與撤離數請輸入 0 以上的整數。')
      return
    }
    if (extractsNumber > gamesNumber) {
      Alert.alert('資料錯誤', '撤離數不能大於總局數。')
      return
    }

    setBusyId(item.id)
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('order_players')
      .update({
        status: 'completed',
        completed_at: now,
        games_played: gamesNumber,
        extracts: extractsNumber,
        calculated_pay: Number(item.assigned_pay ?? 0),
        final_pay: Number(item.assigned_pay ?? 0)
      })
      .eq('id', item.id)

    if (error) {
      setBusyId(null)
      Alert.alert('結單失敗', error.message)
      return
    }

    const { data: remaining } = await supabase
      .from('order_players')
      .select('id')
      .eq('order_id', item.order_id)
      .neq('status', 'completed')
      .limit(1)

    if (!remaining?.length) {
      await supabase
        .from('orders')
        .update({ status: 'completed', completed_at: now })
        .eq('id', item.order_id)
    }

    setGames('')
    setExtracts('')
    setCompletionId(null)
    setBusyId(null)
    Alert.alert('結單完成', item.orders?.order_no ?? '')
    await load()
  }

  return (
    <Screen>
      <H1>{isPlayer ? '我的訂單' : '訂單'}</H1>
      <Muted>
        {isPlayer
          ? '查看派給你的訂單，接單後可填寫局數與撤離數完成結單。'
          : 'RLS 會依登入角色自動限制能看到的訂單。'}
      </Muted>

      {loading ? (
        <ActivityIndicator color={colors.accent} />
      ) : isPlayer ? (
        <FlatList
          data={assignments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: 10 }}
          ListEmptyComponent={<Muted>目前沒有派給你的訂單。</Muted>}
          renderItem={({ item }) => (
            <Card>
              <Text style={styles.orderNo}>{item.orders?.order_no ?? '訂單'}</Text>
              <Text style={styles.amount}>${Number(item.orders?.amount_paid ?? 0).toLocaleString()}</Text>
              <View style={styles.infoRow}>
                <Muted>狀態：{statusText(item.status)}</Muted>
                <Muted>預計分成：${Number(item.assigned_pay ?? 0).toLocaleString()}</Muted>
              </View>

              {item.status === 'assigned' ? (
                <Button
                  title={busyId === item.id ? '接單中…' : '接受訂單'}
                  onPress={() => acceptAssignment(item)}
                  disabled={busyId === item.id}
                />
              ) : null}

              {(item.status === 'accepted' || item.status === 'in_progress') && completionId !== item.id ? (
                <Button
                  title="開始結單"
                  tone="neutral"
                  onPress={() => {
                    setCompletionId(item.id)
                    setGames(item.games_played ? String(item.games_played) : '')
                    setExtracts(item.extracts ? String(item.extracts) : '')
                  }}
                />
              ) : null}

              {completionId === item.id ? (
                <View style={styles.completeBox}>
                  <H2>結單資料</H2>
                  <Field value={games} onChangeText={setGames} placeholder="總局數" keyboardType="numeric" />
                  <Field value={extracts} onChangeText={setExtracts} placeholder="撤離數" keyboardType="numeric" />
                  <Muted>目前先以報單時的預計分成作為最終薪資；下一階段會接入各單種自動計薪規則。</Muted>
                  <Button
                    title={busyId === item.id ? '送出中…' : '確認結單'}
                    onPress={() => completeAssignment(item)}
                    disabled={busyId === item.id}
                  />
                  <Button
                    title="取消"
                    tone="neutral"
                    onPress={() => {
                      setCompletionId(null)
                      setGames('')
                      setExtracts('')
                    }}
                  />
                </View>
              ) : null}

              {item.status === 'completed' ? (
                <Muted>已完成 · {item.games_played} 局 / {item.extracts} 撤離</Muted>
              ) : null}
            </Card>
          )}
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: 10 }}
          ListEmptyComponent={<Muted>目前沒有可顯示的訂單。</Muted>}
          renderItem={({ item }) => (
            <Card>
              <Text style={styles.orderNo}>{item.order_no}</Text>
              <Text style={styles.amount}>${Number(item.amount_paid).toLocaleString()}</Text>
              <Muted>{statusText(item.status)}</Muted>
            </Card>
          )}
        />
      )}
    </Screen>
  )
}

function statusText(status: string) {
  const labels: Record<string, string> = {
    draft: '草稿',
    awaiting_player: '等待打手',
    assigned: '待接單',
    accepted: '已接單',
    in_progress: '進行中',
    completed: '已完成',
    cancelled: '已取消',
    refunded: '已退款'
  }
  return labels[status] ?? status
}

const styles = StyleSheet.create({
  orderNo: { color: colors.text, fontWeight: '800', fontSize: 17 },
  amount: { color: colors.accent, fontWeight: '800', fontSize: 22 },
  infoRow: { gap: 4 },
  completeBox: {
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border
  }
})
