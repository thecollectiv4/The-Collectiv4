// =========================================================================
// _ticketEmail — the buyer confirmation email, in ONE place.
//
// The underscore keeps Vercel from routing this as an endpoint (same as
// _sentry.js): it is shared code, imported by BOTH paths to the same email —
//   • the FAST PATH  (webhook.js, right after the sale is recorded), and
//   • the SAFETY NET (api/cron/ticket-emails.js, the daily sweep).
//
// Both go through processTicketEmail(), which claims the row atomically
// (email_sent_at is the DB lock, migration 0045), so the two paths can race
// the same ticket and only one sends. A send that fails RELEASES the claim so
// the safety net retries — a lost email is recoverable, a double email is spam.
// The seed floor + confirmed check live inside claim_ticket_email(): a fixture
// buyer never claims, so it never receives real mail from our domain.
// =========================================================================
import { Resend } from 'resend'

// Construct defensively: new Resend(undefined) THROWS. A missing key must never
// crash this module at import — that would take the webhook down with it and
// lose a paid ticket over an email-config problem. No key → resend is null and
// processTicketEmail fails gracefully (the sweep retries once the key is set).
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

// Sender rides the VERIFIED sending subdomain (send.thecollectiv4.com), never
// the root — the root's mail slot is left free for a future human mailbox.
const FROM = process.env.TICKET_EMAIL_FROM || 'The Collectiv4 <tickets@send.thecollectiv4.com>'
// Where CLAIM YOUR WORLD sends the buyer to build their profile (retention).
const SITE = process.env.PUBLIC_SITE_URL || 'https://the-collectiv4.vercel.app'

const VOID = '#0A0A0D'
const BONE = '#F2EEE6'
const CARD = '#121218'
const HAIR = '#23232A'
const GREY = '#8A8A93'
const GREY_HI = '#B8B6AE'

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ))
}

// Editorial, not template. Void + bone, uppercase display, hairline rules, one
// bone CTA. Brand fonts load where the client allows and degrade to a clean
// web-safe stack where it doesn't — never a fight (Apple Mail shows Bebas;
// Gmail falls back to the inline stack). No emoji, no "Hi there".
export function buildTicketEmailHTML(data) {
  const { qrCode, tier, amount, title, edition, eventDate, eventTime, venue } = data
  const display = "'Bebas Neue', 'Arial Narrow', Helvetica, Arial, sans-serif"
  const mono = "'DM Mono', 'Courier New', Courier, monospace"
  const sans = "'DM Sans', Helvetica, Arial, sans-serif"
  const price = amount != null && !Number.isNaN(Number(amount)) ? '$' + Math.round(Number(amount) / 100) : ''
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=0&data=${encodeURIComponent(qrCode || '')}&bgcolor=F2EEE6&color=0A0A0D&format=png`
  const row = (label, value) => value
    ? `<tr><td style="padding:13px 0;border-bottom:1px solid ${HAIR};">
         <div style="font-family:${mono};font-size:10px;letter-spacing:.18em;color:${GREY};text-transform:uppercase;">${esc(label)}</div>
         <div style="font-family:${display};font-size:20px;letter-spacing:.02em;color:${BONE};margin-top:5px;">${esc(value)}</div>
       </td></tr>`
    : ''
  const ticketVal = `${esc(tier || 'TICKET')}${price ? `&nbsp;&nbsp;·&nbsp;&nbsp;${price}` : ''}`
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap');
  body{margin:0;padding:0;background:${VOID};}
  a{text-decoration:none;}
</style></head>
<body style="margin:0;padding:0;background:${VOID};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your ticket is confirmed. Show the code at the door.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${VOID};">
<tr><td align="center" style="padding:44px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">

  <tr><td style="padding:0 0 26px 0;">
    <span style="font-family:${display};font-size:22px;letter-spacing:.14em;color:${BONE};">THE&nbsp;COLLECTIV4</span>
  </td></tr>
  <tr><td style="padding:0 0 26px 0;"><div style="height:1px;background:${HAIR};line-height:1px;">&nbsp;</div></td></tr>

  <tr><td style="padding:0 0 12px 0;">
    <span style="font-family:${mono};font-size:11px;letter-spacing:.28em;color:${GREY};text-transform:uppercase;">Your ticket is confirmed</span>
  </td></tr>
  <tr><td style="padding:0 0 ${edition ? '2px' : '26px'} 0;">
    <span style="font-family:${display};font-size:44px;line-height:1.02;letter-spacing:.02em;color:${BONE};">${esc(title || 'RAN BY ARTISTS')}</span>
  </td></tr>
  ${edition ? `<tr><td style="padding:0 0 26px 0;"><span style="font-family:${display};font-size:26px;line-height:1;letter-spacing:.03em;color:${GREY_HI};">${esc(edition)}</span></td></tr>` : ''}

  <tr><td style="padding:6px 22px;background:${CARD};border:1px solid ${HAIR};border-radius:10px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${row('Date', eventDate)}
      ${row('Doors', eventTime)}
      ${row('Venue', venue)}
      <tr><td style="padding:13px 0;">
        <div style="font-family:${mono};font-size:10px;letter-spacing:.18em;color:${GREY};text-transform:uppercase;">Ticket</div>
        <div style="font-family:${display};font-size:20px;letter-spacing:.02em;color:${BONE};margin-top:5px;">${ticketVal}</div>
      </td></tr>
    </table>
  </td></tr>

  <tr><td align="center" style="padding:34px 0 14px 0;">
    <div style="display:inline-block;padding:18px;background:${BONE};border-radius:12px;line-height:0;">
      <img src="${qrUrl}" alt="${esc(qrCode || '')}" width="200" height="200" style="display:block;width:200px;height:200px;border-radius:4px;">
    </div>
  </td></tr>
  <tr><td align="center" style="padding:0 0 6px 0;">
    <span style="font-family:${mono};font-size:15px;letter-spacing:.16em;color:${BONE};">${esc(qrCode || '')}</span>
  </td></tr>
  <tr><td align="center" style="padding:0 0 30px 0;">
    <span style="font-family:${sans};font-size:12px;color:${GREY};">Show this at the door.</span>
  </td></tr>

  <tr><td align="center" style="padding:0 0 10px 0;">
    <a href="${SITE}/claim" style="display:inline-block;padding:15px 38px;background:${BONE};color:${VOID};font-family:${sans};font-size:13px;font-weight:600;letter-spacing:.04em;border-radius:8px;">CLAIM YOUR WORLD</a>
  </td></tr>
  <tr><td align="center" style="padding:0 0 34px 0;">
    <span style="font-family:${sans};font-size:12px;color:${GREY};line-height:1.5;">Build your profile — it's how the room finds you.</span>
  </td></tr>

  <tr><td style="padding:0 0 22px 0;"><div style="height:1px;background:${HAIR};line-height:1px;">&nbsp;</div></td></tr>
  <tr><td align="center" style="padding:0 0 8px 0;">
    <span style="font-family:${display};font-size:16px;letter-spacing:.14em;color:${BONE};">THE&nbsp;COLLECTIV4</span>
  </td></tr>
  <tr><td align="center" style="padding:0 0 8px 0;">
    <span style="font-family:${mono};font-size:9px;letter-spacing:.24em;color:${GREY};text-transform:uppercase;">Art&nbsp;·&nbsp;Music&nbsp;·&nbsp;Fashion&nbsp;·&nbsp;Events</span>
  </td></tr>
  <tr><td align="center" style="padding:0 0 4px 0;">
    <a href="https://instagram.com/thecollectiv4" style="font-family:${sans};font-size:12px;color:${GREY_HI};">@thecollectiv4</a>
  </td></tr>

</table>
</td></tr></table>
</body></html>`
}

// Claim one ticket, compose, send. Idempotent via email_sent_at (the DB lock).
// Returns { status: 'sent' | 'skipped' | 'failed', reason? }. NEVER throws to
// the caller — a webhook must not 500 (and lose a paid ticket) over an email.
export async function processTicketEmail(supabase, ticketId) {
  // No Resend client (key unset) → don't even claim: leave the row pending so
  // the sweep sends it once the key is configured. Never crash the caller.
  if (!resend) {
    console.error('RESEND_API_KEY not configured — leaving ticket ' + ticketId + ' pending')
    return { status: 'failed', reason: 'no_resend_key' }
  }
  // 1. atomic claim — enforces seed floor + confirmed + not-already-sent
  let claim
  try {
    const { data, error } = await supabase.rpc('claim_ticket_email', { p_ticket_id: ticketId })
    if (error) {
      console.error('claim_ticket_email error:', error.message)
      return { status: 'failed', reason: 'claim_error' }
    }
    claim = Array.isArray(data) ? data[0] : data
  } catch (err) {
    console.error('claim_ticket_email threw:', err.message)
    return { status: 'failed', reason: 'claim_threw' }
  }
  // No row = not claimable: already sent, concurrently claimed, seed, or unconfirmed.
  if (!claim) return { status: 'skipped', reason: 'not_claimable' }
  if (!claim.buyer_email) return { status: 'skipped', reason: 'no_email' }

  // 2. compose
  const title = claim.ev_title || 'RAN BY ARTISTS'
  const subject = `Your ticket — ${title}${claim.ev_edition ? ', ' + claim.ev_edition : ''}`
  const html = buildTicketEmailHTML({
    qrCode: claim.qr_code,
    tier: claim.tier_name || 'TICKET',
    amount: claim.price_paid,
    title,
    edition: claim.ev_edition || '',
    eventDate: claim.ev_date
      ? new Date(claim.ev_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()
      : 'TBA',
    eventTime: claim.ev_doors || '',
    venue: claim.ev_venue || '',
  })

  // 3. send — on any failure, RELEASE the claim so the safety net retries.
  try {
    const { data, error } = await resend.emails.send({ from: FROM, to: [claim.buyer_email], subject, html })
    if (error) {
      await releaseAndLog(supabase, ticketId, claim.buyer_email, JSON.stringify(error))
      return { status: 'failed', reason: 'resend_error' }
    }
    console.log('Ticket email sent to ' + claim.buyer_email + ', id: ' + (data && data.id))
    return { status: 'sent', id: data && data.id }
  } catch (err) {
    await releaseAndLog(supabase, ticketId, claim.buyer_email, err.message)
    return { status: 'failed', reason: 'resend_threw' }
  }
}

async function releaseAndLog(supabase, ticketId, email, message) {
  try { await supabase.rpc('release_ticket_email', { p_ticket_id: ticketId }) } catch (e) { console.error('release failed:', e.message) }
  try {
    await supabase.from('email_failures').insert({ ticket_id: ticketId, email_address: email, error_message: message })
  } catch (e) { console.error('email_failures log failed:', e.message) }
}
