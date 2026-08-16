import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { Card, H1, H2, Muted, Screen, colors } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/AuthProvider'

type SettlementRow = {
  player_id: string
  period_start: string
  period_end: string
  order_pay: number
  dispatch_pay: number
  adjustments: number
  total_payable: number
  payment_status: string
}

export default function SettlementScreen() {
  const { profile } = useAuth()
  const [row, setRow] = useState<SettlementRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!profile) return

      let query = supabase
        .from('settlements')
        .select(
          'player_id, period_start, period_end, order_pay, dispatch_pay, adjustments, total_payable, payment_status'
        )
        .order('period_end', { ascending: false })
        .limit(1)

      if (profile.role === 'player') {
        query = query.eq('player_id', profile.id)
      }

      const { data } = await query.maybeSingle()
      setRow((data as SettlementRow | null) ?? null)
      setLoading(false)
    }

    load()
  }, [profile?.id])

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    )
  }

  return (
    <Screen>
      <H1>兩週結算</H1>
      {!row ? (
        <Card>
          <Muted>目前還沒有結算紀錄。</Muted>
        </Card>
      ) : (
        <>
          <Card>
            <H2>{row.period_start} → {row.period_end}</H2>
            <Line label="完單收入" value={row.order_pay} />
            <Line label="派單收入" value={row.dispatch_pay} />
            <Line label="其他加扣" value={row.adjustments} />
          </Card>

          <Card>
            <Muted>目前應付</Muted>
            <Text style={styles.total}>${Number(row.total_payable).toLocaleString()}</Text>
            <Muted>付款狀態：{row.payment_status}</Muted>
          </Card>
        </>
      )}
    </Screen>
  )
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.line}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>${Number(value).toLocaleString()}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: colors.muted },
  value: { color: colors.text, fontWeight: '700' },
  total: { color: colors.accent, fontSize: 34, fontWeight: '900' }
})
