/* =========================================================================
   authErrors — human Spanish for auth failures (D3, El Mundo v7).
   "Todo lo que tiene una app que funciona muy bien." Supabase returns raw
   English codes ("Invalid login credentials"); a real app never shows a code.
   Map the ones a member actually hits to a plain sentence. Anything unmapped
   falls back to a calm generic — never a stack trace, never a code.
   ========================================================================= */
export function humanizeAuthError(e) {
  const m = (e?.message || e?.error_description || '').toLowerCase()
  if (!m) return 'Algo salió mal. Inténtalo de nuevo.'
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (m.includes('email not confirmed')) return 'Tu correo aún no está confirmado.'
  if (m.includes('user already registered') || m.includes('already been registered')) return 'Ya existe una cuenta con este correo. Inicia sesión.'
  if (m.includes('password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.'
  if (m.includes('unable to validate email') || m.includes('invalid email') || m.includes('invalid format')) return 'Ese correo no es válido.'
  if (m.includes('email rate limit') || m.includes('rate limit') || m.includes('too many requests')) return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.'
  if (m.includes('for security purposes')) return 'Espera unos segundos antes de volver a intentarlo.'
  if (m.includes('same password') || m.includes('should be different')) return 'La nueva contraseña debe ser distinta a la anterior.'
  if (m.includes('network') || m.includes('failed to fetch')) return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.'
  return 'Algo salió mal. Inténtalo de nuevo.'
}
