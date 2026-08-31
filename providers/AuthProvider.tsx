import { Session } from '@supabase/supabase-js'
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'

type AuthContextValue = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId?: string) {
    if (!userId) {
      setProfile(null)
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, role, active')
      .eq('id', userId)
      .single()

    if (error) {
      console.warn('Unable to load profile:', error.message)
      setProfile(null)
      return
    }

    setProfile(data as Profile)
  }

  async function refreshProfile() {
    await loadProfile(session?.user.id)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await loadProfile(data.session?.user.id)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession)
      await loadProfile(nextSession?.user.id)
      setLoading(false)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const value = useMemo(
    () => ({
      session,
      profile,
      loading,
      refreshProfile,
      signOut: async () => {
        await supabase.auth.signOut()
      }
    }),
    [session, profile, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
