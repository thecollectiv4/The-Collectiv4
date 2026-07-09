import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/api/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Three-way auth state, not two: `loading` is the third state. Until
  // getSession() resolves from storage, identity is UNKNOWN — user=null here
  // means "not resolved yet", not "signed out". Every guard must wait for
  // loading=false before treating null as unauthenticated (hard-load bounce fix).
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  const signUp = (email, password, name) => supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password })
  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
