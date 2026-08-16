import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'

import { colors } from '@/components/ui'
import { useAuth } from '@/providers/AuthProvider'

export default function Index() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  return <Redirect href={session ? '/home' : '/login'} />
}
