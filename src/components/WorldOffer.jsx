import { useState } from 'react'
import { X, Tag, Handshake, MessageCircle, RotateCcw, Check } from 'lucide-react'
import { KINDS, priceLabel } from '@/lib/listings'

/* =========================================================================
   WorldOffer — the OFFER movement of a world (listings, migration 0017):
   the museum that also WORKS (Estrella Polar: pieza 1 + 2 + 3 — the
   profile as a portfolio that sells). Pieces and services hang like
   catalog objects: specimen label (kind · number), title, a REAL price.

   No payment path exists yet, so the buy affordance is a DM — a real
   door into a real conversation, never a dead checkout (Leyes 9, 11).
   The section marker/numbering lives in ProfileMuseum with the other
   movements.
   ========================================================================= */

const BONE = '#F2EEE6'
const BONE_MID = '#9B9891'
const BONE_LOW = '#5B5952'
const SILVER = '#C7C9D1'
const CARD = '#0E0E13'
const HAIR = 'rgba(242,238,230,0.08)'
const HAIR_HI = 'rgba(242,238,230,0.15)'
const WARN = '#E5A0A0'

const safeImg = (raw) => (/^https?:\/\//i.test((raw || '').trim()) ? raw : '')

export default function WorldOffer({ listings, isOwner, onDMSeller, onSetStatus, onDelete, wide }) {
  // the public sees LIVE only (RLS already enforces this server-side —
  // the filter here just keeps an owner's archive out of the public shape
  // when the same component renders both routes)
  const shown = isOwner ? listings : listings.filter((l) => l.status === 'live')
  if (!shown.length) return null
  return (
    <div style={{ marginTop: '4px', display: 'grid', gridTemplateColumns: wide ? 'repeat(auto-fill, minmax(300px, 1fr))' : '1fr', gap: wide ? '22px' : '16px' }}>
      {shown.map((l, i) => (
        <OfferPiece key={l.id} l={l} index={i} isOwner={isOwner} onDMSeller={onDMSeller} onSetStatus={onSetStatus} onDelete={onDelete} wide={wide} />
      ))}
    </div>
  )
}

function OfferPiece({ l, index, isOwner, onDMSeller, onSetStatus, onDelete, wide }) {
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [err, setErr] = useState('')
  const img = safeImg(l.images?.[0]?.url)
  const kind = KINDS[l.kind] || KINDS.piece
  const KindIcon = l.kind === 'service' ? Handshake : Tag
  const live = l.status === 'live'

  const act = async (fn) => {
    if (busy) return
    setBusy(true); setErr('')
    try { await fn() } catch (e) { setErr(e?.message || 'try again') } finally { setBusy(false); setConfirming(false) }
  }

  return (
    <div style={{ borderRadius: '16px', overflow: 'hidden', border: `1px solid ${live ? HAIR_HI : HAIR}`, background: CARD, opacity: live ? 1 : .62, display: 'flex', flexDirection: 'column' }}>
      {/* the piece — image when it has one; a typographic object when not */}
      {img ? (
        <div style={{ position: 'relative', height: wide ? '210px' : '190px', overflow: 'hidden', background: '#08080D' }}>
          <img src={img} alt={l.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(7,8,14,0) 55%, rgba(7,8,14,.72) 100%)' }} />
        </div>
      ) : (
        <div style={{ position: 'relative', height: wide ? '120px' : '104px', overflow: 'hidden', background: 'linear-gradient(160deg, rgba(199,201,209,.1) 0%, rgba(199,201,209,.02) 45%, #08080D 100%)' }}>
          <span aria-hidden style={{ position: 'absolute', bottom: '-16px', right: '-4px', fontFamily: 'Bebas Neue', fontSize: '110px', lineHeight: 1, opacity: .08, color: BONE, pointerEvents: 'none' }}>{(l.title || '?')[0].toUpperCase()}</span>
          <KindIcon size={18} strokeWidth={1.5} style={{ position: 'absolute', top: '14px', left: '14px', color: SILVER, opacity: .8 }} />
        </div>
      )}

      <div style={{ padding: '14px 16px 15px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        {/* specimen label (Archive Dreams steal): kind · number · state */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: 'DM Mono', fontSize: '7.5px', color: SILVER, letterSpacing: '.2em', border: '1px solid rgba(199,201,209,.25)', borderRadius: '100px', padding: '3px 9px' }}>
            <KindIcon size={9} /> {kind.label}
          </span>
          <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.14em' }}>{String(index + 1).padStart(2, '0')}</span>
          {!live && (
            <span style={{ fontFamily: 'DM Mono', fontSize: '7.5px', color: BONE_LOW, letterSpacing: '.18em', textTransform: 'uppercase', marginLeft: 'auto' }}>{l.status}</span>
          )}
        </div>

        <div style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '23px' : '21px', color: BONE, letterSpacing: '.02em', lineHeight: 1 }}>{l.title}</div>
        {l.description && (
          <p style={{ fontFamily: 'DM Sans', fontSize: '12px', color: BONE_MID, lineHeight: 1.5, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{l.description}</p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: 'auto', paddingTop: '6px', borderTop: `1px solid ${HAIR}` }}>
          {/* the price — the point of the layer, set like a display fact */}
          <span style={{ fontFamily: 'Bebas Neue', fontSize: '24px', color: BONE, letterSpacing: '.02em' }}>{priceLabel(l.price_cents)}</span>

          {!isOwner && live && onDMSeller && (
            <button className="pressable" onClick={() => onDMSeller(l)}
              style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'rgba(242,238,230,.07)', border: `1px solid rgba(242,238,230,.24)`, borderRadius: '100px', padding: '8px 15px', color: BONE, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', transition: 'background .2s, border-color .2s, transform .2s' }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(242,238,230,.13)'; e.currentTarget.style.borderColor = 'rgba(242,238,230,.45)' }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(242,238,230,.07)'; e.currentTarget.style.borderColor = 'rgba(242,238,230,.24)' }}>
              <MessageCircle size={11} /> {kind.cta}
            </button>
          )}

          {isOwner && !confirming && (
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {live ? (
                <button className="pressable" onClick={() => act(() => onSetStatus?.(l, 'sold'))} disabled={busy} title="Mark sold"
                  style={ownerBtn}>
                  <Check size={10} /> sold
                </button>
              ) : (
                <button className="pressable" onClick={() => act(() => onSetStatus?.(l, 'live'))} disabled={busy} title="Put it back up"
                  style={ownerBtn}>
                  <RotateCcw size={10} /> relist
                </button>
              )}
              <button onClick={() => setConfirming(true)} disabled={busy} aria-label="Remove listing" title="Remove"
                style={{ background: 'transparent', border: 'none', color: BONE_LOW, cursor: 'pointer', padding: '4px', display: 'inline-flex' }}>
                <X size={12} />
              </button>
            </span>
          )}
          {isOwner && confirming && (
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '8px', fontFamily: 'DM Mono', fontSize: '8px', letterSpacing: '.1em', textTransform: 'uppercase' }}>
              <button onClick={() => act(() => onDelete?.(l))} disabled={busy}
                style={{ background: 'transparent', border: '1px solid rgba(229,160,160,.35)', borderRadius: '100px', padding: '4px 11px', color: WARN, cursor: 'pointer', fontFamily: 'DM Mono', fontSize: '8px', letterSpacing: '.1em', textTransform: 'uppercase' }}>
                {busy ? '…' : 'delete'}
              </button>
              <button onClick={() => setConfirming(false)} disabled={busy}
                style={{ background: 'transparent', border: 'none', color: BONE_LOW, cursor: 'pointer', padding: 0, fontFamily: 'DM Mono', fontSize: '8px', letterSpacing: '.1em', textTransform: 'uppercase' }}>
                keep
              </button>
            </span>
          )}
        </div>
        {err && <div style={{ fontFamily: 'DM Mono', fontSize: '8.5px', color: WARN }}>⚠ {err}</div>}
      </div>
    </div>
  )
}

const ownerBtn = {
  display: 'inline-flex', alignItems: 'center', gap: '5px',
  background: 'transparent', border: `1px solid ${HAIR_HI}`, borderRadius: '100px',
  padding: '5px 11px', color: BONE_MID, fontFamily: 'DM Mono', fontSize: '8px',
  letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer',
}
