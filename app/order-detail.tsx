import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Button, Card, Field, H1, H2, Muted, Screen, colors } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/AuthProvider'

export default function OrderDetailScreen(){
 const {profile}=useAuth()
 const {orderId,orderNo}=useLocalSearchParams<{orderId:string;orderNo:string}>()
 const canEdit=profile?.role==='staff'||profile?.role==='admin'
 const [rows,setRows]=useState<any[]>([]),[players,setPlayers]=useState<any[]>([]),[order,setOrder]=useState<any>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false)
 const [replaceId,setReplaceId]=useState<string|null>(null),[newPlayerId,setNewPlayerId]=useState(''),[playerQuery,setPlayerQuery]=useState(''),[finalPay,setFinalPay]=useState(''),[newFinalPay,setNewFinalPay]=useState(''),[reason,setReason]=useState(''),[completeDate,setCompleteDate]=useState(todayLocal())

 const load=useCallback(async()=>{
  if(!orderId)return;setLoading(true)
  const [a,p,o]=await Promise.all([
   supabase.from('order_players').select('id, player_id, status, assigned_pay, final_pay, compensation_amount, is_active_slot, replaced_by_assignment_id, replacement_reason, replaced_at, players(display_name)').eq('order_id',orderId).order('created_at'),
   supabase.from('players').select('id, display_name').order('display_name'),
   supabase.from('orders').select('id, status, amount_paid, completed_at').eq('id',orderId).single()
  ])
  if(a.error||p.error||o.error)Alert.alert('讀取失敗',a.error?.message||p.error?.message||o.error?.message||'')
  else{setRows(a.data??[]);setPlayers(p.data??[]);setOrder(o.data)}
  setLoading(false)
 },[orderId])
 useEffect(()=>{load()},[load])

 function beginReplace(r:any){setReplaceId(r.id);setNewPlayerId('');setPlayerQuery('');setFinalPay(String(Number(r.final_pay??r.assigned_pay??0)));setNewFinalPay('');setReason('')}

 async function replacePlayer(){
  const old=rows.find(x=>x.id===replaceId); if(!old||!newPlayerId)return
  if(rows.some(x=>x.player_id===newPlayerId && x.is_active_slot)){Alert.alert('不能換人','這位打手目前已經在這張訂單裡。');return}
  const oldPay=Number(finalPay), newPay=Number(newFinalPay)
  if(!Number.isFinite(oldPay)||!Number.isFinite(newPay)){Alert.alert('金額錯誤','請輸入原打手與新打手的實拿金額；負數代表賠付。');return}
  setBusy(true)
  const {error}=await supabase.rpc('replace_t1_order_player',{p_old_assignment_id:old.id,p_new_player_id:newPlayerId,p_old_final_pay:oldPay,p_new_final_pay:newPay,p_reason:reason.trim()||null})
  setBusy(false)
  if(error){Alert.alert('換人失敗',error.message);return}
  setReplaceId(null);await load()
 }

 async function savePay(r:any,value:string){
  const pay=Number(value)
  if(!Number.isFinite(pay)){Alert.alert('金額錯誤','請輸入正確金額；負數代表賠付。');return}
  setBusy(true)
  const {error}=await supabase.from('order_players').update({assigned_pay:pay,final_pay:pay,calculated_pay:pay,compensation_amount:0}).eq('id',r.id)
  setBusy(false);if(error)Alert.alert('儲存失敗',error.message);else await load()
 }

 async function completeOrder(){
  if(!completeDate.match(/^\d{4}-\d{2}-\d{2}$/)){Alert.alert('日期格式錯誤','請使用 YYYY-MM-DD。');return}
  setBusy(true)
  const {error}=await supabase.rpc('complete_t1_order',{p_order_id:orderId,p_completed_date:completeDate})
  setBusy(false)
  if(error)Alert.alert('結單失敗',error.message);else{Alert.alert('結單完成',`${orderNo||'訂單'} · ${completeDate}`);await load()}
 }

 if(!orderId)return <Screen><H1>訂單詳情</H1><Muted>缺少訂單 ID。</Muted></Screen>
 return <Screen><H1>{orderNo||'訂單詳情'}</H1><Muted>換人會保留「誰換誰」與原打手實拿／賠付紀錄。</Muted>
  {order?<Card><View style={styles.row}><H2>訂單狀態</H2><Text style={order.status==='completed'?styles.active:styles.name}>{order.status==='completed'?'已完成':'進行中'}</Text></View><Muted>訂單金額：$ {Number(order.amount_paid||0).toLocaleString()}</Muted>{order.status==='completed'&&order.completed_at?<Muted>結單日期：{String(order.completed_at).slice(0,10)}</Muted>:null}</Card>:null}
  {loading?<ActivityIndicator color={colors.accent}/>:<FlatList data={rows} keyExtractor={x=>x.id} contentContainerStyle={{gap:12,paddingBottom:30}}
   renderItem={({item})=><PlayerCard item={item} canEdit={canEdit} busy={busy} replacing={replaceId===item.id} players={players} rows={rows}
    newPlayerId={newPlayerId} setNewPlayerId={setNewPlayerId} playerQuery={playerQuery} setPlayerQuery={setPlayerQuery} finalPay={finalPay} setFinalPay={setFinalPay} newFinalPay={newFinalPay} setNewFinalPay={setNewFinalPay} reason={reason} setReason={setReason}
    beginReplace={()=>beginReplace(item)} cancelReplace={()=>setReplaceId(null)} replacePlayer={replacePlayer} savePay={savePay}/>}
   ListFooterComponent={canEdit&&order?.status!=='completed'?<Card><H2>客服／店長結單</H2><Muted>最後現役的 1 或 2 位打手也可以從自己的訂單直接結整張單。</Muted><Field value={completeDate} onChangeText={setCompleteDate} placeholder="YYYY-MM-DD"/><Button title={busy?'結單中…':'完成整張訂單'} onPress={completeOrder} disabled={busy}/></Card>:null}
  />}
 </Screen>
}

function PlayerCard(p:any){
 const r=p.item
 const [pay,setPay]=useState(String(Number(r.final_pay??r.assigned_pay??0)))
 const replacement=p.rows.find((x:any)=>x.id===r.replaced_by_assignment_id)
 return <Card>
  <View style={styles.row}><Text style={styles.name}>{r.players?.display_name??'打手'}</Text><Text style={r.is_active_slot?styles.active:styles.replaced}>{r.is_active_slot?'進行中':'已換人'}</Text></View>
  {!r.is_active_slot&&replacement?<Muted>換成：{replacement.players?.display_name??'新打手'}</Muted>:null}
  {r.replacement_reason?<Muted>原因：{r.replacement_reason}</Muted>:null}
  <Muted>實拿金額：$ {Number(r.final_pay??r.assigned_pay??0).toLocaleString()}（負數＝賠付）</Muted>
  {p.canEdit&&!p.replacing?<><Field value={pay} onChangeText={setPay} placeholder="實拿／賠付金額（賠付輸入負數）" keyboardType="numbers-and-punctuation"/>
   <Button title="更新實拿金額" tone="neutral" onPress={()=>p.savePay(r,pay)} disabled={p.busy}/>
   {r.is_active_slot?<Button title="換人" tone="danger" onPress={p.beginReplace} disabled={p.busy}/>:null}</>:null}
  {p.replacing?<View style={styles.box}><H2>{r.players?.display_name??'打手'} 換成誰？</H2>
   <Field value={p.playerQuery} onChangeText={p.setPlayerQuery} placeholder="搜尋要換上的打手"/><View style={styles.chips}>{p.players.filter((x:any)=>!p.rows.some((z:any)=>z.player_id===x.id && z.is_active_slot)).filter((x:any)=>!p.playerQuery.trim()||x.display_name.toLowerCase().includes(p.playerQuery.trim().toLowerCase())).map((x:any)=><Chip key={x.id} label={x.display_name} active={p.newPlayerId===x.id} onPress={()=>p.setNewPlayerId(x.id)}/>)}</View>
   <Field value={p.finalPay} onChangeText={p.setFinalPay} placeholder="原打手實拿／賠付（負數＝賠付）" keyboardType="numbers-and-punctuation"/>
   <Field value={p.newFinalPay} onChangeText={p.setNewFinalPay} placeholder="新打手實拿金額" keyboardType="numbers-and-punctuation"/>
   <Field value={p.reason} onChangeText={p.setReason} placeholder="換人原因（可不填）"/>
   <Button title={p.busy?'處理中…':'確認換人'} onPress={p.replacePlayer} disabled={p.busy||!p.newPlayerId}/><Button title="取消" tone="neutral" onPress={p.cancelReplace}/></View>:null}
 </Card>
}
function Chip({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){return <Pressable onPress={onPress} style={[styles.chip,active&&styles.chipActive]}><Text style={[styles.chipText,active&&styles.chipTextActive]}>{label}</Text></Pressable>}
const styles=StyleSheet.create({
 row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10},name:{color:colors.text,fontSize:18,fontWeight:'800'},active:{color:colors.success,fontWeight:'800'},replaced:{color:colors.muted,fontWeight:'800'},
 box:{gap:10,borderTopWidth:1,borderTopColor:colors.border,paddingTop:10},chips:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{borderWidth:1,borderColor:colors.border,backgroundColor:colors.panel2,paddingHorizontal:12,paddingVertical:9,borderRadius:999},
 chipActive:{backgroundColor:colors.accent,borderColor:colors.accent},chipText:{color:colors.text,fontWeight:'700'},chipTextActive:{color:'#051018'}
})

function todayLocal(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
