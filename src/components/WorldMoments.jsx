import { useState } from 'react'
import { X } from 'lucide-react'
import { postDate } from '@/lib/worldPosts'

/* =========================================================================
   WorldMoments — the timeline body of the MOMENTS movement: the gallery
   extended into dated pieces (world_posts). Each post is a museum piece
   with a specimen label (date · the line). Editorial, newest first; the
   owner gets one discreet remove per piece. The section marker/numbering
   lives in ProfileMuseum with the other movements.
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

export default function WorldMoments({ posts, isOwner, onDelete, wide }) {
  return (
    <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: wide ? '40px' : '30px' }}>
      {posts.map((p) => <Moment key={p.id} post={p} isOwner={isOwner} onDelete={onDelete} wide={wide} />)}
    </div>
  )
}

function Moment({ post, isOwner, onDelete, wide }) {
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const imgs = (post.images || []).map((i) => safeImg(i.url)).filter(Boolean)

  const remove = async () => {
    if (busy) return
    setBusy(true)
    try { await onDelete?.(post) } finally { setBusy(false); setConfirming(false) }
  }

  return (
    <div style={{ maxWidth: wide ? '860px' : undefined }}>
      {/* specimen label — the date owns the line (Archive Dreams steal) */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '10px' }}>
        <span style={{ fontFamily: 'DM Mono', fontSize: '9px', color: SILVER, letterSpacing: '.18em' }}>{postDate(post.created_at)}</span>
        <span aria-hidden style={{ flex: 1, height: '1px', background: `linear-gradient(90deg,${HAIR},transparent)`, alignSelf: 'center' }} />
        {isOwner && !confirming && (
          <button onClick={() => setConfirming(true)} aria-label="Remove this moment" title="Remove"
            style={{ background: 'transparent', border: 'none', color: BONE_LOW, cursor: 'pointer', padding: '2px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'DM Mono', fontSize: '8px', letterSpacing: '.1em', textTransform: 'uppercase' }}>
            <X size={11} /> remove
          </button>
        )}
        {isOwner && confirming && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontFamily: 'DM Mono', fontSize: '8px', letterSpacing: '.1em', textTransform: 'uppercase' }}>
            <button onClick={remove} disabled={busy} style={{ background: 'transparent', border: `1px solid rgba(229,160,160,.35)`, borderRadius: '100px', padding: '3px 10px', color: WARN, cursor: 'pointer', fontFamily: 'DM Mono', fontSize: '8px', letterSpacing: '.1em', textTransform: 'uppercase' }}>{busy ? '…' : 'delete'}</button>
            <button onClick={() => setConfirming(false)} disabled={busy} style={{ background: 'transparent', border: 'none', color: BONE_LOW, cursor: 'pointer', padding: 0, fontFamily: 'DM Mono', fontSize: '8px', letterSpacing: '.1em', textTransform: 'uppercase' }}>keep</button>
          </span>
        )}
      </div>

      {/* the piece: one image leads full; more hang in a row */}
      {imgs.length === 1 && (
        <a href={imgs[0]} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none' }}>
          <div style={{ borderRadius: '14px', overflow: 'hidden', border: `1px solid ${HAIR_HI}`, background: CARD }}>
            <img src={imgs[0]} alt={post.caption || ''} loading="lazy" style={{ width: '100%', display: 'block', objectFit: 'cover', maxHeight: wide ? '520px' : '400px' }} />
          </div>
        </a>
      )}
      {imgs.length > 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(imgs.length, wide ? 4 : 2)}, minmax(0,1fr))`, gap: wide ? '14px' : '10px' }}>
          {imgs.map((src, i) => (
            <a key={`${src}:${i}`} href={src} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none' }}>
              <div style={{ borderRadius: '12px', overflow: 'hidden', border: `1px solid ${HAIR_HI}`, background: CARD }}>
                <img src={src} alt="" loading="lazy" style={{ width: '100%', height: wide ? '220px' : '150px', display: 'block', objectFit: 'cover' }} />
              </div>
            </a>
          ))}
        </div>
      )}

      {/* the line — the caption reads like a wall text, not a feed blurb */}
      {post.caption && (
        <p style={{ fontFamily: 'DM Sans', fontSize: imgs.length ? '13.5px' : (wide ? '19px' : '16px'), fontWeight: imgs.length ? 400 : 300, color: imgs.length ? BONE_MID : BONE, lineHeight: 1.7, margin: imgs.length ? '10px 0 0' : '2px 0 0', maxWidth: '640px', ...(imgs.length ? {} : { paddingLeft: '16px', borderLeft: `1px solid ${SILVER}` }) }}>
          {post.caption}
        </p>
      )}
    </div>
  )
}
