import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'

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
  is_active_slot: boolean
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
  const { status } = useLocalSearchParams<{ status?: string }>()
  const isPlayer = profile?.role === 'player'
  const [rows, setRows] = useState<OrderRow[]>([])
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [completionId, setCompletionId] = useState<string | null>(null)
  const [completeDate, setCompleteDate] = useState(todayLocal())

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
        .select('id, order_id, status, assigned_pay, games_played, extracts, is_active_slot, orders(id, order_no, amount_paid, status, created_at)')
        .eq('player_id', player.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) Alert.alert('讀取訂單失敗', error.message)
      else setAssignments((data ?? []) as unknown as AssignmentRow[])
    } else {
      let query = supabase.from('orders').select('id, order_no, amount_paid, status, created_at').order('created_at', { ascending: false }).limit(50)
      if (status) query = query.eq('status', status)
      const { data, error } = await query

      if (error) Alert.alert('讀取訂單失敗', error.message)
      else setRows((data ?? []) as OrderRow[])
    }

    setLoading(false)
  }, [isPlayer, profile?.id, status])

  useFocusEffect(useCallback(() => { load() }, [load]))

  async function deleteOrder(item: OrderRow) {
    if (busyId) return
    setBusyId(item.id)
    const { error } = await supabase.rpc('delete_t1_order', { p_order_id: item.id })
    setBusyId(null)
    if (error) {
      Alert.alert('刪除失敗', error.message)
      return
    }
    Alert.alert('已刪除', item.order_no)
    await load()
  }

  async function completeOrder(item: AssignmentRow) {
    if (!item.is_active_slot) return
    if (!completeDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('日期格式錯誤', '請使用 YYYY-MM-DD。')
      return
    }
    setBusyId(item.id)
    const { error } = await supabase.rpc('complete_t1_order', {
      p_order_id: item.order_id,
      p_completed_date: completeDate
    })
    setBusyId(null)
    if (error) Alert.alert('結單失敗', error.message)
    else {
      setCompletionId(null)
      setCompleteDate(todayLocal())
      Alert.alert('結單完成', item.orders?.order_no ?? '')
      await load()
    }
  }

  return (
    <Screen>
      <H1>{isPlayer ? '我的訂單' : status === 'in_progress' ? '進行中訂單' : '所有訂單'}</H1>
      <Muted>
        {isPlayer
          ? '目前現役打手可以直接結整張單；被換下的打手只能查看紀錄。'
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
              {item.is_active_slot && item.orders?.status !== 'completed' && completionId !== item.id ? (
                <Button
                  title="開始結單"
                  tone="neutral"
                  onPress={() => {
                    setCompletionId(item.id)
                    setCompleteDate(todayLocal())
                  }}
                />
              ) : null}

              {completionId === item.id ? (
                <View style={styles.completeBox}>
                  <H2>結單資料</H2>
                  <Field value={completeDate} onChangeText={setCompleteDate} placeholder="YYYY-MM-DD" />
                  <Muted>只有目前仍在做這張單的打手可以結單。送出後會一次完成整張訂單，日期預設今天。</Muted>
                  <Button
                    title={busyId === item.id ? '送出中…' : '確認結單'}
                    onPress={() => completeOrder(item)}
                    disabled={busyId === item.id}
                  />
                  <Button
                    title="取消"
                    tone="neutral"
                    onPress={() => {
                      setCompletionId(null)
                      setCompleteDate(todayLocal())
                    }}
                  />
                </View>
              ) : null}

              {item.status === 'completed' ? (
                <Muted>已完成</Muted>
              ) : null}

              {!item.is_active_slot && item.status !== 'completed' ? (
                <Muted>已換人 · 此打手不能結單</Muted>
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
            <Pressable onPress={() => router.push({ pathname: '/order-detail', params: { orderId: item.id, orderNo: item.order_no } })}>
            <Card>
              <Text style={styles.orderNo}>{item.order_no}</Text>
              <Text style={styles.amount}>${Number(item.amount_paid).toLocaleString()}</Text>
              <Muted>{statusText(item.status)} · 點擊查看打手／換人</Muted>
              {(profile?.role === 'staff' || profile?.role === 'admin') ? (
                <Button title={busyId === item.id ? '刪除中…' : '刪除訂單'} tone="danger" onPress={() => deleteOrder(item)} disabled={busyId === item.id} />
              ) : null}
            </Card>
            </Pressable>
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

function todayLocal(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
