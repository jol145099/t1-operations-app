import { useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { Button, Card, Field, H1, H2, Muted, Screen, colors } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/AuthProvider'

type Customer = {
  id: string
  display_name: string
  aliases: string[] | null
}

type OrderType = {
  id: string
  name: string
  requires_player: boolean
  vip_eligible: boolean
}

type Player = {
  id: string
  display_name: string
}

type SelectedPlayer = {
  playerId: string
  playerName: string
  query: string
  pay: string
}

const emptyPlayer = (): SelectedPlayer => ({
  playerId: '',
  playerName: '',
  query: '',
  pay: ''
})

export default function NewOrderScreen() {
  const { profile } = useAuth()
  const allowed = profile?.role === 'staff' || profile?.role === 'admin'

  const [customers, setCustomers] = useState<Customer[]>([])
  const [orderTypes, setOrderTypes] = useState<OrderType[]>([])
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)

  const [customerId, setCustomerId] = useState('')
  const [customerQuery, setCustomerQuery] = useState('')
  const [orderTypeId, setOrderTypeId] = useState('')
  const [orderTypeQuery, setOrderTypeQuery] = useState('')
  const [amount, setAmount] = useState('')
  const [requiresPlayer, setRequiresPlayer] = useState(true)
  const [vipEligible, setVipEligible] = useState(true)
  const [players, setPlayers] = useState<SelectedPlayer[]>([emptyPlayer()])
  const [busy, setBusy] = useState(false)

  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [showAddPlayer, setShowAddPlayer] = useState<number | null>(null)
  const [newPlayerName, setNewPlayerName] = useState('')

  useEffect(() => {
    if (!allowed) return
    loadOptions()
  }, [allowed])

  async function loadOptions() {
    setLoadingOptions(true)
    const [customerResult, typeResult, playerResult] = await Promise.all([
      supabase
        .from('customers')
        .select('id, display_name, aliases')
        .eq('active', true)
        .order('display_name'),
      supabase
        .from('order_types')
        .select('id, name, requires_player, vip_eligible')
        .eq('active', true)
        .order('name'),
      supabase
        .from('players')
        .select('id, display_name')
        .eq('active', true)
        .order('display_name')
    ])

    setLoadingOptions(false)

    const error = customerResult.error || typeResult.error || playerResult.error
    if (error) {
      Alert.alert('讀取資料失敗', error.message)
      return
    }

    setCustomers((customerResult.data ?? []) as Customer[])
    setOrderTypes((typeResult.data ?? []) as OrderType[])
    setAllPlayers((playerResult.data ?? []) as Player[])
  }

  const customerMatches = useMemo(() => {
    const q = customerQuery.trim().toLowerCase()
    if (!q || customerId) return []
    return customers
      .filter((customer) => {
        const names = [customer.display_name, ...(customer.aliases ?? [])]
        return names.some((name) => name.toLowerCase().includes(q))
      })
      .slice(0, 8)
  }, [customerQuery, customerId, customers])

  const orderTypeMatches = useMemo(() => {
    const q = orderTypeQuery.trim().toLowerCase()
    if (!q || orderTypeId) return []
    return orderTypes.filter((type) => type.name.toLowerCase().includes(q)).slice(0, 8)
  }, [orderTypeQuery, orderTypeId, orderTypes])

  function playerMatches(query: string, index: number) {
    const q = query.trim().toLowerCase()
    if (!q || players[index]?.playerId) return []
    const alreadySelected = new Set(
      players.filter((_, i) => i !== index).map((player) => player.playerId).filter(Boolean)
    )
    return allPlayers
      .filter(
        (player) =>
          !alreadySelected.has(player.id) && player.display_name.toLowerCase().includes(q)
      )
      .slice(0, 8)
  }

  function chooseCustomer(customer: Customer) {
    setCustomerId(customer.id)
    setCustomerQuery(customer.display_name)
  }

  function chooseOrderType(type: OrderType) {
    setOrderTypeId(type.id)
    setOrderTypeQuery(type.name)
    setRequiresPlayer(type.requires_player)
    setVipEligible(type.vip_eligible)
    if (!type.requires_player) setPlayers([emptyPlayer()])
  }

  function choosePlayer(index: number, player: Player) {
    setPlayers((current) =>
      current.map((item, i) =>
        i === index
          ? { ...item, playerId: player.id, playerName: player.display_name, query: player.display_name }
          : item
      )
    )
  }

  async function addCustomer() {
    const name = newCustomerName.trim()
    if (!name) return

    const { data, error } = await supabase
      .from('customers')
      .insert({ display_name: name })
      .select('id, display_name, aliases')
      .single()

    if (error || !data) {
      Alert.alert('新增老闆失敗', error?.message ?? 'Unable to add customer')
      return
    }

    const customer = data as Customer
    setCustomers((current) => [...current, customer].sort((a, b) => a.display_name.localeCompare(b.display_name)))
    chooseCustomer(customer)
    setNewCustomerName('')
    setShowAddCustomer(false)
  }

  async function addPlayer(index: number) {
    const name = newPlayerName.trim()
    if (!name) return

    const { data, error } = await supabase
      .from('players')
      .insert({ display_name: name })
      .select('id, display_name')
      .single()

    if (error || !data) {
      Alert.alert('新增打手失敗', error?.message ?? 'Unable to add player')
      return
    }

    const player = data as Player
    setAllPlayers((current) => [...current, player].sort((a, b) => a.display_name.localeCompare(b.display_name)))
    choosePlayer(index, player)
    setNewPlayerName('')
    setShowAddPlayer(null)
  }

  async function submit() {
    if (!allowed) return

    const numericAmount = Number(amount)
    if (!customerId || !orderTypeId || !amount.trim()) {
      Alert.alert('資料不足', '請選擇老闆、單種並填寫訂單金額。')
      return
    }
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      Alert.alert('金額錯誤', '請輸入有效的訂單金額。')
      return
    }

    if (requiresPlayer) {
      if (players.length === 0 || players.some((player) => !player.playerId)) {
        Alert.alert('資料不足', '需要打手的訂單請先選擇所有打手。')
        return
      }
      const ids = players.map((player) => player.playerId)
      if (new Set(ids).size !== ids.length) {
        Alert.alert('打手重複', '同一張訂單不能重複加入同一位打手。')
        return
      }
      if (
        players.some(
          (player) => player.pay.trim() && (!Number.isFinite(Number(player.pay)) || Number(player.pay) < 0)
        )
      ) {
        Alert.alert('分成錯誤', '請輸入有效的打手分成。')
        return
      }
    }

    setBusy(true)

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: customerId,
        order_type_id: orderTypeId,
        amount_paid: numericAmount,
        vip_eligible_amount: vipEligible ? numericAmount : 0,
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
      const assignments = players.map((player) => ({
        order_id: order.id,
        player_id: player.playerId,
        assigned_pay: player.pay.trim() ? Number(player.pay) : 0,
        status: 'assigned'
      }))

      const { error: playerError } = await supabase.from('order_players').insert(assignments)
      if (playerError) {
        setBusy(false)
        Alert.alert('訂單已建立，但打手指派失敗', `${order.order_no}\n${playerError.message}`)
        return
      }
    }

    setBusy(false)
    Alert.alert('報單完成', order.order_no)
    setCustomerId('')
    setCustomerQuery('')
    setOrderTypeId('')
    setOrderTypeQuery('')
    setAmount('')
    setRequiresPlayer(true)
    setVipEligible(true)
    setPlayers([emptyPlayer()])
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
          <Muted>{loadingOptions ? '正在讀取老闆、單種與打手…' : '直接搜尋名稱，不需要再輸入 UUID。'}</Muted>

          <Text style={styles.label}>老闆</Text>
          <Field
            value={customerQuery}
            onChangeText={(value) => {
              setCustomerQuery(value)
              setCustomerId('')
            }}
            placeholder="搜尋老闆名稱 / 別名"
          />
          {customerMatches.map((customer) => (
            <OptionRow key={customer.id} title={customer.display_name} onPress={() => chooseCustomer(customer)} />
          ))}
          {customerId ? <SelectedText text={`✓ 已選：${customerQuery}`} /> : null}

          <Button title={showAddCustomer ? '取消新增老闆' : '＋ 新增老闆'} tone="neutral" onPress={() => setShowAddCustomer((value) => !value)} />
          {showAddCustomer && (
            <View style={styles.inlineBox}>
              <Field value={newCustomerName} onChangeText={setNewCustomerName} placeholder="新老闆名稱" />
              <Button title="建立並選擇" onPress={addCustomer} />
            </View>
          )}

          <Text style={styles.label}>單種</Text>
          <Field
            value={orderTypeQuery}
            onChangeText={(value) => {
              setOrderTypeQuery(value)
              setOrderTypeId('')
            }}
            placeholder="搜尋單種"
          />
          {orderTypeMatches.map((type) => (
            <OptionRow
              key={type.id}
              title={type.name}
              subtitle={type.requires_player ? '需要打手結單' : '直接報單'}
              onPress={() => chooseOrderType(type)}
            />
          ))}
          {orderTypeId ? (
            <SelectedText text={`✓ ${orderTypeQuery} · ${requiresPlayer ? '需要打手' : '直接報單'}`} />
          ) : null}

          <Text style={styles.label}>訂單金額</Text>
          <Field value={amount} onChangeText={setAmount} placeholder="例如 2400" keyboardType="numeric" />
        </Card>

        {requiresPlayer && orderTypeId ? (
          <Card>
            <H2>打手</H2>
            <Muted>同一張訂單可以加入多位打手，但老闆消費只會計算一次。</Muted>

            {players.map((player, index) => {
              const matches = playerMatches(player.query, index)
              return (
                <View key={index} style={styles.playerBox}>
                  <Text style={styles.label}>打手 {index + 1}</Text>
                  <Field
                    value={player.query}
                    onChangeText={(value) =>
                      setPlayers((current) =>
                        current.map((item, i) =>
                          i === index ? { ...item, query: value, playerId: '', playerName: '' } : item
                        )
                      )
                    }
                    placeholder="搜尋打手名稱"
                  />
                  {matches.map((match) => (
                    <OptionRow key={match.id} title={match.display_name} onPress={() => choosePlayer(index, match)} />
                  ))}
                  {player.playerId ? <SelectedText text={`✓ 已選：${player.playerName}`} /> : null}

                  <Field
                    value={player.pay}
                    onChangeText={(value) =>
                      setPlayers((current) =>
                        current.map((item, i) => (i === index ? { ...item, pay: value } : item))
                      )
                    }
                    placeholder="預計分成（可先留 0）"
                    keyboardType="numeric"
                  />

                  <Button
                    title={showAddPlayer === index ? '取消新增打手' : '＋ 新增打手資料'}
                    tone="neutral"
                    onPress={() => {
                      setShowAddPlayer(showAddPlayer === index ? null : index)
                      setNewPlayerName('')
                    }}
                  />
                  {showAddPlayer === index && (
                    <View style={styles.inlineBox}>
                      <Field value={newPlayerName} onChangeText={setNewPlayerName} placeholder="新打手名稱" />
                      <Button title="建立並選擇" onPress={() => addPlayer(index)} />
                    </View>
                  )}

                  {players.length > 1 && (
                    <Button
                      title="移除此打手"
                      tone="danger"
                      onPress={() => setPlayers((current) => current.filter((_, i) => i !== index))}
                    />
                  )}
                </View>
              )
            })}

            <Button title="＋ 再加一位打手" tone="neutral" onPress={() => setPlayers((current) => [...current, emptyPlayer()])} />
          </Card>
        ) : null}

        {orderTypeId && !requiresPlayer ? (
          <Card>
            <H2>直接報單</H2>
            <Muted>此單種不需要打手，送出後會直接完成並計入老闆消費。</Muted>
          </Card>
        ) : null}

        <Button title={busy ? '送出中…' : '送出報單'} onPress={submit} disabled={busy || loadingOptions} />
      </Screen>
    </ScrollView>
  )
}

function OptionRow({ title, subtitle, onPress }: { title: string; subtitle?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.optionRow}>
      <Text style={styles.optionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.optionSubtitle}>{subtitle}</Text> : null}
    </Pressable>
  )
}

function SelectedText({ text }: { text: string }) {
  return <Text style={styles.selected}>{text}</Text>
}

const styles = StyleSheet.create({
  playerBox: {
    gap: 8,
    paddingBottom: 16,
    borderBottomColor: colors.border,
    borderBottomWidth: 1
  },
  inlineBox: {
    gap: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.panel2
  },
  label: {
    color: colors.text,
    fontWeight: '700'
  },
  optionRow: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel2,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3
  },
  optionTitle: {
    color: colors.text,
    fontWeight: '700'
  },
  optionSubtitle: {
    color: colors.muted,
    fontSize: 13
  },
  selected: {
    color: colors.success,
    fontWeight: '700'
  }
})
