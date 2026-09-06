import { useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { Button, Card, Field, H1, H2, Muted, Screen, colors } from '@/components/ui'
import {
  COLLISION_PRICE,
  ENTERTAINMENT_OPTIONS,
  GUARANTEE_PRICE,
  HOURLY_PRICE,
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
type PlayerType = 'technical' | 'female'
type Player = { id: string; display_name: string; player_type: PlayerType }
type Dispatcher = { id: string; display_name: string; role: string }
type OrderType = { id: string; name: string; requires_player: boolean }
type PlayerSlot = { playerId: string; playerName: string; rank: Rank; pay: string }
type SearchItem = { id: string; label: string; searchText?: string }

const RANKS: Rank[] = ['B', 'A', 'S', 'SR']
const SECRECY: Secrecy[] = ['機密', '絕密']
const ENTERTAINMENT_TYPES = Object.keys(ENTERTAINMENT_OPTIONS) as EntertainmentType[]
const DISPATCH_PRESETS = ['0', '2.5', '3', '5'] as const

function todayLocal() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function blankSlot(rank: Rank = 'B'): PlayerSlot {
  return { playerId: '', playerName: '', rank, pay: '0' }
}

export default function NewOrderV2Screen() {
  const { profile } = useAuth()
  const allowed = profile?.role === 'staff' || profile?.role === 'admin'

  const [customers, setCustomers] = useState<Customer[]>([])
  const [playersList, setPlayersList] = useState<Player[]>([])
  const [dispatchers, setDispatchers] = useState<Dispatcher[]>([])
  const [orderTypes, setOrderTypes] = useState<OrderType[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [serviceGroup, setServiceGroup] = useState('護航陪玩')
  const [category, setCategory] = useState<ServiceCategory>('小時單')
  const [groupOpen, setGroupOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)

  const [orderDate, setOrderDate] = useState(todayLocal())
  const [customerId, setCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerOpen, setCustomerOpen] = useState(false)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [newCustomer, setNewCustomer] = useState('')

  const [dispatcherId, setDispatcherId] = useState('')
  const [dispatcherName, setDispatcherName] = useState('')
  const [dispatcherRole, setDispatcherRole] = useState('')
  const [dispatcherOpen, setDispatcherOpen] = useState(false)
  const [dispatchPct, setDispatchPct] = useState('5')

  const [amount, setAmount] = useState('0')
  const [systemAmount, setSystemAmount] = useState(0)
  const [amountManual, setAmountManual] = useState(false)
  const [selfOrder, setSelfOrder] = useState(false)
  const [selfOrderPlayerId, setSelfOrderPlayerId] = useState('')
  const [selfOrderPlayerName, setSelfOrderPlayerName] = useState('')
  const [selfOrderOpen, setSelfOrderOpen] = useState(false)
  const [selfOrderQuery, setSelfOrderQuery] = useState('')
  const [selfPayment, setSelfPayment] = useState<'直接付款' | '薪資扣款'>('直接付款')
  const [customerDiscount, setCustomerDiscount] = useState<'無折扣' | '95折' | '9折' | '85折' | '8折' | '自訂'>('無折扣')
  const [customDiscountPct, setCustomDiscountPct] = useState('90')
  const [playerAbsorbsDiscount, setPlayerAbsorbsDiscount] = useState(false)
  const [originalSystemAmount, setOriginalSystemAmount] = useState(0)

  const [secrecy, setSecrecy] = useState<Secrecy>('機密')
  const [hours, setHours] = useState('1')
  const [hourlyMode, setHourlyMode] = useState<HourlyMode>('單陪')
  const [hourlyRanks, setHourlyRanks] = useState<Rank[]>(['B'])
  const [guaranteeTier, setGuaranteeTier] = useState<'1000w' | '3000w' | '5000w'>('1000w')
  const [trialPeriod, setTrialPeriod] = useState<'每日' | '每週'>('每日')
  const [femaleMode, setFemaleMode] = useState<'女+技術陪' | '純女陪'>('女+技術陪')
  const [femalePureMode, setFemalePureMode] = useState<'單陪' | '雙陪'>('單陪')
  const [femaleTechRank, setFemaleTechRank] = useState<Rank>('B')
  const [entertainmentType, setEntertainmentType] = useState<EntertainmentType>('賭紅單')
  const [entertainmentOption, setEntertainmentOption] = useState('出1紅')
  const [runTier, setRunTier] = useState<'1000w' | '5000w' | '1e' | '自訂'>('1000w')
  const [collisionTier, setCollisionTier] = useState<'1000w' | '1500w' | '3000w' | '5000w' | '1e' | '自訂'>('1000w')
  const [identityMode, setIdentityMode] = useState<'實名' | '強改綁'>('實名')
  const [seasonMode, setSeasonMode] = useState<'台服' | '陸服' | '部分/造型'>('台服')
  const [topupIndex, setTopupIndex] = useState<number | null>(0)
  const [topupRmb, setTopupRmb] = useState('6')
  const [simpleDetail, setSimpleDetail] = useState('')
  const [responsible, setResponsible] = useState('')

  const [slots, setSlots] = useState<PlayerSlot[]>([blankSlot('B')])
  const [playerOpen, setPlayerOpen] = useState<number | null>(null)
  const [playerQueries, setPlayerQueries] = useState<Record<number, string>>({})
  const [showAddPlayer, setShowAddPlayer] = useState<number | null>(null)
  const [newPlayer, setNewPlayer] = useState('')
  const [newPlayerType, setNewPlayerType] = useState<PlayerType>('technical')

  useEffect(() => {
    if (!allowed) return
    void loadOptions()
  }, [allowed])

  async function loadOptions() {
    setLoading(true)
    const [c, p, d, t] = await Promise.all([
      supabase.from('customers').select('id, display_name, aliases').eq('active', true).order('display_name'),
      supabase.from('players').select('id, display_name, player_type').eq('active', true).order('display_name'),
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

  const groupItems = SERVICE_GROUPS.find((group) => group.label === serviceGroup)?.items ?? []
  const requiresPlayers = shouldRequirePlayers(category)
  const nominalRate = Math.max(0, Number(dispatchPct || 0) / 100)
  const currentAmount = Math.max(0, Number(amount || 0))
  const selfDiscountAllowed = !['實名', '調畫質', '代儲'].includes(category)
  const customerDiscountRate = customerDiscount === '95折' ? 0.95 : customerDiscount === '9折' ? 0.9 : customerDiscount === '85折' ? 0.85 : customerDiscount === '8折' ? 0.8 : customerDiscount === '自訂' ? Math.max(0, Math.min(1, Number(customDiscountPct || 100) / 100)) : 1
  const dispatchFee = ceilMoney(currentAmount * nominalRate)
  const entertainmentOptions = ENTERTAINMENT_OPTIONS[entertainmentType] as readonly { label: string; price: number }[]
  const dispatchPresetValue = DISPATCH_PRESETS.includes(dispatchPct as (typeof DISPATCH_PRESETS)[number])
    ? `${dispatchPct}%`
    : '自訂'

  useEffect(() => {
    setAmountManual(false)
    resetCategory(category)
    setDispatchPct(String((dispatcherName.trim().toLowerCase() === 'bobo' ? 0 : defaultDispatchRate(category)) * 100))
  }, [category])

  useEffect(() => {
    recalculate()
  }, [
    category,
    secrecy,
    hours,
    hourlyMode,
    hourlyRanks.join('|'),
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
    amountManual,
    selfOrder,
    customerDiscount,
    customDiscountPct,
    playerAbsorbsDiscount
  ])

  function resetCategory(next: ServiceCategory) {
    setSimpleDetail('')
    setPlayerQueries({})
    setPlayerOpen(null)
    setShowAddPlayer(null)
    setResponsible(['實名', '賽季3x3', '調畫質'].includes(next) ? '林峰' : next === '跑刀' ? '華' : next === '代儲' ? '小白' : '')

    if (next === '小時單') {
      setHourlyMode('單陪')
      setHourlyRanks(['B'])
      setSlots([blankSlot('B')])
    } else if (['保底單', '體驗單', '勇敢者', '娛樂單'].includes(next)) {
      setSlots([blankSlot(), blankSlot()])
    } else if (next === '教學單') {
      setSlots([blankSlot('A')])
    } else if (next === '女陪單') {
      setFemaleMode('女+技術陪')
      setFemaleTechRank('B')
      setSlots([blankSlot(), blankSlot('B')])
    } else {
      setSlots([])
    }
  }

  function changeHourlyMode(mode: HourlyMode) {
    setHourlyMode(mode)

    if (mode === '單陪') {
      const rank = hourlyRanks[0] ?? 'B'
      setHourlyRanks([rank])
      setSlots((current) => [{ ...(current[0] ?? blankSlot(rank)), rank }])
    } else {
      const first = hourlyRanks[0] ?? 'B'
      const second = hourlyRanks[1] ?? 'A'
      setHourlyRanks([first, second])
      setSlots((current) => [
        { ...(current[0] ?? blankSlot(first)), rank: first },
        { ...(current[1] ?? blankSlot(second)), rank: second }
      ])
    }

    setAmountManual(false)
  }

  function changeHourlyRank(index: number, rank: Rank) {
    setHourlyRanks((current) => {
      const next = [...current]
      next[index] = rank
      return next
    })

    setSlots((current) => current.map((slot, i) => i === index ? { ...slot, rank } : slot))
    setAmountManual(false)
  }

  function changeFemaleMode(mode: '女+技術陪' | '純女陪') {
    setFemaleMode(mode)
    setPlayerQueries({})
    setPlayerOpen(null)

    if (mode === '女+技術陪') {
      setSlots([blankSlot(), blankSlot(femaleTechRank)])
    } else {
      setSlots(femalePureMode === '單陪' ? [blankSlot()] : [blankSlot(), blankSlot()])
    }

    setAmountManual(false)
  }

  function changeFemalePureMode(mode: '單陪' | '雙陪') {
    setFemalePureMode(mode)
    setPlayerQueries({})
    setPlayerOpen(null)
    setSlots(mode === '單陪' ? [blankSlot()] : [blankSlot(), blankSlot()])
    setAmountManual(false)
  }

  function changeFemaleTechRank(rank: Rank) {
    setFemaleTechRank(rank)
    setSlots((current) => current.map((slot, index) => index === 1 ? { ...slot, rank } : slot))
    setAmountManual(false)
  }

  function recalculate(force = false) {
    const h = Number(hours)
    let total = 0
    let pays: number[] = []

    if (category === '小時單' && h > 0) {
      total = hourlyPricing(secrecy, h, hourlyRanks, hourlyMode).total
      const multiplier = hourlyMode === '單陪' ? 1.2 : 1
      pays = hourlyRanks.map((rank) => ceilMoney(HOURLY_PRICE[secrecy][rank] * h * multiplier * 0.8))
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

    const baseTotal = total
    setOriginalSystemAmount(baseTotal)

    if (selfOrder && selfDiscountAllowed) {
      total = ceilMoney(baseTotal * 0.9)
    } else if (!selfOrder && customerDiscountRate < 1) {
      total = ceilMoney(baseTotal * customerDiscountRate)
      if (playerAbsorbsDiscount && pays.length) {
        pays = pays.map((pay) => ceilMoney(pay * customerDiscountRate))
      }
    }

    setSystemAmount(total)
    if (!amountManual || force) setAmount(String(total))
    if (pays.length) {
      setSlots((current) => current.map((slot, index) => ({
        ...slot,
        rank: category === '小時單' ? (hourlyRanks[index] ?? slot.rank) : slot.rank,
        pay: String(pays[index] ?? 0)
      })))
    }
  }

  function requiredPlayerType(index: number): PlayerType {
    if (category !== '女陪單') return 'technical'
    if (femaleMode === '純女陪') return 'female'
    return index === 0 ? 'female' : 'technical'
  }

  function playerFieldLabel(index: number) {
    if (category === '小時單') return `打手 ${index + 1}（${hourlyRanks[index] ?? 'B'}級）`
    if (category !== '女陪單') return `打手 ${index + 1}`
    if (femaleMode === '純女陪') return femalePureMode === '單陪' ? '女陪' : `女陪 ${index + 1}`
    return index === 0 ? '女陪' : `技術陪（${femaleTechRank}級）`
  }

  function chooseDispatcher(item: Dispatcher) {
    setDispatcherId(item.id)
    setDispatcherName(item.display_name)
    setDispatcherRole(item.role)
    setDispatcherOpen(false)
    setDispatchPct(item.display_name.trim().toLowerCase() === 'bobo' ? '0' : String(defaultDispatchRate(category) * 100))
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
      .insert({ display_name: name, player_type: newPlayerType })
      .select('id, display_name, player_type')
      .single()

    if (error || !data) return Alert.alert('新增打手失敗', error?.message ?? 'Unknown error')

    const item = data as Player
    setPlayersList((current) => [...current, item].sort((a, b) => a.display_name.localeCompare(b.display_name)))
    choosePlayer(index, item)
    setNewPlayer('')
    setShowAddPlayer(null)
  }

  function choosePlayer(index: number, player: Player) {
    setSlots((current) => current.map((slot, i) => i === index
      ? { ...slot, playerId: player.id, playerName: player.display_name }
      : slot
    ))
    setPlayerQueries((current) => ({ ...current, [index]: '' }))
    setPlayerOpen(null)
  }

  function setSlotCount(count: number) {
    setSlots((current) => {
      const next = [...current]
      while (next.length < count) next.push(blankSlot())
      return next.slice(0, count)
    })
  }

  const detailSummary = useMemo(() => {
    if (category === '小時單') return `${secrecy} · ${hourlyMode} · ${hourlyRanks.join('+')} · ${hours} 小時`
    if (category === '保底單') return `${secrecy} · ${guaranteeTier}`
    if (category === '體驗單') return trialPeriod
    if (category === '教學單') return `${hours} 小時`
    if (category === '女陪單') {
      return femaleMode === '女+技術陪'
        ? `${secrecy} · 女+${femaleTechRank} · ${hours} 小時`
        : `${secrecy} · ${femalePureMode} · ${hours} 小時`
    }
    if (category === '娛樂單') {
      return entertainmentType === '自訂'
        ? `自訂 · ${simpleDetail || '未填內容'}`
        : `${entertainmentType} · ${entertainmentOption}`
    }
    if (category === '跑刀') return runTier
    if (category === '撞車') return collisionTier
    if (category === '實名') return identityMode
    if (category === '賽季3x3') return seasonMode
    if (category === '代儲') return topupIndex === null ? simpleDetail : TOPUP_OPTIONS[topupIndex].label
    return simpleDetail
  }, [
    category,
    secrecy,
    hourlyMode,
    hourlyRanks,
    hours,
    guaranteeTier,
    trialPeriod,
    femaleMode,
    femaleTechRank,
    femalePureMode,
    entertainmentType,
    entertainmentOption,
    runTier,
    collisionTier,
    identityMode,
    seasonMode,
    topupIndex,
    simpleDetail
  ])

  async function submit() {
    if (selfOrder && !selfOrderPlayerId) return Alert.alert('資料不足', '打手自己下單時，請選擇是哪位打手。')
    if (!selfOrder && !customerId) return Alert.alert('資料不足', '一般老闆下單時，請選擇下單老闆。')
    if (!orderDate.match(/^\d{4}-\d{2}-\d{2}$/)) return Alert.alert('日期格式錯誤', '請使用 YYYY-MM-DD。')
    if (!dispatcherId && nominalRate > 0) return Alert.alert('資料不足', '有派單抽成時請選擇派單人。')
    if (category === '娛樂單' && entertainmentType === '自訂' && !simpleDetail.trim()) {
      return Alert.alert('資料不足', '請填寫自訂娛樂單內容。')
    }
    if (requiresPlayers && slots.some((slot) => !slot.playerId)) {
      return Alert.alert('資料不足', '請選擇所有打手。')
    }

    const ids = slots.map((slot) => slot.playerId).filter(Boolean)
    if (new Set(ids).size !== ids.length) return Alert.alert('打手重複', '同一張訂單不能重複選同一位打手。')

    const dbType = orderTypes.find((type) => type.requires_player === requiresPlayers)
    if (!dbType) return Alert.alert('缺少單種設定', '找不到對應的基礎單種設定。')

    const notes = JSON.stringify({
      service_group: serviceGroup,
      service_category: category,
      detail: detailSummary,
      responsible: responsible || null,
      system_amount: systemAmount,
      manual_amount: amountManual,
      nominal_dispatch_rate: nominalRate,
      nominal_dispatch_fee: dispatchFee,
      topup_rmb: category === '代儲' ? Number(topupRmb || 0) : null,
      self_order: selfOrder,
      self_order_player_id: selfOrder ? selfOrderPlayerId : null,
      self_order_player_name: selfOrder ? selfOrderPlayerName : null,
      self_order_discount: selfOrder && selfDiscountAllowed ? 0.1 : 0,
      self_payment: selfOrder ? selfPayment : null,
      original_system_amount: originalSystemAmount,
      customer_discount_rate: selfOrder ? (selfDiscountAllowed ? 0.9 : 1) : customerDiscountRate,
      customer_discount_label: selfOrder ? (selfDiscountAllowed ? '打手自下單9折' : '無折扣') : customerDiscount,
      player_absorbs_discount: !selfOrder && customerDiscountRate < 1 ? playerAbsorbsDiscount : false
    })

    const createdAt = new Date(`${orderDate}T12:00:00`).toISOString()
    const storedRate = currentAmount > 0 ? dispatchFee / currentAmount : 0

    setBusy(true)

    let orderCustomerId = customerId
    if (selfOrder) {
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .ilike('display_name', selfOrderPlayerName)
        .limit(1)
        .maybeSingle()

      if (existingCustomer?.id) {
        orderCustomerId = existingCustomer.id
      } else {
        const { data: createdCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({ display_name: selfOrderPlayerName })
          .select('id')
          .single()
        if (customerError || !createdCustomer) {
          setBusy(false)
          return Alert.alert('建立打手下單資料失敗', customerError?.message ?? 'Unknown error')
        }
        orderCustomerId = createdCustomer.id
      }
    }

    const { data: order, error } = await supabase.from('orders').insert({
      customer_id: orderCustomerId,
      order_type_id: dbType.id,
      created_by: profile?.id,
      dispatcher_id: dispatcherId || null,
      amount_paid: ceilMoney(currentAmount),
      vip_eligible_amount: category === '代儲' ? 0 : ceilMoney(currentAmount),
      dispatch_rate: storedRate,
      requires_player: requiresPlayers,
      status: requiresPlayers ? 'awaiting_player' : 'completed',
      completed_at: requiresPlayers ? null : createdAt,
      created_at: createdAt,
      notes
    }).select('id, order_no').single()

    if (error || !order) {
      setBusy(false)
      return Alert.alert('報單失敗', error?.message ?? 'Unknown error')
    }

    if (requiresPlayers) {
      const { error: assignmentError } = await supabase.from('order_players').insert(
        slots.map((slot, index) => ({
          order_id: order.id,
          player_id: slot.playerId,
          assigned_pay: ceilMoney(Number(slot.pay || 0)),
          status: 'assigned',
          notes: category === '小時單'
            ? `${hourlyRanks[index] ?? slot.rank}級接單`
            : category === '女陪單'
              ? `${playerFieldLabel(index)}接單`
              : null
        }))
      )

      if (assignmentError) {
        setBusy(false)
        return Alert.alert('訂單已建立，但派打手失敗', assignmentError.message)
      }
    }

    if (selfOrder && selfPayment === '薪資扣款') {
      const { error: ledgerError } = await supabase.from('ledger').insert({
        player_id: selfOrderPlayerId, order_id: order.id, type: 'other',
        amount: -ceilMoney(currentAmount),
        description: `自己下單薪資扣款｜${category}｜${detailSummary}`,
        created_by: profile?.id, occurred_at: createdAt
      })
      if (ledgerError) { setBusy(false); return Alert.alert('訂單已建立，但薪資扣款紀錄失敗', ledgerError.message) }
    }

    setBusy(false)
    Alert.alert('報單完成', `${order.order_no}\n總金額 $${ceilMoney(currentAmount)}\n派單抽成 ${dispatchPct || 0}% = $${dispatchFee}`)
    setCustomerId('')
    setCustomerName('')
    setCustomerQuery('')
    setAmountManual(false)
    setSelfOrder(false)
    setSelfOrderPlayerId('')
    setSelfOrderPlayerName('')
    setSelfPayment('直接付款')
    setCustomerDiscount('無折扣')
    setCustomDiscountPct('90')
    setPlayerAbsorbsDiscount(false)
    setOrderDate(todayLocal())
    resetCategory(category)
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
        <Muted>{loading ? '正在讀取資料…' : '先選服務分類，再從下一個下拉選單選單種。'}</Muted>

        <Card>
          <H2>1. 單種</H2>

          <Dropdown label="服務分類" value={serviceGroup} open={groupOpen} onToggle={() => setGroupOpen(!groupOpen)}>
            <ScrollView style={styles.menuScroll} nestedScrollEnabled>
              {SERVICE_GROUPS.map((group) => (
                <Choice key={group.label} text={group.label} onPress={() => {
                  setServiceGroup(group.label)
                  setGroupOpen(false)
                  const first = group.items[0]
                  if (first) setCategory(first)
                }} />
              ))}
            </ScrollView>
          </Dropdown>

          <Dropdown label="單種" value={category} open={categoryOpen} onToggle={() => setCategoryOpen(!categoryOpen)}>
            <ScrollView style={styles.menuScroll} nestedScrollEnabled>
              {groupItems.map((item) => (
                <Choice key={item} text={item} onPress={() => { setCategory(item); setCategoryOpen(false) }} />
              ))}
            </ScrollView>
          </Dropdown>

          <CategoryFields
            category={category}
            secrecy={secrecy}
            setSecrecy={setSecrecy}
            hours={hours}
            setHours={setHours}
            hourlyMode={hourlyMode}
            setHourlyMode={changeHourlyMode}
            hourlyRanks={hourlyRanks}
            setHourlyRank={changeHourlyRank}
            guaranteeTier={guaranteeTier}
            setGuaranteeTier={setGuaranteeTier}
            trialPeriod={trialPeriod}
            setTrialPeriod={setTrialPeriod}
            femaleMode={femaleMode}
            setFemaleMode={changeFemaleMode}
            femalePureMode={femalePureMode}
            setFemalePureMode={changeFemalePureMode}
            femaleTechRank={femaleTechRank}
            setFemaleTechRank={changeFemaleTechRank}
            entertainmentType={entertainmentType}
            setEntertainmentType={(value: EntertainmentType) => {
              const opts = ENTERTAINMENT_OPTIONS[value] as readonly { label: string; price: number }[]
              setEntertainmentType(value)
              setEntertainmentOption(opts[0]?.label ?? '')
              if (value === '自訂') setSimpleDetail('')
              setAmountManual(false)
            }}
            entertainmentOption={entertainmentOption}
            setEntertainmentOption={(value: string) => { setEntertainmentOption(value); setAmountManual(false) }}
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
            setSlotCount={setSlotCount}
          />
        </Card>

        <Card>
          <H2>2. 下單資料</H2>
          <Text style={styles.label}>下單日期</Text>
          <Field value={orderDate} onChangeText={setOrderDate} placeholder="YYYY-MM-DD" />

          <Segment
            label="下單身份"
            options={['一般老闆', '打手自己下單']}
            value={selfOrder ? '打手自己下單' : '一般老闆'}
            onChange={(value) => {
              const enabled = value === '打手自己下單'
              setSelfOrder(enabled)
              setAmountManual(false)
              setCustomerOpen(false)
              setSelfOrderOpen(false)
              if (enabled) {
                setCustomerId('')
                setCustomerName('')
                setCustomerQuery('')
                setShowAddCustomer(false)
                setCustomerDiscount('無折扣')
                setPlayerAbsorbsDiscount(false)
              } else {
                setSelfOrderPlayerId('')
                setSelfOrderPlayerName('')
                setSelfOrderQuery('')
                setSelfPayment('直接付款')
              }
            }}
          />

          {!selfOrder ? (
            <>
              <SearchPicker
                label="下單老闆"
                selectedLabel={customerName || '點這裡選擇老闆'}
                open={customerOpen}
                onToggle={() => setCustomerOpen(!customerOpen)}
                query={customerQuery}
                setQuery={setCustomerQuery}
                items={customerItems}
                onSelect={(item: SearchItem) => {
                  setCustomerId(item.id)
                  setCustomerName(item.label)
                  setCustomerQuery('')
                  setCustomerOpen(false)
                }}
                addLabel="＋ 名單沒有？新增老闆"
                onAdd={() => { setCustomerOpen(false); setShowAddCustomer(true) }}
              />

              {showAddCustomer ? (
                <View style={styles.inline}>
                  <Field value={newCustomer} onChangeText={setNewCustomer} placeholder="新老闆名稱" />
                  <Button title="新增並選擇" onPress={addCustomer} />
                  <Button title="取消" tone="neutral" onPress={() => setShowAddCustomer(false)} />
                </View>
              ) : null}

              <Segment
                label="老闆折扣"
                options={['無折扣', '95折', '9折', '85折', '8折', '自訂']}
                value={customerDiscount}
                onChange={(value) => {
                  setCustomerDiscount(value as '無折扣' | '95折' | '9折' | '85折' | '8折' | '自訂')
                  setAmountManual(false)
                  if (value === '無折扣') setPlayerAbsorbsDiscount(false)
                }}
              />

              {customerDiscount === '自訂' ? (
                <>
                  <Text style={styles.label}>自訂折扣（付款比例 %）</Text>
                  <Field value={customDiscountPct} onChangeText={(value) => { setCustomDiscountPct(value); setAmountManual(false) }} keyboardType="decimal-pad" placeholder="例如 80 = 8折" />
                </>
              ) : null}

              {customerDiscount !== '無折扣' ? (
                <Segment
                  label="折扣由誰吸收"
                  options={['公司吸收', '打手吸收']}
                  value={playerAbsorbsDiscount ? '打手吸收' : '公司吸收'}
                  onChange={(value) => { setPlayerAbsorbsDiscount(value === '打手吸收'); setAmountManual(false) }}
                />
              ) : null}

              {customerDiscount !== '無折扣' ? (
                <Muted>{playerAbsorbsDiscount ? '打手吸收：打手實拿會依折扣後金額同比例計算。' : '公司吸收：老闆付折扣價，但打手仍按原價計算實拿。'}</Muted>
              ) : null}
            </>
          ) : (
            <>
              <SearchPicker
                label="下單打手"
                selectedLabel={selfOrderPlayerName || '點這裡選擇打手'}
                open={selfOrderOpen}
                onToggle={() => setSelfOrderOpen(!selfOrderOpen)}
                query={selfOrderQuery}
                setQuery={setSelfOrderQuery}
                items={playersList.map((player) => ({ id: player.id, label: player.display_name }))}
                onSelect={(item: SearchItem) => {
                  setSelfOrderPlayerId(item.id)
                  setSelfOrderPlayerName(item.label)
                  setSelfOrderQuery('')
                  setSelfOrderOpen(false)
                }}
                addLabel=""
                onAdd={() => {}}
                hideAdd
              />
              <Segment label="付款方式" options={['直接付款', '薪資扣款']} value={selfPayment} onChange={(value) => setSelfPayment(value as '直接付款' | '薪資扣款')} />
              <Muted>{selfDiscountAllowed ? '打手自己下單自動 9 折；接單打手實拿仍按原價計算。' : `${category} 不享打手自下單 9 折。`}</Muted>
            </>
          )}

          <Text style={styles.label}>總金額</Text>
          <Field
            value={amount}
            onChangeText={(value) => {
              setAmount(value)
              setAmountManual(true)
              if (category === '娛樂單') {
                const result = entertainmentPricing(Number(value || 0))
                setSlots((current) => current.map((slot, i) => ({ ...slot, pay: String(result.pays[i] ?? 0) })))
              }
            }}
            keyboardType="decimal-pad"
          />

          <View style={styles.summaryRow}>
            <Muted>{originalSystemAmount !== systemAmount ? `原價：$${originalSystemAmount}｜折扣後：$${systemAmount}` : `系統價：$${systemAmount}`}</Muted>
            {amountManual ? (
              <Pressable onPress={() => { setAmountManual(false); setAmount(String(systemAmount)) }}>
                <Text style={styles.link}>套用系統價</Text>
              </Pressable>
            ) : null}
          </View>
        </Card>

        {requiresPlayers ? (
          <Card>
            <H2>3. 打手與實拿</H2>

            {category === '小時單' ? <Muted>打手等級直接固定跟隨上面設定，不需要在下面再選一次。</Muted> : null}
            {category === '女陪單' ? (
              <Muted>{femaleMode === '女+技術陪' ? '女陪欄只顯示女陪名單；技術陪欄只顯示技術打手名單。' : '純女陪只會顯示女陪名單。'}</Muted>
            ) : null}

            {slots.map((slot, index) => {
              const expectedType = requiredPlayerType(index)
              const playerItems: SearchItem[] = playersList
                .filter((player) => player.player_type === expectedType)
                .filter((player) => !slots.some((other, otherIndex) => otherIndex !== index && other.playerId === player.id))
                .map((player) => ({ id: player.id, label: player.display_name }))
              const fieldLabel = playerFieldLabel(index)

              return (
                <View key={index} style={styles.playerBox}>
                  <SearchPicker
                    label={fieldLabel}
                    selectedLabel={slot.playerName || `點這裡選擇${fieldLabel}`}
                    open={playerOpen === index}
                    onToggle={() => setPlayerOpen(playerOpen === index ? null : index)}
                    query={playerQueries[index] ?? ''}
                    setQuery={(value: string) => setPlayerQueries((current) => ({ ...current, [index]: value }))}
                    items={playerItems}
                    onSelect={(item: SearchItem) => {
                      const player = playersList.find((p) => p.id === item.id)
                      if (player) choosePlayer(index, player)
                    }}
                    addLabel={`＋ 名單沒有？新增${expectedType === 'female' ? '女陪' : '技術打手'}`}
                    onAdd={() => {
                      setPlayerOpen(null)
                      setShowAddPlayer(index)
                      setNewPlayerType(expectedType)
                      setNewPlayer('')
                    }}
                  />

                  {showAddPlayer === index ? (
                    <View style={styles.inline}>
                      <Field value={newPlayer} onChangeText={setNewPlayer} placeholder={newPlayerType === 'female' ? '新女陪名稱' : '新技術打手名稱'} />
                      <Segment
                        label="打手類型"
                        options={['技術陪', '女陪']}
                        value={newPlayerType === 'female' ? '女陪' : '技術陪'}
                        onChange={(value) => setNewPlayerType(value === '女陪' ? 'female' : 'technical')}
                      />
                      <Button title="新增並選擇" onPress={() => addPlayer(index)} />
                      <Button title="取消" tone="neutral" onPress={() => setShowAddPlayer(null)} />
                    </View>
                  ) : null}

                  {category === '小時單' ? <Muted>接單等級固定：{hourlyRanks[index] ?? slot.rank} 級</Muted> : null}
                  {category === '女陪單' && femaleMode === '女+技術陪' && index === 1 ? <Muted>這位技術陪以 {femaleTechRank} 級接單。</Muted> : null}

                  <Text style={styles.label}>{fieldLabel}實拿金額</Text>
                  <Field
                    value={slot.pay}
                    onChangeText={(value) => setSlots((current) => current.map((s, i) => i === index ? { ...s, pay: value } : s))}
                    keyboardType="decimal-pad"
                  />
                </View>
              )
            })}
          </Card>
        ) : null}

        <Card>
          <H2>{requiresPlayers ? '4. 派單' : '3. 派單'}</H2>

          <Dropdown label="派單人" value={dispatcherName || '點這裡選擇派單人'} open={dispatcherOpen} onToggle={() => setDispatcherOpen(!dispatcherOpen)}>
            <ScrollView style={styles.menuScroll} nestedScrollEnabled>
              {dispatchers.map((item) => (
                <Choice key={item.id} text={`${item.display_name}${item.display_name.trim().toLowerCase() === 'bobo' ? '（店長）' : ''}`} onPress={() => chooseDispatcher(item)} />
              ))}
              <Choice text="不指定派單人" onPress={() => {
                setDispatcherId('')
                setDispatcherName('')
                setDispatcherRole('')
                setDispatcherOpen(false)
              }} />
            </ScrollView>
          </Dropdown>

          <Segment
            label="派單抽成"
            options={['0%', '2.5%', '3%', '5%', '自訂']}
            value={dispatchPresetValue}
            onChange={(value) => {
              if (value === '自訂') {
                if (DISPATCH_PRESETS.includes(dispatchPct as (typeof DISPATCH_PRESETS)[number])) setDispatchPct('')
              } else {
                setDispatchPct(value.replace('%', ''))
              }
            }}
          />

          {dispatchPresetValue === '自訂' ? (
            <>
              <Text style={styles.label}>自訂派單抽成 %</Text>
              <Field value={dispatchPct} onChangeText={setDispatchPct} keyboardType="decimal-pad" placeholder="例如 4" />
            </>
          ) : null}

          <Text style={styles.money}>派單人實拿：${dispatchFee}（{dispatchPct || 0}%）</Text>
        </Card>

        <Button title={busy ? '送出中…' : '送出報單'} onPress={submit} disabled={busy || loading} />
      </Screen>
    </ScrollView>
  )
}

function CategoryFields(props: any) {
  const c: ServiceCategory = props.category

  return (
    <View style={{ gap: 10 }}>
      {c === '小時單' ? (
        <>
          <Segment label="單陪 / 雙陪" options={['單陪', '雙陪']} value={props.hourlyMode} onChange={props.setHourlyMode} />
          <Segment label={props.hourlyMode === '單陪' ? '小時單等級' : '第 1 個等級'} options={RANKS} value={props.hourlyRanks[0]} onChange={(value) => props.setHourlyRank(0, value)} />
          {props.hourlyMode === '雙陪' ? <Segment label="第 2 個等級" options={RANKS} value={props.hourlyRanks[1]} onChange={(value) => props.setHourlyRank(1, value)} /> : null}
        </>
      ) : null}

      {['小時單', '保底單', '女陪單'].includes(c) ? <Segment label="機密 / 絕密" options={SECRECY} value={props.secrecy} onChange={props.setSecrecy} /> : null}
      {['小時單', '教學單', '女陪單'].includes(c) ? (
        <>
          <Text style={styles.label}>小時數</Text>
          <Field value={props.hours} onChangeText={props.setHours} keyboardType="decimal-pad" placeholder="例如 2.5" />
        </>
      ) : null}
      {c === '保底單' ? <Segment label="保底金額" options={Object.keys(GUARANTEE_PRICE.機密)} value={props.guaranteeTier} onChange={props.setGuaranteeTier} /> : null}
      {c === '體驗單' ? <Segment label="體驗方案" options={['每日', '每週']} value={props.trialPeriod} onChange={props.setTrialPeriod} /> : null}

      {c === '女陪單' ? (
        <>
          <Segment label="女陪類型" options={['女+技術陪', '純女陪']} value={props.femaleMode} onChange={props.setFemaleMode} />
          {props.femaleMode === '女+技術陪'
            ? <Segment label="技術陪等級" options={RANKS} value={props.femaleTechRank} onChange={props.setFemaleTechRank} />
            : <Segment label="單陪 / 雙陪" options={['單陪', '雙陪']} value={props.femalePureMode} onChange={props.setFemalePureMode} />}
        </>
      ) : null}

      {c === '娛樂單' ? (
        <>
          <Segment label="娛樂單種類" options={ENTERTAINMENT_TYPES} value={props.entertainmentType} onChange={props.setEntertainmentType} />
          {props.entertainmentType !== '自訂' ? <Segment label="方案" options={props.entertainmentOptions.map((o: any) => o.label)} value={props.entertainmentOption} onChange={props.setEntertainmentOption} /> : null}
          {props.entertainmentType === '自訂' ? (
            <>
              <Text style={styles.label}>自訂內容</Text>
              <Field value={props.simpleDetail} onChangeText={props.setSimpleDetail} placeholder="自己填這張娛樂單要做什麼" />
              <Muted>自訂單沒有固定金額，總金額預設為 0，可在下方自行修改。</Muted>
            </>
          ) : props.entertainmentOptions.find((o: any) => o.label === props.entertainmentOption)?.price === 0 ? <Muted>此方案沒有固定金額，總金額預設為 0。</Muted> : null}
        </>
      ) : null}

      {c === '跑刀' ? (
        <>
          <Segment label="跑刀" options={['1000w', '5000w', '1e', '自訂']} value={props.runTier} onChange={props.setRunTier} />
          <Segment label="負責人" options={['華', '望舒', '睡', '其他']} value={['華', '望舒', '睡'].includes(props.responsible) ? props.responsible : '其他'} onChange={(value) => props.setResponsible(value === '其他' ? '' : value)} />
          {!['華', '望舒', '睡'].includes(props.responsible) ? <Field value={props.responsible} onChangeText={props.setResponsible} placeholder="其他負責人" /> : null}
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
          <Field value={props.simpleDetail} onChangeText={props.setSimpleDetail} placeholder={c === '撞紅' ? '填什麼紅' : c === '撞子彈' ? '填什麼子彈' : '填什麼任務'} />
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
          {props.seasonMode === '部分/造型' ? <Field value={props.simpleDetail} onChangeText={props.setSimpleDetail} placeholder="做哪個部分 / 造型" /> : null}
          <Muted>負責人固定：林峰</Muted>
        </>
      ) : null}

      {c === '調畫質' ? <Muted>固定 $520｜負責人：林峰｜派單不抽成。</Muted> : null}

      {c === '代儲' ? (
        <>
          <Text style={styles.label}>代儲品項</Text>
          <ScrollView style={styles.menuScroll} nestedScrollEnabled>
            {TOPUP_OPTIONS.map((option, index) => <Choice key={option.label} text={`${option.label}｜老闆 $${option.customer}｜${option.rmb} RMB`} onPress={() => props.setTopupIndex(index)} />)}
            <Choice text="其他 / 自訂代儲" accent onPress={() => props.setTopupIndex(null)} />
          </ScrollView>
          {props.topupIndex === null ? (
            <>
              <Field value={props.simpleDetail} onChangeText={props.setSimpleDetail} placeholder="自訂代儲內容" />
              <Field value={props.topupRmb} onChangeText={props.setTopupRmb} keyboardType="decimal-pad" placeholder="RMB 金額" />
            </>
          ) : null}
          <Segment label="負責充值" options={['小白', '莫北', 'BoBo']} value={props.responsible} onChange={props.setResponsible} />
        </>
      ) : null}

      {c === '勇敢者' ? <Muted>固定 $3680｜2 位打手。</Muted> : null}
    </View>
  )
}

function SearchPicker({ label, selectedLabel, open, onToggle, query, setQuery, items, onSelect, addLabel, onAdd, hideAdd = false }: any) {
  const q = query.trim().toLowerCase()
  const filtered = items.filter((item: SearchItem) => !q || (item.searchText ?? item.label).toLowerCase().includes(q))

  return (
    <Dropdown label={label} value={selectedLabel} open={open} onToggle={onToggle}>
      <View style={{ gap: 8, paddingTop: 8 }}>
        <Field value={query} onChangeText={setQuery} placeholder={`搜尋${label}`} />
        <ScrollView style={styles.searchResults} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {filtered.map((item: SearchItem) => <Choice key={item.id} text={item.label} onPress={() => onSelect(item)} />)}
          {filtered.length === 0 ? <Text style={styles.emptyText}>找不到符合資料</Text> : null}
        </ScrollView>
        {!hideAdd ? <Choice text={addLabel} onPress={onAdd} accent /> : null}
      </View>
    </Dropdown>
  )
}

function Dropdown({ label, value, open, onToggle, children }: any) {
  return (
    <View style={{ gap: 7 }}>
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

function Segment({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string; onChange: (value: string) => void }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.segment}>
        {options.map((option) => (
          <Pressable key={option} onPress={() => onChange(option)} style={[styles.segmentItem, value === option && styles.segmentActive]}>
            <Text style={[styles.segmentText, value === option && styles.segmentTextActive]}>{option}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  label: { color: colors.text, fontWeight: '700', fontSize: 14 },
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
  menu: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.panel2
  },
  menuScroll: { maxHeight: 235 },
  searchResults: { maxHeight: 235 },
  choice: {
    minHeight: 46,
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  choiceText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  emptyText: { color: colors.muted, padding: 14 },
  inline: { gap: 8, padding: 10, borderRadius: 12, backgroundColor: colors.panel2 },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  segmentItem: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel2
  },
  segmentActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  segmentText: { color: colors.text, fontWeight: '700' },
  segmentTextActive: { color: '#051018' },
  playerBox: { gap: 9, paddingBottom: 14, borderBottomColor: colors.border, borderBottomWidth: 1 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  link: { color: colors.accent, fontWeight: '800' },
  money: { color: colors.accent, fontSize: 20, fontWeight: '800' }
})
