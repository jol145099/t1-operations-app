import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Button, Card, Field, H1, H2, Muted, Screen, colors } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/AuthProvider'

type Mode='drops'|'guarantee'|'games'|'hours'|'ratio'|'manual'
const MODES:{key:Mode;label:string;unit:string}[]=[
 {key:'drops',label:'滴數',unit:'滴'},{key:'guarantee',label:'保底金額',unit:'w'},
 {key:'games',label:'局數',unit:'局'},{key:'hours',label:'小時',unit:'小時'},
 {key:'ratio',label:'比例',unit:'%'},{key:'manual',label:'手動金額',unit:''}
]

export default function OrderPayAdjustmentsScreen(){
 const {profile}=useAuth()
 const params=useLocalSearchParams<{orderId?:string;orderNo?:string}>()
 const orderId=String(params.orderId??''); const orderNo=String(params.orderNo??'訂單')
 const canEdit=profile?.role==='staff'||profile?.role==='admin'
 const [players,setPlayers]=useState<any[]>([]),[assignments,setAssignments]=useState<any[]>([]),[rows,setRows]=useState<any[]>([])
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false)
 const [playerId,setPlayerId]=useState(''),[mode,setMode]=useState<Mode>('drops'),[direction,setDirection]=useState<'earn'|'compensate'>('earn')
 const [baseAmount,setBaseAmount]=useState(''),[baseUnits,setBaseUnits]=useState(''),[actualUnits,setActualUnits]=useState('')
 const [manualAmount,setManualAmount]=useState(''),[checkpoint,setCheckpoint]=useState(''),[notes,setNotes]=useState('')

 const load=useCallback(async()=>{
  if(!orderId)return; setLoading(true)
  const [p,a,j]=await Promise.all([
   supabase.from('players').select('id, display_name').eq('active',true).order('display_name'),
   supabase.from('order_players').select('id, player_id, assigned_pay, final_pay, players(display_name)').eq('order_id',orderId).order('created_at'),
   supabase.from('order_pay_adjustments').select('id, player_id, mode, direction, base_amount, base_units, actual_units, ratio, amount, checkpoint_label, notes, created_at, players(display_name)').eq('order_id',orderId).order('created_at')
  ])
  if(p.error||a.error||j.error) Alert.alert('讀取失敗',p.error?.message||a.error?.message||j.error?.message||'')
  else {setPlayers(p.data??[]);setAssignments(a.data??[]);setRows(j.data??[]);if(!playerId&&p.data?.length)setPlayerId(p.data[0].id)}
  setLoading(false)
 },[orderId,playerId])
 useEffect(()=>{load()},[load])

 const unit=MODES.find(x=>x.key===mode)?.unit??''
 const preview=useMemo(()=>{
  if(mode==='manual')return Math.ceil(Math.max(0,Number(manualAmount)||0))
  const base=Math.max(0,Number(baseAmount)||0),whole=Math.max(0,Number(baseUnits)||0),actual=Math.max(0,Number(actualUnits)||0)
  return base&&whole?Math.ceil(base*(actual/whole)):0
 },[mode,baseAmount,baseUnits,actualUnits,manualAmount])
 const signed=direction==='compensate'?-preview:preview

 async function add(){
  if(!canEdit||!playerId||!orderId)return
  if(!preview){Alert.alert('資料不足',mode==='manual'?'請輸入調整金額。':'請輸入基準金額、完整工作量與實際工作量。');return}
  setBusy(true)
  const whole=mode==='manual'?null:Math.max(0,Number(baseUnits)||0),actual=mode==='manual'?null:Math.max(0,Number(actualUnits)||0)
  const {error}=await supabase.from('order_pay_adjustments').insert({
   order_id:orderId,player_id:playerId,mode,direction,
   base_amount:mode==='manual'?preview:Math.max(0,Number(baseAmount)||0),
   base_units:whole,actual_units:actual,ratio:whole&&actual!=null?actual/whole:null,amount:signed,
   checkpoint_label:checkpoint.trim()||null,notes:notes.trim()||null,created_by:profile?.id
  })
  if(!error) await supabase.rpc('recalculate_order_player_final_pay',{p_order_id:orderId})
  setBusy(false)
  if(error)Alert.alert('新增失敗',error.message);else{setActualUnits('');setManualAmount('');setCheckpoint('');setNotes('');await load()}
 }
 async function remove(id:string){
  setBusy(true);const {error}=await supabase.from('order_pay_adjustments').delete().eq('id',id)
  if(!error)await supabase.rpc('recalculate_order_player_final_pay',{p_order_id:orderId})
  setBusy(false);if(error)Alert.alert('刪除失敗',error.message);else await load()
 }
 if(!orderId)return <Screen><H1>訂單內賠付</H1><Muted>缺少訂單 ID。</Muted></Screen>
 return <Screen>
  <H1>訂單內賠付</H1><Muted>{orderNo} · 按實際價格／薪資比例換算，可記錄換人 checkpoint。</Muted>
  {loading?<ActivityIndicator color={colors.accent}/>:<FlatList data={rows} keyExtractor={x=>x.id} contentContainerStyle={{gap:12,paddingBottom:30}}
   ListHeaderComponent={<View style={{gap:12}}>
    <Card><H2>目前最終薪資</H2>{assignments.map(a=><View key={a.id} style={styles.row}><Text style={styles.text}>{a.players?.display_name??'打手'}</Text><Text style={styles.money}>$ {Number(a.final_pay??a.assigned_pay).toLocaleString()}</Text></View>)}</Card>
    {canEdit?<Card><H2>新增賠付／薪資分配</H2><Muted>打手</Muted><View style={styles.chips}>{players.map(p=><Chip key={p.id} label={p.display_name} active={playerId===p.id} onPress={()=>setPlayerId(p.id)}/>)}</View>
     <Muted>計算方式</Muted><View style={styles.chips}>{MODES.map(m=><Chip key={m.key} label={m.label} active={mode===m.key} onPress={()=>setMode(m.key)}/>)}</View>
     <Muted>性質</Muted><View style={styles.chips}><Chip label="應得 +" active={direction==='earn'} onPress={()=>setDirection('earn')}/><Chip label="賠付 -" active={direction==='compensate'} onPress={()=>setDirection('compensate')}/></View>
     {mode==='manual'?<Field value={manualAmount} onChangeText={setManualAmount} placeholder="直接輸入金額" keyboardType="decimal-pad"/>:<>
      <Field value={baseAmount} onChangeText={setBaseAmount} placeholder="完整工作對應金額，例如 2107" keyboardType="decimal-pad"/>
      <Field value={baseUnits} onChangeText={setBaseUnits} placeholder={'完整工作量，例如 30'+unit} keyboardType="decimal-pad"/>
      <Field value={actualUnits} onChangeText={setActualUnits} placeholder={'本次有效／賠付量（'+unit+'）'} keyboardType="decimal-pad"/></>}
     <Field value={checkpoint} onChangeText={setCheckpoint} placeholder="Checkpoint，例如 30 → 41.5 / SE 換人"/><Field value={notes} onChangeText={setNotes} placeholder="備註（可不填）"/>
     <Text style={[styles.preview,signed<0&&{color:colors.danger}]}>本次：{signed>=0?'+':'-'}$ {Math.abs(signed).toLocaleString()}</Text><Button title={busy?'儲存中…':'加入這筆'} onPress={add} disabled={busy}/></Card>:null}
    <H2>賠付／分配紀錄</H2>
   </View>}
   ListEmptyComponent={<Muted>這張單目前沒有賠付或重新分配紀錄。</Muted>}
   renderItem={({item})=><Card><View style={styles.row}><Text style={styles.text}>{item.players?.display_name??'打手'} · {MODES.find(m=>m.key===item.mode)?.label??item.mode}</Text><Text style={[styles.money,Number(item.amount)<0&&{color:colors.danger}]}>{Number(item.amount)>=0?'+':'-'}$ {Math.abs(Number(item.amount)).toLocaleString()}</Text></View>
    {item.base_units!=null?<Muted>{Number(item.actual_units)} / {Number(item.base_units)} · {(Number(item.ratio??0)*100).toFixed(2)}%</Muted>:null}{item.checkpoint_label?<Muted>Checkpoint：{item.checkpoint_label}</Muted>:null}{item.notes?<Muted>{item.notes}</Muted>:null}
    {canEdit?<Button title="刪除這筆" tone="danger" onPress={()=>remove(item.id)} disabled={busy}/>:null}</Card>}
  />}
 </Screen>
}
function Chip({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){return <Pressable onPress={onPress} style={[styles.chip,active&&styles.chipActive]}><Text style={[styles.chipText,active&&styles.chipTextActive]}>{label}</Text></Pressable>}
const styles=StyleSheet.create({
 chips:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{borderWidth:1,borderColor:colors.border,backgroundColor:colors.panel2,paddingHorizontal:12,paddingVertical:9,borderRadius:999},
 chipActive:{backgroundColor:colors.accent,borderColor:colors.accent},chipText:{color:colors.text,fontWeight:'700'},chipTextActive:{color:'#051018'},
 row:{flexDirection:'row',justifyContent:'space-between',gap:12,alignItems:'center'},text:{color:colors.text,fontWeight:'700',flex:1},money:{color:colors.success,fontWeight:'900',fontSize:17},preview:{color:colors.success,fontWeight:'900',fontSize:22}
})
