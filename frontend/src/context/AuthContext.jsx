import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      // If "stay signed in" was off, sign out when app is reopened (session-only mode)
      if (session && localStorage.getItem('onepost_session_only') === '1') {
        const lastActive = parseInt(localStorage.getItem('onepost_last_active') || '0')
        const idleMs = Date.now() - lastActive
        if (lastActive && idleMs > 30 * 60 * 1000) {
          supabase.auth.signOut()
          localStorage.removeItem('onepost_session_only')
          localStorage.removeItem('onepost_last_active')
          setLoading(false)
          return
        }
      }
      if (session) localStorage.setItem('onepost_last_active', Date.now().toString())
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId) => {
    const { data } = await supabase.from('users').select('*').eq('id', userId).single()
    if (data) setProfile(data)
    else {
      // Auto-create profile on first login
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const newProfile = {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
          avatar_url: user.user_metadata?.avatar_url || null
        }
        const { data: created } = await supabase.from('users').insert(newProfile).select().single()
        setProfile(created)
      }
    }
    setLoading(false)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  const updateProfile = async (updates) => {
    const { data } = await supabase.from('users').update(updates).eq('id', user.id).select().single()
    if (data) setProfile(data)
    return data
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, updateProfile, refetchProfile: () => fetchProfile(user?.id) }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
