import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, ArrowRight, Check, Copy, ChevronDown } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { BONE, BONE_MID, BONE_LOW, FAINT, SILVER, STAR, HAIR, HAIR_HI, WARN, FONT_DISPLAY, FONT_MONO, FONT_SANS, chromeText } from '@/lib/cosmos'
import { fetchListings } from '@/lib/listings'
import { fetchMyBookings, markDelivered, bookingLink, fmtMoney, netCents } from '@/lib/bookings'

/* =========================================================================
   Bookings — /bookings. The creative's side of the payment layer: their
   services, the shareable links, the bookings that came in, and their
   real number. INTEGRITY: every figure on this screen is computed from
   real rows the creative owns under RLS. No booking → an honest 0,
   never a placeholder.
   ========================================================================= */

const STATUS = {
  pending:   { label: 'PENDING',   color: 'var(--cream-ghost)' },
  paid:      { label: 'PAID',      color: 'var(--star)' },
  delivered: { label: 'DELIVERED', color: 'var(--silver)' },
  cancelled: { label: 'CANCELLED', color: 'var(--cream-ghost)' },
}

export default function Bookings() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [services, setServices] = useState([])
  const [bookings, setBookings] = useState([])

  const load = useCallback(async (uid) => {
    const [ls, bs] = await Promise.all([fetchListings(uid), fetchMyBookings()])
    return { services: ls.filter((l) => l.kind === 'service'), bookings: bs }
  }, [])

  useEffect(() => {
    if (authLoading || !user) return
    let alive = true
    setLoading(true)
    load(user.id).then(({ services, bookings }) => {
      if (!alive) return
      setServices(services)
      setBookings(bookings)
      setLoading(false)
    })
    return () => { alive = false }
  }, [user, authLoading, load])

  const onDelivered = useCallback(async (id) => {
    await markDelivered(id)
    setBookings((bs) => bs.map((b) => (b.id === id ? { ...b, status: 'delivered', delivered_at: new Date().toISOString() } : b)))
  }, [])

  // the real number: what the creative keeps, from settled rows only
  const settled = bookings.filter((b) => b.status === 'paid' || b.status === 'delivered')
  const take = settled.reduce((sum, b) => sum + netCents(b.price_cents, b.fee_bps), 0)

  const shell = (children) => (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '28px 20px 80px' }}>{children}</div>
  )

  // page-level guard, independent of the dismissible auth modal (v14 doctrine)
  if (authLoading) return shell(
    <div style={{ textAlign: 'center', paddingTop: '30vh' }}>
      <Loader2 size={20} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} />
    </div>
  )
  if (!user) return shell(
    <div style={{ textAlign: 'center', paddingTop: '24vh', maxWidth: '400px', margin: '0 auto' }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: SILVER, letterSpacing: '.28em', textTransform: 'uppercase' }}>The Offer, working</div>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(36px,11vw,48px)', lineHeight: .9, margin: '14px 0 0', color: BONE }}>YOUR BOOKINGS</h1>
      <p style={{ fontFamily: FONT_SANS, fontSize: '14px', color: BONE_MID, lineHeight: 1.6, margin: '18px 0 0' }}>
        Sign in to see your services, your links, and who booked you.
      </p>
      <button onClick={() => navigate('/auth?next=/bookings')} style={{ ...cta, marginTop: '26px' }} onMouseOver={hoverIn} onMouseOut={hoverOut}>
        Sign in <ArrowRight size={16} />
      </button>
    </div>
  )

  return shell(
    <>
      <div style={{ fontFamily: FONT_MONO, fontSize: '10px', color: SILVER, letterSpacing: '.28em', textTransform: 'uppercase' }}>The Offer, working</div>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(40px,10vw,56px)', lineHeight: .9, margin: '12px 0 0', ...chromeText }}>YOUR BOOKINGS</h1>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Loader2 size={18} style={{ color: SILVER, animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <>
          {/* YOUR TAKE — the honest number */}
          <div style={{ marginTop: '30px', border: `1px solid ${HAIR_HI}`, borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '22px 24px', background: 'var(--bg-card)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.3em', color: BONE_LOW, textTransform: 'uppercase' }}>Your take</div>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: '44px', color: BONE, lineHeight: 1, marginTop: '10px' }}>{fmtMoney(take) || '$0'}</div>
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: '9.5px', color: BONE_LOW, letterSpacing: '.1em', textAlign: 'right', lineHeight: 1.8 }}>
                {settled.length} PAID BOOKING{settled.length === 1 ? '' : 'S'}<br />
                AFTER THE C4 FEE
              </div>
            </div>
            <div style={{ padding: '12px 24px', borderTop: `1px dashed ${HAIR_HI}`, fontFamily: FONT_MONO, fontSize: '9px', color: FAINT, letterSpacing: '.1em', lineHeight: 1.6 }}>
              COUNTED FROM REAL PAID BOOKINGS ONLY · PAYOUTS SETTLE WITH C4 DIRECTLY WHILE STRIPE CONNECT LANDS
            </div>
          </div>

          {/* YOUR SERVICES — the links that get shared */}
          <SectionLabel style={{ marginTop: '40px' }}>Your services</SectionLabel>
          {services.length === 0 ? (
            <Empty>
              A service is your work with a price on it — a set, a shoot, a design, a mix.
              Put one up with the <span style={{ color: BONE_MID }}>+</span> in the nav (the OFFER path), then share its payment link anywhere.
            </Empty>
          ) : (
            <div style={{ border: `1px solid ${HAIR}`, borderRadius: '12px', overflow: 'hidden' }}>
              {services.map((s, i) => <ServiceRow key={s.id} s={s} first={i === 0} />)}
            </div>
          )}

          {/* BOOKINGS — who booked you */}
          <SectionLabel style={{ marginTop: '40px' }}>Bookings</SectionLabel>
          {bookings.length === 0 ? (
            <Empty>
              No bookings yet — an honest zero. Share a service link by DM; the page it opens does the selling.
            </Empty>
          ) : (
            <div style={{ border: `1px solid ${HAIR}`, borderRadius: '12px', overflow: 'hidden' }}>
              {bookings.map((b, i) => <BookingRow key={b.id} b={b} first={i === 0} onDelivered={onDelivered} />)}
            </div>
          )}
        </>
      )}
    </>
  )
}

function SectionLabel({ children, style }) {
  return <div style={{ fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.3em', color: BONE_LOW, textTransform: 'uppercase', marginBottom: '14px', ...style }}>{children}</div>
}

function Empty({ children }) {
  return (
    <div style={{ border: `1px dashed ${HAIR_HI}`, borderRadius: '12px', padding: '22px 24px', fontFamily: FONT_SANS, fontSize: '13px', color: BONE_LOW, lineHeight: 1.65 }}>
      {children}
    </div>
  )
}

function ServiceRow({ s, first }) {
  const [copied, setCopied] = useState(false)
  const live = s.status === 'live'
  const copy = () => {
    navigator.clipboard.writeText(bookingLink(s.id))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', borderTop: first ? 'none' : `1px solid ${HAIR}`, opacity: live ? 1 : .55 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: '13px', fontWeight: 600, color: BONE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
        <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.1em', marginTop: '3px', textTransform: 'uppercase' }}>
          {fmtMoney(s.price_cents)}{!live && ` · ${s.status}`}
        </div>
      </div>
      {live && (
        <button className="pressable" onClick={copy}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'rgba(var(--ink-rgb),.07)', border: '1px solid rgba(var(--ink-rgb),.24)', borderRadius: '100px', padding: '8px 15px', color: BONE, fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', transition: 'background .2s, border-color .2s' }}>
          {copied ? <><Check size={11} style={{ color: STAR }} /> Copied</> : <><Copy size={11} /> Payment link</>}
        </button>
      )}
    </div>
  )
}

function BookingRow({ b, first, onDelivered }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const st = STATUS[b.status] || STATUS.pending
  const r = b.request || {}
  const hasRequest = r.brief || r.date || r.place || r.links

  const deliver = async () => {
    if (busy) return
    setBusy(true); setErr('')
    try { await onDelivered(b.id) } catch (e) { setErr(e?.message || 'try again') } finally { setBusy(false) }
  }

  return (
    <div style={{ borderTop: first ? 'none' : `1px solid ${HAIR}` }}>
      <div onClick={() => setOpen((o) => !o)} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o) } }}
        style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }}>
        <span aria-hidden style={{ width: '6px', height: '6px', borderRadius: '50%', background: st.color, boxShadow: b.status === 'paid' ? '0 0 8px rgba(var(--star-rgb),.6)' : 'none', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: '13px', fontWeight: 600, color: BONE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {b.client_name} — {b.service_title}
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.1em', marginTop: '3px' }}>
            {fmtDate(b.created_at)} · {fmtMoney(b.price_cents)} · YOU KEEP {fmtMoney(netCents(b.price_cents, b.fee_bps))}
          </div>
        </div>
        <span style={{ fontFamily: FONT_MONO, fontSize: '8px', color: st.color, letterSpacing: '.18em' }}>{st.label}</span>
        <ChevronDown size={14} style={{ color: BONE_LOW, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .25s var(--ease-house, ease)' }} />
      </div>

      {open && (
        <div style={{ padding: '0 20px 18px 40px' }}>
          {hasRequest ? (
            <div style={{ fontFamily: FONT_SANS, fontSize: '12.5px', color: BONE_MID, lineHeight: 1.65 }}>
              {r.brief && <p style={{ margin: '0 0 8px' }}>{r.brief}</p>}
              <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: BONE_LOW, letterSpacing: '.08em', lineHeight: 2, textTransform: 'uppercase' }}>
                {r.date && <div>When · {r.date}</div>}
                {r.place && <div>Where · {r.place}</div>}
                {r.links && <div style={{ textTransform: 'none' }}>REFERENCES · {r.links}</div>}
                <div style={{ textTransform: 'none' }}>REPLY TO · {b.client_email}</div>
              </div>
            </div>
          ) : (
            <div style={{ fontFamily: FONT_MONO, fontSize: '9px', color: FAINT, letterSpacing: '.1em' }}>NO REQUEST DETAILS</div>
          )}
          {b.status === 'paid' && (
            <button className="pressable" onClick={(e) => { e.stopPropagation(); deliver() }} disabled={busy}
              style={{ marginTop: '14px', display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'rgba(var(--ink-rgb),.07)', border: '1px solid rgba(var(--ink-rgb),.24)', borderRadius: '100px', padding: '8px 15px', color: BONE, fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
              {busy ? '…' : <><Check size={11} /> Mark delivered</>}
            </button>
          )}
          {err && <div style={{ fontFamily: FONT_MONO, fontSize: '8.5px', color: WARN, marginTop: '8px' }}>△ {err}</div>}
        </div>
      )}
    </div>
  )
}

const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
  } catch { return '' }
}

const cta = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
  background: BONE, border: 'none', borderRadius: '12px', padding: '15px 26px', color: 'var(--bg)',
  fontFamily: FONT_SANS, fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'transform .2s, box-shadow .2s',
}
const hoverIn = (e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(var(--silver-rgb),.18)' }
const hoverOut = (e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }
