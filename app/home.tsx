import { router } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { Button, Card, H1, H2, Muted, Screen, colors } from '@/components/ui'
import { useAuth } from '@/providers/AuthProvider'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.stat}>
      <Muted>{label}</Muted>
      <Text style={styles.statValue}>{value}</Text>
    </Card>
  )
}

export default function HomeScreen() {
  const { profile, signOut } = useAuth()
  const role = profile?.role

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        <H1>你好，{profile?.display_name ?? 'T1'}</H1>
        <Muted>目前身份：{role ?? '尚未設定'}</Muted>

        {role === 'customer' && (
          <>
            <View style={styles.row}>
              <Stat label="本月消費" value="$0" />
              <Stat label="VIP" value="Lv. 0" />
            </View>
            <Card>
              <H2>老闆中心</H2>
              <Muted>查看自己的消費紀錄、VIP 等級、VIP 福利與儲值金。</Muted>
              <Button title="查看消費紀錄" onPress={() => router.push('/orders')} />
            </Card>
          </>
        )}

        {role === 'player' && (
          <>
            <View style={styles.row}>
              <Stat label="本期完單" value="$0" />
              <Stat label="目前應付" value="$0" />
            </View>
            <Card>
              <H2>打手中心</H2>
              <Muted>查看指派給你的單、接單、結單，以及這兩週所有加扣款。</Muted>
              <Button title="我的訂單" onPress={() => router.push('/orders')} />
              <Button title="兩週結算" onPress={() => router.push('/settlement')} tone="neutral" />
            </Card>
          </>
        )}

        {(role === 'staff' || role === 'admin') && (
          <>
            <View style={styles.row}>
              <Stat label="進行中訂單" value="0" />
              <Stat label="待結單" value="0" />
            </View>
            <Card>
              <H2>營運中心</H2>
              <Muted>客服與店長可以報單、派單、記錄租號/賠付/預支，以及查看結算。</Muted>
              <Button title="＋ 新增報單" onPress={() => router.push('/new-order')} />
              <Button title="所有訂單" onPress={() => router.push('/orders')} tone="neutral" />
              <Button title="兩週結算" onPress={() => router.push('/settlement')} tone="neutral" />
            </Card>
          </>
        )}

        {!role && (
          <Card>
            <H2>帳號尚未設定角色</H2>
            <Muted>請先在 Supabase profiles 表為此帳號指定 customer / player / staff / admin。</Muted>
          </Card>
        )}

        <Button
          title="登出"
          tone="danger"
          onPress={async () => {
            await signOut()
            router.replace('/login')
          }}
        />
      </Screen>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12
  },
  stat: {
    flex: 1
  },
  statValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800'
  }
})
