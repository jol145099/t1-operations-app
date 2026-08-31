import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text } from 'react-native'

import { Card, H1, Muted, Screen, colors } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/AuthProvider'

type OrderRow = {
  id: string
  order_no: string
  amount_paid: number
  status: string
  created_at: string
}

export default function OrdersScreen() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_no, amount_paid, status, created_at')
        .order('created_at', { ascending: false })
        .limit(50)

      if (!error) setRows((data ?? []) as OrderRow[])
      setLoading(false)
    }

    load()
  }, [profile?.id])

  return (
    <Screen>
      <H1>訂單</H1>
      <Muted>RLS 會依登入角色自動限制能看到的訂單。</Muted>

      {loading ? (
        <ActivityIndicator color={colors.accent} />
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
              <Muted>{item.status}</Muted>
            </Card>
          )}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  orderNo: { color: colors.text, fontWeight: '800', fontSize: 17 },
  amount: { color: colors.accent, fontWeight: '800', fontSize: 22 }
})
