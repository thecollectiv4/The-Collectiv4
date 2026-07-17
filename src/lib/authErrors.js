/* =========================================================================
   authErrors — plain English for auth failures (D3, El Mundo v7).
   "Everything a very-good app has." Supabase returns raw codes
   ("Invalid login credentials"); a real app never shows a code. Map the
   ones a member actually hits to a plain sentence. Anything unmapped falls
   back to a calm generic — never a stack trace, never a code. The auth form
   is English end to end (labels, placeholders, buttons), so these are too:
   the same voice at the exact moment trust is forming.
   ========================================================================= */
export function humanizeAuthError(e) {
  const m = (e?.message || e?.error_description || '').toLowerCase()
  if (!m) return 'Something went wrong. Try again.'
  if (m.includes('invalid login credentials')) return 'Wrong email or password.'
  if (m.includes('email not confirmed')) return 'Your email isn’t confirmed yet.'
  if (m.includes('user already registered') || m.includes('already been registered')) return 'An account already exists with this email. Sign in.'
  if (m.includes('password should be at least')) return 'Password must be at least 6 characters.'
  if (m.includes('unable to validate email') || m.includes('invalid email') || m.includes('invalid format')) return 'That email isn’t valid.'
  if (m.includes('email rate limit') || m.includes('rate limit') || m.includes('too many requests')) return 'Too many attempts. Wait a moment and try again.'
  if (m.includes('for security purposes')) return 'Wait a few seconds before trying again.'
  if (m.includes('same password') || m.includes('should be different')) return 'Your new password must be different from the old one.'
  if (m.includes('network') || m.includes('failed to fetch')) return 'No connection. Check your internet and try again.'
  return 'Something went wrong. Try again.'
}
