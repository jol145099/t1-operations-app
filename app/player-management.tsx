import { useCallback, useState } from 'react'
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useFocusEffect } from 'expo-router'

import { Button, Card, Field, H1, H2, Muted, Screen, colors } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/AuthProvider'

const GRADES=['SR','S','A','B','娛樂女陪']
const MAPS=['航天','巴克什','大壩','監獄']
const SERVERS=['陸服','台服']

type Player={id:string;display_name:string;player_grade:string|null;specialties:string[];servers:string[];card_url:string|null;active:boolean}

export default function PlayerManagement(){
 const {profile}=useAuth()
 const [rows,setRows]=useState<Player[]>([])
 const [name,setName]=useState(''); const [grade,setGrade]=useState('A')
 const [maps,setMaps]=useState<string[]>([]); const [servers,setServers]=useState<string[]>([])
 const [card,setCard]=useState<string|null>(null); const [busy,setBusy]=useState(false)

 const load=useCallback(async()=>{const {data,error}=await supabase.from('players').select('id,display_name,player_grade,specialties,servers,card_url,active').order('display_name');if(error)Alert.alert('讀取失敗',error.message);else setRows((data??[]) as Player[])},[])
 useFocusEffect(useCallback(()=>{load()},[load]))
 if(profile?.role!=='admin') return <Screen><H1>人員管理</H1><Muted>只有 Admin 可以新增或修改打手檔案。</Muted></Screen>

 const toggle=(v:string,a:string[],set:(x:string[])=>void)=>set(a.includes(v)?a.filter(x=>x!==v):[...a,v])
 async function pickCard(){const r=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],quality:.85});if(!r.canceled)setCard(r.assets[0].uri)}
 async function save(){
  if(!name.trim()){Alert.alert('請輸入名字');return}
  setBusy(true); let cardUrl:string|null=null
  if(card){
   const res=await fetch(card); const blob=await res.blob(); const ext=(blob.type.split('/')[1]||'jpg').replace('jpeg','jpg'); const path=`${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
   const up=await supabase.storage.from('player-cards').upload(path,blob,{contentType:blob.type||'image/jpeg'})
   if(up.error){setBusy(false);Alert.alert('名片上傳失敗',up.error.message);return}
   cardUrl=supabase.storage.from('player-cards').getPublicUrl(path).data.publicUrl
  }
  const {error}=await supabase.from('players').insert({display_name:name.trim(),player_grade:grade,specialties:maps,servers,card_url:cardUrl,active:true})
  setBusy(false); if(error){Alert.alert('新增失敗',error.message);return}
  setName('');setGrade('A');setMaps([]);setServers([]);setCard(null);await load();Alert.alert('已新增打手')
 }
 return <ScrollView style={{flex:1,backgroundColor:colors.bg}}><Screen>
  <H1>打手管理</H1><Muted>建立打手公開檔案；登入帳號可以之後再綁定。</Muted>
  <Card><H2>＋ 新增打手</H2><Muted>名字</Muted><Field value={name} onChangeText={setName} placeholder="打手名字"/>
   <Muted>等級</Muted><View style={s.wrap}>{GRADES.map(x=><Button key={x} title={x} tone={grade===x?'primary':'neutral'} onPress={()=>setGrade(x)}/>)}</View>
   <Muted>擅長地圖</Muted><View style={s.wrap}>{MAPS.map(x=><Button key={x} title={x} tone={maps.includes(x)?'primary':'neutral'} onPress={()=>toggle(x,maps,setMaps)}/>)}</View>
   <Muted>伺服器</Muted><View style={s.wrap}>{SERVERS.map(x=><Button key={x} title={x} tone={servers.includes(x)?'primary':'neutral'} onPress={()=>toggle(x,servers,setServers)}/>)}</View>
   <Button title="上傳打手名片" tone="neutral" onPress={pickCard}/>{card?<Image source={{uri:card}} style={s.image}/>:null}
   <Button title={busy?'新增中…':'新增打手'} onPress={save} disabled={busy}/>
  </Card>
  <H2>現有人員</H2>{rows.map(p=><Card key={p.id}>{p.card_url?<Image source={{uri:p.card_url}} style={s.image}/>:null}<Text style={s.name}>{p.display_name} · {p.player_grade||'未設定'}</Text><Muted>地圖：{p.specialties?.join('、')||'未設定'}</Muted><Muted>伺服器：{p.servers?.join('、')||'未設定'}</Muted></Card>)}
 </Screen></ScrollView>
}
const s=StyleSheet.create({wrap:{flexDirection:'row',flexWrap:'wrap',gap:8},image:{width:'100%',height:180,borderRadius:12,resizeMode:'contain'},name:{color:colors.text,fontSize:18,fontWeight:'800'}})
