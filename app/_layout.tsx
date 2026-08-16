import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

import { AuthProvider } from '@/providers/AuthProvider'
import { colors } from '@/components/ui'

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg }
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="home" options={{ title: 'T1 Operations' }} />
        <Stack.Screen name="orders" options={{ title: '訂單' }} />
        <Stack.Screen name="new-order" options={{ title: '新增報單' }} />
        <Stack.Screen name="settlement" options={{ title: '兩週結算' }} />
      </Stack>
    </AuthProvider>
  )
}
