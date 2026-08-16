import { useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'

import { Button, Card, Field, H1, H2, Muted, Screen, colors } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/AuthProvider'

type SelectedPlayer = {
  playerId: string
  playerName: string
  pay: string
}

export default function NewOrderScreen() {
  const { profile } = useAuth()
  const [customerId, setCustomerId] = useState('')
  const [orderTypeId, setOrderTypeId] = useState('')
  const [amount, setAmount] = useState('')
  const [requiresPlayer, setRequiresPlayer] = useState(true)
  const [players, setPlayers] = useState<SelectedPlayer[]>([
    { playerId: '', playerName: '', pay: '' }
  ])
  const [busy, setBusy] = useState(false)

  const allowed = profile?.role === 'staff' || profile?.role === 'admin'

  async function submit() {
    if (!allowed) return
    if (!customerId || !orderTypeId || !amount) {
      Alert.alert('資料不足', '請至少填 Customer ID、Order Type ID 與訂單金額。')
      return
    }
    if (requiresPlayer && players.some((p) => !p.playerId)) {
      Alert.alert('資料不足', '需要打手的訂單至少要有一位有效 Player ID。')
      return
    }

    setBusy(true)

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: customerId.trim(),
        order_type_id: orderTypeId.trim(),
        amount_paid: Number(amount),
        vip_eligible_amount: Number(amount),
        requires_player: requiresPlayer,
        created_by: profile?.id,
        status: requiresPlayer ? 'awaiting_player' : 'completed',
        completed_at: requiresPlayer ? null : new Date().toISOString()
      })
      .select('id, order_no')
      .single()

    if (orderError || !order) {
      setBusy(false)
      Alert.alert('報單失敗', orderError?.message ?? 'Unable to create order')
      return
    }

    if (requiresPlayer) {
      const assignments = players
        .filter((p) => p.playerId)
        .map((p) => ({
          order_id: order.id,
          player_id: p.playerId.trim(),
          assigned_pay: p.pay ? Number(p.pay) : 0,
          status: 'assigned'
        }))

      const { error: playerError } = await supabase.from('order_players').insert(assignments)
      if (playerError) {
        setBusy(false)
        Alert.alert(
          '訂單已建立，但打手指派失敗',
          `${order.order_no}\n${playerError.message}`
        )
        return
      }
    }

    setBusy(false)
    Alert.alert('報單完成', order.order_no)
    setCustomerId('')
    setOrderTypeId('')
    setAmount('')
    setPlayers([{ playerId: '', playerName: '', pay: '' }])
  }

  if (!allowed) {
    return (
      <Screen>
        <H1>新增報單</H1>
        <Card>
          <H2>沒有權限</H2>
          <Muted>只有客服與店長/Admin 可以建立訂單。</Muted>
        </Card>
      </Screen>
    )
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        <H1>新增報單</H1>

        <Card>
          <H2>訂單資料</H2>
          <Muted>
            第一版先使用 ID 輸入。下一版會改成可搜尋的老闆、單種與打手下拉選單。
          </Muted>
          <Field value={customerId} onChangeText={setCustomerId} placeholder="Customer ID (UUID)" />
          <Field value={orderTypeId} onChangeText={setOrderTypeId} placeholder="Order Type ID (UUID)" />
          <Field
            value={amount}
            onChangeText={setAmount}
            placeholder="訂單金額"
            keyboardType="numeric"
          />

          <View style={styles.toggleRow}>
            <Text style={styles.label}>需要打手審核 / 結單？</Text>
            <Button
              title={requiresPlayer ? '需要' : '直接報單'}
              tone={requiresPlayer ? 'accent' : 'neutral'}
              onPress={() => setRequiresPlayer((v) => !v)}
            />
          </View>
        </Card>

        {requiresPlayer && (
          <Card>
            <H2>打手</H2>
            {players.map((player, index) => (
              <View key={index} style={styles.playerBox}>
                <Field
                  value={player.playerId}
                  onChangeText={(value) =>
                    setPlayers((current) =>
                      current.map((p, i) => (i === index ? { ...p, playerId: value } : p))
                    )
                  }
                  placeholder={`打手 ${index + 1} Player ID`}
                />
                <Field
                  value={player.pay}
                  onChangeText={(value) =>
                    setPlayers((current) =>
                      current.map((p, i) => (i === index ? { ...p, pay: value } : p))
                    )
                  }
                  placeholder="預計分成（可先留 0）"
                  keyboardType="numeric"
                />
                {players.length > 1 && (
                  <Button
                    title="移除此打手"
                    tone="danger"
                    onPress={() =>
                      setPlayers((current) => current.filter((_, i) => i !== index))
                    }
                  />
                )}
              </View>
            ))}
            <Button
              title="＋ 新增打手"
              tone="neutral"
              onPress={() =>
                setPlayers((current) => [
                  ...current,
                  { playerId: '', playerName: '', pay: '' }
                ])
              }
            />
          </Card>
        )}

        <Button title={busy ? '送出中…' : '送出報單'} onPress={submit} disabled={busy} />
      </Screen>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  playerBox: {
    gap: 8,
    paddingBottom: 12,
    borderBottomColor: colors.border,
    borderBottomWidth: 1
  },
  toggleRow: {
    gap: 10
  },
  label: {
    color: colors.text,
    fontWeight: '700'
  }
})
