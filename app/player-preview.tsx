import { useCallback, useState } from 'react'
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Button, Card, H1, Muted, Screen, colors } from '@/components/ui'
import { supabase } from '@/lib/supabase'

const GRADES=['全部','SR','S','A','B','娛樂女陪']; const MAPS=['全部','航天','巴克什','大壩','監獄']; const SERVERS=['全部','陸服','台服']
type Player={id:string;display_name:string;player_grade:string|null;specialties:string[];servers:string[];card_url:string|null}
export default function PlayerPreview(){
 const [rows,setRows]=useState<Player[]>([]);const [grade,setGrade]=useState('全部');const [map,setMap]=useState('全部');const [server,setServer]=useState('全部')
 const load=useCallback(async()=>{const {data}=await supabase.from('players').select('id,display_name,player_grade,specialties,servers,card_url').eq('active',true).order('display_name');setRows((data??[]) as Player[])},[])
 useFocusEffect(useCallback(()=>{load()},[load]))
 const shown=rows.filter(p=>(grade==='全部'||p.player_grade===grade)&&(map==='全部'||p.specialties?.includes(map))&&(server==='全部'||p.servers?.includes(server)))
 return <ScrollView style={{flex:1,backgroundColor:colors.bg}}><Screen><H1>打手預覽</H1><Muted>依等級、擅長地圖與伺服器篩選。</Muted>
  <Muted>等級</Muted><View style={s.wrap}>{GRADES.map(x=><Button key={x} title={x} tone={grade===x?'primary':'neutral'} onPress={()=>setGrade(x)}/>)}</View>
  <Muted>地圖</Muted><View style={s.wrap}>{MAPS.map(x=><Button key={x} title={x} tone={map===x?'primary':'neutral'} onPress={()=>setMap(x)}/>)}</View>
  <Muted>伺服器</Muted><View style={s.wrap}>{SERVERS.map(x=><Button key={x} title={x} tone={server===x?'primary':'neutral'} onPress={()=>setServer(x)}/>)}</View>
  <Muted>共 {shown.length} 位</Muted>{shown.map(p=><Card key={p.id}>{p.card_url?<Image source={{uri:p.card_url}} style={s.image}/>:null}<Text style={s.name}>{p.display_name}</Text><Text style={s.grade}>{p.player_grade||'未設定'}</Text><Muted>擅長：{p.specialties?.join('、')||'未設定'}</Muted><Muted>伺服器：{p.servers?.join('、')||'未設定'}</Muted></Card>)}
 </Screen></ScrollView>
}
const s=StyleSheet.create({wrap:{flexDirection:'row',flexWrap:'wrap',gap:8},image:{width:'100%',height:220,borderRadius:12,resizeMode:'contain'},name:{color:colors.text,fontSize:20,fontWeight:'900'},grade:{color:colors.accent,fontSize:17,fontWeight:'800'}})
