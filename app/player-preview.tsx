import { useCallback, useState } from 'react'
import { Image, ScrollView, StyleSheet, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Button, H1, Muted, Screen, colors } from '@/components/ui'
import { supabase } from '@/lib/supabase'

const GRADES=['SR','S','A','B','娛樂女陪'], MAPS=['航天','巴克什','大壩','監獄','AZ3','長工'], SERVERS=['陸服','台服']
type Player={id:string;player_grade:string|null;specialties:string[];servers:string[];card_url:string|null}
export default function PlayerPreview(){
 const [rows,setRows]=useState<Player[]>([]);const [grades,setGrades]=useState<string[]>([]);const [maps,setMaps]=useState<string[]>([]);const [servers,setServers]=useState<string[]>([])
 const load=useCallback(async()=>{const {data}=await supabase.from('players').select('id,player_grade,specialties,servers,card_url').eq('active',true).order('display_name');setRows((data??[]) as Player[])},[])
 useFocusEffect(useCallback(()=>{load()},[load]))
 const toggle=(v:string,a:string[],set:(x:string[])=>void)=>set(a.includes(v)?a.filter(x=>x!==v):[...a,v])
 const shown=rows.filter(p=>(grades.length===0||grades.includes(p.player_grade||''))&&(maps.length===0||maps.some(x=>p.specialties?.includes(x)))&&(servers.length===0||servers.some(x=>p.servers?.includes(x))))
 return <ScrollView style={{flex:1,backgroundColor:colors.bg}}><Screen><H1>打手預覽</H1><Muted>可複選篩選條件；未選代表全部。</Muted>
  <Muted>等級</Muted><View style={s.wrap}>{GRADES.map(x=><Button key={x} title={x} tone={grades.includes(x)?'primary':'neutral'} onPress={()=>toggle(x,grades,setGrades)}/>)}</View>
  <Muted>地圖</Muted><View style={s.wrap}>{MAPS.map(x=><Button key={x} title={x} tone={maps.includes(x)?'primary':'neutral'} onPress={()=>toggle(x,maps,setMaps)}/>)}</View>
  <Muted>伺服器</Muted><View style={s.wrap}>{SERVERS.map(x=><Button key={x} title={x} tone={servers.includes(x)?'primary':'neutral'} onPress={()=>toggle(x,servers,setServers)}/>)}</View>
  {(grades.length||maps.length||servers.length)?<Button title="清除篩選" tone="neutral" onPress={()=>{setGrades([]);setMaps([]);setServers([])}}/>:null}
  <View style={s.cards}>{shown.filter(p=>p.card_url).map(p=><Image key={p.id} source={{uri:p.card_url!}} style={s.image}/>)}</View>
 </Screen></ScrollView>
}
const s=StyleSheet.create({wrap:{flexDirection:'row',flexWrap:'wrap',gap:8},cards:{gap:14},image:{width:'100%',height:360,borderRadius:12,resizeMode:'contain'}})
