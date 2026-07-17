// =========================================================================
// /api/cron/ticket-emails — the SAFETY NET for buyer confirmation email.
//
// The fast path (webhook.js) sends in seconds and covers ~everything. This
// sweep catches what it lost: Resend down, a timeout, a deploy mid-transaction.
// It claims each un-emailed row atomically (email_sent_at lock, migration 0045)
// and sends — the same processTicketEmail() the fast path uses, so a row the
// fast path already sent is skipped, and the seed floor is enforced in the claim.
//
// PLAN NOTE (Hobby): Vercel Hobby caps cron at once per day, so vercel.json
// schedules this daily. The fast path is the real-time guarantee; this is the
// backstop. The endpoint is plan-agnostic and can be triggered manually or by
// an external pinger for a tighter cadence on event day (see the PR/handback),
// or set a sub-daily schedule the moment the project moves to Pro.
//
// SECURITY: fail CLOSED, like the webhook. No CRON_SECRET configured → refuse
// (the safety net stays inert; the fast path still works). Vercel attaches
// `Authorization: Bearer $CRON_SECRET` to cron invocations when the var is set.
// =========================================================================
import { createClient } from '@supabase/supabase-js'
import { processTicketEmail } from '../_ticketEmail.js'

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://tpjbyxbsgtiwqcxcpwyn.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
)

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('CRON_SECRET not set — refusing to run the sweep unauthenticated')
    return res.status(500).json({ error: 'CRON_SECRET not configured' })
  }
  if ((req.headers.authorization || '') !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  let ids
  try {
    const { data, error } = await supabase.rpc('tickets_pending_email', { p_limit: 100 })
    if (error) {
      console.error('tickets_pending_email error:', error.message)
      return res.status(500).json({ error: 'Sweep query failed' })
    }
    ids = data || []
  } catch (err) {
    console.error('Sweep query threw:', err.message)
    return res.status(500).json({ error: 'Sweep query failed' })
  }

  let sent = 0, skipped = 0, failed = 0
  for (const id of ids) {
    const r = await processTicketEmail(supabase, id)
    if (r.status === 'sent') sent++
    else if (r.status === 'skipped') skipped++
    else failed++
  }
  const capped = ids.length === 100 // hit the query cap — more may remain for the next run
  console.log(`Ticket-email sweep: swept=${ids.length} sent=${sent} skipped=${skipped} failed=${failed}${capped ? ' (capped at 100)' : ''}`)
  return res.status(200).json({ ok: true, swept: ids.length, sent, skipped, failed, capped })
}
