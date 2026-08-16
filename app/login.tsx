import { router } from 'expo-router'
import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native'

import { Button, Card, Field, H1, Muted, Screen, colors } from '@/components/ui'
import { supabase } from '@/lib/supabase'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function signIn() {
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)

    if (error) {
      Alert.alert('登入失敗', error.message)
      return
    }

    router.replace('/home')
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <Text style={styles.brand}>T1</Text>
        <H1>T1 Operations</H1>
        <Muted>老闆、打手、客服與店長共用的營運系統。</Muted>

        <Card>
          <Field
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Field
            value={password}
            onChangeText={setPassword}
            placeholder="密碼"
            secureTextEntry
          />
          <Button title={busy ? '登入中…' : '登入'} onPress={signIn} disabled={busy} />
        </Card>

        <Muted>
          第一版先使用 Email + Password。正式版可以再加入 Discord / OTP / 邀請碼登入。
        </Muted>
      </Screen>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  brand: {
    color: colors.accent,
    fontSize: 52,
    fontWeight: '900',
    marginTop: 52
  }
})
