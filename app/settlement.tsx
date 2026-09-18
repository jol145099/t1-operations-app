import { useEffect, useMemo, useState } from 'react'
import { router } from 'expo-router'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Button, Card, H1, H2, Muted, Screen, colors } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/AuthProvider'

type Player={id:string;profile_id:string|null;display_name:string}
type Assignment={player_id:string;assigned_pay:number|null;calculated_pay:number|null;final_pay:number|null}
type LedgerRow={player_id:string;amount:number}
type DispatchOrder={dispatcher_id:string|null;dispatch_fee:number|null}
type SettlementRow={id:string;player_id:string;period_start:string;period_end:string;order_pay:number;dispatch_pay:number;adjustments:number;carry_in:number;carry_out:number;total_payable:number;payment_status:'unpaid'|'partial'|'paid';amount_paid:number;paid_at:string|null;players?:{display_name:string}|null}
type Summary={player:Player;orderPay:number;dispatchPay:number;adjustments:number;carryIn:number;total:number;saved?:SettlementRow}
type Period={start:Date;end:Date;nextExclusive:Date;payout:Date}
function localDate(y:number,m:number,d:number){return new Date(y,m,d,0,0,0,0)}
function currentPeriod(now=new Date()):Period{const y=now.getFullYear(),m=now.getMonth(),d=now.getDate();if(d===1)return{start:localDate(y,m-1,16),end:localDate(y,m,1),nextExclusive:localDate(y,m,2),payout:localDate(y,m,1)};if(d<=15)return{start:localDate(y,m,2),end:localDate(y,m,15),nextExclusive:localDate(y,m,16),payout:localDate(y,m,15)};return{start:localDate(y,m,16),end:localDate(y,m+1,1),nextExclusive:localDate(y,m+1,2),payout:localDate(y,m+1,1)}}
const dateOnly=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const label=(d:Date)=>`${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`
const money=(n:number)=>`$${Math.ceil(Number(n||0)).toLocaleString()}`
const signed=(n:number)=>n>0?`+${money(n)}`:money(n)

export default function SettlementScreen(){
 const {profile}=useAuth();const period=useMemo(()=>currentPeriod(),[]);const canManage=profile?.role==='staff'||profile?.role==='admin';const isPlayer=profile?.role==='player'
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[selectedPeriod,setSelectedPeriod]=useState('current')
 const [players,setPlayers]=useState<Player[]>([]),[assignments,setAssignments]=useState<Assignment[]>([]),[ledger,setLedger]=useState<LedgerRow[]>([]),[dispatch,setDispatch]=useState<DispatchOrder[]>([]),[saved,setSaved]=useState<SettlementRow[]>([]),[history,setHistory]=useState<SettlementRow[]>([])
 async function load(){
  if(!profile)return;setLoading(true);setError('')
  if(canManage) await supabase.rpc('ensure_negative_settlement_carry',{p_period_start:dateOnly(period.start),p_period_end:dateOnly(period.end)})
  let pq=supabase.from('players').select('id,profile_id,display_name').eq('active',true).order('display_name');if(profile.role==='player')pq=pq.eq('profile_id',profile.id)
  const [p,a,l,d,s,h]=await Promise.all([
   pq,
   supabase.from('order_players').select('player_id,assigned_pay,calculated_pay,final_pay,orders!inner(status,completed_at)').eq('orders.status','completed').gte('orders.completed_at',period.start.toISOString()).lt('orders.completed_at',period.nextExclusive.toISOString()),
   supabase.from('ledger').select('player_id,amount').gte('occurred_at',period.start.toISOString()).lt('occurred_at',period.nextExclusive.toISOString()),
   supabase.from('orders').select('dispatcher_id,dispatch_fee').eq('status','completed').gte('completed_at',period.start.toISOString()).lt('completed_at',period.nextExclusive.toISOString()),
   supabase.from('settlements').select('id,player_id,period_start,period_end,order_pay,dispatch_pay,adjustments,carry_in,carry_out,total_payable,payment_status,amount_paid,paid_at').eq('period_start',dateOnly(period.start)).eq('period_end',dateOnly(period.end)),
   supabase.from('settlements').select('id,player_id,period_start,period_end,order_pay,dispatch_pay,adjustments,carry_in,carry_out,total_payable,payment_status,amount_paid,paid_at,players(display_name)').order('period_end',{ascending:false}).limit(200)
  ])
  const e=p.error||a.error||l.error||d.error||s.error||h.error;if(e)setError(e.message);else{setPlayers((p.data??[]) as Player[]);setAssignments((a.data??[]) as Assignment[]);setLedger((l.data??[]) as LedgerRow[]);setDispatch((d.data??[]) as DispatchOrder[]);setSaved((s.data??[]) as SettlementRow[]);setHistory((h.data??[]) as unknown as SettlementRow[])}setLoading(false)
 }
 useEffect(()=>{void load()},[profile?.id,profile?.role])
 const summaries=useMemo<Summary[]>(()=>players.map(player=>{const sv=saved.find(x=>x.player_id===player.id);const orderPay=assignments.filter(x=>x.player_id===player.id).reduce((n,x)=>n+Number(x.final_pay??x.calculated_pay??x.assigned_pay??0),0);const adjustments=ledger.filter(x=>x.player_id===player.id).reduce((n,x)=>n+Number(x.amount||0),0);const dispatchPay=player.profile_id?dispatch.filter(x=>x.dispatcher_id===player.profile_id).reduce((n,x)=>n+Number(x.dispatch_fee||0),0):0;if(sv)return{player,orderPay:Number(sv.order_pay||0),dispatchPay:Number(sv.dispatch_pay||0),adjustments:Number(sv.adjustments||0),carryIn:Number(sv.carry_in||0),total:Number(sv.total_payable||0),saved:sv};return{player,orderPay,dispatchPay,adjustments,carryIn:0,total:orderPay+dispatchPay+adjustments}}),[players,assignments,ledger,dispatch,saved])
 async function confirm(x:Summary){setSaving(true);const {error:e}=await supabase.rpc('confirm_t1_settlement',{p_player_id:x.player.id,p_period_start:dateOnly(period.start),p_period_end:dateOnly(period.end),p_order_pay:x.orderPay,p_dispatch_pay:x.dispatchPay,p_adjustments:x.adjustments});setSaving(false);if(e)Alert.alert('確認失敗',e.message);else await load()}
 async function reopen(x:Summary){if(!x.saved||x.saved.payment_status==='paid')return;setSaving(true);const {error:e}=await supabase.rpc('reopen_t1_settlement',{p_settlement_id:x.saved.id});setSaving(false);if(e)Alert.alert('撤銷確認失敗',e.message);else await load()}
 async function pay(x:Summary){if(!x.saved||x.total<=0)return;setSaving(true);const {error:e}=await supabase.from('settlements').update({payment_status:'paid',amount_paid:x.total,paid_at:new Date().toISOString()}).eq('id',x.saved.id);setSaving(false);if(e)Alert.alert('付款更新失敗',e.message);else await load()}
 function detail(x:Summary){router.push({pathname:'/settlement-detail',params:{playerId:x.player.id,playerName:x.player.display_name,start:period.start.toISOString(),end:period.end.toISOString(),nextExclusive:period.nextExclusive.toISOString(),carryIn:String(x.carryIn),savedTotal:x.saved?String(x.total):''}})}
 if(loading)return <Screen><ActivityIndicator color={colors.accent}/></Screen>
 return <ScrollView style={{flex:1,backgroundColor:colors.bg}}><Screen><H1>薪資結算</H1>
  <Card><H2>本期：{label(period.start)} → {label(period.end)}</H2><Muted>負數會自動結轉；即使下一期沒有接單，也會保留負數結算紀錄。</Muted></Card>
  <Card><H2>選擇結算時間</H2><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periods}>
   <TouchableOpacity onPress={()=>setSelectedPeriod('current')} style={[styles.periodChip,selectedPeriod==='current'&&styles.periodActive]}><Text style={styles.periodText}>本期</Text></TouchableOpacity>
   {Array.from(new Map(history.map(x=>[`${x.period_start}|${x.period_end}`,x])).values()).map(x=>{const key=`${x.period_start}|${x.period_end}`;return <TouchableOpacity key={key} onPress={()=>setSelectedPeriod(key)} style={[styles.periodChip,selectedPeriod===key&&styles.periodActive]}><Text style={styles.periodText}>{x.period_start} → {x.period_end}</Text></TouchableOpacity>})}
  </ScrollView></Card>
  {selectedPeriod!=='current'?<Card><H2>{selectedPeriod.split('|')[0]} → {selectedPeriod.split('|')[1]}</H2>
   {history.filter(x=>`${x.period_start}|${x.period_end}`===selectedPeriod).map(x=><TouchableOpacity key={x.id} onPress={()=>router.push({pathname:'/settlement-detail',params:{playerId:x.player_id,playerName:x.players?.display_name||'打手',start:new Date(x.period_start+'T00:00:00').toISOString(),end:new Date(x.period_end+'T00:00:00').toISOString(),nextExclusive:new Date(new Date(x.period_end+'T00:00:00').getTime()+86400000).toISOString(),carryIn:String(x.carry_in||0),savedTotal:String(x.total_payable)}})}><View style={styles.history}><View><Text style={styles.name}>{x.players?.display_name||'打手'}</Text></View><View><Text style={x.total_payable<0?styles.negative:styles.amount}>{signed(Number(x.total_payable))}</Text><Muted>{x.payment_status==='paid'?'已付款':x.total_payable<0?'結轉下期':'待付款'}</Muted></View></View></TouchableOpacity>)}
  </Card>:null}
  {error?<Card><Text style={styles.negative}>{error}</Text></Card>:null}
  {selectedPeriod === 'current' ? summaries.map(x => (<View key={x.player.id}><TouchableOpacity onPress={()=>detail(x)}><Card><View style={styles.header}><H2>{x.player.display_name}</H2><Text style={x.saved?styles.saved:styles.live}>{x.saved?'已確認':'即時計算'}</Text></View><Line label="完單收入" value={x.orderPay}/><Line label="派單收入" value={x.dispatchPay}/><Line label="其他加扣" value={x.adjustments}/>{x.carryIn!==0?<Line label="上期結轉" value={x.carryIn}/>:null}<View style={styles.divider}/><Line label={x.total<0?'結轉下期':'本期應付'} value={x.total} total/></Card></TouchableOpacity>{x.total!==0?<View style={styles.actions}>{!x.saved&&isPlayer?<Button title="確認我的結算" onPress={()=>confirm(x)} disabled={saving}/>:null}{x.saved&&isPlayer?<Muted>你已確認本期結算。</Muted>:null}{canManage&&!x.saved?<Muted>等待打手確認結算</Muted>:null}{canManage&&x.saved&&x.saved.payment_status!=='paid'?<><Button title="撤銷打手確認" tone="neutral" onPress={()=>reopen(x)} disabled={saving}/>{x.total>0?<Button title={`標記已付款 ${money(x.total)}`} onPress={()=>pay(x)} disabled={saving}/>:null}</>:null}</View>:null}</View>)) : null}
 </Screen></ScrollView>
}
function Line({label,value,total=false}:{label:string;value:number;total?:boolean}){return <View style={styles.line}><Text style={[styles.lbl,total&&styles.totalLbl]}>{label}</Text><Text style={[styles.val,value<0&&styles.negative,total&&styles.total]}>{signed(value)}</Text></View>}
const styles=StyleSheet.create({header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},line:{flexDirection:'row',justifyContent:'space-between'},lbl:{color:colors.muted},val:{color:colors.text,fontWeight:'700'},totalLbl:{color:colors.text,fontWeight:'800',fontSize:17},total:{fontSize:24,fontWeight:'900'},negative:{color:'#ff8f8f',fontWeight:'800'},amount:{color:colors.text,fontWeight:'800'},saved:{color:colors.success,fontWeight:'800'},live:{color:colors.muted,fontWeight:'700'},divider:{height:1,backgroundColor:colors.border,marginVertical:5},actions:{marginTop:-6,marginBottom:8},history:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:10,borderBottomWidth:1,borderBottomColor:colors.border},name:{color:colors.text,fontWeight:'800'},periods:{gap:8,paddingVertical:4},periodChip:{borderWidth:1,borderColor:colors.border,borderRadius:999,paddingHorizontal:12,paddingVertical:9},periodActive:{backgroundColor:colors.panel2,borderColor:colors.accent},periodText:{color:colors.text,fontWeight:'700'}})
