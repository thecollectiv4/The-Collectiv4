import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { X, ImagePlus, Loader2, ArrowLeft, Tag, Handshake, CalendarPlus, Sparkles, Camera } from 'lucide-react'
import { useWide } from '@/lib/useIsDesktop'
import Mark from '@/components/Mark'
import { createWorldPost } from '@/lib/worldPosts'
import { createListing, KINDS, priceLabel } from '@/lib/listings'
import { socialReady, circleReady } from '@/lib/social'

/* =========================================================================
   CREATE CENTRAL — the + at the center of the app (Ley 13; the Base44
   steal). v8 (adición A): the six flat intentions become THREE DOORS —
   Pato's drop: "post your world y curate your world podrían estar más
   juntos. Make a plan o just an event, más juntos. Offer a service y
   sell, más juntos."

     ○ SHARE   — post to your world · curate your world
     ◇ GATHER  — make a plan · host an event (verified)
     △ OFFER   — offer a service · sell a piece

   The structural reason is not cleanliness: six flat buttons cannot
   become twelve. Three doors hold four each without the member feeling
   anything. Each door wears its house mark (Ley 14); honest absence
   holds per door AND per intention (Leyes 9/11) — a door with nothing
   live behind it simply isn't there.
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
const CHROME = 'linear-gradient(100deg,#F6F6FA 0%,#A6ABBA 26%,#FCFCFE 50%,#8E94A6 73%,#EFEFF4 100%)' // deck formula — jewelry, one moment per screen (v8 D3)
const chromeText = { background: CHROME, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }

const MAX_POST_IMAGES = 4
const MAX_LISTING_IMAGES = 4

export default function CreateCentral({ user, isMemberVerified, onClose }) {
  const navigate = useNavigate()
  const wide = useWide()
  // menu (the doors) | share | gather | offer (a door open) | post | posted | sell | listed
  const [stage, setStage] = useState('menu')
  const [sellKind, setSellKind] = useState('piece')
  // the marketplace doors render only when the layer is LIVE in the DB —
  // pre-migration they're honestly absent, never a full composer that
  // hits a wall at publish (panel + review catch, Leyes 9/11)
  const [marketReady, setMarketReady] = useState(false)
  useEffect(() => { let on = true; socialReady().then((r) => { if (on) setMarketReady(r) }); return () => { on = false } }, [])
  // same doctrine for the plan door: it renders only once 0023 is live
  const [planReady, setPlanReady] = useState(false)
  useEffect(() => { let on = true; circleReady().then((r) => { if (on) setPlanReady(r) }); return () => { on = false } }, [])
  // while a write is in flight, neither Esc nor the backdrop may abandon it
  const busyRef = useRef(false)
  const dialogRef = useRef(null)

  // Esc closes; lock body scroll while open; focus moves INTO the dialog
  // and back to the opener on close (a11y catch). Mount-once with onClose
  // in a ref — an unstable inline onClose from Layout re-ran this effect
  // mid-session and stole focus from a member mid-caption (review catch).
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    const opener = document.activeElement
    dialogRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape' && !busyRef.current) onCloseRef.current() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      if (opener && typeof opener.focus === 'function') opener.focus()
    }
  }, [])

  const go = (path) => { onClose(); navigate(path) }

  const shell = wide
    ? { position: 'relative', width: 'min(560px, 92vw)', maxHeight: '86vh', background: VOID_2, border: `1px solid ${HAIR_HI}`, borderRadius: '18px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 90px rgba(0,0,0,.6)' }
    : { position: 'relative', width: '100%', maxWidth: '430px', maxHeight: '86dvh', background: VOID_2, borderTop: `1px solid ${HAIR_HI}`, borderRadius: '20px 20px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }

  return createPortal(
    <div onClick={() => { if (!busyRef.current) onClose() }} className="overlay-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 10005, background: 'rgba(7,8,14,.8)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: wide ? 'center' : 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Create" className={wide ? 'dialog-in' : 'sheet-up'} style={{ ...shell, outline: 'none' }}>

        {(stage === 'menu' || stage === 'share' || stage === 'gather' || stage === 'offer') && (
          <CreateDoors wide={wide} stage={stage} setStage={setStage}
            verified={isMemberVerified} marketReady={marketReady} planReady={planReady} onClose={onClose}
            onPost={() => setStage('post')}
            onPlan={() => go('/messages?seg=plans&new=1')}
            onSell={(kind) => { setSellKind(kind); setStage('sell') }}
            onHost={() => go('/os?tab=events&new=1')}
            onCurate={() => go('/profile')} />
        )}
        {stage === 'post' && (
          <PostComposer wide={wide} user={user} onBack={() => setStage('share')} onClose={onClose}
            onBusy={(b) => { busyRef.current = b }}
            onPosted={() => { busyRef.current = false; setStage('posted') }} />
        )}
        {stage === 'posted' && (
          <Done
            kicker="posted" title={<>IT LIVES IN<br />YOUR WORLD</>}
            line="A dated piece in your museum — the world can see it now."
            cta="SEE IT IN YOUR WORLD" onCta={() => go('/profile')} onClose={onClose} />
        )}
        {stage === 'sell' && (
          <ListingComposer wide={wide} user={user} kind={sellKind} onBack={() => setStage('offer')} onClose={onClose}
            onBusy={(b) => { busyRef.current = b }}
            onListed={() => { busyRef.current = false; setStage('listed') }} />
        )}
        {stage === 'listed' && (
          <Done
            kicker="on offer" title={<>IT'S ON<br />THE WALL</>}
            line={sellKind === 'service'
              ? 'Your service hangs in your world with its price — people reach you by DM.'
              : 'Your piece hangs in your world with its price — people reach you by DM.'}
            cta="SEE YOUR OFFER" onCta={() => go('/profile')} onClose={onClose} />
        )}
      </div>
    </div>,
    document.body
  )
}

/* ---------- the closing moment, shared ---------- */
function Done({ kicker, title, line, cta, onCta, onClose }) {
  return (
    <div style={{ position: 'relative', padding: '44px 28px 40px', textAlign: 'center' }}>
      <div className="rise" style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.3em', textTransform: 'uppercase' }}>◇ {kicker}</div>
      <div className="rise rise-1" style={{ fontFamily: 'Bebas Neue', fontSize: '40px', lineHeight: .95, marginTop: '14px', ...chromeText }}>{title}</div>
      <p className="rise rise-2" style={{ fontFamily: 'DM Sans', fontSize: '13px', color: BONE_MID, lineHeight: 1.6, marginTop: '12px' }}>{line}</p>
      {/* the rise animates the WRAPPER: a filled animation outranks .pressable's
          :active transform, so a .rise on the button would kill its press. */}
      <div className="rise rise-3" style={{ marginTop: '24px', display: 'flex' }}>
        <button className="pressable" onClick={onCta}
          style={{ width: '100%', background: BONE, border: 'none', borderRadius: '10px', padding: '14px', color: VOID, fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans' }}>
          {cta}
        </button>
      </div>
      <button className="rise rise-4" onClick={onClose} style={{ marginTop: '12px', background: 'transparent', border: 'none', color: BONE_LOW, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
        done
      </button>
    </div>
  )
}

/* ---------- the three doors + the rooms behind them (v8 adición A) ----------
   'menu' shows the doors; tapping one opens its intentions in place.
   Doors and intentions are both catalog rows — the house's own marks,
   temperature per door (Ley 14), the word always beside the mark (Ley 5). */
function CreateDoors({ wide, stage, setStage, verified, marketReady, planReady, onPost, onPlan, onSell, onHost, onCurate, onClose }) {
  // each intention exists only when its layer is LIVE (Leyes 9/11)
  const INTENTS = {
    share: [
      { icon: Camera,   tint: '242,238,230', title: 'POST TO YOUR WORLD', kicker: 'a dated piece', line: 'Images and a line — it hangs in your museum, today’s date on the label.', onGo: onPost },
      { icon: Sparkles, tint: '242,238,230', title: 'CURATE YOUR WORLD',  kicker: 'the museum',    line: 'Gallery, sound, marquee, skin — shape how the world walks in.', onGo: onCurate },
    ],
    gather: [
      ...(planReady ? [{ mark: 'star', tint: '232,233,237', title: 'MAKE A PLAN', kicker: 'real life', line: 'A kickback, a roadtrip, real life — it gets a room, your amigos get the door.', onGo: onPlan }] : []),
      ...(verified ? [{ icon: CalendarPlus, tint: '232,233,237', title: 'HOST AN EVENT', kicker: 'your room', line: 'Create it, publish it, scan the door. Your event, on the platform.', onGo: onHost }] : []),
    ],
    offer: [
      ...(marketReady ? [
        { icon: Handshake, tint: '199,201,209', title: 'OFFER A SERVICE', kicker: 'your craft',   line: 'Shoots, sets, design — put your rate on the wall, get booked by DM.', onGo: () => onSell('service') },
        { icon: Tag,       tint: '199,201,209', title: 'SELL A PIECE',    kicker: 'with a price', line: 'Clothing, prints, archive — name it, price it, the world DMs you.', onGo: () => onSell('piece') },
      ] : []),
    ],
  }
  // a door with nothing live behind it isn't there (honest absence)
  const DOORS = [
    { key: 'share',  mark: 'ring',     tint: '242,238,230', title: 'SHARE',  line: 'your world speaks' },
    { key: 'gather', mark: 'diamond',  tint: '232,233,237', title: 'GATHER', line: 'real life, planned' },
    { key: 'offer',  mark: 'triangle', tint: '199,201,209', title: 'OFFER',  line: 'your craft, priced' },
  ].filter((d) => INTENTS[d.key].length > 0)

  const open = stage !== 'menu' ? DOORS.find((d) => d.key === stage) : null
  const rows = open ? INTENTS[open.key] : []

  return (
    <div style={{ position: 'relative', padding: wide ? '26px 28px 24px' : '20px 20px calc(20px + env(safe-area-inset-bottom, 0px))', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {open ? (
          <button onClick={() => setStage('menu')} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'transparent', border: 'none', color: BONE_LOW, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.18em', textTransform: 'uppercase', cursor: 'pointer', padding: 0 }}>
            <ArrowLeft size={12} /> create
          </button>
        ) : (
          <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: BONE_LOW, letterSpacing: '.3em', textTransform: 'uppercase' }}>◇ create</div>
        )}
        <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: BONE_LOW, cursor: 'pointer', padding: '4px', display: 'inline-flex' }}><X size={16} /></button>
      </div>

      {open ? (
        <>
          {/* the door, open: its mark + name lead, its rooms follow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
            <Mark type={open.mark} size={18} color={`rgb(${open.tint})`} />
            <div style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '38px' : '32px', lineHeight: .95, ...chromeText }}>{open.title}</div>
            <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.22em', textTransform: 'uppercase', paddingTop: '6px' }}>{open.line}</span>
          </div>
          <div style={{ marginTop: '14px' }}>
            {rows.map((r, i) => <IntentRow key={r.title} r={r} last={i === rows.length - 1} wide={wide} />)}
          </div>
        </>
      ) : (
        <>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '38px' : '32px', lineHeight: .95, marginTop: '10px', ...chromeText }}>PUT SOMETHING<br />INTO THE WORLD</div>
          <div style={{ marginTop: '16px' }}>
            {DOORS.map((d, i) => (
              <button key={d.key} className="row-lead" data-testid={`create-door-${d.key}`} onClick={() => setStage(d.key)}
                style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: i === DOORS.length - 1 ? 'none' : `1px solid ${HAIR}`, padding: wide ? '19px 2px' : '17px 2px', cursor: 'pointer' }}>
                <span aria-hidden style={{ width: '46px', height: '46px', flexShrink: 0, borderRadius: '13px', border: `1px solid rgba(${d.tint},.28)`, background: `rgba(${d.tint},.07)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 14px rgba(${d.tint},.08)` }}>
                  <Mark type={d.mark} size={18} color={`rgb(${d.tint})`} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'Bebas Neue', fontSize: '25px', color: BONE, letterSpacing: '.04em', lineHeight: 1 }}>{d.title}</span>
                    <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.22em', textTransform: 'uppercase' }}>{d.line}</span>
                  </span>
                  {/* what's inside, legible before opening (Ley 5) */}
                  <span style={{ display: 'block', fontFamily: 'DM Mono', fontSize: '9.5px', color: BONE_MID, letterSpacing: '.06em', marginTop: '5px', textTransform: 'lowercase' }}>
                    {INTENTS[d.key].map((r) => r.title.toLowerCase()).join(' · ')}
                  </span>
                </span>
                <span aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '12px', color: SILVER, flexShrink: 0 }}>→</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* one intention — the same catalog row language as always */
function IntentRow({ r, last, wide }) {
  const Icon = r.icon
  return (
    <button className="row-lead" onClick={r.onGo}
      style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: last ? 'none' : `1px solid ${HAIR}`, padding: wide ? '15px 2px' : '13px 2px', cursor: 'pointer' }}>
      <span aria-hidden style={{ width: '40px', height: '40px', flexShrink: 0, borderRadius: '11px', border: `1px solid rgba(${r.tint},.28)`, background: `rgba(${r.tint},.07)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 14px rgba(${r.tint},.08)` }}>
        {r.mark
          ? <Mark type={r.mark} size={16} color={`rgb(${r.tint})`} />
          : <Icon size={17} strokeWidth={1.6} style={{ color: `rgb(${r.tint})` }} />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'Bebas Neue', fontSize: '21px', color: BONE, letterSpacing: '.03em', lineHeight: 1 }}>{r.title}</span>
          <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.22em', textTransform: 'uppercase' }}>{r.kicker}</span>
        </span>
        <span style={{ display: 'block', fontFamily: 'DM Sans', fontSize: '12px', color: BONE_MID, lineHeight: 1.45, marginTop: '4px' }}>{r.line}</span>
      </span>
      <span aria-hidden style={{ fontFamily: 'DM Mono', fontSize: '12px', color: SILVER, flexShrink: 0 }}>→</span>
    </button>
  )
}

/* ---------- the post composer: images + a line, one honest write ---------- */
function PostComposer({ wide, user, onBack, onClose, onBusy, onPosted }) {
  const [files, setFiles] = useState([])           // [{ file, preview }]
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  // previews are object URLs — a ref mirror releases the CURRENT set on
  // unmount (an [] effect closure would capture the initial empty array
  // and revoke nothing)
  const filesRef = useRef(files)
  filesRef.current = files
  useEffect(() => () => { filesRef.current.forEach((f) => URL.revokeObjectURL(f.preview)) }, [])

  const addFiles = (list) => {
    const imgs = Array.from(list || []).filter((f) => f && f.type?.startsWith('image/'))
    if (!imgs.length) return
    setErr('')
    // create object URLs only for the slots that remain — URLs made past the
    // cap and discarded by a slice would leak unrevoked (review catch)
    setFiles((cur) => {
      const room = Math.max(0, MAX_POST_IMAGES - cur.length)
      return [...cur, ...imgs.slice(0, room).map((file) => ({ file, preview: URL.createObjectURL(file) }))]
    })
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
    setBusy(true); setErr(''); onBusy?.(true)
    try {
      await createWorldPost(user.id, { files: files.map((f) => f.file), caption })
      // any mounted museum refreshes its timeline without a hard reload
      window.dispatchEvent(new Event('c4:posted'))
      onPosted()
    } catch (e) {
      setErr(e?.message || "couldn't post — try again")
    } finally { setBusy(false); onBusy?.(false) }
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer?.files) }}
      style={{ position: 'relative', padding: wide ? '26px 28px 24px' : '20px 20px calc(20px + env(safe-area-inset-bottom, 0px))', overflowY: 'auto', ...(dragOver && { outline: `1px dashed ${SILVER}`, outlineOffset: '-10px' }) }}>
      <ComposerTop onBack={onBack} onClose={onClose} busy={busy} />
      <div style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '32px' : '27px', lineHeight: .95, marginTop: '10px', color: BONE }}>POST TO YOUR WORLD</div>
      <p style={{ fontFamily: 'DM Sans', fontSize: '12.5px', color: BONE_MID, lineHeight: 1.55, margin: '8px 0 16px' }}>
        A moment, dated and hung in your museum. Up to {MAX_POST_IMAGES} images, one line — or just the line.
      </p>

      <Thumbs files={files} busy={busy} onRemove={removeAt} />

      {files.length < MAX_POST_IMAGES && (
        <AddImages busy={busy} dragOver={dragOver} onPick={() => fileRef.current?.click()} />
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

/* ---------- the listing composer: a piece/service with a REAL price ----------
   The first marketplace layer (Estrella Polar): exist and show honestly.
   No payment path yet → the wall says DM to buy, never a dead checkout
   (Ley 11). Price is required — the price IS the point. */
function ListingComposer({ wide, user, kind, onBack, onClose, onBusy, onListed }) {
  const [files, setFiles] = useState([])
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef(null)

  const filesRef = useRef(files)
  filesRef.current = files
  useEffect(() => () => { filesRef.current.forEach((f) => URL.revokeObjectURL(f.preview)) }, [])

  const addFiles = (list) => {
    const imgs = Array.from(list || []).filter((f) => f && f.type?.startsWith('image/'))
    if (!imgs.length) return
    setErr('')
    // same slot-cap discipline as the post composer (review catch)
    setFiles((cur) => {
      const room = Math.max(0, MAX_LISTING_IMAGES - cur.length)
      return [...cur, ...imgs.slice(0, room).map((file) => ({ file, preview: URL.createObjectURL(file) }))]
    })
  }
  const removeAt = (i) => setFiles((cur) => { URL.revokeObjectURL(cur[i]?.preview); return cur.filter((_, j) => j !== i) })

  const priceNum = Number(price)
  const priceOk = Number.isFinite(priceNum) && priceNum >= 1 && priceNum <= 50000
  const canList = !busy && title.trim().length > 0 && priceOk && (kind === 'service' || files.length > 0)

  const service = kind === 'service'
  const heading = service ? 'OFFER A SERVICE' : 'SELL A PIECE'
  const sub = service
    ? 'Your craft with a rate — shoots, sets, design, whatever you do. Booking happens by DM for now; native booking is a coming layer.'
    : 'A piece with a price — clothing, prints, archive. Buying happens by DM for now; native checkout is a coming layer.'

  const publish = async () => {
    if (!canList || !user) return
    setBusy(true); setErr(''); onBusy?.(true)
    try {
      await createListing(user.id, {
        kind,
        title,
        description: desc,
        priceCents: Math.round(priceNum * 100),
        files: files.map((f) => f.file),
      })
      window.dispatchEvent(new Event('c4:listed'))
      onListed()
    } catch (e) {
      setErr(e?.message || "couldn't publish — try again")
    } finally { setBusy(false); onBusy?.(false) }
  }

  return (
    <div style={{ position: 'relative', padding: wide ? '26px 28px 24px' : '20px 20px calc(20px + env(safe-area-inset-bottom, 0px))', overflowY: 'auto' }}>
      <ComposerTop onBack={onBack} onClose={onClose} busy={busy} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
        <span aria-hidden style={{ width: '34px', height: '34px', flexShrink: 0, borderRadius: '10px', border: '1px solid rgba(199,201,209,.28)', background: 'rgba(199,201,209,.07)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          {service ? <Handshake size={15} strokeWidth={1.6} style={{ color: SILVER }} /> : <Tag size={15} strokeWidth={1.6} style={{ color: SILVER }} />}
        </span>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: wide ? '32px' : '26px', lineHeight: .95, color: BONE }}>{heading}</div>
      </div>
      <p style={{ fontFamily: 'DM Sans', fontSize: '12.5px', color: BONE_MID, lineHeight: 1.55, margin: '8px 0 16px' }}>{sub}</p>

      <Thumbs files={files} busy={busy} onRemove={removeAt} />
      {files.length < MAX_LISTING_IMAGES && (
        <AddImages busy={busy} onPick={() => fileRef.current?.click()}
          hint={service ? 'optional — show the work' : 'show the piece — at least one'} />
      )}
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple style={{ display: 'none' }}
        onChange={(e) => { const list = Array.from(e.target.files || []); e.target.value = ''; addFiles(list) }} />

      <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label htmlFor="listing-title" style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.22em', color: BONE_LOW, textTransform: 'uppercase', display: 'block', marginBottom: '7px' }}>{service ? 'THE SERVICE' : 'THE PIECE'}</label>
          <input id="listing-title" value={title} maxLength={120} disabled={busy}
            placeholder={service ? 'Event photography · full set' : 'C4 archive tee · 001'}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: '100%', background: CARD, border: `1px solid ${HAIR_HI}`, borderRadius: '10px', padding: '12px 14px', color: BONE, fontFamily: 'DM Sans', fontSize: '14px', outline: 'none' }} />
        </div>
        <div>
          <label htmlFor="listing-price" style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.22em', color: BONE_LOW, textTransform: 'uppercase', display: 'block', marginBottom: '7px' }}>THE PRICE (USD)</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontFamily: 'Bebas Neue', fontSize: '16px', color: SILVER }}>$</span>
            <input id="listing-price" value={price} inputMode="decimal" disabled={busy}
              placeholder={service ? '150' : '45'}
              aria-invalid={!!price && !priceOk}
              aria-describedby={price && !priceOk ? 'listing-price-err' : undefined}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))}
              style={{ width: '100%', background: CARD, border: `1px solid ${price && !priceOk ? 'rgba(229,160,160,.4)' : HAIR_HI}`, borderRadius: '10px', padding: '12px 14px 12px 30px', color: BONE, fontFamily: 'DM Sans', fontSize: '14px', outline: 'none' }} />
          </div>
          {price && !priceOk && <div id="listing-price-err" role="alert" style={{ fontFamily: 'DM Mono', fontSize: '8.5px', color: WARN, marginTop: '6px' }}>a real price: $1 – $50,000</div>}
        </div>
        <div>
          <label htmlFor="listing-desc" style={{ fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.22em', color: BONE_LOW, textTransform: 'uppercase', display: 'block', marginBottom: '7px' }}>THE DETAILS <span style={{ opacity: .6 }}>· optional</span></label>
          <textarea id="listing-desc" value={desc} maxLength={1000} rows={2} disabled={busy}
            placeholder={service ? 'What it includes, turnaround, where you work.' : 'Size, condition, the story behind it.'}
            onChange={(e) => setDesc(e.target.value)}
            style={{ width: '100%', background: CARD, border: `1px solid ${HAIR_HI}`, borderRadius: '10px', padding: '12px 14px', color: BONE, fontFamily: 'DM Sans', fontSize: '14px', outline: 'none', resize: 'vertical', lineHeight: 1.6 }} />
        </div>
      </div>

      {err && <div style={{ fontFamily: 'DM Mono', fontSize: '9px', color: WARN, marginTop: '10px' }}>⚠ {err}</div>}

      <button className="pressable" onClick={publish} disabled={!canList}
        style={{ marginTop: '16px', width: '100%', background: BONE, border: 'none', borderRadius: '10px', padding: '14px', color: VOID, fontWeight: 600, fontSize: '13px', cursor: canList ? 'pointer' : 'default', fontFamily: 'DM Sans', opacity: canList ? 1 : .5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        {busy
          ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> PUTTING IT UP…</>
          : `PUT IT ON THE WALL${priceOk ? ` · ${priceLabel(Math.round(priceNum * 100))}` : ''}`}
      </button>
      <div style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.1em', textAlign: 'center', marginTop: '10px', textTransform: 'uppercase' }}>
        {KINDS[kind].cta} · native checkout comes next
      </div>
    </div>
  )
}

/* ---------- shared composer pieces ---------- */
function ComposerTop({ onBack, onClose, busy }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <button onClick={onBack} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'transparent', border: 'none', color: BONE_LOW, fontFamily: 'DM Mono', fontSize: '9px', letterSpacing: '.18em', textTransform: 'uppercase', cursor: 'pointer', padding: 0 }}>
        <ArrowLeft size={12} /> create
      </button>
      <button onClick={onClose} disabled={busy} aria-label="Close" style={{ background: 'transparent', border: 'none', color: BONE_LOW, cursor: 'pointer', padding: '4px', display: 'inline-flex', opacity: busy ? .4 : 1 }}><X size={16} /></button>
    </div>
  )
}

function Thumbs({ files, busy, onRemove }) {
  if (!files.length) return null
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
      {files.map((f, i) => (
        <div key={f.preview} style={{ position: 'relative' }}>
          <img src={f.preview} alt="" style={{ width: '72px', height: '72px', borderRadius: '10px', objectFit: 'cover', border: `1px solid ${HAIR_HI}`, display: 'block' }} />
          <button onClick={() => onRemove(i)} disabled={busy} aria-label="Remove image" style={{ position: 'absolute', top: '-6px', right: '-6px', width: '19px', height: '19px', borderRadius: '50%', background: VOID, border: `1px solid ${HAIR_HI}`, color: WARN, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><X size={10} /></button>
        </div>
      ))}
    </div>
  )
}

function AddImages({ busy, dragOver, onPick, hint }) {
  return (
    <button className="pressable" onClick={onPick} disabled={busy}
      style={{ width: '100%', background: dragOver ? 'rgba(199,201,209,.07)' : 'transparent', border: `1px dashed ${dragOver ? SILVER : HAIR_HI}`, borderRadius: '12px', padding: '16px 13px', color: BONE_MID, fontSize: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', fontFamily: 'DM Sans', opacity: busy ? .6 : 1 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><ImagePlus size={14} /> Add images</span>
      <span style={{ fontFamily: 'DM Mono', fontSize: '8px', color: BONE_LOW, letterSpacing: '.1em' }}>{hint || 'tap · drag it in · or just paste'}</span>
    </button>
  )
}
