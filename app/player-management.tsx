import { useCallback, useState } from 'react'
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useFocusEffect } from 'expo-router'
import { Button, Card, Field, H1, H2, Muted, Screen, colors } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/AuthProvider'

const GRADES=['SR','S','A','B','娛樂女陪'], MAPS=['航天','巴克什','大壩','監獄','AZ3','長工'], SERVERS=['陸服','台服']
type Player={id:string;display_name:string;player_grade:string|null;specialties:string[];servers:string[];card_url:string|null;active:boolean}

export default function PlayerManagement(){
 const {profile}=useAuth(); const [rows,setRows]=useState<Player[]>([]); const [editingId,setEditingId]=useState<string|null>(null)
 const [name,setName]=useState(''); const [grade,setGrade]=useState('A'); const [maps,setMaps]=useState<string[]>([]); const [servers,setServers]=useState<string[]>([])
 const [card,setCard]=useState<string|null>(null); const [busy,setBusy]=useState(false)
 const load=useCallback(async()=>{const {data,error}=await supabase.from('players').select('id,display_name,player_grade,specialties,servers,card_url,active').order('display_name');if(error)Alert.alert('讀取失敗',error.message);else setRows((data??[]) as Player[])},[])
 useFocusEffect(useCallback(()=>{load()},[load]))
 if(profile?.role!=='admin') return <Screen><H1>人員管理</H1><Muted>只有 Admin 可以新增或修改打手檔案。</Muted></Screen>
 const toggle=(v:string,a:string[],set:(x:string[])=>void)=>set(a.includes(v)?a.filter(x=>x!==v):[...a,v])
 const reset=()=>{setEditingId(null);setName('');setGrade('A');setMaps([]);setServers([]);setCard(null)}
 const edit=(p:Player)=>{setEditingId(p.id);setName(p.display_name);setGrade(p.player_grade||'A');setMaps(p.specialties||[]);setServers(p.servers||[]);setCard(p.card_url);window?.scrollTo?.({top:0,behavior:'smooth'})}
 async function pickCard(){const r=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],quality:.85});if(!r.canceled)setCard(r.assets[0].uri)}
 async function uploadCard(){if(!card||card.startsWith('http'))return card;const res=await fetch(card);const blob=await res.blob();const ext=(blob.type.split('/')[1]||'jpg').replace('jpeg','jpg');const path=`${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;const up=await supabase.storage.from('player-cards').upload(path,blob,{contentType:blob.type||'image/jpeg'});if(up.error)throw up.error;return supabase.storage.from('player-cards').getPublicUrl(path).data.publicUrl}
 async function save(){
  if(!name.trim()){Alert.alert('請輸入名字');return} setBusy(true)
  try{const cardUrl=await uploadCard();const payload={display_name:name.trim(),player_grade:grade,specialties:maps,servers,card_url:cardUrl,active:true}
   const {error}=editingId?await supabase.from('players').update(payload).eq('id',editingId):await supabase.from('players').insert(payload)
   if(error)throw error;const wasEditing=!!editingId;reset();await load();Alert.alert(wasEditing?'已儲存修改':'已新增打手')
  }catch(e:any){Alert.alert(editingId?'修改失敗':'新增失敗',e?.message||String(e))}finally{setBusy(false)}
 }
 return <ScrollView style={{flex:1,backgroundColor:colors.bg}}><Screen>
  <H1>打手管理</H1><Muted>Admin 可以新增及修改公開打手檔案。</Muted>
  <Card><H2>{editingId?'編輯打手':'＋ 新增打手'}</H2><Muted>名字</Muted><Field value={name} onChangeText={setName} placeholder="打手名字"/>
   <Muted>等級</Muted><View style={s.wrap}>{GRADES.map(x=><Button key={x} title={x} tone={grade===x?'primary':'neutral'} onPress={()=>setGrade(x)}/>)}</View>
   <Muted>擅長地圖</Muted><View style={s.wrap}>{MAPS.map(x=><Button key={x} title={x} tone={maps.includes(x)?'primary':'neutral'} onPress={()=>toggle(x,maps,setMaps)}/>)}</View>
   <Muted>伺服器</Muted><View style={s.wrap}>{SERVERS.map(x=><Button key={x} title={x} tone={servers.includes(x)?'primary':'neutral'} onPress={()=>toggle(x,servers,setServers)}/>)}</View>
   <Button title={card?'更換打手名片':'上傳打手名片'} tone="neutral" onPress={pickCard}/>{card?<Image source={{uri:card}} style={s.image}/>:null}
   <Button title={busy?'儲存中…':editingId?'儲存修改':'新增打手'} onPress={save} disabled={busy}/>{editingId?<Button title="取消編輯" tone="neutral" onPress={reset}/>:null}
  </Card>
  <H2>現有人員</H2>{rows.map(p=><Card key={p.id}>{p.card_url?<Image source={{uri:p.card_url}} style={s.image}/>:null}<Text style={s.name}>{p.display_name} · {p.player_grade||'未設定'}</Text><Muted>地圖：{p.specialties?.join('、')||'未設定'}</Muted><Muted>伺服器：{p.servers?.join('、')||'未設定'}</Muted><Button title="編輯資料" tone="neutral" onPress={()=>edit(p)}/></Card>)}
 </Screen></ScrollView>
}
const s=StyleSheet.create({wrap:{flexDirection:'row',flexWrap:'wrap',gap:8},image:{width:'100%',height:180,borderRadius:12,resizeMode:'contain'},name:{color:colors.text,fontSize:18,fontWeight:'800'}})
