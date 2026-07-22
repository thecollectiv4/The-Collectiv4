import { useState } from 'react'
import { X, Pencil } from 'lucide-react'
import { postDate } from '@/lib/worldPosts'

/* =========================================================================
   WorldMoments — the timeline body of the MOMENTS movement: the gallery
   extended into dated pieces (world_posts). Each post is a museum piece
   with a specimen label (date · the line). Editorial, newest first; the
   owner gets one discreet remove per piece — and, since v15, one discreet
   edit: the LINE is rewritable, the images are not (a hung piece doesn't
   get re-cut; re-hanging is post + remove). The section marker/numbering
   lives in ProfileMuseum with the other movements.
   ========================================================================= */

const BONE = 'var(--cream)'
const BONE_MID = 'var(--cream-soft)'
const BONE_LOW = 'var(--cream-dim)'
const SILVER = 'var(--silver)'
const CARD = 'var(--card-solid)'
const HAIR = 'rgba(var(--ink-rgb),0.08)'
const HAIR_HI = 'rgba(var(--ink-rgb),0.15)'
const WARN = 'var(--warn)'

const safeImg = (raw) => (/^https?:\/\//i.test((raw || '').trim()) ? raw : '')

export default function WorldMoments({ posts, isOwner, onDelete, onEdit, wide }) {
  return (
    <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: wide ? '40px' : '30px' }}>
      {posts.map((p) => <Moment key={p.id} post={p} isOwner={isOwner} onDelete={onDelete} onEdit={onEdit} wide={wide} />)}
    </div>
  )
}

function Moment({ post, isOwner, onDelete, onEdit, wide }) {
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [err, setErr] = useState('')
  const imgs = (post.images || []).map((i) => safeImg(i.url)).filter(Boolean)

  const remove = async () => {
    if (busy) return
    setBusy(true); setErr('')
    try { await onDelete?.(post) }
    catch (e) { setErr(e?.message || "couldn't delete — try again") }
    finally { setBusy(false); setConfirming(false) }
  }

  /* Edit is the same discreet register as remove: opened from the specimen
     label, resolved inline, never a modal over the museum. The draft seeds
     from the CURRENT line every time — a cancelled edit leaves no residue. */
  const startEdit = () => { setDraft(post.caption || ''); setEditing(true); setErr('') }
  const saveEdit = async () => {
    if (busy) return
    /* mirror of the helper's guard, said before the round-trip: a text-only
       moment can't have its only substance cleared (world_posts_not_empty) */
    if (!draft.trim() && imgs.length === 0) { setErr('a moment with no image needs its line — to take the piece down, use remove'); return }
    setBusy(true); setErr('')
    try { await onEdit?.(post, draft); setEditing(false) }
    catch (e) { setErr(e?.message || "couldn't save — try again") }
    finally { setBusy(false) }
  }

  return (
    <div style={{ maxWidth: wide ? '860px' : undefined }}>
      {/* specimen label — the date owns the line (Archive Dreams steal) */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '10px' }}>
        <span style={{ fontFamily: 'DM Mono', fontSize: '9px', color: SILVER, letterSpacing: '.18em' }}>{postDate(post.created_at)}</span>
        <span aria-hidden style={{ flex: 1, height: '1px', background: `linear-gradient(90deg,${HAIR},transparent)`, alignSelf: 'center' }} />
        {isOwner && !confirming && !editing && (
          <button onClick={startEdit} aria-label="Edit this moment's line" title="Edit"
            style={{ background: 'transparent', border: 'none', color: BONE_LOW, cursor: 'pointer', padding: '2px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'DM Mono', fontSize: '8px', letterSpacing: '.1em', textTransform: 'uppercase' }}>
            <Pencil size={11} /> edit
          </button>
        )}
        {isOwner && !confirming && !editing && (
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

      {err && <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: WARN, marginTop: '8px' }}>⚠ {err}</div>}

      {/* the line — the caption reads like a wall text, not a feed blurb */}
      {!editing && post.caption && (
        <p style={{ fontFamily: 'DM Sans', fontSize: imgs.length ? '13.5px' : (wide ? '19px' : '16px'), fontWeight: imgs.length ? 400 : 300, color: imgs.length ? BONE_MID : BONE, lineHeight: 1.7, margin: imgs.length ? '10px 0 0' : '2px 0 0', maxWidth: '640px', ...(imgs.length ? {} : { paddingLeft: '16px', borderLeft: `1px solid ${SILVER}` }) }}>
          {post.caption}
        </p>
      )}

      {/* rewriting the line — the same vocabulary as the composer's caption
          box (CreateCentral), resolved with the label row's mono verbs.
          maxLength mirrors world_posts_caption_cap (1000). */}
      {editing && (
        <div style={{ marginTop: imgs.length ? '10px' : '2px', maxWidth: '640px' }}>
          <textarea
            value={draft} onChange={(e) => setDraft(e.target.value)}
            maxLength={1000} rows={2} autoFocus aria-label="The line under this moment"
            placeholder="the line under this piece"
            style={{ width: '100%', background: CARD, border: `1px solid ${HAIR_HI}`, borderRadius: '10px', padding: '10px 12px', color: BONE, fontFamily: 'DM Sans', fontSize: '13.5px', outline: 'none', resize: 'vertical', lineHeight: 1.6 }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
            <button onClick={() => { setEditing(false); setErr('') }} disabled={busy}
              style={{ background: 'transparent', border: 'none', color: BONE_LOW, cursor: 'pointer', padding: 0, fontFamily: 'DM Mono', fontSize: '8px', letterSpacing: '.1em', textTransform: 'uppercase' }}>
              cancel
            </button>
            <button onClick={saveEdit} disabled={busy}
              style={{ background: 'transparent', border: `1px solid ${HAIR_HI}`, borderRadius: '100px', padding: '3px 10px', color: busy ? BONE_LOW : BONE_MID, cursor: 'pointer', fontFamily: 'DM Mono', fontSize: '8px', letterSpacing: '.1em', textTransform: 'uppercase' }}>
              {busy ? '…' : 'save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
