import { useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { Button, Card, Field, H1, H2, Muted, Screen, colors } from '@/components/ui'
import {
  COLLISION_PRICE,
  ENTERTAINMENT_OPTIONS,
  GUARANTEE_PRICE,
  RUN_KNIFE_PRICE,
  SERVICE_GROUPS,
  TOPUP_OPTIONS,
  EntertainmentType,
  HourlyMode,
  Rank,
  Secrecy,
  ServiceCategory,
  bravePricing,
  ceilMoney,
  defaultDispatchRate,
  entertainmentPricing,
  femalePurePricing,
  femaleTechPricing,
  guaranteePricing,
  hourlyPricing,
  shouldRequirePlayers,
  teachingPricing,
  trialPricing
} from '@/lib/pricing'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/AuthProvider'

type Customer = { id: string; display_name: string; aliases: string[] | null }
type Player = { id: string; display_name: string }
type Dispatcher = { id: string; display_name: string; role: string }
type OrderType = { id: string; name: string; requires_player: boolean }
type PlayerSlot = { playerId: string; playerName: string; rank: Rank; pay: string }

type SearchItem = { id: string; label: string; searchText?: string }

const RANKS: Rank[] = ['B', 'A', 'S', 'SR']
const SECRECY: Secrecy[] = ['機密', '絕密']
const ENTERTAINMENT_TYPES = Object.keys(ENTERTAINMENT_OPTIONS) as EntertainmentType[]

function todayLocal() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function blankSlot(rank: Rank = 'B'): PlayerSlot {
  return { playerId: '', playerName: '', rank, pay: '' }
}

export default function NewOrderScreen() {
  const { profile } = useAuth()
  const allowed = profile?.role === 'staff' || profile?.role === 'admin'

  const [customers, setCustomers] = useState<Customer[]>([])
  const [playersList, setPlayersList] = useState<Player[]>([])
  const [dispatchers, setDispatchers] = useState<Dispatcher[]>([])
  const [orderTypes, setOrderTypes] = useState<OrderType[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [category, setCategory] = useState<ServiceCategory>('小時單')
  const [orderDate, setOrderDate] = useState(todayLocal())
  const [customerId, setCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerQuery, setCustomerQuery] = useState('')
  const [dispatcherId, setDispatcherId] = useState('')
  const [dispatcherName, setDispatcherName] = useState('')
  const [dispatcherRole, setDispatcherRole] = useState('')
  const [dispatchPct, setDispatchPct] = useState('5')
  const [amount, setAmount] = useState('0')
  const [systemAmount, setSystemAmount] = useState(0)
  const [amountManual, setAmountManual] = useState(false)
  const [slots, setSlots] = useState<PlayerSlot[]>([blankSlot()])
  const [playerQueries, setPlayerQueries] = useState<Record<number, string>>({})

  const [secrecy, setSecrecy] = useState<Secrecy>('機密')
  const [hours, setHours] = useState('1')
  const [hourlyMode, setHourlyMode] = useState<HourlyMode>('單陪')
  const [guaranteeTier, setGuaranteeTier] = useState<'1000w' | '3000w' | '5000w'>('1000w')
  const [trialPeriod, setTrialPeriod] = useState<'每日' | '每週'>('每日')
  const [femaleMode, setFemaleMode] = useState<'女+技術陪' | '純女陪'>('女+技術陪')
  const [femalePureMode, setFemalePureMode] = useState<'單陪' | '雙陪'>('單陪')
  const [femaleTechRank, setFemaleTechRank] = useState<Rank>('B')
  const [entertainmentType, setEntertainmentType] = useState<EntertainmentType>('賭紅單')
  const [entertainmentOption, setEntertainmentOption] = useState('出1紅')
  const [runTier, setRunTier] = useState<'1000w' | '5000w' | '1e' | '自訂'>('1000w')
  const [collisionTier, setCollisionTier] = useState<'1000w' | '1500w' | '3000w' | '5000w' | '1e' | '自訂'>('1000w')
  const [simpleDetail, setSimpleDetail] = useState('')
  const [identityMode, setIdentityMode] = useState<'實名' | '強改綁'>('實名')
  const [seasonMode, setSeasonMode] = useState<'台服' | '陸服' | '部分/造型'>('台服')
  const [topupIndex, setTopupIndex] = useState<number | null>(0)
  const [topupRmb, setTopupRmb] = useState('6')
  const [responsible, setResponsible] = useState('')
  const [customNeedsPlayers, setCustomNeedsPlayers] = useState(false)

  const [customerOpen, setCustomerOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [dispatcherOpen, setDispatcherOpen] = useState(false)
  const [playerOpen, setPlayerOpen] = useState<number | null>(null)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [newCustomer, setNewCustomer] = useState('')
  const [showAddPlayer, setShowAddPlayer] = useState<number | null>(null)
  const [newPlayer, setNewPlayer] = useState('')

  useEffect(() => {
    if (!allowed) return
    void loadOptions()
  }, [allowed])

  async function loadOptions() {
    setLoading(true)
    const [c, p, d, t] = await Promise.all([
      supabase.from('customers').select('id, display_name, aliases').eq('active', true).order('display_name'),
      supabase.from('players').select('id, display_name').eq('active', true).order('display_name'),
      supabase.from('profiles').select('id, display_name, role').eq('active', true).in('role', ['staff', 'admin']).order('display_name'),
      supabase.from('order_types').select('id, name, requires_player').eq('active', true).order('name')
    ])
    setLoading(false)
    const error = c.error || p.error || d.error || t.error
    if (error) return Alert.alert('讀取資料失敗', error.message)

    setCustomers((c.data ?? []) as Customer[])
    setPlayersList((p.data ?? []) as Player[])
    setDispatchers((d.data ?? []) as Dispatcher[])
    setOrderTypes((t.data ?? []) as OrderType[])

    const me = (d.data ?? []).find((item: any) => item.id === profile?.id) as Dispatcher | undefined
    if (me) chooseDispatcher(me)
  }

  const requiresPlayers = category === '其他（訂製單）' ? customNeedsPlayers : shouldRequirePlayers(category)
  const nominalRate = Math.max(0, Number(dispatchPct || 0) / 100)
  const currentAmount = Math.max(0, Number(amount || 0))
  const dispatchFee = ceilMoney(currentAmount * nominalRate)

  const entertainmentOptions = ENTERTAINMENT_OPTIONS[entertainmentType] as readonly { label: string; price: number }[]

  useEffect(() => {
    setAmountManual(false)
    resetCategoryDefaults(category)
    const defaultRate = dispatcherRole === 'admin' ? 0 : defaultDispatchRate(category)
    setDispatchPct(String(defaultRate * 100))
  }, [category])

  useEffect(() => {
    if (dispatcherRole === 'admin') setDispatchPct('0')
  }, [dispatcherRole])

  useEffect(() => {
    recalculate()
  }, [
    category,
    secrecy,
    hours,
    hourlyMode,
    guaranteeTier,
    trialPeriod,
    femaleMode,
    femalePureMode,
    femaleTechRank,
    entertainmentType,
    entertainmentOption,
    runTier,
    collisionTier,
    identityMode,
    seasonMode,
    topupIndex,
    slots.length,
    slots.map((slot) => slot.rank).join('|')
  ])

  function resetCategoryDefaults(next: ServiceCategory) {
    setSimpleDetail('')
    setPlayerQueries({})
    setCustomNeedsPlayers(false)
    setResponsible(next === '實名' || next === '賽季3x3' || next === '調畫質' ? '林峰' : '')

    if (next === '跑刀') setResponsible('華')
    if (next === '代儲') setResponsible('小白')

    if (next === '小時單') {
      setHourlyMode('單陪')
      setSlots([blankSlot()])
    } else if (['保底單', '體驗單', '勇敢者', '娛樂單'].includes(next)) {
      setSlots([blankSlot(), blankSlot()])
    } else if (next === '教學單') {
      setSlots([blankSlot('A')])
    } else if (next === '女陪單') {
      setFemaleMode('女+技術陪')
      setSlots([blankSlot(), blankSlot()])
    } else {
      setSlots([])
    }
  }

  function recalculate(force = false) {
    const h = Number(hours)
    let total = 0
    let pays: number[] = []

    if (category === '小時單' && h > 0) {
      const result = hourlyPricing(secrecy, h, slots.map((slot) => slot.rank), hourlyMode)
      total = result.total
      pays = result.pays
    } else if (category === '保底單') {
      const result = guaranteePricing(secrecy, guaranteeTier)
      total = result.total
      pays = result.pays
    } else if (category === '體驗單') {
      const result = trialPricing(trialPeriod)
      total = result.total
      pays = result.pays
    } else if (category === '教學單' && h > 0) {
      const result = teachingPricing(h)
      total = result.total
      pays = result.pays
    } else if (category === '勇敢者') {
      const result = bravePricing()
      total = result.total
      pays = result.pays
    } else if (category === '女陪單' && h > 0) {
      const result = femaleMode === '女+技術陪'
        ? femaleTechPricing(secrecy, femaleTechRank, h)
        : femalePurePricing(secrecy, femalePureMode, h)
      total = result.total
      pays = result.pays
    } else if (category === '娛樂單') {
      total = entertainmentOptions.find((option) => option.label === entertainmentOption)?.price ?? 0
      pays = entertainmentPricing(total).pays
    } else if (category === '跑刀' && runTier !== '自訂') {
      total = RUN_KNIFE_PRICE[runTier]
    } else if (category === '撞車' && collisionTier !== '自訂') {
      total = COLLISION_PRICE[collisionTier]
    } else if (category === '實名') {
      total = identityMode === '實名' ? 1100 : 1750
    } else if (category === '賽季3x3' && seasonMode !== '部分/造型') {
      total = seasonMode === '台服' ? 3500 : 3700
    } else if (category === '調畫質') {
      total = 520
    } else if (category === '代儲' && topupIndex !== null) {
      total = TOPUP_OPTIONS[topupIndex].customer
      setTopupRmb(String(TOPUP_OPTIONS[topupIndex].rmb))
    }

    setSystemAmount(total)
    if (!amountManual || force) setAmount(String(total))
    if (pays.length) {
      setSlots((current) => current.map((slot, index) => ({ ...slot, pay: String(pays[index] ?? 0) })))
    }
  }

  function chooseDispatcher(item: Dispatcher) {
    setDispatcherId(item.id)
    setDispatcherName(item.display_name)
    setDispatcherRole(item.role)
    setDispatcherOpen(false)
    setDispatchPct(item.role === 'admin' ? '0' : String(defaultDispatchRate(category) * 100))
  }

  function setSlotCount(count: number) {
    setSlots((current) => {
      const copy = [...current]
      while (copy.length < count) copy.push(blankSlot())
      return copy.slice(0, count)
    })
    setPlayerQueries({})
  }

  async function addCustomer() {
    const name = newCustomer.trim()
    if (!name) return

    const { data, error } = await supabase
      .from('customers')
      .insert({ display_name: name })
      .select('id, display_name, aliases')
      .single()

    if (error || !data) return Alert.alert('新增老闆失敗', error?.message ?? 'Unknown error')

    const item = data as Customer
    setCustomers((current) => [...current, item].sort((a, b) => a.display_name.localeCompare(b.display_name)))
    setCustomerId(item.id)
    setCustomerName(item.display_name)
    setCustomerQuery('')
    setNewCustomer('')
    setShowAddCustomer(false)
  }

  async function addPlayer(index: number) {
    const name = newPlayer.trim()
    if (!name) return

    const { data, error } = await supabase
      .from('players')
      .insert({ display_name: name })
      .select('id, display_name')
      .single()

    if (error || !data) return Alert.alert('新增打手失敗', error?.message ?? 'Unknown error')

    const item = data as Player
    setPlayersList((current) => [...current, item].sort((a, b) => a.display_name.localeCompare(b.display_name)))
    choosePlayer(index, item)
    setNewPlayer('')
    setShowAddPlayer(null)
  }

  function choosePlayer(index: number, player: Player) {
    setSlots((current) => current.map((slot, i) => i === index ? { ...slot, playerId: player.id, playerName: player.display_name } : slot))
    setPlayerQueries((current) => ({ ...current, [index]: '' }))
    setPlayerOpen(null)
  }

  function changeEntertainmentType(value: EntertainmentType) {
    const options = ENTERTAINMENT_OPTIONS[value] as readonly { label: string; price: number }[]
    setEntertainmentType(value)
    setEntertainmentOption(options[0]?.label ?? '')
    setAmountManual(false)
  }

  const detailSummary = useMemo(() => {
    if (category === '小時單') return `${secrecy} · ${hourlyMode} · ${slots.map((slot) => slot.rank).join('+')} · ${hours} 小時`
    if (category === '保底單') return `${secrecy} · ${guaranteeTier}`
    if (category === '體驗單') return trialPeriod
    if (category === '教學單') return `${hours} 小時`
    if (category === '女陪單') return femaleMode === '女+技術陪' ? `${secrecy} · 女+${femaleTechRank} · ${hours} 小時` : `${secrecy} · ${femalePureMode} · ${hours} 小時`
    if (category === '娛樂單') return `${entertainmentType} · ${entertainmentOption}`
    if (category === '跑刀') return runTier
    if (category === '撞車') return collisionTier
    if (category === '實名') return identityMode
    if (category === '賽季3x3') return seasonMode
    if (category === '代儲') return topupIndex === null ? simpleDetail : TOPUP_OPTIONS[topupIndex].label
    return simpleDetail
  }, [category, secrecy, hourlyMode, slots, hours, guaranteeTier, trialPeriod, femaleMode, femaleTechRank, femalePureMode, entertainmentType, entertainmentOption, runTier, collisionTier, identityMode, seasonMode, topupIndex, simpleDetail])

  async function submit() {
    if (!customerId) return Alert.alert('資料不足', '請選擇下單老闆。')
    if (!orderDate.match(/^\d{4}-\d{2}-\d{2}$/)) return Alert.alert('日期格式錯誤', '請使用 YYYY-MM-DD。')
    if (!Number.isFinite(currentAmount) || currentAmount < 0) return Alert.alert('金額錯誤', '請輸入有效總金額。')
    if (!dispatcherId && nominalRate > 0) return Alert.alert('資料不足', '有派單抽成時請選擇派單人。')
    if (requiresPlayers && (!slots.length || slots.some((slot) => !slot.playerId))) return Alert.alert('資料不足', '請選擇所有打手。')
    if (requiresPlayers && slots.some((slot) => !Number.isFinite(Number(slot.pay)) || Number(slot.pay) < 0)) return Alert.alert('實拿錯誤', '請確認每位打手實拿金額。')

    const ids = slots.map((slot) => slot.playerId).filter(Boolean)
    if (new Set(ids).size !== ids.length) return Alert.alert('打手重複', '同一張訂單不能重複選同一位打手。')

    const dbType = orderTypes.find((type) => type.requires_player === requiresPlayers)
    if (!dbType) return Alert.alert('缺少單種設定', requiresPlayers ? '資料庫沒有「需要打手」的基礎單種。' : '資料庫沒有「直接報單」的基礎單種。')

    const notes = JSON.stringify({
      service_category: category,
      detail: detailSummary,
      responsible: responsible || null,
      system_amount: systemAmount,
      manual_amount: amountManual,
      nominal_dispatch_rate: nominalRate,
      nominal_dispatch_fee: dispatchFee,
      topup_rmb: category === '代儲' ? Number(topupRmb || 0) : null
    })

    setBusy(true)
    const storedRate = currentAmount > 0 && dispatchFee > 0 ? dispatchFee / currentAmount : 0
    const createdAt = new Date(`${orderDate}T12:00:00`).toISOString()
    const vipEligible = category !== '代儲'

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        customer_id: customerId,
        order_type_id: dbType.id,
        created_by: profile?.id,
        dispatcher_id: dispatcherId || null,
        amount_paid: ceilMoney(currentAmount),
        vip_eligible_amount: vipEligible ? ceilMoney(currentAmount) : 0,
        dispatch_rate: storedRate,
        requires_player: requiresPlayers,
        status: requiresPlayers ? 'awaiting_player' : 'completed',
        completed_at: requiresPlayers ? null : createdAt,
        created_at: createdAt,
        notes
      })
      .select('id, order_no')
      .single()

    if (error || !order) {
      setBusy(false)
      return Alert.alert('報單失敗', error?.message ?? 'Unknown error')
    }

    if (requiresPlayers) {
      const rows = slots.map((slot) => ({
        order_id: order.id,
        player_id: slot.playerId,
        assigned_pay: ceilMoney(Number(slot.pay || 0)),
        status: 'assigned',
        notes: category === '小時單' ? `${slot.rank}級` : null
      }))

      const { error: assignmentError } = await supabase.from('order_players').insert(rows)
      if (assignmentError) {
        setBusy(false)
        return Alert.alert('訂單已建立，但派打手失敗', `${order.order_no}\n${assignmentError.message}`)
      }
    }

    setBusy(false)
    Alert.alert('報單完成', `${order.order_no}\n總金額 $${ceilMoney(currentAmount)}\n派單抽成 $${dispatchFee}`)
    setCustomerId('')
    setCustomerName('')
    setCustomerQuery('')
    setAmountManual(false)
    setOrderDate(todayLocal())
    resetCategoryDefaults(category)
    recalculate(true)
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

  const customerItems: SearchItem[] = customers.map((item) => ({
    id: item.id,
    label: item.display_name,
    searchText: [item.display_name, ...(item.aliases ?? [])].join(' ')
  }))

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      <Screen>
        <H1>新增報單</H1>
        <Muted>{loading ? '正在讀取資料…' : '先選單種，再填下單資料。價格與實拿會自動帶入，但都可以手動修改。'}</Muted>

        <Card>
          <H2>1. 單種</H2>
          <CategoryPicker
            value={category}
            open={categoryOpen}
            onToggle={() => setCategoryOpen((value) => !value)}
            onChange={(value) => {
              setCategory(value)
              setCategoryOpen(false)
            }}
          />

          <CategoryFields
            category={category}
            secrecy={secrecy}
            setSecrecy={setSecrecy}
            hours={hours}
            setHours={setHours}
            hourlyMode={hourlyMode}
            setHourlyMode={(value: HourlyMode) => {
              setHourlyMode(value)
              setSlotCount(value === '單陪' ? 1 : 2)
              setAmountManual(false)
            }}
            slots={slots}
            setSlots={setSlots}
            setSlotCount={setSlotCount}
            guaranteeTier={guaranteeTier}
            setGuaranteeTier={setGuaranteeTier}
            trialPeriod={trialPeriod}
            setTrialPeriod={setTrialPeriod}
            femaleMode={femaleMode}
            setFemaleMode={setFemaleMode}
            femalePureMode={femalePureMode}
            setFemalePureMode={setFemalePureMode}
            femaleTechRank={femaleTechRank}
            setFemaleTechRank={setFemaleTechRank}
            entertainmentType={entertainmentType}
            setEntertainmentType={changeEntertainmentType}
            entertainmentOption={entertainmentOption}
            setEntertainmentOption={(value: string) => {
              setEntertainmentOption(value)
              setAmountManual(false)
            }}
            entertainmentOptions={entertainmentOptions}
            runTier={runTier}
            setRunTier={setRunTier}
            collisionTier={collisionTier}
            setCollisionTier={setCollisionTier}
            simpleDetail={simpleDetail}
            setSimpleDetail={setSimpleDetail}
            identityMode={identityMode}
            setIdentityMode={setIdentityMode}
            seasonMode={seasonMode}
            setSeasonMode={setSeasonMode}
            topupIndex={topupIndex}
            setTopupIndex={setTopupIndex}
            topupRmb={topupRmb}
            setTopupRmb={setTopupRmb}
            responsible={responsible}
            setResponsible={setResponsible}
            customNeedsPlayers={customNeedsPlayers}
            setCustomNeedsPlayers={setCustomNeedsPlayers}
          />
        </Card>

        <Card>
          <H2>2. 下單資料</H2>
          <Text style={styles.label}>下單日期</Text>
          <Field value={orderDate} onChangeText={setOrderDate} placeholder="YYYY-MM-DD" />

          <SearchPicker
            label="下單老闆"
            selectedLabel={customerName || '點這裡選擇老闆'}
            open={customerOpen}
            onToggle={() => setCustomerOpen((value) => !value)}
            query={customerQuery}
            setQuery={setCustomerQuery}
            items={customerItems}
            onSelect={(item) => {
              setCustomerId(item.id)
              setCustomerName(item.label)
              setCustomerQuery('')
              setCustomerOpen(false)
            }}
            addLabel="＋ 名單沒有？新增老闆"
            onAdd={() => {
              setCustomerOpen(false)
              setShowAddCustomer(true)
            }}
          />

          {showAddCustomer ? (
            <View style={styles.inline}>
              <Field value={newCustomer} onChangeText={setNewCustomer} placeholder="新老闆名稱" />
              <Button title="新增並選擇" onPress={addCustomer} />
              <Button title="取消" tone="neutral" onPress={() => setShowAddCustomer(false)} />
            </View>
          ) : null}

          <Text style={styles.label}>總金額</Text>
          <Field
            value={amount}
            onChangeText={(value) => {
              setAmount(value)
              setAmountManual(true)
              if (category === '娛樂單') {
                const result = entertainmentPricing(Number(value || 0))
                setSlots((current) => current.map((slot, index) => ({ ...slot, pay: String(result.pays[index] ?? 0) })))
              }
            }}
            keyboardType="decimal-pad"
            placeholder="總金額"
          />
          <View style={styles.summaryRow}>
            <Muted>系統價：${systemAmount}</Muted>
            {amountManual ? (
              <Pressable onPress={() => {
                setAmountManual(false)
                setAmount(String(systemAmount))
                if (category === '娛樂單') {
                  const result = entertainmentPricing(systemAmount)
                  setSlots((current) => current.map((slot, index) => ({ ...slot, pay: String(result.pays[index] ?? 0) })))
                }
              }}>
                <Text style={styles.link}>套用系統價</Text>
              </Pressable>
            ) : null}
          </View>
        </Card>

        {requiresPlayers ? (
          <Card>
            <H2>3. 打手與實拿</H2>
            <Muted>點開可直接選；沒輸入搜尋文字時顯示全部，清單最多顯示約 5 筆高度，再往下滾動。</Muted>

            {slots.map((slot, index) => {
              const playerItems: SearchItem[] = playersList
                .filter((player) => !slots.some((other, otherIndex) => otherIndex !== index && other.playerId === player.id))
                .map((player) => ({ id: player.id, label: player.display_name }))

              return (
                <View key={index} style={styles.playerBox}>
                  <SearchPicker
                    label={`打手 ${index + 1}`}
                    selectedLabel={slot.playerName || '點這裡選擇打手'}
                    open={playerOpen === index}
                    onToggle={() => setPlayerOpen(playerOpen === index ? null : index)}
                    query={playerQueries[index] ?? ''}
                    setQuery={(value) => setPlayerQueries((current) => ({ ...current, [index]: value }))}
                    items={playerItems}
                    onSelect={(item) => {
                      const player = playersList.find((candidate) => candidate.id === item.id)
                      if (player) choosePlayer(index, player)
                    }}
                    addLabel="＋ 名單沒有？新增打手"
                    onAdd={() => {
                      setPlayerOpen(null)
                      setShowAddPlayer(index)
                    }}
                  />

                  {showAddPlayer === index ? (
                    <View style={styles.inline}>
                      <Field value={newPlayer} onChangeText={setNewPlayer} placeholder="新打手名稱" />
                      <Button title="新增並選擇" onPress={() => addPlayer(index)} />
                      <Button title="取消" tone="neutral" onPress={() => setShowAddPlayer(null)} />
                    </View>
                  ) : null}

                  {category === '小時單' ? (
                    <Segment
                      label="等級"
                      options={RANKS}
                      value={slot.rank}
                      onChange={(value) => setSlots((current) => current.map((currentSlot, i) => i === index ? { ...currentSlot, rank: value as Rank } : currentSlot))}
                    />
                  ) : null}

                  <Text style={styles.label}>打手實拿金額</Text>
                  <Field
                    value={slot.pay}
                    onChangeText={(value) => setSlots((current) => current.map((currentSlot, i) => i === index ? { ...currentSlot, pay: value } : currentSlot))}
                    keyboardType="decimal-pad"
                    placeholder="實拿金額"
                  />
                </View>
              )
            })}
          </Card>
        ) : null}

        <Card>
          <H2>{requiresPlayers ? '4. 派單' : '3. 派單'}</H2>
          <SimplePicker
            label="派單人"
            value={dispatcherName || '點這裡選擇派單人'}
            open={dispatcherOpen}
            onToggle={() => setDispatcherOpen((value) => !value)}
          >
            <ScrollView style={styles.scrollMenu} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {dispatchers.map((item) => (
                <Choice
                  key={item.id}
                  text={`${item.display_name}${item.role === 'admin' ? '（店長/Admin）' : ''}`}
                  onPress={() => chooseDispatcher(item)}
                />
              ))}
              <Choice
                text="不指定派單人"
                onPress={() => {
                  setDispatcherId('')
                  setDispatcherName('')
                  setDispatcherRole('')
                  setDispatcherOpen(false)
                }}
              />
            </ScrollView>
          </SimplePicker>

          <Text style={styles.label}>派單抽成 %</Text>
          <Field value={dispatchPct} onChangeText={setDispatchPct} keyboardType="decimal-pad" placeholder="例如 5 / 3 / 2.5 / 0" />
          <Text style={styles.money}>派單人實拿：${dispatchFee}</Text>
          <Muted>一般 5%｜體驗單 2.5%｜撞子彈 3%｜店長/Admin、調畫質、代儲預設 0%。可手動修改。</Muted>
        </Card>

        <Button title={busy ? '送出中…' : '送出報單'} onPress={submit} disabled={busy || loading} />
      </Screen>
    </ScrollView>
  )
}

function CategoryPicker({
  value,
  open,
  onToggle,
  onChange
}: {
  value: ServiceCategory
  open: boolean
  onToggle: () => void
  onChange: (value: ServiceCategory) => void
}) {
  return (
    <SimplePicker label="選擇單種" value={value} open={open} onToggle={onToggle}>
      <ScrollView style={styles.categoryMenu} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        {SERVICE_GROUPS.map((group) => (
          <View key={group.label}>
            <Text style={styles.groupTitle}>{group.label}</Text>
            {group.items.map((item) => (
              <Choice key={item} text={item} onPress={() => onChange(item)} />
            ))}
          </View>
        ))}
      </ScrollView>
    </SimplePicker>
  )
}

function SearchPicker({
  label,
  selectedLabel,
  open,
  onToggle,
  query,
  setQuery,
  items,
  onSelect,
  addLabel,
  onAdd
}: {
  label: string
  selectedLabel: string
  open: boolean
  onToggle: () => void
  query: string
  setQuery: (value: string) => void
  items: SearchItem[]
  onSelect: (item: SearchItem) => void
  addLabel: string
  onAdd: () => void
}) {
  const q = query.trim().toLowerCase()
  const filtered = items.filter((item) => !q || (item.searchText ?? item.label).toLowerCase().includes(q))

  return (
    <SimplePicker label={label} value={selectedLabel} open={open} onToggle={onToggle}>
      <View style={styles.searchMenu}>
        <Field value={query} onChangeText={setQuery} placeholder={`搜尋${label}`} autoFocus={false} />
        <ScrollView style={styles.searchResults} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {filtered.map((item) => (
            <Choice key={item.id} text={item.label} onPress={() => onSelect(item)} />
          ))}
          {filtered.length === 0 ? <Text style={styles.emptyText}>找不到符合資料</Text> : null}
        </ScrollView>
        <Choice text={addLabel} onPress={onAdd} accent />
      </View>
    </SimplePicker>
  )
}

function SimplePicker({ label, value, open, onToggle, children }: any) {
  return (
    <View style={styles.selectWrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.selectButton} onPress={onToggle}>
        <Text style={styles.selectText}>{value}</Text>
        <Text style={styles.chevron}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open ? <View style={styles.menu}>{children}</View> : null}
    </View>
  )
}

function Choice({ text, onPress, accent = false }: { text: string; onPress: () => void; accent?: boolean }) {
  return (
    <Pressable style={styles.choice} onPress={onPress}>
      <Text style={[styles.choiceText, accent && { color: colors.accent }]}>{text}</Text>
    </Pressable>
  )
}

function Segment({
  label,
  options,
  value,
  onChange
}: {
  label: string
  options: readonly string[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.segment}>
        {options.map((option) => (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[styles.segmentItem, value === option && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, value === option && styles.segmentTextActive]}>{option}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

function CategoryFields(props: any) {
  const c: ServiceCategory = props.category

  return (
    <View style={{ gap: 10 }}>
      {c === '小時單' ? (
        <Segment label="單陪 / 雙陪" options={['單陪', '雙陪']} value={props.hourlyMode} onChange={props.setHourlyMode} />
      ) : null}

      {['小時單', '保底單', '女陪單'].includes(c) ? (
        <Segment label="機密 / 絕密" options={SECRECY} value={props.secrecy} onChange={props.setSecrecy} />
      ) : null}

      {['小時單', '教學單', '女陪單'].includes(c) ? (
        <>
          <Text style={styles.label}>小時數</Text>
          <Field value={props.hours} onChangeText={props.setHours} keyboardType="decimal-pad" placeholder="例如 2.5" />
        </>
      ) : null}

      {c === '保底單' ? (
        <Segment label="保底金額" options={Object.keys(GUARANTEE_PRICE.機密)} value={props.guaranteeTier} onChange={props.setGuaranteeTier} />
      ) : null}

      {c === '體驗單' ? (
        <Segment label="體驗方案" options={['每日', '每週']} value={props.trialPeriod} onChange={props.setTrialPeriod} />
      ) : null}

      {c === '女陪單' ? (
        <>
          <Segment
            label="女陪類型"
            options={['女+技術陪', '純女陪']}
            value={props.femaleMode}
            onChange={(value) => {
              props.setFemaleMode(value)
              if (value === '女+技術陪') props.setSlotCount(2)
              else props.setSlotCount(props.femalePureMode === '單陪' ? 1 : 2)
            }}
          />
          {props.femaleMode === '女+技術陪' ? (
            <Segment label="技術陪等級" options={RANKS} value={props.femaleTechRank} onChange={props.setFemaleTechRank} />
          ) : (
            <Segment
              label="單陪 / 雙陪"
              options={['單陪', '雙陪']}
              value={props.femalePureMode}
              onChange={(value) => {
                props.setFemalePureMode(value)
                props.setSlotCount(value === '單陪' ? 1 : 2)
              }}
            />
          )}
        </>
      ) : null}

      {c === '娛樂單' ? (
        <>
          <Segment label="娛樂單種類" options={ENTERTAINMENT_TYPES} value={props.entertainmentType} onChange={props.setEntertainmentType} />
          <Segment
            label="方案"
            options={props.entertainmentOptions.map((option: { label: string }) => option.label)}
            value={props.entertainmentOption}
            onChange={props.setEntertainmentOption}
          />
          {props.entertainmentOptions.find((option: { label: string; price: number }) => option.label === props.entertainmentOption)?.price === 0 ? (
            <Muted>此方案沒有固定金額，總金額預設為 0，請在下方自行修改。</Muted>
          ) : null}
        </>
      ) : null}

      {c === '跑刀' ? (
        <>
          <Segment label="跑刀" options={['1000w', '5000w', '1e', '自訂']} value={props.runTier} onChange={props.setRunTier} />
          <Segment
            label="負責人"
            options={['華', '望舒', '睡', '其他']}
            value={['華', '望舒', '睡'].includes(props.responsible) ? props.responsible : '其他'}
            onChange={(value) => props.setResponsible(value === '其他' ? '' : value)}
          />
          {!['華', '望舒', '睡'].includes(props.responsible) ? (
            <Field value={props.responsible} onChangeText={props.setResponsible} placeholder="其他負責人" />
          ) : null}
        </>
      ) : null}

      {c === '撞車' ? (
        <>
          <Segment label="撞車" options={['1000w', '1500w', '3000w', '5000w', '1e', '自訂']} value={props.collisionTier} onChange={props.setCollisionTier} />
          <Field value={props.responsible} onChangeText={props.setResponsible} placeholder="負責接的人" />
        </>
      ) : null}

      {['撞紅', '撞子彈', '代解任務'].includes(c) ? (
        <>
          <Field
            value={props.simpleDetail}
            onChangeText={props.setSimpleDetail}
            placeholder={c === '撞紅' ? '填什麼紅' : c === '撞子彈' ? '填什麼子彈' : '填什麼任務'}
          />
          <Field value={props.responsible} onChangeText={props.setResponsible} placeholder="負責接的人" />
        </>
      ) : null}

      {c === '實名' ? (
        <>
          <Segment label="實名類型" options={['實名', '強改綁']} value={props.identityMode} onChange={props.setIdentityMode} />
          <Muted>負責人固定：林峰</Muted>
        </>
      ) : null}

      {c === '賽季3x3' ? (
        <>
          <Segment label="3x3" options={['台服', '陸服', '部分/造型']} value={props.seasonMode} onChange={props.setSeasonMode} />
          {props.seasonMode === '部分/造型' ? (
            <Field value={props.simpleDetail} onChangeText={props.setSimpleDetail} placeholder="做哪個部分 / 造型" />
          ) : null}
          <Muted>負責人固定：林峰</Muted>
        </>
      ) : null}

      {c === '調畫質' ? <Muted>固定 $520｜負責人：林峰｜派單不抽成。</Muted> : null}

      {c === '代儲' ? (
        <>
          <Text style={styles.label}>代儲品項</Text>
          <ScrollView style={styles.searchResults} nestedScrollEnabled>
            {TOPUP_OPTIONS.map((option, index) => (
              <Choice
                key={option.label}
                text={`${option.label}｜老闆 $${option.customer}｜代儲 ${option.rmb} RMB`}
                onPress={() => props.setTopupIndex(index)}
              />
            ))}
            <Choice text="其他 / 自訂代儲" accent onPress={() => props.setTopupIndex(null)} />
          </ScrollView>
          {props.topupIndex === null ? (
            <>
              <Field value={props.simpleDetail} onChangeText={props.setSimpleDetail} placeholder="自訂代儲內容" />
              <Text style={styles.label}>代儲 RMB</Text>
              <Field value={props.topupRmb} onChangeText={props.setTopupRmb} keyboardType="decimal-pad" placeholder="RMB 金額" />
            </>
          ) : null}
          <Segment label="負責充值" options={['小白', '莫北', 'BoBo']} value={props.responsible} onChange={props.setResponsible} />
          <Muted>代儲不算老闆累積消費，也沒有派單抽成；RMB 金額會保留在報單明細。</Muted>
        </>
      ) : null}

      {c === '其他（訂製單）' ? (
        <>
          <Field value={props.simpleDetail} onChangeText={props.setSimpleDetail} placeholder="訂製內容" />
          <Segment
            label="需要打手嗎？"
            options={['不需要', '需要']}
            value={props.customNeedsPlayers ? '需要' : '不需要'}
            onChange={(value) => {
              props.setCustomNeedsPlayers(value === '需要')
              props.setSlotCount(value === '需要' ? 1 : 0)
            }}
          />
          {!props.customNeedsPlayers ? (
            <Field value={props.responsible} onChangeText={props.setResponsible} placeholder="負責人（可留空）" />
          ) : null}
        </>
      ) : null}

      {c === '勇敢者' ? <Muted>固定 $3680｜2 位打手｜每位預設 3680 ÷ 2 × 80%。</Muted> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  label: { color: colors.text, fontWeight: '700', fontSize: 14 },
  selectWrap: { gap: 7 },
  selectButton: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel2,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  selectText: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 },
  chevron: { color: colors.accent, fontWeight: '800' },
  menu: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.panel2 },
  categoryMenu: { maxHeight: 260 },
  scrollMenu: { maxHeight: 240 },
  searchMenu: { paddingTop: 8, gap: 8 },
  searchResults: { maxHeight: 235 },
  groupTitle: { color: colors.accent, fontSize: 13, fontWeight: '800', paddingHorizontal: 14, paddingTop: 11, paddingBottom: 5 },
  choice: { minHeight: 46, justifyContent: 'center', paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  choiceText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  emptyText: { color: colors.muted, padding: 14 },
  inline: { gap: 8, padding: 10, borderRadius: 12, backgroundColor: colors.panel2 },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  segmentItem: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel2 },
  segmentActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  segmentText: { color: colors.text, fontWeight: '700' },
  segmentTextActive: { color: '#051018' },
  playerBox: { gap: 9, paddingBottom: 14, borderBottomColor: colors.border, borderBottomWidth: 1 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  link: { color: colors.accent, fontWeight: '800' },
  money: { color: colors.accent, fontSize: 20, fontWeight: '800' }
})
