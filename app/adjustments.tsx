import { useEffect, useMemo, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

import { Button, Card, H1, H2, Muted, Screen, colors } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/AuthProvider'

type Player = { id: string; display_name: string }
type AdjustmentKind = '租號' | '賠付' | '罰錢' | '扣押金' | '預支' | '借錢' | '加雞腿' | '打手之間扣款' | '其他'

const kinds: AdjustmentKind[] = ['租號', '賠付', '罰錢', '扣押金', '預支', '借錢', '加雞腿', '打手之間扣款', '其他']
const typeMap: Record<AdjustmentKind, string> = {
  租號: 'rental',
  賠付: 'compensation',
  罰錢: 'penalty',
  扣押金: 'deposit',
  預支: 'advance',
  借錢: 'other',
  加雞腿: 'bonus',
  打手之間扣款: 'other',
  其他: 'other'
}
const defaultSign: Record<AdjustmentKind, '加款' | '扣款'> = {
  租號: '扣款',
  賠付: '扣款',
  罰錢: '扣款',
  扣押金: '扣款',
  預支: '扣款',
  借錢: '扣款',
  加雞腿: '加款',
  打手之間扣款: '扣款',
  其他: '加款'
}

export default function AdjustmentsScreen() {
  const { profile } = useAuth()
  const allowed = profile?.role === 'staff' || profile?.role === 'admin'
  const [players, setPlayers] = useState<Player[]>([])
  const [playerId, setPlayerId] = useState('')
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<AdjustmentKind>('租號')
  const [direction, setDirection] = useState<'加款' | '扣款'>('扣款')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [customKind, setCustomKind] = useState('')
  const [targetPlayerId, setTargetPlayerId] = useState('')
  const [targetQuery, setTargetQuery] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!allowed) return
    supabase.from('players').select('id, display_name').eq('active', true).order('display_name').then(({ data, error }) => {
      if (error) Alert.alert('讀取打手失敗', error.message)
      else setPlayers((data ?? []) as Player[])
    })
  }, [allowed])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? players.filter((p) => p.display_name.toLowerCase().includes(q)) : players
  }, [players, query])

  const targetFiltered = useMemo(() => {
    const q = targetQuery.trim().toLowerCase()
    return players
      .filter((p) => p.id !== playerId)
      .filter((p) => !q || p.display_name.toLowerCase().includes(q))
  }, [players, playerId, targetQuery])

  const selected = players.find((p) => p.id === playerId)
  const targetSelected = players.find((p) => p.id === targetPlayerId)

  function chooseKind(value: AdjustmentKind) {
    setKind(value)
    setDirection(defaultSign[value])
    if (value !== '其他') setCustomKind('')
    if (value !== '打手之間扣款') {
      setTargetPlayerId('')
      setTargetQuery('')
    }
  }

  async function submit() {
    const n = Math.ceil(Math.abs(Number(amount || 0)))
    if (!playerId) return Alert.alert('資料不足', '請選擇打手。')
    if (!n) return Alert.alert('資料不足', '請輸入金額。')
    if (kind === '其他' && !customKind.trim()) return Alert.alert('資料不足', '選擇其他時，請填寫這筆調整是什麼。')
    if (kind === '打手之間扣款' && !targetPlayerId) return Alert.alert('資料不足', '請選擇款項要轉給哪一位打手。')

    setBusy(true)

    if (kind === '打手之間扣款') {
      const transferLabel = description.trim() ? `｜${description.trim()}` : ''
      const { error } = await supabase.from('ledger').insert([
        {
          player_id: playerId,
          type: 'other',
          amount: -n,
          description: `打手之間扣款｜轉給 ${targetSelected?.display_name ?? '另一位打手'}${transferLabel}`,
          created_by: profile?.id,
          occurred_at: new Date().toISOString()
        },
        {
          player_id: targetPlayerId,
          type: 'other',
          amount: n,
          description: `打手之間轉入｜來自 ${selected?.display_name ?? '另一位打手'}${transferLabel}`,
          created_by: profile?.id,
          occurred_at: new Date().toISOString()
        }
      ])
      setBusy(false)
      if (error) return Alert.alert('新增失敗', error.message)
      Alert.alert('已記錄', `${selected?.display_name ?? '打手'} -$${n}\n${targetSelected?.display_name ?? '打手'} +$${n}`)
    } else {
      const signed = direction === '加款' ? n : -n
      const label = kind === '其他' ? customKind.trim() : kind
      const { error } = await supabase.from('ledger').insert({
        player_id: playerId,
        type: typeMap[kind],
        amount: signed,
        description: `${label}${description.trim() ? `｜${description.trim()}` : ''}`,
        created_by: profile?.id,
        occurred_at: new Date().toISOString()
      })
      setBusy(false)
      if (error) return Alert.alert('新增失敗', error.message)
      Alert.alert('已記錄', `${selected?.display_name ?? '打手'}｜${label}｜${direction} $${n}`)
    }

    setAmount('')
    setDescription('')
    setCustomKind('')
    setTargetPlayerId('')
    setTargetQuery('')
  }

  if (!allowed) return <Screen><H1>打手帳務調整</H1><Card><Muted>只有客服與店長/Admin 可以新增帳務調整。</Muted></Card></Screen>

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <Screen>
        <H1>打手帳務調整</H1>
        <Muted>租號、賠付、罰錢、扣押金、預支、借錢、加雞腿、打手之間扣款等，都會直接進入 ledger，兩週結算時一起計算。</Muted>

        <Card>
          <H2>1. 選擇打手</H2>
          <TextInput style={styles.input} value={query} onChangeText={setQuery} placeholder="搜尋打手" placeholderTextColor={colors.muted} />
          <View style={styles.wrap}>
            {filtered.map((p) => <Chip key={p.id} text={p.display_name} active={p.id === playerId} onPress={() => { setPlayerId(p.id); setQuery(''); if (p.id === targetPlayerId) setTargetPlayerId('') }} />)}
          </View>
        </Card>

        <Card>
          <H2>2. 調整內容</H2>
          <Text style={styles.label}>類型</Text>
          <View style={styles.wrap}>{kinds.map((k) => <Chip key={k} text={k} active={kind === k} onPress={() => chooseKind(k)} />)}</View>

          {kind === '其他' ? (
            <>
              <Text style={styles.label}>其他是什麼</Text>
              <TextInput style={styles.input} value={customKind} onChangeText={setCustomKind} placeholder="例如：補貼、設備費、特殊扣款" placeholderTextColor={colors.muted} />
            </>
          ) : null}

          {kind === '打手之間扣款' ? (
            <>
              <Muted>上面選的打手會扣款；下面選的打手會收到同額加款。</Muted>
              <Text style={styles.label}>轉給哪位打手</Text>
              <TextInput style={styles.input} value={targetQuery} onChangeText={setTargetQuery} placeholder="搜尋收款打手" placeholderTextColor={colors.muted} />
              <View style={styles.wrap}>
                {targetFiltered.map((p) => <Chip key={p.id} text={p.display_name} active={p.id === targetPlayerId} onPress={() => { setTargetPlayerId(p.id); setTargetQuery('') }} />)}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.label}>加款 / 扣款</Text>
              <View style={styles.wrap}><Chip text="加款" active={direction === '加款'} onPress={() => setDirection('加款')} /><Chip text="扣款" active={direction === '扣款'} onPress={() => setDirection('扣款')} /></View>
            </>
          )}

          <Text style={styles.label}>金額</Text>
          <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="例如 300" placeholderTextColor={colors.muted} />

          <Text style={styles.label}>備註</Text>
          <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="可選，例如：監獄租號 / 9月預支 / 本單分攤" placeholderTextColor={colors.muted} />

          {kind === '打手之間扣款'
            ? <Muted>會同時建立兩筆紀錄：付款打手負數、收款打手正數，總帳不會憑空增加或減少。</Muted>
            : <Muted>系統會自動把「加款」記為正數、「扣款」記為負數。</Muted>}

          <Button title={busy ? '儲存中…' : '確認新增'} onPress={submit} disabled={busy} />
        </Card>
      </Screen>
    </ScrollView>
  )
}

function Chip({ text, active, onPress }: { text: string; active: boolean; onPress: () => void }) {
  return <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{text}</Text></TouchableOpacity>
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: colors.text, backgroundColor: colors.card, marginBottom: 10 },
  label: { color: colors.text, fontWeight: '700', marginTop: 8, marginBottom: 7 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text },
  chipTextActive: { color: '#fff', fontWeight: '800' }
})
