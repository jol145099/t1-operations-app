import { useCallback, useState } from 'react'
import { Image, ScrollView, StyleSheet, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Button, H1, Muted, Screen, colors } from '@/components/ui'
import { supabase } from '@/lib/supabase'

const TYPES=['打手','客服','店長','考官','合作廠商'], GRADES=['SR','S','A','B','娛樂女陪'], MAPS=['航天','巴克什','大壩','監獄','AZ3','長工'], SERVERS=['陸服','台服']
type Player={id:string;personnel_type:string;player_grade:string|null;specialties:string[];servers:string[];card_url:string|null}
export default function PlayerPreview(){
 const [rows,setRows]=useState<Player[]>([]);const [types,setTypes]=useState<string[]>([]);const [grades,setGrades]=useState<string[]>([]);const [maps,setMaps]=useState<string[]>([]);const [servers,setServers]=useState<string[]>([])
 const load=useCallback(async()=>{const {data}=await supabase.from('players').select('id,personnel_type,player_grade,specialties,servers,card_url').eq('active',true).order('display_name');setRows((data??[]) as Player[])},[])
 useFocusEffect(useCallback(()=>{load()},[load])); const toggle=(v:string,a:string[],set:(x:string[])=>void)=>set(a.includes(v)?a.filter(x=>x!==v):[...a,v])
 const shown=rows.filter(p=>(types.length===0||types.includes(p.personnel_type||'打手'))&&(grades.length===0||grades.includes(p.player_grade||''))&&(maps.length===0||maps.some(x=>p.specialties?.includes(x)))&&(servers.length===0||servers.some(x=>p.servers?.includes(x))))
 return <ScrollView style={{flex:1,backgroundColor:colors.bg}}><Screen><H1>人員預覽</H1><Muted>可複選；未選代表全部。</Muted>
  <Muted>身份</Muted><View style={s.wrap}>{TYPES.map(x=><Button key={x} title={x} tone={types.includes(x)?'primary':'neutral'} onPress={()=>toggle(x,types,setTypes)}/>)}</View>
  <Muted>等級</Muted><View style={s.wrap}>{GRADES.map(x=><Button key={x} title={x} tone={grades.includes(x)?'primary':'neutral'} onPress={()=>toggle(x,grades,setGrades)}/>)}</View>
  <Muted>地圖</Muted><View style={s.wrap}>{MAPS.map(x=><Button key={x} title={x} tone={maps.includes(x)?'primary':'neutral'} onPress={()=>toggle(x,maps,setMaps)}/>)}</View>
  <Muted>伺服器</Muted><View style={s.wrap}>{SERVERS.map(x=><Button key={x} title={x} tone={servers.includes(x)?'primary':'neutral'} onPress={()=>toggle(x,servers,setServers)}/>)}</View>
  {(types.length||grades.length||maps.length||servers.length)?<Button title="清除篩選" tone="neutral" onPress={()=>{setTypes([]);setGrades([]);setMaps([]);setServers([])}}/>:null}
  <View style={s.cards}>{shown.filter(x=>x.card_url).map(x=><Image key={x.id} source={{uri:x.card_url!}} style={s.image}/>)}</View>
 </Screen></ScrollView>
}
const s=StyleSheet.create({wrap:{flexDirection:'row',flexWrap:'wrap',gap:8},cards:{gap:14},image:{width:'100%',height:360,borderRadius:12,resizeMode:'contain'}})
