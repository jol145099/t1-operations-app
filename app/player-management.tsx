import { useCallback, useState } from 'react'
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useFocusEffect } from 'expo-router'
import { Button, Card, Field, H1, H2, Muted, Screen, colors } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/AuthProvider'

const GRADES=['SR','S','A','B','娛樂女陪'], MAPS=['航天','巴克什','大壩','監獄','AZ3','長工'], SERVERS=['陸服','台服']
type Player={id:string;display_name:string;player_grade:string|null;specialties:string[];servers:string[];card_url:string|null;active:boolean}
type Draft={name:string;grade:string;maps:string[];servers:string[];card:string|null}
const blank=():Draft=>({name:'',grade:'A',maps:[],servers:[],card:null})
const fromPlayer=(p:Player):Draft=>({name:p.display_name,grade:p.player_grade||'A',maps:p.specialties||[],servers:p.servers||[],card:p.card_url})

export default function PlayerManagement(){
 const {profile}=useAuth(); const [rows,setRows]=useState<Player[]>([]); const [editingId,setEditingId]=useState<string|null>(null)
 const [draft,setDraft]=useState<Draft>(blank()); const [newDraft,setNewDraft]=useState<Draft>(blank()); const [busy,setBusy]=useState(false)
 const load=useCallback(async()=>{const {data,error}=await supabase.from('players').select('id,display_name,player_grade,specialties,servers,card_url,active').order('display_name');if(error)Alert.alert('讀取失敗',error.message);else setRows((data??[]) as Player[])},[])
 useFocusEffect(useCallback(()=>{load()},[load]))
 if(profile?.role!=='admin') return <Screen><H1>人員管理</H1><Muted>只有 Admin 可以新增或修改打手檔案。</Muted></Screen>
 const toggle=(v:string,a:string[])=>a.includes(v)?a.filter(x=>x!==v):[...a,v]
 async function pickCard(set:(d:Draft)=>void,d:Draft){const r=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],quality:.85});if(!r.canceled)set({...d,card:r.assets[0].uri})}
 async function uploadCard(card:string|null){if(!card||card.startsWith('http'))return card;const res=await fetch(card);const blob=await res.blob();const ext=(blob.type.split('/')[1]||'jpg').replace('jpeg','jpg');const path=`${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;const up=await supabase.storage.from('player-cards').upload(path,blob,{contentType:blob.type||'image/jpeg'});if(up.error)throw up.error;return supabase.storage.from('player-cards').getPublicUrl(path).data.publicUrl}
 async function save(d:Draft,id?:string){if(!d.name.trim()){Alert.alert('請輸入名字');return}setBusy(true);try{const cardUrl=await uploadCard(d.card);const payload={display_name:d.name.trim(),player_grade:d.grade,specialties:d.maps,servers:d.servers,card_url:cardUrl,active:true};const {error}=id?await supabase.from('players').update(payload).eq('id',id):await supabase.from('players').insert(payload);if(error)throw error;if(id){setEditingId(null);setDraft(blank())}else setNewDraft(blank());await load();Alert.alert(id?'已儲存修改':'已新增打手')}catch(e:any){Alert.alert(id?'修改失敗':'新增失敗',e?.message||String(e))}finally{setBusy(false)}}
 const form=(d:Draft,set:(x:Draft)=>void,id?:string)=><>
  <Muted>名字</Muted><Field value={d.name} onChangeText={name=>set({...d,name})} placeholder="打手名字"/>
  <Muted>等級</Muted><View style={s.wrap}>{GRADES.map(x=><Button key={x} title={x} tone={d.grade===x?'primary':'neutral'} onPress={()=>set({...d,grade:x})}/>)}</View>
  <Muted>擅長地圖</Muted><View style={s.wrap}>{MAPS.map(x=><Button key={x} title={x} tone={d.maps.includes(x)?'primary':'neutral'} onPress={()=>set({...d,maps:toggle(x,d.maps)})}/>)}</View>
  <Muted>伺服器</Muted><View style={s.wrap}>{SERVERS.map(x=><Button key={x} title={x} tone={d.servers.includes(x)?'primary':'neutral'} onPress={()=>set({...d,servers:toggle(x,d.servers)})}/>)}</View>
  <Button title={d.card?'更換打手名片':'上傳打手名片'} tone="neutral" onPress={()=>pickCard(set,d)}/>{d.card?<Image source={{uri:d.card}} style={s.image}/>:null}
  <Button title={busy?'儲存中…':id?'儲存修改':'新增打手'} onPress={()=>save(d,id)} disabled={busy}/>
  {id?<Button title="取消編輯" tone="neutral" onPress={()=>{setEditingId(null);setDraft(blank())}}/>:null}
 </>
 return <ScrollView style={{flex:1,backgroundColor:colors.bg}}><Screen><H1>打手管理</H1><Muted>Admin 可以新增及直接在每位打手卡片內修改資料。</Muted>
  <Card><H2>＋ 新增打手</H2>{form(newDraft,setNewDraft)}</Card>
  <H2>現有人員</H2>{rows.map(p=><Card key={p.id}>{editingId===p.id?form(draft,setDraft,p.id):<>{p.card_url?<Image source={{uri:p.card_url}} style={s.image}/>:null}<Text style={s.name}>{p.display_name} · {p.player_grade||'未設定'}</Text><Muted>地圖：{p.specialties?.join('、')||'未設定'}</Muted><Muted>伺服器：{p.servers?.join('、')||'未設定'}</Muted><Button title="編輯資料" tone="neutral" onPress={()=>{setEditingId(p.id);setDraft(fromPlayer(p))}}/></>}</Card>)}
 </Screen></ScrollView>
}
const s=StyleSheet.create({wrap:{flexDirection:'row',flexWrap:'wrap',gap:8},image:{width:'100%',height:180,borderRadius:12,resizeMode:'contain'},name:{color:colors.text,fontSize:18,fontWeight:'800'}})
