import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { X, ImagePlus, Loader2, ArrowLeft } from 'lucide-react'
import { useWide } from '@/lib/useIsDesktop'
import { createWorldPost } from '@/lib/worldPosts'

/* =========================================================================
   CREATE CENTRAL — the + at the center of the app (Ley 13; the Base44
   steal, modernized under the Constitution). One door, and behind it only
   the intentions the member can act on TODAY (Leyes 9/11 — zero
   coming-soon teasers, zero dead doors):

     01 POST TO YOUR WORLD   — every member: image(s) + a line, a dated
                               piece in their museum (world_posts, 0016)
     02 HOST AN EVENT        — verified members: create/publish THEIR
                               event through the OS Events surface
     03 CURATE YOUR WORLD    — every member: straight to the builder

   The catalog rows are the design (numbered, hairlines, mono kickers) —
   labels as intention, not filler.
   ========================================================================= */

const VOID = '#0A0A0D'
const VOID_2 = '#07080E'
const BONE = '#F2EEE6'
const BONE_MID = '#9B9891'
const BONE_LOW = '#5B5952'
const SILVER = '#C7C9D1'
const CARD = '#0E0E13'
const HAIR = 'rgba(242,238,230,0.08)'
const HAIR_HI = 'rgba(242,238,230,0.15)'
const WARN = '#E5A0A0'
const NOISE = "<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>"
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(NOISE)}")`
const CHROME = 'linear-gradient(176deg,#EEF0F4 0%,#BFC2CB 20%,#83868F 40%,#F7F9FD 52%,#7E818A 63%,#CED1DA 82%,#9497A0 100%)'
const chromeText = { background: CHROME, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }

const MAX_POST_IMAGES = 4

export default function CreateCentral({ user, isMemberVerified, onClose }) {
  const navigate = useNavigate()
  const wide = useWide()
  const [stage, setStage] = useState('menu')   // menu | post | posted

  // Esc closes; lock body scroll while open
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const go = (path) => { onClose(); navigate(path) }

  const shell = wide
    ? { position: 'relative', width: 'min(560px, 92vw)', maxHeight: '86vh', background: VOID_2, border: `1px solid ${HAIR_HI}`, borderRadius: '18px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 90px rgba(0,0,0,.6)' }
    : { position: 'relative', width: '100%', maxWidth: '430px', maxHeight: '86dvh', background: VOID_2, borderTop: `1px solid ${HAIR_HI}`, borderRadius: '20px 20px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10005, background: 'rgba(7,8,14,.8)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: wide ? 'center' : 'flex-end', justifyContent: 'center', animation: 'fadeIn .25s ease' }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Create" style={shell}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: GRAIN, backgroundSize: '150px 150px', opacity: .05, mixBlendMode: 'overlay', pointerEvents: 'none' }} />

        {stage === 'menu' && (
          <CreateMenu wide={wide} verified={isMemberVerified} onClose={onClose}
            onPost={() => setStage('post')}
            onHost={() => go('/os?tab=events&new=1')}
            onCurate={() => go('/profile')} />
        )}
        {stage === 'post' && (
          <PostComposer wide={wide} user={user} onBack={() => setStage('menu')} onClose={onClose}
            onPosted={() => setStage('posted')} />
        )}
        {stage === 'posted' && (
          <div style={{ position: 'relative', padding: '44px 28px 40px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.3em', textTransform: 'uppercase' }}>◇ posted</div>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: '40px', lineHeight: .95, marginTop: '14px', ...chromeText }}>IT LIVES IN<br />YOUR WORLD</div>
            <p style={{ fontFamily: 'DM Sans', fontSize: '13px', color: BONE_MID, lineHeight: 1.6, marginTop: '12px' }}>A dated piece in your museum — the world can see it now.</p>
            <button className="pressable" onClick={() => go('/profile')}
              style={{ marginTop: '24px', width: '100%', background: BONE, border: 'none', borderRadius: '10px', padding: '14px', color: VOID, fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans' }}>
              SEE IT IN YOUR WORLD
            </button>
            <button onClick={onClose} style={{ marginTop: '12px', background: 'transparent', border: 'none', color: BONE_LOW, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
              done
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

/* ---------- the menu: intentions as catalog rows ---------- */
function CreateMenu({ wide, verified, onPost, onHost, onCurate, onClose }) {
  const rows = [
    { n: '01', title: 'POST TO YOUR WORLD', kicker: 'a dated piece', line: 'Images and a line — it hangs in your museum, today’s date on the label.', onGo: onPost },
    ...(verified ? [{ n: '02', title: 'HOST AN EVENT', kicker: 'your room', line: 'Create it, publish it, scan the door. Your event, on the platform.', onGo: onHost }] : []),
    { n: verified ? '03' : '02', title: 'CURATE YOUR WORLD', kicker: 'the museum', line: 'Gallery, sound, marquee, skin — shape how the world walks in.', onGo: onCurate },
  ]
  return (
    <div style={{ position: 'relative', padding: wide ? '26px 28px 24px' : '20px 20px calc(20px + env(safe-area-inset-bottom, 0px))' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.3em', textTransform: 'uppercase' }}>◇ create</div>
        <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: BONE_LOW, cursor: 'pointer', padding: '4px', display: 'inline-flex' }}><X size={16} /></button>
      </div>
      <div style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '38px' : '32px', lineHeight: .95, marginTop: '10px', ...chromeText }}>PUT SOMETHING<br />INTO THE WORLD</div>
      <div style={{ marginTop: '18px' }}>
        {rows.map((r, i) => (
          <button key={r.n} className="pressable" onClick={r.onGo}
            style={{ display: 'flex', alignItems: 'baseline', gap: '14px', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${HAIR}`, padding: '16px 2px', cursor: 'pointer', transition: 'padding-left .2s ease' }}
            onMouseOver={(e) => { e.currentTarget.style.paddingLeft = '10px' }}
            onMouseOut={(e) => { e.currentTarget.style.paddingLeft = '2px' }}>
            <span style={{ fontFamily: 'DM Mono', fontSize: '10px', color: SILVER, letterSpacing: '.1em', flexShrink: 0, opacity: .85 }}>{r.n}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'Bebas Neue', fontSize: '22px', color: BONE, letterSpacing: '.03em', lineHeight: 1 }}>{r.title}</span>
                <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.22em', textTransform: 'uppercase' }}>{r.kicker}</span>
              </span>
              <span style={{ display: 'block', fontFamily: 'DM Sans', fontSize: '12.5px', color: BONE_MID, lineHeight: 1.5, marginTop: '5px' }}>{r.line}</span>
            </span>
            <span aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '12px', color: SILVER, flexShrink: 0 }}>→</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ---------- the post composer: images + a line, one honest write ---------- */
function PostComposer({ wide, user, onBack, onClose, onPosted }) {
  const [files, setFiles] = useState([])           // [{ file, preview }]
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  // previews are object URLs — release them on unmount
  useEffect(() => () => { files.forEach((f) => URL.revokeObjectURL(f.preview)) }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const addFiles = (list) => {
    const imgs = Array.from(list || []).filter((f) => f && f.type?.startsWith('image/'))
    if (!imgs.length) return
    setErr('')
    setFiles((cur) => [...cur, ...imgs.map((file) => ({ file, preview: URL.createObjectURL(file) }))].slice(0, MAX_POST_IMAGES))
  }
  const removeAt = (i) => setFiles((cur) => { URL.revokeObjectURL(cur[i]?.preview); return cur.filter((_, j) => j !== i) })

  // paste an image straight into the composer
  useEffect(() => {
    const onPaste = (e) => {
      const imgs = [...(e.clipboardData?.files || [])].filter((f) => f.type?.startsWith('image/'))
      if (imgs.length) { e.preventDefault(); addFiles(imgs) }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  const canPost = !busy && (files.length > 0 || caption.trim().length > 0)

  const publish = async () => {
    if (!canPost || !user) return
    setBusy(true); setErr('')
    try {
      await createWorldPost(user.id, { files: files.map((f) => f.file), caption })
      // any mounted museum refreshes its timeline without a hard reload
      window.dispatchEvent(new Event('c4:posted'))
      onPosted()
    } catch (e) {
      setErr(e?.message || "couldn't post — try again")
    } finally { setBusy(false) }
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer?.files) }}
      style={{ position: 'relative', padding: wide ? '26px 28px 24px' : '20px 20px calc(20px + env(safe-area-inset-bottom, 0px))', overflowY: 'auto', ...(dragOver && { outline: `1px dashed ${SILVER}`, outlineOffset: '-10px' }) }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onBack} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'transparent', border: 'none', color: BONE_LOW, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.18em', textTransform: 'uppercase', cursor: 'pointer', padding: 0 }}>
          <ArrowLeft size={12} /> create
        </button>
        <button onClick={onClose} disabled={busy} aria-label="Close" style={{ background: 'transparent', border: 'none', color: BONE_LOW, cursor: 'pointer', padding: '4px', display: 'inline-flex', opacity: busy ? .4 : 1 }}><X size={16} /></button>
      </div>
      <div style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '32px' : '27px', lineHeight: .95, marginTop: '10px', color: BONE }}>POST TO YOUR WORLD</div>
      <p style={{ fontFamily: 'DM Sans', fontSize: '12.5px', color: BONE_MID, lineHeight: 1.55, margin: '8px 0 16px' }}>
        A moment, dated and hung in your museum. Up to {MAX_POST_IMAGES} images, one line — or just the line.
      </p>

      {files.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
          {files.map((f, i) => (
            <div key={f.preview} style={{ position: 'relative' }}>
              <img src={f.preview} alt="" style={{ width: '72px', height: '72px', borderRadius: '10px', objectFit: 'cover', border: `1px solid ${HAIR_HI}`, display: 'block' }} />
              <button onClick={() => removeAt(i)} disabled={busy} aria-label="Remove image" style={{ position: 'absolute', top: '-6px', right: '-6px', width: '19px', height: '19px', borderRadius: '50%', background: VOID, border: `1px solid ${HAIR_HI}`, color: WARN, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><X size={10} /></button>
            </div>
          ))}
        </div>
      )}

      {files.length < MAX_POST_IMAGES && (
        <button className="pressable" onClick={() => fileRef.current?.click()} disabled={busy}
          style={{ width: '100%', background: dragOver ? 'rgba(199,201,209,.07)' : 'transparent', border: `1px dashed ${dragOver ? SILVER : HAIR_HI}`, borderRadius: '12px', padding: '16px 13px', color: BONE_MID, fontSize: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', fontFamily: 'DM Sans', opacity: busy ? .6 : 1 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><ImagePlus size={14} /> Add images</span>
          <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.1em' }}>tap · drag it in · or just paste</span>
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple style={{ display: 'none' }}
        onChange={(e) => { const list = Array.from(e.target.files || []); e.target.value = ''; addFiles(list) }} />

      <div style={{ marginTop: '14px' }}>
        <label style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.22em', color: BONE_LOW, textTransform: 'uppercase', display: 'block', marginBottom: '7px' }}>THE LINE</label>
        <textarea value={caption} maxLength={600} rows={3} disabled={busy}
          placeholder="What is this moment? Your voice, one breath."
          onChange={(e) => setCaption(e.target.value)}
          style={{ width: '100%', background: CARD, border: `1px solid ${HAIR_HI}`, borderRadius: '10px', padding: '12px 14px', color: BONE, fontFamily: 'DM Sans', fontSize: '14px', outline: 'none', resize: 'vertical', lineHeight: 1.6 }} />
      </div>

      {err && <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: WARN, marginTop: '10px' }}>⚠ {err}</div>}

      <button className="pressable" onClick={publish} disabled={!canPost}
        style={{ marginTop: '16px', width: '100%', background: BONE, border: 'none', borderRadius: '10px', padding: '14px', color: VOID, fontWeight: 600, fontSize: '13px', cursor: canPost ? 'pointer' : 'default', fontFamily: 'DM Sans', opacity: canPost ? 1 : .5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        {busy ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> POSTING…</> : 'POST IT'}
      </button>
    </div>
  )
}
