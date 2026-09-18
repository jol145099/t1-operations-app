import { router } from 'expo-router'
import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native'

import { Button, Card, Field, H1, Muted, Screen, colors } from '@/components/ui'
import { supabase } from '@/lib/supabase'

const USERNAME_DOMAIN = 'auth.t1.internal'

function loginEmail(value: string) {
  const username = value.trim().toLowerCase()
  if (username.includes('@')) return username
  return `${username}@${USERNAME_DOMAIN}`
}

export default function LoginScreen() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function signIn() {
    if (!username.trim() || !password) {
      Alert.alert('請輸入帳號與密碼')
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail(username),
      password
    })
    setBusy(false)
    if (error) {
      Alert.alert('登入失敗', '帳號或密碼不正確')
      return
    }
    router.replace('/home')
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <Text style={styles.brand}>T1</Text>
        <H1>T1 Operations</H1>
        <Muted>使用你的 T1 帳號登入。</Muted>
        <Card>
          <Field value={username} onChangeText={setUsername} placeholder="帳號" autoCapitalize="none" autoCorrect={false} />
          <Field value={password} onChangeText={setPassword} placeholder="密碼" secureTextEntry onSubmitEditing={signIn} />
          <Button title={busy ? '登入中…' : '登入'} onPress={signIn} disabled={busy} />
        </Card>
        <Muted>打手只需要使用管理員提供的帳號與密碼，不需要輸入 Email。</Muted>
      </Screen>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  brand: { color: colors.accent, fontSize: 52, fontWeight: '900', marginTop: 52 }
})
