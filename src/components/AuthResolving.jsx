import { Loader2 } from 'lucide-react'

/* Cosmos holding state while the Supabase session rehydrates on a hard load.
   ACTION INTEGRITY applied to auth: an unresolved identity is not "signed out" —
   absence of data is not data. Guarded surfaces render this instead of redirecting
   or painting a join/lock wall until AuthContext's `loading` settles. Same visual
   language as the OS / NetworkAdmin loading states (void bg, silver spinner). */
export default function AuthResolving() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <Loader2 size={20} style={{ color: 'var(--silver)', animation: 'spin 1s linear infinite' }} />
    </div>
  )
}
