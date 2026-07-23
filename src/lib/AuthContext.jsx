import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/api/supabase'
import { withInviteCode } from '@/lib/earlyAccess'

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
      /* v16 — c4:returning: el pestillo de dispositivo que decide el estado
         inicial de /auth (primera visita = CREATE ACCOUNT, regreso = SIGN IN).
         Se escribe aquí y no en Auth.jsx porque TODA sesión pasa por este
         listener: email, OAuth (que vuelve por el hash, sin tocar el submit
         de Auth), y la rehidratación — todas significan "esta persona ya
         entró en este dispositivo". Sin uid a propósito: es un hecho del
         dispositivo, previo a saber quién eres. try/catch: localStorage
         puede no existir (modo privado viejo) y la sesión vale más. */
      if (session?.user) { try { localStorage.setItem('c4:returning', '1') } catch { /* sin storage, sin pestillo */ } }
    })
    return () => subscription.unsubscribe()
  }, [])

  // full_name carries the name to the eventual profile row (lazy-created on
  // first /profile visit). first_name/last_name are stored too for future use.
  // v12: `code` rides in raw_user_meta_data to the before_user_created hook
  // (migration 0046). withInviteCode omits the key entirely when there is no
  // valid code, so nothing changes while the gate is off.
  const signUp = (email, password, name, extra = {}, code = '') =>
    supabase.auth.signUp({ email, password, options: { data: withInviteCode({ full_name: name, ...extra }, code) } })
  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password })
  const signOut = () => supabase.auth.signOut()
  // D3: password reset — the member enters their email and gets a link back.
  // redirectTo self-resolves across localhost / preview / prod; the link lands
  // on /reset-password where updateUser sets the new password.
  const resetPassword = (email) =>
    supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
