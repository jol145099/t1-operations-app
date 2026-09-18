import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { Button, Card, H1, H2, Muted, Screen, colors } from '@/components/ui'
import { useAuth } from '@/providers/AuthProvider'
import { supabase } from '@/lib/supabase'

function Stat({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  const content = <Card style={styles.stat}>
      <Muted>{label}</Muted>
      <Text style={styles.statValue}>{value}</Text>
    </Card>
  return onPress ? <Pressable onPress={onPress} style={styles.statPress}>{content}</Pressable> : content
}

export default function HomeScreen() {
  const { profile, signOut } = useAuth()
  const role = profile?.role
  const [inProgress, setInProgress] = useState(0)
  const [completedTwoWeeks, setCompletedTwoWeeks] = useState(0)
  const [playerStats,setPlayerStats]=useState({inProgress:0,completed:0,orderPay:0,payable:0})

  useFocusEffect(useCallback(() => {
    let alive = true
    if(role==='player'){
      ;(async()=>{const {data:p}=await supabase.from('players').select('id').eq('profile_id',profile?.id).maybeSingle();if(!p)return;const period=currentPeriod();const [a,l,s]=await Promise.all([supabase.from('order_players').select('status,final_pay,calculated_pay,assigned_pay,orders!inner(status,completed_at)').eq('player_id',p.id),supabase.from('ledger').select('amount').eq('player_id',p.id).gte('occurred_at',period.start).lt('occurred_at',period.next),supabase.from('settlements').select('carry_in,total_payable').eq('player_id',p.id).eq('period_start',period.start.slice(0,10)).eq('period_end',period.end).maybeSingle()]);const rows=(a.data??[]) as any[];const completedRows=rows.filter(x=>x.orders?.status==='completed'&&x.orders?.completed_at>=period.start&&x.orders?.completed_at<period.next);const orderPay=completedRows.reduce((n,x)=>n+Number(x.final_pay??x.calculated_pay??x.assigned_pay??0),0);const adj=(l.data??[]).reduce((n:any,x:any)=>n+Number(x.amount||0),0);const carry=Number(s.data?.carry_in||0);if(alive)setPlayerStats({inProgress:rows.filter(x=>x.orders?.status==='in_progress'&&x.status!=='cancelled').length,completed:completedRows.length,orderPay,payable:s.data?Number(s.data.total_payable||0):orderPay+adj+carry})})()
      return()=>{alive=false}
    }
    if (role !== 'staff' && role !== 'admin') return

    ;(async () => {
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      const [{ count: progress }, { count: completed }] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('completed_at', since)
      ])
      if (alive) { setInProgress(progress ?? 0); setCompletedTwoWeeks(completed ?? 0) }
    })()
    return () => { alive = false }
  }, [role,profile?.id]))

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
              <Button title="瀏覽打手" onPress={() => router.push('/player-preview')} />
              <Button title="查看消費紀錄" onPress={() => router.push('/orders')} tone="neutral" />
            </Card>
          </>
        )}

        {role === 'player' && (
          <>
            <View style={styles.row}>
              <Stat label="進行中單數" value={String(playerStats.inProgress)} onPress={() => router.push({pathname:'/orders',params:{status:'in_progress'}})} />
              <Stat label="這期結單數" value={String(playerStats.completed)} onPress={() => router.push({pathname:'/orders',params:{status:'completed'}})} />
            </View>
            <View style={styles.row}>
              <Stat label="本期完單" value={`${Math.ceil(playerStats.orderPay).toLocaleString()}`} />
              <Stat label="目前應付" value={`${Math.ceil(playerStats.payable).toLocaleString()}`} />
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
              <Stat label="進行中訂單" value={String(inProgress)} onPress={() => router.push({ pathname: '/orders', params: { status: 'in_progress' } })} />
              <Stat label="已結單（2週）" value={String(completedTwoWeeks)} onPress={() => router.push({ pathname: '/orders', params: { status: 'completed', days: '14' } })} />
            </View>
            <Card>
              <H2>營運中心</H2>
              <Muted>客服與店長可以報單、派單、記錄租號/賠付/預支，以及查看結算。</Muted>
              <Button title="＋ 新增報單" onPress={() => router.push('/new-order')} />
              {role === 'admin' ? <Button title="打手管理" onPress={() => router.push('/player-management')} tone="neutral" /> : null}
              <Button title="打手預覽" onPress={() => router.push('/player-preview')} tone="neutral" />
              <Button title="打手帳務調整" onPress={() => router.push('/adjustments')} tone="neutral" />
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
  statPress: { flex: 1 },
  statValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800'
  }
})

function currentPeriod(){const n=new Date(),y=n.getFullYear(),m=n.getMonth(),d=n.getDate();let s:Date,e:Date,x:Date;if(d===1){s=new Date(y,m-1,16);e=new Date(y,m,1);x=new Date(y,m,2)}else if(d<=15){s=new Date(y,m,2);e=new Date(y,m,15);x=new Date(y,m,16)}else{s=new Date(y,m,16);e=new Date(y,m+1,1);x=new Date(y,m+1,2)}const iso=(z:Date)=>{const yy=z.getFullYear(),mm=String(z.getMonth()+1).padStart(2,'0'),dd=String(z.getDate()).padStart(2,'0');return `${yy}-${mm}-${dd}`};return{start:iso(s)+'T00:00:00',end:iso(e),next:iso(x)+'T00:00:00'}}
